const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");


const PORT =
  process.env.PORT || 10000;


const server =
  http.createServer((req,res) => {

    res.writeHead(200,{
      "Content-Type":"text/plain; charset=utf-8"
    });

    res.end(
      "UNO Jeux2Soirée server OK"
    );

  });


const wss =
  new WebSocket.Server({
    server
  });


const rooms =
  new Map();


const MAX_PLAYERS = 10;


const COLORS = [
  "red",
  "yellow",
  "green",
  "blue"
];


function send(socket,data){

  if(
    socket &&
    socket.readyState === WebSocket.OPEN
  ){

    socket.send(
      JSON.stringify(data)
    );

  }

}


function broadcast(room,data){

  room.players.forEach(
    p => send(p.socket,data)
  );

  if(room.mode === "tv"){
    send(room.host,data);
  }

}


function randomRoomCode(){

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code;

  do{

    code = "";

    for(let i=0;i<4;i++){

      code +=
        chars[
          crypto.randomInt(chars.length)
        ];

    }

  }while(rooms.has(code));

  return code;

}


function shuffle(array){

  const result =
    [...array];


  for(
    let i=result.length-1;
    i>0;
    i--
  ){

    const j =
      crypto.randomInt(i+1);

    [
      result[i],
      result[j]
    ] = [
      result[j],
      result[i]
    ];

  }


  return result;

}


function createDeck(){

  const deck = [];


  for(const color of COLORS){

    deck.push({
      color,
      type:"number",
      value:0
    });


    for(let n=1;n<=9;n++){

      deck.push({
        color,
        type:"number",
        value:n
      });

      deck.push({
        color,
        type:"number",
        value:n
      });

    }


    for(let i=0;i<2;i++){

      deck.push({
        color,
        type:"skip"
      });

      deck.push({
        color,
        type:"reverse"
      });

      deck.push({
        color,
        type:"draw2"
      });

    }

  }


  for(let i=0;i<4;i++){

    deck.push({
      color:null,
      type:"wild"
    });

    deck.push({
      color:null,
      type:"wild4"
    });

  }


  return deck;

}


function makePlayer(socket,name){

  return {

    id:
      crypto.randomUUID(),

    socket,

    name:
      String(name || "Joueur")
        .trim()
        .slice(0,18),

    hand:[],

    hasDrawn:false,

    uno:false,

    score:0

  };

}


function createRoom(
  socket,
  mode,
  name,
  stacking
){

  const roomCode =
    randomRoomCode();


  const room = {

    room:roomCode,

    mode,

    host:socket,

    players:[],

    status:"waiting",

    deck:[],

    discard:[],

    currentPlayer:null,

    currentColor:null,

    direction:1,

    pendingDraw:0,

    winner:null,

    settings:{
      stacking:Boolean(stacking)
    }

  };


  /*
    MODE TELEPHONES :
    le créateur est lui-même
    un joueur de la partie.
  */

  if(mode === "phones"){

    const player =
      makePlayer(
        socket,
        name
      );

    room.players.push(player);

    socket.playerId =
      player.id;

  }


  socket.room =
    roomCode;


  rooms.set(
    roomCode,
    room
  );


  return room;

}


function currentPlayer(room){

  if(!room.currentPlayer){
    return null;
  }

  return room.players.find(
    p => p.id === room.currentPlayer
  ) || null;

}


function nextPlayerId(
  room,
  steps=1
){

  if(!room.players.length){
    return null;
  }


  const currentIndex =
    room.players.findIndex(
      p => p.id === room.currentPlayer
    );


  let index =
    currentIndex;


  for(let i=0;i<steps;i++){

    index =
      (
        index +
        room.direction +
        room.players.length
      ) %
      room.players.length;

  }


  return room.players[index].id;

}


function advance(
  room,
  steps=1
){

  room.currentPlayer =
    nextPlayerId(
      room,
      steps
    );


  room.players.forEach(
    p => {
      p.hasDrawn = false;
    }
  );

}


function getNextPlayer(room){

  const id =
    nextPlayerId(room,1);

  return room.players.find(
    p => p.id === id
  ) || null;

}


function refillDeck(room){

  if(room.discard.length <= 1){
    return;
  }


  const top =
    room.discard.pop();


  const recycled =
    room.discard.splice(0);


  room.deck =
    shuffle(recycled);


  room.discard.push(top);

}


function drawOne(room){

  if(!room.deck.length){
    refillDeck(room);
  }

  return room.deck.pop() || null;

}


function drawCards(
  room,
  player,
  amount
){

  for(
    let i=0;
    i<amount;
    i++
  ){

    const card =
      drawOne(room);

    if(card){
      player.hand.push(card);
    }

  }

}


