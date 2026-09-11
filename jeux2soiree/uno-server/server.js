const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 10000;

const MAX_PLAYERS = 10;
const DEFAULT_HAND_SIZE = 7;
const MIN_HAND_SIZE = 1;
const MAX_HAND_SIZE = 20;

const COLORS = [
  "red",
  "yellow",
  "green",
  "blue"
];

const MAX_LOGS = 100;

/*
 * Heartbeat WebSocket serveur.
 * Toutes les 20 secondes, le serveur vérifie
 * que les connexions sont toujours vivantes.
 */
const HEARTBEAT_INTERVAL = 20000;


const server = http.createServer(
  (req,res)=>{

    res.writeHead(
      200,
      {
        "Content-Type":
          "text/plain; charset=utf-8"
      }
    );

    res.end(
      "Serveur UNO Jeux2Soirée opérationnel."
    );

  }
);


const wss =
  new WebSocket.Server({
    server
  });


const rooms =
  new Map();


/* =========================================================
   OUTILS
   ========================================================= */

function makeId(){

  return crypto
    .randomBytes(8)
    .toString("hex");

}


function makeRoomCode(){

  let code;

  do{

    code=
      crypto
        .randomBytes(3)
        .toString("hex")
        .slice(0,4)
        .toUpperCase();

  }while(
    rooms.has(code)
  );

  return code;

}


function shuffle(deck){

  for(
    let i=deck.length-1;
    i>0;
    i--
  ){

    const j=
      crypto.randomInt(i+1);

    [
      deck[i],
      deck[j]
    ]=[
      deck[j],
      deck[i]
    ];

  }

  return deck;

}


/* =========================================================
   PAQUET UNO
   ========================================================= */

function createDeck(){

  const deck=[];


  for(
    const color of COLORS
  ){

    deck.push({
      id:makeId(),
      color,
      type:"number",
      value:0
    });


    for(
      let value=1;
      value<=9;
      value++
    ){

      deck.push({
        id:makeId(),
        color,
        type:"number",
        value
      });

      deck.push({
        id:makeId(),
        color,
        type:"number",
        value
      });

    }


    for(
      let i=0;
      i<2;
      i++
    ){

      deck.push({
        id:makeId(),
        color,
        type:"skip"
      });

      deck.push({
        id:makeId(),
        color,
        type:"reverse"
      });

      deck.push({
        id:makeId(),
        color,
        type:"draw2"
      });

    }

  }


  for(
    let i=0;
    i<4;
    i++
  ){

    deck.push({
      id:makeId(),
      color:null,
      type:"wild"
    });

    deck.push({
      id:makeId(),
      color:null,
      type:"wild4"
    });

  }


  return deck;

}


/* =========================================================
   COMMUNICATION
   ========================================================= */

function send(socket,data){

  if(
    socket &&
    socket.readyState===
    WebSocket.OPEN
  ){

    socket.send(
      JSON.stringify(data)
    );

  }

}


function broadcast(room,data){

  for(
    const player of room.players
  ){

    send(
      player.socket,
      data
    );

  }


  const hostIsPlayer=
    room.players.some(
      player=>
        player.socket===
        room.host
    );


  if(!hostIsPlayer){

    send(
      room.host,
      data
    );

  }

}


/* =========================================================
   LOGS
   ========================================================= */

function addLog(room,text){

  room.logs.push({

    time:
      new Date().toLocaleTimeString(
        "fr-FR",
        {
          hour:"2-digit",
          minute:"2-digit"
        }
      ),

    text

  });


  if(
    room.logs.length>
    MAX_LOGS
  ){

    room.logs.shift();

  }

}


/* =========================================================
   JOUEURS
   ========================================================= */

function currentPlayer(room){

  return room.players.find(
    player=>
      player.id===
      room.currentPlayerId
  )||null;

}


function getNextPlayer(
  room,
  steps=1
){

  if(
    !room.players.length
  ){

    return null;

  }


  const currentIndex=
    room.players.findIndex(
      player=>
        player.id===
        room.currentPlayerId
    );


  if(currentIndex<0){

    return room.players[0];

  }


  const index=
    (
      currentIndex+
      room.direction*
      steps+
      room.players.length*
      1000
    )%
    room.players.length;


  return room.players[index];

}


