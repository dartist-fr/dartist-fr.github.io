const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");


const PORT =
  process.env.PORT || 10000;


const server =
  http.createServer(
    (req,res) => {

      res.writeHead(
        200,
        {
          "Content-Type":
            "text/plain; charset=utf-8"
        }
      );

      res.end(
        "UNO Jeux2Soirée server OK"
      );

    }
  );


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


/* =========================
   COMMUNICATION
========================= */

function send(
  socket,
  data
){

  if(
    socket &&
    socket.readyState ===
    WebSocket.OPEN
  ){

    socket.send(
      JSON.stringify(data)
    );

  }

}


function broadcast(
  room,
  data
){

  room.players.forEach(
    player => {

      send(
        player.socket,
        data
      );

    }
  );


  /*
    En mode TV, la TV n'est pas
    dans room.players.
  */

  if(
    room.mode === "tv"
  ){

    send(
      room.host,
      data
    );

  }

}


/* =========================
   CODE SALON
========================= */

function randomRoomCode(){

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


  let code;


  do{

    code = "";


    for(
      let i=0;
      i<4;
      i++
    ){

      code +=
        chars[
          crypto.randomInt(
            chars.length
          )
        ];

    }

  }
  while(
    rooms.has(code)
  );


  return code;

}


/* =========================
   MELANGE
========================= */

function shuffle(array){

  const result =
    [...array];


  /*
    Fisher-Yates + crypto.randomInt
    pour un mélange propre.
  */

  for(
    let i=result.length - 1;
    i>0;
    i--
  ){

    const j =
      crypto.randomInt(
        i + 1
      );


    [
      result[i],
      result[j]
    ] =
    [
      result[j],
      result[i]
    ];

  }


  return result;

}


/* =========================
   PAQUET UNO 108 CARTES
========================= */