function isPlayable(
  room,
  player,
  card
){

  const top =
    room.discard[
      room.discard.length - 1
    ];


  if(!top){
    return true;
  }


  /*
    Si une pénalité est en cours,
    seul un +2 peut être empilé
    lorsque le mode est activé.
  */

  if(room.pendingDraw > 0){

    if(
      room.settings.stacking &&
      card.type === "draw2"
    ){

      return true;

    }

    return false;

  }


  if(card.type === "wild"){
    return true;
  }


  if(card.type === "wild4"){

    /*
      Le +4 n'est autorisé que si
      le joueur ne possède aucune
      carte de la couleur actuelle.
    */

    return !player.hand.some(
      c =>
        c.color ===
        room.currentColor
    );

  }


  if(
    card.color ===
    room.currentColor
  ){

    return true;

  }


  if(
    card.type !== "number" &&
    card.type === top.type
  ){

    return true;

  }


  if(
    card.type === "number" &&
    top.type === "number" &&
    card.value === top.value
  ){

    return true;

  }


  return false;

}


function publicState(
  room,
  viewerId
){

  const current =
    currentPlayer(room);


  const mePlayer =
    viewerId
      ? room.players.find(
          p => p.id === viewerId
        )
      : null;


  return {

    status:
      room.status,

    mode:
      room.mode,

    settings:
      room.settings,

    players:
      room.players.map(p => ({

        id:p.id,

        name:p.name,

        cardCount:
          p.hand.length,

        host:
          p.socket === room.host,

        score:p.score

      })),

    discard:
      room.discard[
        room.discard.length - 1
      ] || null,

    deckCount:
      room.deck.length,

    currentPlayer:
      current
        ? current.id
        : null,

    currentPlayerName:
      current
        ? current.name
        : null,

    currentColor:
      room.currentColor,

    direction:
      room.direction,

    pendingDraw:
      room.pendingDraw,

    me:
      mePlayer
        ? {

            id:
              mePlayer.id,

            name:
              mePlayer.name,

            hand:
              mePlayer.hand,

            hasDrawn:
              mePlayer.hasDrawn,

            uno:
              mePlayer.uno

          }
        : null

  };

}