function nextPlayer(
  room,
  steps=1
){

  const next=
    getNextPlayer(
      room,
      steps
    );


  room.currentPlayerId=
    next
      ?next.id
      :null;

}


/* =========================================================
   PIOCHE
   ========================================================= */

function refillDeck(room){

  if(
    room.discard.length<=1
  ){

    return;

  }


  const top=
    room.discard.pop();


  const recycled=
    room.discard.splice(0);


  room.deck=
    shuffle(
      recycled
    );


  room.discard.push(
    top
  );

}


function drawOne(room){

  if(
    !room.deck.length
  ){

    refillDeck(room);

  }


  return room.deck.pop()||null;

}


function drawCards(
  room,
  player,
  amount
){

  let count=0;


  for(
    let i=0;
    i<amount;
    i++
  ){

    const card=
      drawOne(room);


    if(!card)
      break;


    player.hand.push(
      card
    );

    count++;

  }


  return count;

}


/* =========================================================
   RÈGLES
   ========================================================= */

function canPlayWild4(
  room,
  player
){

  return !player.hand.some(
    card=>
      card.color===
      room.currentColor
  );

}


function basePlayable(
  room,
  player,
  card
){

  const top=
    room.discard[
      room.discard.length-1
    ];


  if(!top)
    return true;


  if(card.type==="wild")
    return true;


  if(
    card.type==="wild4"
  ){

    return canPlayWild4(
      room,
      player
    );

  }


  if(
    card.color===
    room.currentColor
  ){

    return true;

  }


  if(
    card.type==="number" &&
    top.type==="number" &&
    card.value===
    top.value
  ){

    return true;

  }


  if(
    card.type!=="number" &&
    card.type===
    top.type
  ){

    return true;

  }


  return false;

}


function isPlayable(
  room,
  player,
  card
){

  /*
   * Même lorsqu'une pénalité est active,
   * une carte normalement jouable peut
   * servir de défense.
   */

  return basePlayable(
    room,
    player,
    card
  );

}


/* =========================================================
   POINTS
   ========================================================= */

function cardPoints(card){

  if(
    card.type==="number"
  ){

    return card.value;

  }


  if(
    [
      "skip",
      "reverse",
      "draw2"
    ].includes(card.type)
  ){

    return 20;

  }


  return 50;

}


function cardLabel(card){

  if(
    card.type==="number"
  ){

    return String(
      card.value
    );

  }


  return {

    skip:"PASS",

    reverse:"REVERSE",

    draw2:"+2",

    wild:"CHANGEMENT DE COULEUR",

    wild4:"+4"

  }[
    card.type
  ]||card.type;

}


/* =========================================================
   ÉTAT PUBLIC
   ========================================================= */

function publicState(
  room,
  viewerId
){

  const viewer=
    room.players.find(
      player=>
        player.id===
        viewerId
    )||null;


  const current=
    currentPlayer(room);


  return {

    mode:
      room.mode,

    status:
      room.status,


    players:
      room.players.map(
        player=>({

          id:
            player.id,

          name:
            player.name,

          cardCount:
            player.hand.length,

          score:
            player.score,

          host:
            player.socket===
            room.host

        })
      ),


    discard:
      room.discard[
        room.discard.length-1
      ]||null,


    deckCount:
      room.deck.length,


    currentPlayer:
      current
        ?current.id
        :null,


    currentPlayerName:
      current
        ?current.name
        :null,


    currentColor:
      room.currentColor,


    direction:
      room.direction,


    pendingDraw:
      room.pendingDraw,


    settings:
      room.settings,


    logs:
      room.logs,


    winner:
      room.winner,


    unoChallenge:
      room.unoChallenge
        ?{

          targetId:
            room.unoChallenge.targetId,

          targetName:
            room.unoChallenge.targetName

        }
        :null,


    penaltyDecision:
      room.penaltyDecision
        ?{

          targetId:
            room.penaltyDecision.targetId,

          targetName:
            room.penaltyDecision.targetName,

          amount:
            room.penaltyDecision.amount

        }
        :null,


    me:
      viewer
        ?{

          id:
            viewer.id,

          name:
            viewer.name,

          hand:
            viewer.hand,

          hasDrawn:
            viewer.hasDrawn,

          drawnCardId:
            viewer.drawnCardId

        }
        :null,


    canPlayWild4:
      viewer
        ?canPlayWild4(
          room,
          viewer
        )
        :false,


    isHost:
      viewer
        ?viewer.socket===
          room.host
        :true

  };

}