function createDeck(){

  const deck = [];


  COLORS.forEach(
    color => {

      /*
        0
      */

      deck.push({

        color,

        type:"number",

        value:0

      });


      /*
        1 à 9 en double
      */

      for(
        let n=1;
        n<=9;
        n++
      ){

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


      /*
        2 Skip
        2 Reverse
        2 +2
      */

      for(
        let i=0;
        i<2;
        i++
      ){

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
  );


  /*
    4 Wild
    4 Wild +4
  */

  for(
    let i=0;
    i<4;
    i++
  ){

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


/* =========================
   JOUEUR
========================= */

function makePlayer(
  socket,
  name
){

  return {

    id:
      crypto.randomUUID(),

    socket,

    name:
      String(
        name || "Joueur"
      )
      .trim()
      .slice(0,18),

    hand:[],

    hasDrawn:false,

    uno:false,

    score:0

  };

}


/* =========================
   CREATION SALON
========================= */

function createRoom(
  socket,
  mode,
  name,
  stacking
){

  const roomCode =
    randomRoomCode();


  const room = {

    room:
      roomCode,

    mode,

    host:
      socket,

    players:[],

    status:
      "waiting",

    deck:[],

    discard:[],

    currentPlayer:null,

    currentColor:null,

    direction:1,

    pendingDraw:0,

    winner:null,

    settings:{

      stacking:
        Boolean(stacking)

    }

  };


  /*
    MODE TELEPHONES :
    LE CREATEUR EST AUSSI JOUEUR.
  */

  if(
    mode === "phones"
  ){

    const player =
      makePlayer(
        socket,
        name
      );


    room.players.push(
      player
    );


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


/* =========================
   JOUEUR ACTUEL
========================= */

function currentPlayer(room){

  if(
    !room.currentPlayer
  ){

    return null;

  }


  return (
    room.players.find(
      p =>
        p.id ===
        room.currentPlayer
    )
    || null
  );

}


/* =========================
   JOUEUR SUIVANT
========================= */

function nextPlayerId(
  room,
  steps=1
){

  if(
    !room.players.length
  ){

    return null;

  }


  const currentIndex =
    room.players.findIndex(
      p =>
        p.id ===
        room.currentPlayer
    );


  let index =
    currentIndex;


  for(
    let i=0;
    i<steps;
    i++
  ){

    index =
      (
        index +
        room.direction +
        room.players.length
      )
      %
      room.players.length;

  }


  return room.players[
    index
  ].id;

}


/* =========================
   AVANCER TOUR
========================= */

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
    player => {

      player.hasDrawn =
        false;

    }
  );

}


/* =========================
   JOUEUR SUIVANT OBJET
========================= */

function getNextPlayer(room){

  const id =
    nextPlayerId(
      room,
      1
    );


  return (
    room.players.find(
      p =>
        p.id === id
    )
    || null
  );

}


/* =========================
   RECYCLAGE
========================= */

function refillDeck(room){

  if(
    room.discard.length <= 1
  ){

    return;

  }


  const top =
    room.discard.pop();


  const recycled =
    room.discard.splice(0);


  room.deck =
    shuffle(
      recycled
    );


  room.discard.push(
    top
  );

}


/* =========================
   PIOCHE UNE CARTE
========================= */

function drawOne(room){

  if(
    !room.deck.length
  ){

    refillDeck(room);

  }


  return (
    room.deck.pop()
    || null
  );

}


/* =========================
   PIOCHE PLUSIEURS
========================= */

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

      player.hand.push(
        card
      );

    }

  }

}


/* =========================
   CARTE JOUABLE
========================= */

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
    PENALITE EN COURS
  */

  if(
    room.pendingDraw > 0
  ){

    return (
      room.settings.stacking &&
      card.type === "draw2"
    );

  }


  /*
    WILD
  */

  if(
    card.type === "wild"
  ){

    return true;

  }


  /*
    +4
  */

  if(
    card.type === "wild4"
  ){

    /*
      Le +4 est autorisé seulement
      si aucune carte de la couleur
      actuelle n'est dans la main.
    */

    return !player.hand.some(
      c =>
        c.color ===
        room.currentColor
    );

  }


  /*
    MEME COULEUR
  */

  if(
    card.color ===
    room.currentColor
  ){

    return true;

  }


  /*
    MEME TYPE
  */

  if(
    card.type !== "number" &&
    card.type === top.type
  ){

    return true;

  }


  /*
    MEME NUMERO
  */

  if(
    card.type === "number" &&
    top.type === "number" &&
    card.value === top.value
  ){

    return true;

  }


  return false;

}


/* =========================
   ETAT PUBLIC
========================= */

function publicState(
  room,
  viewerId
){

  const current =
    currentPlayer(room);


  const mePlayer =
    viewerId
      ? room.players.find(
          p =>
            p.id ===
            viewerId
        )
      : null;


  /*
    CORRECTION IMPORTANTE :

    TV :
      viewerId = null
      mais la TV est quand même l'hôte.

    TELEPHONE :
      le créateur possède son playerId
      et devient hôte.
  */

  const isHost =
    room.mode === "tv"
      ? true
      : Boolean(
          mePlayer &&
          mePlayer.socket ===
          room.host
        );


  return {

    status:
      room.status,

    mode:
      room.mode,

    isHost,


    settings:
      room.settings,


    players:
      room.players.map(
        player => ({

          id:
            player.id,

          name:
            player.name,

          cardCount:
            player.hand.length,

          host:
            player.socket ===
            room.host,

          score:
            player.score

        })
      ),


    discard:
      room.discard[
        room.discard.length - 1
      ]
      || null,


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


/* =========================
   ENVOI ETAT
========================= */

function sendState(room){

  /*
    TELEPHONES :
    chacun reçoit uniquement
    sa propre main.
  */

  room.players.forEach(
    player => {

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
  );


  /*
    TV :
    reçoit l'état général.
  */

  if(
    room.mode === "tv"
  ){

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


/* =========================
   DEMARRER PARTIE
========================= */

function startGame(room){

  if(
    room.players.length < 2
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


  /*
    Nouveau paquet mélangé.
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
    player => {

      player.hand = [];

      player.hasDrawn =
        false;

      player.uno =
        false;

    }
  );


  /*
    7 cartes par joueur.
    Distribution tour par tour.
  */

  for(
    let i=0;
    i<7;
    i++
  ){

    room.players.forEach(
      player => {

        const card =
          drawOne(room);


        if(card){

          player.hand.push(
            card
          );

        }

      }
    );

  }


  /*
    Première carte :
    on choisit une carte numérique.
  */

  let first =
    null;


  while(
    room.deck.length
  ){

    const card =
      drawOne(room);


    if(
      card &&
      card.type === "number"
    ){

      first =
        card;

      break;

    }


    if(card){

      room.deck.unshift(
        card
      );

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


  room.discard.push(
    first
  );


  room.currentColor =
    first.color;


  room.currentPlayer =
    room.players[0].id;


  room.status =
    "playing";


  sendState(room);

}


/* =========================
   POINTS
========================= */

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
    ].includes(
      card.type
    )
  ){

    return 20;

  }


  return 50;

}


/* =========================
   FIN MANCHE
========================= */

function endRound(
  room,
  winner
){

  let points = 0;


  room.players.forEach(
    player => {

      if(
        player.id !==
        winner.id
      ){

        player.hand.forEach(
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


/* =========================
   JOUER CARTE
========================= */

function playCard(
  room,
  player,
  index,
  chosenColor
){

  if(
    room.status !==
    "playing"
  ){

    return;

  }


  /*
    Vérifier le tour.
  */

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


  /*
    Vérifier index.
  */

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
    Vérifier jouabilité.
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
    Wild / +4 :
    couleur obligatoire.
  */

  if(
    (
      card.type === "wild" ||
      card.type === "wild4"
    ) &&
    !COLORS.includes(
      chosenColor
    )
  ){

    send(
      player.socket,
      {

        type:"color_required",

        cardIndex:
          index

      }
    );

    return;

  }


  /*
    Retirer la carte.
  */

  player.hand.splice(
    index,
    1
  );


  /*
    Ajouter à la défausse.
  */

  room.discard.push(
    card
  );


  /*
    Couleur.
  */

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
    =========================
    +2
    =========================
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

    room.pendingDraw =
      2;

  }

  else{

    room.pendingDraw =
      0;

  }


  /*
    VICTOIRE
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
    UNO
  */

  if(
    player.hand.length === 1
  ){

    player.uno =
      false;

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

    /*
      À deux joueurs,
      Reverse agit comme Skip.
    */

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
    +2 SANS EMPILEMENT
  */

  else if(
    card.type === "draw2" &&
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


    room.pendingDraw =
      0;


    steps = 2;

  }


  /*
    +4
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


    room.pendingDraw =
      0;


    steps = 2;

  }


  /*
    Passage du tour.
  */

  advance(
    room,
    steps
  );


  sendState(room);

}


/* =========================
   PIOCHE
========================= */

function playerDraw(
  room,
  player
){

  if(
    room.status !==
    "playing"
  ){

    return;

  }


  /*
    Vérifier tour.
  */

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


  /*
    Une pioche maximum
    par tour normal.
  */

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
    =========================
    PENALITE +2
    =========================
  */

  if(
    room.pendingDraw > 0
  ){

    const amount =
      room.pendingDraw;


    drawCards(
      room,
      player,
      amount
    );


    room.pendingDraw =
      0;


    player.hasDrawn =
      false;


    /*
      IMPORTANT :
      le joueur qui prend la pénalité
      perd son tour.
    */

    advance(
      room,
      1
    );


    sendState(room);

    return;

  }


  /*
    =========================
    PIOCHE NORMALE
    =========================
  */

  const card =
    drawOne(room);


  if(card){

    player.hand.push(
      card
    );

  }


  player.hasDrawn =
    true;


  /*
    =========================
    CORRECTION DU BLOCAGE
    =========================

    Carte non jouable :
      -> tour suivant.

    Carte jouable :
      -> le joueur garde son tour.
      -> il peut cliquer dessus.
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


/* =========================
   UNO
========================= */

function callUno(
  room,
  player
){

  if(
    room.status !==
    "playing"
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

    player.uno =
      true;


    sendState(room);

  }

}


/* =========================
   NOUVELLE MANCHE
========================= */

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
    player => {

      player.hand = [];

      player.hasDrawn =
        false;

      player.uno =
        false;

    }
  );


  sendState(room);

}


/* =========================
   WEBSOCKET
========================= */

wss.on(
  "connection",
  socket => {

    socket.room =
      null;

    socket.playerId =
      null;


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
          =========================
          CREER SALON
          =========================
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
          =========================
          REJOINDRE
          =========================
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
            rooms.get(
              code
            );


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


        /*
          Trouver salon.
        */

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
          =========================
          START
          =========================
        */

        if(
          data.type ===
          "start_game"
        ){

          /*
            En TV :
              socket === room.host

            En téléphone :
              socket === room.host
              et le créateur est joueur.
          */

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
          =========================
          JOUER CARTE
          =========================
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
            Number(
              data.index
            ),
            data.color
          );


          return;

        }


        /*
          =========================
          PIOCHER
          =========================
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
          =========================
          UNO
          =========================
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
          =========================
          NOUVELLE MANCHE
          =========================
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


    /* =========================
       DECONNEXION
    ========================= */

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
            player =>
              player.socket ===
              socket
          );


        const leavingId =
          idx >= 0
            ? room.players[idx].id
            : null;


        if(
          idx >= 0
        ){

          room.players.splice(
            idx,
            1
          );

        }


        /*
          =========================
          L'HOTE QUITTE
          =========================
        */

        if(
          socket ===
          room.host
        ){

          /*
            TELEPHONES :
            un autre joueur devient hôte.
          */

          if(
            room.mode === "phones" &&
            room.players.length
          ){

            room.host =
              room.players[0].socket;

          }


          /*
            TV :
            la partie dépend de la TV.
          */

          else if(
            room.mode === "tv"
          ){

            rooms.delete(
              room.room
            );


            room.players.forEach(
              player => {

                send(
                  player.socket,
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
          Plus aucun joueur.
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
          Le joueur dont c'était le tour
          vient de partir.
        */

        if(
          room.status === "playing" &&
          leavingId ===
          room.currentPlayer
        ){

          room.currentPlayer =
            room.players[0].id;


          room.players.forEach(
            player => {

              player.hasDrawn =
                false;

            }
          );

        }


        /*
          Sécurité supplémentaire :
          si currentPlayer n'existe plus.
        */

        else if(
          room.currentPlayer &&
          !room.players.some(
            player =>
              player.id ===
              room.currentPlayer
          )
        ){

          room.currentPlayer =
            room.players[0].id;


          room.players.forEach(
            player => {

              player.hasDrawn =
                false;

            }
          );

        }


        sendState(room);

      }
    );

  }
);


/* =========================
   SERVEUR
========================= */

server.listen(
  PORT,
  () => {

    console.log(
      `UNO server lancé sur le port ${PORT}`
    );

  }
);