function sendState(room){

  /*
    Chaque téléphone reçoit
    uniquement sa propre main.
  */

  room.players.forEach(
    p => {

      send(
        p.socket,
        {
          type:"state",
          state:
            publicState(
              room,
              p.id
            )
        }
      );

    }
  );


  /*
    En mode TV, la TV reçoit
    l'état général mais aucune main.
  */

  if(room.mode === "tv"){

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


function startGame(room){

  if(room.players.length < 2){

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


  /*
    Nouveau paquet totalement mélangé.
  */

  room.deck =
    shuffle(
      createDeck()
    );


  room.discard = [];

  room.pendingDraw = 0;

  room.direction = 1;

  room.winner = null;


  room.players.forEach(
    p => {

      p.hand = [];

      p.hasDrawn = false;

      p.uno = false;

    }
  );


  /*
    Distribution :
    7 cartes par joueur,
    une carte après l'autre.
  */

  for(let i=0;i<7;i++){

    room.players.forEach(
      p => {

        const card =
          drawOne(room);

        if(card){
          p.hand.push(card);
        }

      }
    );

  }


  /*
    Première carte de la défausse.
    On cherche une carte numérique
    afin de commencer simplement.
  */

  let first = null;

  while(room.deck.length){

    const card =
      drawOne(room);

    if(
      card &&
      card.type === "number"
    ){

      first = card;
      break;

    }

    if(card){
      room.deck.unshift(card);
    }

  }


  if(!first){

    send(
      room.host,
      {
        type:"error",
        message:
          "Impossible de préparer le paquet."
      }
    );

    return;

  }


  room.discard.push(first);

  room.currentColor =
    first.color;

  room.currentPlayer =
    room.players[0].id;

  room.status =
    "playing";


  sendState(room);

}


function cardPoints(card){

  if(
    card.type === "number"
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


function endRound(
  room,
  winner
){

  let points = 0;


  room.players.forEach(
    p => {

      if(
        p.id !== winner.id
      ){

        p.hand.forEach(
          card => {

            points +=
              cardPoints(card);

          }
        );

      }

    }
  );


  winner.score +=
    points;


  room.status =
    "finished";


  room.winner =
    winner.id;


  broadcast(
    room,
    {
      type:"round_end",

      winner:
        winner.name,

      winnerId:
        winner.id,

      points,

      score:
        winner.score

    }
  );


  sendState(room);

}


function playCard(
  room,
  player,
  index,
  chosenColor
){

  if(
    room.status !== "playing"
  ){
    return;
  }


  if(
    room.currentPlayer !==
    player.id
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
    !Number.isInteger(index) ||
    index < 0 ||
    index >= player.hand.length
  ){

    return;

  }


  const card =
    player.hand[index];


  /*
    Si une carte vient d'être piochée
    et est jouable, elle peut être jouée.
  */

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
          "Cette carte ne peut pas être jouée."
      }
    );

    return;

  }


  /*
    Les cartes sauvages doivent
    obligatoirement recevoir une couleur.
  */

  if(
    (
      card.type === "wild" ||
      card.type === "wild4"
    ) &&
    !COLORS.includes(chosenColor)
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


  player.hand.splice(
    index,
    1
  );


  room.discard.push(card);


  if(
    card.type === "wild" ||
    card.type === "wild4"
  ){

    room.currentColor =
      chosenColor;

  }
  else{

    room.currentColor =
      card.color;

  }


  player.hasDrawn =
    false;


  /*
    GESTION DES +2
  */

  if(
    room.pendingDraw > 0 &&
    card.type === "draw2" &&
    room.settings.stacking
  ){

    room.pendingDraw += 2;

  }

  else if(
    card.type === "draw2"
  ){

    room.pendingDraw = 2;

  }

  else{

    room.pendingDraw = 0;

  }


  /*
    Le joueur n'a plus de carte :
    victoire immédiate.
  */

  if(
    player.hand.length === 0
  ){

    endRound(
      room,
      player
    );

    return;

  }


  /*
    Il lui reste une carte :
    il devra appuyer sur UNO.
  */

  if(
    player.hand.length === 1
  ){

    player.uno = false;

  }


  let steps = 1;


  /*
    SKIP
  */

  if(
    card.type === "skip"
  ){

    steps = 2;

  }


  /*
    REVERSE
  */

  else if(
    card.type === "reverse"
  ){

    if(
      room.players.length === 2
    ){

      steps = 2;

    }
    else{

      room.direction *= -1;

    }

  }


  /*
    +2 sans empilement :
    le joueur suivant prend immédiatement
    les deux cartes puis son tour est sauté.
  */

  else if(
    card.type === "draw2"
  ){

    if(
      !room.settings.stacking
    ){

      const target =
        getNextPlayer(room);

      if(target){

        drawCards(
          room,
          target,
          2
        );

      }

      room.pendingDraw = 0;

      steps = 2;

    }

  }


  /*
    +4 :
    le joueur suivant prend 4 cartes
    et son tour est sauté.
  */

  else if(
    card.type === "wild4"
  ){

    const target =
      getNextPlayer(room);

    if(target){

      drawCards(
        room,
        target,
        4
      );

    }

    room.pendingDraw = 0;

    steps = 2;

  }


  /*
    Passage au joueur suivant.
  */

  advance(
    room,
    steps
  );


  sendState(room);

}


function playerDraw(
  room,
  player
){

  if(
    room.status !== "playing"
  ){

    return;

  }


  if(
    room.currentPlayer !==
    player.id
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


  if(player.hasDrawn){

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
    CAS D'UNE PÉNALITÉ :
    le joueur doit prendre toute
    la pénalité et son tour passe.
  */

  if(room.pendingDraw > 0){

    const amount =
      room.pendingDraw;


    drawCards(
      room,
      player,
      amount
    );


    room.pendingDraw = 0;

    player.hasDrawn = false;


    /*
      Très important :
      après avoir pris la pénalité,
      le tour passe.
    */

    advance(
      room,
      1
    );


    sendState(room);

    return;

  }


  /*
    PIOCHE NORMALE
  */

  const card =
    drawOne(room);


  if(card){

    player.hand.push(card);

  }


  /*
    On mémorise qu'il a pioché.
  */

  player.hasDrawn = true;


  /*
    CORRECTION DU BLOCAGE :
    
    - si la carte piochée est jouable :
      le joueur garde son tour et
      peut jouer cette carte.

    - si elle n'est pas jouable :
      son tour passe automatiquement.

  */

  if(!card){

    advance(
      room,
      1
    );

  }

  else if(
    !isPlayable(
      room,
      player,
      card
    )
  ){

    advance(
      room,
      1
    );

  }


  sendState(room);

}


function callUno(
  room,
  player
){

  if(
    room.status !== "playing"
  ){

    return;

  }


  if(
    room.currentPlayer !==
    player.id
  ){

    return;

  }


  if(
    player.hand.length === 1
  ){

    player.uno = true;

    sendState(room);

  }

}


function newGame(room){

  room.status =
    "waiting";

  room.deck = [];

  room.discard = [];

  room.currentPlayer =
    null;

  room.currentColor =
    null;

  room.pendingDraw =
    0;

  room.winner =
    null;

  room.direction =
    1;


  room.players.forEach(
    p => {

      p.hand = [];

      p.hasDrawn = false;

      p.uno = false;

    }
  );


  sendState(room);

}


wss.on(
  "connection",
  socket => {

    socket.room = null;

    socket.playerId = null;


    socket.on(
      "message",
      raw => {

        let data;


        try{

          data =
            JSON.parse(
              raw.toString()
            );

        }
        catch{

          return;

        }


        /*
          CRÉATION D'UN SALON
        */

        if(
          data.type ===
          "create_room"
        ){

          const mode =
            data.mode === "phones"
              ? "phones"
              : "tv";


          const room =
            createRoom(
              socket,
              mode,
              data.name,
              data.stacking
            );


          send(
            socket,
            {
              type:"room_created",

              room:
                room.room,

              playerId:
                socket.playerId,

              mode:
                room.mode

            }
          );


          sendState(room);

          return;

        }


        /*
          REJOINDRE UN SALON
        */

        if(
          data.type ===
          "join_room"
        ){

          const code =
            String(
              data.room || ""
            )
            .trim()
            .toUpperCase();


          const room =
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
            room.status !==
            "waiting"
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
            room.players.length >=
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


          const player =
            makePlayer(
              socket,
              data.name
            );


          room.players.push(
            player
          );


          socket.room =
            room.room;


          socket.playerId =
            player.id;


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


        const room =
          rooms.get(
            socket.room
          );


        if(!room){
          return;
        }


        const player =
          room.players.find(
            p =>
              p.id ===
              socket.playerId
          );


        /*
          LANCER LA PARTIE
        */

        if(
          data.type ===
          "start_game"
        ){

          if(
            socket !==
            room.host
          ){

            return;

          }


          startGame(room);

          return;

        }


        /*
          JOUER UNE CARTE
        */

        if(
          data.type ===
          "play_card"
        ){

          if(!player){
            return;
          }


          playCard(
            room,
            player,
            Number(data.index),
            data.color
          );

          return;

        }


        /*
          PIOCHER
        */

        if(
          data.type ===
          "draw"
        ){

          if(!player){
            return;
          }


          playerDraw(
            room,
            player
          );

          return;

        }


        /*
          UNO
        */

        if(
          data.type ===
          "uno"
        ){

          if(!player){
            return;
          }


          callUno(
            room,
            player
          );

          return;

        }


        /*
          NOUVELLE MANCHE
        */

        if(
          data.type ===
          "new_game"
        ){

          if(
            socket !==
            room.host
          ){

            return;

          }


          newGame(room);

          return;

        }

      }
    );


    socket.on(
      "close",
      () => {

        const room =
          rooms.get(
            socket.room
          );


        if(!room){
          return;
        }


        const idx =
          room.players.findIndex(
            p =>
              p.socket === socket
          );


        const leavingId =
          idx >= 0
            ? room.players[idx].id
            : null;


        if(idx >= 0){

          room.players.splice(
            idx,
            1
          );

        }


        /*
          SI LE CRÉATEUR QUITTE
        */

        if(
          socket === room.host
        ){

          /*
            En mode téléphones :
            le prochain joueur devient hôte.
          */

          if(
            room.mode === "phones" &&
            room.players.length
          ){

            room.host =
              room.players[0].socket;


            room.host.playerId =
              room.players[0].id;

          }

          /*
            En mode TV :
            la TV est nécessaire à la partie.
          */

          else if(
            room.mode === "tv"
          ){

            rooms.delete(
              room.room
            );


            room.players.forEach(
              p => {

                send(
                  p.socket,
                  {
                    type:"error",
                    message:
                      "La TV a quitté le salon."
                  }
                );

              }
            );


            return;

          }

        }


        /*
          Plus aucun joueur :
          suppression du salon.
        */

        if(
          !room.players.length
        ){

          rooms.delete(
            room.room
          );

          return;

        }


        /*
          Si le joueur qui quitte
          était celui dont c'était le tour,
          on donne le tour au premier
          joueur restant.
        */

        if(
          room.status === "playing" &&
          leavingId ===
          room.currentPlayer
        ){

          room.currentPlayer =
            room.players[0].id;


          room.players.forEach(
            p => {
              p.hasDrawn = false;
            }
          );

        }

        else if(
          room.currentPlayer &&
          !room.players.some(
            p =>
              p.id ===
              room.currentPlayer
          )
        ){

          room.currentPlayer =
            room.players[0].id;


          room.players.forEach(
            p => {
              p.hasDrawn = false;
            }
          );

        }


        sendState(room);

      }
    );

  }
);


server.listen(
  PORT,
  () => {

    console.log(
      `UNO server lancé sur le port ${PORT}`
    );

  }
);