function sendState(room){

  for(
    const player of room.players
  ){

    send(
      player.socket,
      {
        type:"state",
        state:
          publicState(
            room,
            player.id
          )
      }
    );

  }


  const hostIsPlayer=
    room.players.some(
      player=>
        player.socket===
        room.host
    );


  if(!hostIsPlayer){

    send(
      room.host,
      {
        type:"state",
        state:
          publicState(
            room,
            null
          )
      }
    );

  }

}


/* =========================================================
   CRÉATION SALON
   ========================================================= */

function makeRoom(
  hostSocket,
  mode,
  hostName,
  stacking,
  handSize
){

  const safeHandSize=
    Math.max(
      MIN_HAND_SIZE,
      Math.min(
        MAX_HAND_SIZE,
        Number(handSize)||
        DEFAULT_HAND_SIZE
      )
    );


  const room={

    room:
      makeRoomCode(),

    host:
      hostSocket,

    mode:
      mode==="phones"
        ?"phones"
        :"tv",

    players:[],

    deck:[],

    discard:[],

    currentPlayerId:null,

    direction:1,

    currentColor:null,

    pendingDraw:0,

    status:"waiting",

    winner:null,

    logs:[],

    unoChallenge:null,

    penaltyDecision:null,

    settings:{

      stacking:
        !!stacking,

      handSize:
        safeHandSize

    }

  };


  rooms.set(
    room.room,
    room
  );


  /*
   * En mode téléphone uniquement,
   * le créateur joue également.
   */

  if(
    room.mode==="phones"
  ){

    const player={

      id:
        makeId(),

      name:
        String(
          hostName||
          "Créateur"
        )
        .trim()
        .slice(
          0,
          18
        )||
        "Créateur",

      socket:
        hostSocket,

      hand:[],

      score:0,

      hasDrawn:false,

      drawnCardId:null

    };


    room.players.push(
      player
    );


    hostSocket.playerId=
      player.id;

  }


  addLog(
    room,
    "🏠 Salon créé."
  );


  addLog(
    room,
    `⚙️ ${safeHandSize} carte(s) au départ par joueur.`
  );


  addLog(
    room,
    room.settings.stacking
      ?"➕ Empilement des +2 activé."
      :"➖ Empilement des +2 désactivé."
  );


  return room;

}


/* =========================================================
   DÉMARRAGE
   ========================================================= */

function startGame(room){

  if(
    room.players.length<2
  ){

    send(
      room.host,
      {
        type:"error",
        message:
          "Il faut au moins 2 joueurs."
      }
    );

    return;

  }


  const needed=
    room.players.length*
    room.settings.handSize+
    1;


  if(
    needed>108
  ){

    send(
      room.host,
      {
        type:"error",
        message:
          `Impossible : ${room.settings.handSize} cartes × ${room.players.length} joueurs dépassent le paquet de 108 cartes.`
      }
    );

    return;

  }


  room.deck=
    shuffle(
      createDeck()
    );


  room.discard=[];

  room.pendingDraw=0;

  room.direction=1;

  room.currentPlayerId=null;

  room.currentColor=null;

  room.winner=null;

  room.status="playing";

  room.unoChallenge=null;

  room.penaltyDecision=null;


  for(
    const player of room.players
  ){

    player.hand=[];

    player.hasDrawn=false;

    player.drawnCardId=null;

  }


  /*
   * Distribution.
   */

  for(
    let round=0;
    round<
    room.settings.handSize;
    round++
  ){

    for(
      const player of room.players
    ){

      const card=
        drawOne(room);


      if(card){

        player.hand.push(
          card
        );

      }

    }

  }


  /*
   * Première carte numérique.
   */

  let first=null;

  const rejected=[];


  while(
    room.deck.length
  ){

    const card=
      drawOne(room);


    if(!card)
      break;


    if(
      card.type==="number"
    ){

      first=card;

      break;

    }


    rejected.push(
      card
    );

  }


  for(
    const card of rejected
  ){

    room.deck.push(
      card
    );

  }


  shuffle(
    room.deck
  );


  if(!first){

    first=
      drawOne(room);

  }


  if(first){

    room.discard.push(
      first
    );

    room.currentColor=
      first.color;

  }


  /*
   * Joueur de départ aléatoire.
   */

  const starter=
    room.players[
      crypto.randomInt(
        room.players.length
      )
    ];


  room.currentPlayerId=
    starter.id;


  addLog(
    room,
    `🎲 ${starter.name} commence la partie (tirage aléatoire).`
  );


  addLog(
    room,
    `🃏 ${room.settings.handSize} carte(s) distribuée(s) à chaque joueur.`
  );


  sendState(room);

}


/* =========================================================
   FLAGS
   ========================================================= */

function resetPlayerTurnFlags(
  player
){

  player.hasDrawn=false;

  player.drawnCardId=null;

}


/* =========================================================
   FIN CARTE
   ========================================================= */

function advanceAfterCard(
  room,
  card
){

  if(
    card.type==="skip"
  ){

    nextPlayer(
      room,
      2
    );

    addLog(
      room,
      "⛔ Le tour est passé."
    );

    return;

  }


  if(
    card.type==="reverse"
  ){

    if(
      room.players.length===2
    ){

      nextPlayer(
        room,
        2
      );

      addLog(
        room,
        "↔ Reverse à 2 joueurs : le joueur suivant est passé."
      );

    }else{

      room.direction*=-1;

      nextPlayer(
        room,
        1
      );

      addLog(
        room,
        "↔ Sens de jeu inversé."
      );

    }

    return;

  }


  if(
    card.type==="draw2"
  ){

    /*
     * La pénalité reste en attente.
     * Le joueur suivant peut défendre
     * ou la prendre.
     */

    room.pendingDraw=
      room.settings.stacking
        ?room.pendingDraw+2
        :2;


    nextPlayer(
      room,
      1
    );


    addLog(
      room,
      `⚠️ +${room.pendingDraw} en attente : le joueur suivant peut répondre ou piocher.`
    );


    return;

  }


  if(
    card.type==="wild4"
  ){

    room.pendingDraw=4;

    nextPlayer(
      room,
      1
    );


    addLog(
      room,
      "⚠️ +4 en attente : le joueur suivant peut répondre ou piocher."
    );


    return;

  }


  nextPlayer(
    room,
    1
  );

}


/* =========================================================
   FIN DE MANCHE
   ========================================================= */

function finishRound(
  room,
  winner
){

  let points=0;


  for(
    const player of room.players
  ){

    if(
      player.id===
      winner.id
    )continue;


    for(
      const card of player.hand
    ){

      points+=
        cardPoints(card);

    }

  }


  winner.score+=points;

  winner.roundWins=
    (winner.roundWins||0)+1;


  room.winner=
    winner.id;


  room.status=
    "finished";


  room.currentPlayerId=
    null;


  room.pendingDraw=
    0;


  room.penaltyDecision=
    null;


  room.unoChallenge=
    null;


  addLog(
    room,
    `🏆 ${winner.name} remporte la manche et gagne ${points} point(s).`
  );


  broadcast(
    room,
    {
      type:"round_end",

      winner:
        winner.name,

      points,

      score:
        winner.score,

      roundWins:
        winner.roundWins

    }
  );


  sendState(room);

}


/* =========================================================
   UNO
   ========================================================= */

function beginUnoChallenge(
  room,
  player
){

  room.unoChallenge={

    targetId:
      player.id,

    targetName:
      player.name,

    resolved:false

  };


  addLog(
    room,
    `🚨 ${player.name} n'a plus qu'une carte ! Premier à buzzer : arbitre le UNO.`
  );


  sendState(room);

}


function resolveUnoChallenge(
  room,
  claimedById
){

  const challenge=
    room.unoChallenge;


  if(
    !challenge ||
    challenge.resolved
  ){

    return;

  }


  challenge.resolved=true;


  const target=
    room.players.find(
      player=>
        player.id===
        challenge.targetId
    );


  const claimedBy=
    room.players.find(
      player=>
        player.id===
        claimedById
    );


  if(!target){

    room.unoChallenge=null;

    sendState(room);

    return;

  }


  if(
    claimedBy &&
    claimedBy.id===
    target.id
  ){

    addLog(
      room,
      `📣 ${target.name} a buzzé UNO en premier : aucun malus.`
    );

  }else{

    const amount=2;

    const drawn=
      drawCards(
        room,
        target,
        amount
      );


    addLog(
      room,
      `🚨 ${
        claimedBy
          ?claimedBy.name
          :"Un joueur"
      } a buzzé en premier : ${target.name} pioche ${drawn} carte(s).`
    );

  }


  room.unoChallenge=null;


  nextPlayer(
    room,
    1
  );


  sendState(room);

}


/* =========================================================
   JOUER UNE CARTE
   ========================================================= */

function playCard(
  room,
  player,
  index,
  chosenColor
){

  if(
    room.status!=="playing"
  )return;


  if(
    room.unoChallenge
  ){

    send(
      player.socket,
      {
        type:"error",
        message:
          "Buzzez d'abord !"
      }
    );

    return;

  }


  const current=
    currentPlayer(room);


  if(
    !current ||
    current.id!==player.id
  ){

    send(
      player.socket,
      {
        type:"error",
        message:
          "Ce n'est pas ton tour."
      }
    );

    return;

  }


  if(
    room.penaltyDecision &&
    room.penaltyDecision.targetId
      !==player.id
  ){

    send(
      player.socket,
      {
        type:"error",
        message:
          "Le joueur visé doit d'abord décider."
      }
    );

    return;

  }


  if(
    !Number.isInteger(index) ||
    index<0 ||
    index>=player.hand.length
  ){

    return;

  }


  const card=
    player.hand[index];


  /*
   * Après une pioche normale,
   * seule la carte piochée peut être jouée.
   */

  if(
    player.hasDrawn &&
    player.drawnCardId &&
    card.id!==player.drawnCardId
  ){

    send(
      player.socket,
      {
        type:"error",
        message:
          "Après une pioche normale, tu peux seulement jouer la carte que tu viens de piocher."
      }
    );

    return;

  }


  if(
    !isPlayable(
      room,
      player,
      card
    )
  ){

    send(
      player.socket,
      {
        type:"error",
        message:
          "Cette carte ne peut pas être jouée ici."
      }
    );

    return;

  }


  if(
    (
      card.type==="wild" ||
      card.type==="wild4"
    ) &&
    !COLORS.includes(
      chosenColor
    )
  ){

    send(
      player.socket,
      {
        type:"color_required",
        cardIndex:index
      }
    );

    return;

  }


  const wasPenalty=
    room.pendingDraw>0;


  const previousPenalty=
    room.pendingDraw;


  /*
   * Une carte jouée pour défendre
   * annule la pénalité.
   */

  room.pendingDraw=0;

  room.penaltyDecision=null;


  player.hand.splice(
    index,
    1
  );


  resetPlayerTurnFlags(
    player
  );


  room.discard.push(
    card
  );


  if(
    card.type==="wild" ||
    card.type==="wild4"
  ){

    room.currentColor=
      chosenColor;

  }else{

    room.currentColor=
      card.color;

  }


  addLog(
    room,
    `🃏 ${player.name} joue ${cardLabel(card)}${
      chosenColor
        ?` → ${chosenColor.toUpperCase()}`
        :""
    }.`
  );


  if(wasPenalty){

    addLog(
      room,
      `🛡️ ${player.name} répond à la pénalité de +${previousPenalty} au lieu de la prendre.`
    );

  }


  if(
    player.hand.length===0
  ){

    finishRound(
      room,
      player
    );

    return;

  }


  if(
    player.hand.length===1
  ){

    beginUnoChallenge(
      room,
      player
    );

    return;

  }


  advanceAfterCard(
    room,
    card
  );


  sendState(room);

}


/* =========================================================
   PIOCHE NORMALE
   ========================================================= */

function drawNormal(
  room,
  player
){

  const card=
    drawOne(room);


  if(!card){

    nextPlayer(
      room,
      1
    );

    sendState(room);

    return;

  }


  player.hand.push(
    card
  );


  player.hasDrawn=true;

  player.drawnCardId=
    card.id;


  addLog(
    room,
    `🃏 ${player.name} pioche une carte.`
  );


  if(
    !basePlayable(
      room,
      player,
      card
    )
  ){

    resetPlayerTurnFlags(
      player
    );


    addLog(
      room,
      `➡️ La carte piochée n'est pas jouable : le tour de ${player.name} est terminé.`
    );


    nextPlayer(
      room,
      1
    );

  }else{

    addLog(
      room,
      `✨ ${player.name} peut jouer la carte piochée.`
    );

  }


  sendState(room);

}


/* =========================================================
   PIOCHE PÉNALITÉ
   ========================================================= */

function drawPenalty(
  room,
  player
){

  const amount=
    room.pendingDraw;


  if(!amount)
    return;


  const drawn=
    drawCards(
      room,
      player,
      amount
    );


  room.pendingDraw=0;

  room.penaltyDecision=null;


  resetPlayerTurnFlags(
    player
  );


  addLog(
    room,
    `⚠️ ${player.name} prend la pénalité de +${amount} et pioche ${drawn} carte(s).`
  );


  nextPlayer(
    room,
    1
  );


  sendState(room);

}


/* =========================================================
   ACTION PIOCHER
   ========================================================= */

function drawCard(
  room,
  player
){

  if(
    room.status!=="playing"
  )return;


  if(
    room.unoChallenge
  ){

    send(
      player.socket,
      {
        type:"error",
        message:
          "Buzzez d'abord !"
      }
    );

    return;

  }


  const current=
    currentPlayer(room);


  if(
    !current ||
    current.id!==player.id
  ){

    send(
      player.socket,
      {
        type:"error",
        message:
          "Ce n'est pas ton tour."
      }
    );

    return;

  }


  if(
    room.penaltyDecision &&
    room.penaltyDecision.targetId
      !==player.id
  ){

    send(
      player.socket,
      {
        type:"error",
        message:
          "Le joueur visé doit d'abord décider."
      }
    );

    return;

  }


  if(
    player.hasDrawn
  ){

    send(
      player.socket,
      {
        type:"error",
        message:
          "Tu as déjà pioché."
      }
    );

    return;

  }


  /*
   * Une pénalité existe :
   * on ouvre la décision défendre /
   * prendre la pénalité.
   */

  if(
    room.pendingDraw>0
  ){

    room.penaltyDecision={

      targetId:
        player.id,

      targetName:
        player.name,

      amount:
        room.pendingDraw

    };


    addLog(
      room,
      `⚖️ ${player.name} doit choisir : défendre ou prendre +${room.pendingDraw}.`
    );


    sendState(room);

    return;

  }


  drawNormal(
    room,
    player
  );

}


/* =========================================================
   UNO CHALLENGE
   ========================================================= */

function challengeUno(
  room,
  player
){

  if(
    !room.unoChallenge
  )return;


  resolveUnoChallenge(
    room,
    player.id
  );

}


/* =========================================================
   NOUVELLE MANCHE
   ========================================================= */

function resetRound(room){

  room.status=
    "waiting";

  room.deck=[];

  room.discard=[];

  room.currentPlayerId=
    null;

  room.currentColor=
    null;

  room.direction=
    1;

  room.pendingDraw=
    0;

  room.unoChallenge=
    null;

  room.penaltyDecision=
    null;

  room.winner=
    null;


  for(
    const player of room.players
  ){

    resetPlayerTurnFlags(
      player
    );

  }


  addLog(
    room,
    "🔄 Nouvelle manche prête."
  );


  sendState(room);

}


/* =========================================================
   CONNEXIONS WEBSOCKET
   ========================================================= */

wss.on(
  "connection",
  socket=>{

    /*
     * État du heartbeat protocole WebSocket.
     */

    socket.isAlive=true;

    socket.room=null;

    socket.playerId=null;


    /*
     * Quand le navigateur répond au ping
     * WebSocket du serveur.
     */

    socket.on(
      "pong",
      ()=>{

        socket.isAlive=true;

      }
    );


    socket.on(
      "message",
      raw=>{

        let data;


        try{

          data=
            JSON.parse(
              raw.toString()
            );

        }catch{

          return;

        }


        /*
         * =================================================
         * HEARTBEAT APPLICATION
         * =================================================
         *
         * Le frontend envoie :
         * { "type":"ping" }
         *
         * Le serveur répond :
         * { "type":"pong" }
         */

        if(
          data.type==="ping"
        ){

          send(
            socket,
            {
              type:"pong"
            }
          );

          return;

        }


        /* =================================================
           CRÉER SALON
           ================================================= */

        if(
          data.type==="create_room"
        ){

          const room=
            makeRoom(
              socket,
              data.mode,
              data.name,
              data.stacking,
              data.handSize
            );


          socket.room=
            room.room;


          send(
            socket,
            {
              type:"room_created",

              room:
                room.room,

              playerId:
                socket.playerId||
                null,

              mode:
                room.mode

            }
          );


          sendState(room);

          return;

        }


        /* =================================================
           REJOINDRE SALON
           ================================================= */

        if(
          data.type==="join_room"
        ){

          const code=
            String(
              data.room||""
            )
            .trim()
            .toUpperCase();


          const room=
            rooms.get(code);


          if(!room){

            send(
              socket,
              {
                type:"error",
                message:
                  "Salon introuvable."
              }
            );

            return;

          }


          if(
            room.status!=="waiting"
          ){

            send(
              socket,
              {
                type:"error",
                message:
                  "La partie a déjà commencé."
              }
            );

            return;

          }


          if(
            room.players.length>=
            MAX_PLAYERS
          ){

            send(
              socket,
              {
                type:"error",
                message:
                  "Salon complet."
              }
            );

            return;

          }


          const name=
            String(
              data.name||
              "Joueur"
            )
            .trim()
            .slice(
              0,
              18
            )||
            "Joueur";


          const player={

            id:
              makeId(),

            name,

            socket,

            hand:[],

            score:0,

            roundWins:0,

            hasDrawn:false,

            drawnCardId:null

          };


          room.players.push(
            player
          );


          socket.room=
            room.room;

          socket.playerId=
            player.id;


          addLog(
            room,
            `👋 ${player.name} rejoint le salon.`
          );


          send(
            socket,
            {
              type:"joined",

              room:
                room.room,

              playerId:
                player.id,

              mode:
                room.mode

            }
          );


          sendState(room);

          return;

        }


        /* =================================================
           SALON DU SOCKET
           ================================================= */

        const room=
          rooms.get(
            socket.room
          );


        if(!room)
          return;


        const player=
          room.players.find(
            p=>
              p.id===
              socket.playerId
          );


        /* =================================================
           START
           ================================================= */

        if(
          data.type==="start_game"
        ){

          if(
            socket===
            room.host
          ){

            startGame(room);

          }

          return;

        }


        /* =================================================
           JOUER CARTE
           ================================================= */

        if(
          data.type==="play_card"
        ){

          if(player){

            playCard(
              room,
              player,
              Number(data.index),
              data.color
            );

          }

          return;

        }


        /* =================================================
           PIOCHER
           ================================================= */

        if(
          data.type==="draw"
        ){

          if(player){

            drawCard(
              room,
              player
            );

          }

          return;

        }


        /* =================================================
           UNO
           ================================================= */

        if(
          data.type==="uno_challenge"
        ){

          if(player){

            challengeUno(
              room,
              player
            );

          }

          return;

        }


        /* =================================================
           PRENDRE PÉNALITÉ
           ================================================= */

        if(
          data.type==="penalty_draw"
        ){

          if(
            player &&
            room.penaltyDecision?.targetId===
            player.id
          ){

            drawPenalty(
              room,
              player
            );

          }

          return;

        }


        /* =================================================
           ANNULER DÉCISION PÉNALITÉ
           ================================================= */

        if(
          data.type==="penalty_cancel"
        ){

          if(
            player &&
            room.penaltyDecision?.targetId===
            player.id
          ){

            room.penaltyDecision=null;


            addLog(
              room,
              `🛡️ ${player.name} choisit de jouer une carte pour répondre à la pénalité.`
            );


            sendState(room);

          }

          return;

        }


        /* =================================================
           NOUVELLE MANCHE
           ================================================= */

        if(
          data.type==="new_game"
        ){

          if(
            socket===
            room.host
          ){

            resetRound(room);

          }

          return;

        }

      }
    );


    /* =====================================================
       FERMETURE SOCKET
       ===================================================== */

    socket.on(
      "close",
      ()=>{

        const room=
          rooms.get(
            socket.room
          );


        if(!room)
          return;


        const index=
          room.players.findIndex(
            player=>
              player.socket===
              socket
          );


        if(index!==-1){

          const leaving=
            room.players[index];


          const wasCurrent=
            leaving.id===
            room.currentPlayerId;


          room.players.splice(
            index,
            1
          );


          addLog(
            room,
            `🚪 ${leaving.name} quitte le salon.`
          );


          if(
            room.unoChallenge?.targetId===
            leaving.id
          ){

            room.unoChallenge=null;

          }


          if(
            room.penaltyDecision?.targetId===
            leaving.id
          ){

            room.penaltyDecision=null;

          }


          /*
           * Si le créateur part.
           */

          if(
            socket===
            room.host
          ){

            if(
              room.mode==="phones" &&
              room.players.length
            ){

              room.host=
                room.players[0].socket;


              addLog(
                room,
                `👑 ${room.players[0].name} devient créateur.`
              );

            }else if(
              room.mode==="tv"
            ){

              rooms.delete(
                room.room
              );

              return;

            }else if(
              !room.players.length
            ){

              rooms.delete(
                room.room
              );

              return;

            }

          }


          if(
            !room.players.length
          ){

            rooms.delete(
              room.room
            );

            return;

          }


          /*
           * Si le joueur qui part était
           * celui dont c'était le tour.
           */

          if(
            wasCurrent &&
            room.status==="playing"
          ){

            const nextIndex=
              Math.min(
                index,
                room.players.length-1
              );


            room.currentPlayerId=
              room.players[
                nextIndex
              ].id;


            addLog(
              room,
              `➡️ Le tour passe à ${
                currentPlayer(room).name
              }.`
            );

          }


          sendState(room);

        }else if(
          socket===
          room.host &&
          room.mode==="tv"
        ){

          rooms.delete(
            room.room
          );

        }

      }
    );

  }
);


/* =========================================================
   HEARTBEAT SERVEUR
   =========================================================

   Toutes les 20 secondes :
   - si la connexion n'a pas répondu au ping précédent,
     elle est considérée comme morte ;
   - sinon, on lui envoie un nouveau ping.
*/

const heartbeatInterval=
  setInterval(
    ()=>{

      wss.clients.forEach(
        socket=>{

          if(
            socket.isAlive===false
          ){

            console.warn(
              "💀 Connexion WebSocket morte supprimée."
            );

            return socket.terminate();

          }


          socket.isAlive=false;

          socket.ping();

        }
      );

    },
    HEARTBEAT_INTERVAL
  );


/*
 * Évite que le timer du heartbeat
 * empêche Node.js de s'arrêter proprement.
 */

heartbeatInterval.unref();


/* =========================================================
   SERVEUR HTTP
   ========================================================= */

server.listen(
  PORT,
  ()=>{

    console.log(
      `UNO server lancé sur le port ${PORT}`
    );

    console.log(
      `💓 Heartbeat serveur : toutes les ${HEARTBEAT_INTERVAL/1000}s`
    );

  }
);
