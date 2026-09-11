const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 10000;
const MAX_PLAYERS = 10;
const DEFAULT_HAND_SIZE = 7;
const MIN_HAND_SIZE = 1;
const MAX_HAND_SIZE = 20;
const COLORS = ["red", "yellow", "green", "blue"];
const MAX_LOGS = 100;

const BATTLESHIP_SIZE = 10;
const BATTLESHIP_MAX_PLAYERS = 2;
const BATTLESHIP_FLEET = [
  { type: "carrier", name: "Porte-avions", size: 5 },
  { type: "battleship", name: "Cuirassé", size: 4 },
  { type: "cruiser", name: "Croiseur", size: 3 },
  { type: "submarine", name: "Sous-marin", size: 3 },
  { type: "destroyer", name: "Torpilleur", size: 2 }
];


/* =========================================================
   SERVEUR HTTP
========================================================= */

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end(
    "Serveur Jeux2Soirée opérationnel. UNO + Bataille Navale."
  );
});


/* =========================================================
   WEBSOCKET
========================================================= */

const wss = new WebSocket.Server({
  server
});


/* =========================================================
   ROOMS
========================================================= */

const rooms = new Map();


/* =========================================================
   UTILITAIRES
========================================================= */

function makeId() {
  return crypto.randomBytes(8).toString("hex");
}


function makeRoomCode() {
  let code;

  do {
    code = crypto
      .randomBytes(3)
      .toString("hex")
      .slice(0, 4)
      .toUpperCase();
  } while (rooms.has(code));

  return code;
}


function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);

    [
      deck[i],
      deck[j]
    ] = [
      deck[j],
      deck[i]
    ];
  }

  return deck;
}


function send(socket, data) {
  if (
    socket &&
    socket.readyState === WebSocket.OPEN
  ) {
    socket.send(
      JSON.stringify(data)
    );
  }
}


function broadcast(room, data) {
  for (const player of room.players) {
    send(
      player.socket,
      data
    );
  }

  const hostIsPlayer =
    room.players.some(
      player =>
        player.socket === room.host
    );

  if (!hostIsPlayer) {
    send(
      room.host,
      data
    );
  }
}


function addLog(room, text) {
  room.logs.push({
    time: new Date().toLocaleTimeString(
      "fr-FR",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    ),
    text
  });

  if (
    room.logs.length >
    MAX_LOGS
  ) {
    room.logs.shift();
  }
}


/* =========================================================
   ========================= UNO ===========================
========================================================= */


/* =========================================================
   PAQUET UNO
========================================================= */

function createDeck() {
  const deck = [];

  for (const color of COLORS) {

    deck.push({
      id: makeId(),
      color,
      type: "number",
      value: 0
    });

    for (
      let value = 1;
      value <= 9;
      value++
    ) {

      deck.push({
        id: makeId(),
        color,
        type: "number",
        value
      });

      deck.push({
        id: makeId(),
        color,
        type: "number",
        value
      });
    }


    for (let i = 0; i < 2; i++) {

      deck.push({
        id: makeId(),
        color,
        type: "skip"
      });

      deck.push({
        id: makeId(),
        color,
        type: "reverse"
      });

      deck.push({
        id: makeId(),
        color,
        type: "draw2"
      });
    }
  }


  for (let i = 0; i < 4; i++) {

    deck.push({
      id: makeId(),
      color: null,
      type: "wild"
    });

    deck.push({
      id: makeId(),
      color: null,
      type: "wild4"
    });
  }

  return deck;
}


/* =========================================================
   UNO JOUEUR ACTUEL
========================================================= */

function currentPlayer(room) {
  return (
    room.players.find(
      player =>
        player.id ===
        room.currentPlayerId
    ) || null
  );
}


function getNextPlayer(
  room,
  steps = 1
) {

  if (!room.players.length) {
    return null;
  }

  const currentIndex =
    room.players.findIndex(
      player =>
        player.id ===
        room.currentPlayerId
    );

  if (currentIndex < 0) {
    return room.players[0];
  }

  const index =
    (
      currentIndex +
      room.direction * steps +
      room.players.length * 1000
    ) %
    room.players.length;

  return room.players[index];
}


function nextPlayer(
  room,
  steps = 1
) {

  const next =
    getNextPlayer(
      room,
      steps
    );

  room.currentPlayerId =
    next
      ? next.id
      : null;
}


/* =========================================================
   UNO PIOCHE
========================================================= */

function refillDeck(room) {

  if (
    room.discard.length <= 1
  ) {
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


function drawOne(room) {

  if (!room.deck.length) {
    refillDeck(room);
  }

  return (
    room.deck.pop() ||
    null
  );
}


function drawCards(
  room,
  player,
  amount
) {

  let count = 0;

  for (
    let i = 0;
    i < amount;
    i++
  ) {

    const card =
      drawOne(room);

    if (!card) {
      break;
    }

    player.hand.push(card);
    count++;
  }

  return count;
}


/* =========================================================
   UNO CARTES JOUABLES
========================================================= */

function canPlayWild4(
  room,
  player
) {

  return !player.hand.some(
    card =>
      card.color ===
      room.currentColor
  );
}


function basePlayable(
  room,
  player,
  card
) {

  const top =
    room.discard[
      room.discard.length - 1
    ];

  if (!top) {
    return true;
  }

  if (
    card.type === "wild"
  ) {
    return true;
  }

  if (
    card.type === "wild4"
  ) {
    return canPlayWild4(
      room,
      player
    );
  }

  if (
    card.color ===
    room.currentColor
  ) {
    return true;
  }

  if (
    card.type === "number" &&
    top.type === "number" &&
    card.value === top.value
  ) {
    return true;
  }

  if (
    card.type !== "number" &&
    card.type === top.type
  ) {
    return true;
  }

  return false;
}


function isPlayable(
  room,
  player,
  card
) {

  return basePlayable(
    room,
    player,
    card
  );
}


/* =========================================================
   UNO SCORE
========================================================= */

function cardPoints(card) {

  if (
    card.type === "number"
  ) {
    return card.value;
  }

  if (
    [
      "skip",
      "reverse",
      "draw2"
    ].includes(card.type)
  ) {
    return 20;
  }

  return 50;
}


function cardLabel(card) {

  if (
    card.type === "number"
  ) {
    return String(
      card.value
    );
  }

  return {
    skip: "PASS",
    reverse: "REVERSE",
    draw2: "+2",
    wild: "CHANGEMENT DE COULEUR",
    wild4: "+4"
  }[card.type] ||
    card.type;
}


/* =========================================================
   UNO ETAT PUBLIC
========================================================= */

function publicState(
  room,
  viewerId
) {

  const viewer =
    room.players.find(
      player =>
        player.id ===
        viewerId
    ) || null;

  const current =
    currentPlayer(room);


  return {

    mode:
      room.mode,

    status:
      room.status,

    players:
      room.players.map(
        player => ({
          id: player.id,
          name: player.name,
          cardCount:
            player.hand.length,
          score:
            player.score,
          host:
            player.socket ===
            room.host
        })
      ),

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

    settings:
      room.settings,

    logs:
      room.logs,

    winner:
      room.winner,

    unoChallenge:
      room.unoChallenge
        ? {
            targetId:
              room.unoChallenge.targetId,

            targetName:
              room.unoChallenge.targetName
          }
        : null,

    me:
      viewer
        ? {
            id: viewer.id,
            name: viewer.name,
            hand: viewer.hand,
            hasDrawn:
              viewer.hasDrawn,
            drawnCardId:
              viewer.drawnCardId
          }
        : null,

    canPlayWild4:
      viewer
        ? canPlayWild4(
            room,
            viewer
          )
        : false,

    isHost:
      viewer
        ? viewer.socket ===
          room.host
        : true
  };
}


/* =========================================================
   UNO ENVOI ETAT
========================================================= */

function sendState(room) {

  for (
    const player of
    room.players
  ) {

    send(
      player.socket,
      {
        type: "state",

        state:
          publicState(
            room,
            player.id
          )
      }
    );
  }


  const hostIsPlayer =
    room.players.some(
      player =>
        player.socket ===
        room.host
    );

  if (!hostIsPlayer) {

    send(
      room.host,
      {
        type: "state",

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
   CREATION SALON UNO
========================================================= */

function makeRoom(
  hostSocket,
  mode,
  hostName,
  stacking,
  handSize
) {

  const safeHandSize =
    Math.max(
      MIN_HAND_SIZE,
      Math.min(
        MAX_HAND_SIZE,
        Number(handSize) ||
          DEFAULT_HAND_SIZE
      )
    );


  const room = {

    game: "uno",

    room:
      makeRoomCode(),

    host:
      hostSocket,

    mode:
      mode === "phones"
        ? "phones"
        : "tv",

    players: [],

    deck: [],

    discard: [],

    currentPlayerId:
      null,

    direction:
      1,

    currentColor:
      null,

    pendingDraw:
      0,

    status:
      "waiting",

    winner:
      null,

    logs: [],

    unoChallenge:
      null,

    settings: {

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
     En mode téléphones,
     le créateur est aussi joueur.
  */

  if (
    room.mode ===
    "phones"
  ) {

    const player = {

      id:
        makeId(),

      name:
        String(
          hostName ||
          "Créateur"
        )
          .trim()
          .slice(0,18) ||
        "Créateur",

      socket:
        hostSocket,

      hand: [],

      score: 0,

      hasDrawn:
        false,

      drawnCardId:
        null
    };


    room.players.push(
      player
    );

    hostSocket.playerId =
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
      ? "➕ Empilement des +2 activé."
      : "➖ Empilement des +2 désactivé."
  );


  return room;
}


/* =========================================================
   DEMARRER UNO
========================================================= */

function startGame(room) {

  if (
    room.players.length < 2
  ) {

    send(
      room.host,
      {
        type: "error",
        message:
          "Il faut au moins 2 joueurs."
      }
    );

    return;
  }


  const needed =
    room.players.length *
      room.settings.handSize +
    1;


  if (
    needed > 108
  ) {

    send(
      room.host,
      {
        type: "error",

        message:
          `Impossible : ${room.settings.handSize} cartes × ${room.players.length} joueurs dépassent le paquet de 108 cartes.`
      }
    );

    return;
  }


  room.deck =
    shuffle(
      createDeck()
    );

  room.discard =
    [];

  room.pendingDraw =
    0;

  room.direction =
    1;

  room.currentPlayerId =
    null;

  room.currentColor =
    null;

  room.winner =
    null;

  room.status =
    "playing";

  room.unoChallenge =
    null;


  for (
    const player of
    room.players
  ) {

    player.hand =
      [];

    player.hasDrawn =
      false;

    player.drawnCardId =
      null;
  }


  /*
     Distribution une carte
     par joueur à chaque tour.
  */

  for (
    let round = 0;
    round <
      room.settings.handSize;
    round++
  ) {

    for (
      const player of
      room.players
    ) {

      const card =
        drawOne(room);

      if (card) {
        player.hand.push(
          card
        );
      }
    }
  }


  /*
     Première carte numérique.
  */

  let first =
    null;

  const rejected =
    [];


  while (
    room.deck.length
  ) {

    const card =
      drawOne(room);

    if (!card) {
      break;
    }


    if (
      card.type ===
      "number"
    ) {

      first =
        card;

      break;
    }


    rejected.push(
      card
    );
  }


  for (
    const card of
    rejected
  ) {
    room.deck.push(
      card
    );
  }


  shuffle(
    room.deck
  );


  if (!first) {
    first =
      drawOne(room);
  }


  if (first) {

    room.discard.push(
      first
    );

    room.currentColor =
      first.color;
  }


  /*
     Premier joueur aléatoire.
  */

  const starter =
    room.players[
      crypto.randomInt(
        room.players.length
      )
    ];


  room.currentPlayerId =
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
   FLAGS TOUR UNO
========================================================= */

function resetPlayerTurnFlags(
  player
) {

  player.hasDrawn =
    false;

  player.drawnCardId =
    null;
}


/* =========================================================
   ACTION CARTE UNO
========================================================= */

function advanceAfterCard(
  room,
  card
) {

  /*
     PASS
  */

  if (
    card.type ===
    "skip"
  ) {

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


  /*
     REVERSE
  */

  if (
    card.type ===
    "reverse"
  ) {

    if (
      room.players.length ===
      2
    ) {

      nextPlayer(
        room,
        2
      );

      addLog(
        room,
        "↔ Reverse à 2 joueurs : le joueur suivant est passé."
      );

    } else {

      room.direction *=
        -1;

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


  /*
     +2
  */

  if (
    card.type ===
    "draw2"
  ) {

    room.pendingDraw =
      room.settings.stacking
        ? Math.max(
            2,
            room.pendingDraw +
              2
          )
        : 2;


    nextPlayer(
      room,
      1
    );


    applyPenaltyImmediately(
      room
    );

    return;
  }


  /*
     +4
  */

  if (
    card.type ===
    "wild4"
  ) {

    room.pendingDraw =
      4;


    nextPlayer(
      room,
      1
    );


    applyPenaltyImmediately(
      room
    );

    return;
  }


  /*
     Carte normale.
  */

  nextPlayer(
    room,
    1
  );
}


/* =========================================================
   PENALITE UNO
========================================================= */

function applyPenaltyImmediately(
  room
) {

  const target =
    currentPlayer(room);

  const amount =
    room.pendingDraw;


  if (
    !target ||
    !amount
  ) {
    return;
  }


  const drawn =
    drawCards(
      room,
      target,
      amount
    );


  room.pendingDraw =
    0;


  /*
     Le joueur garde son tour.
  */

  target.hasDrawn =
    true;

  target.drawnCardId =
    null;


  addLog(
    room,
    `⚠️ ${target.name} pioche ${drawn} carte(s) de pénalité (+${amount}) et garde son tour.`
  );


  /*
     Si aucune carte n'est jouable,
     on passe automatiquement.
  */

  const canPlaySomething =
    target.hand.some(
      card =>
        basePlayable(
          room,
          target,
          card
        )
    );


  if (
    !canPlaySomething
  ) {

    resetPlayerTurnFlags(
      target
    );

    addLog(
      room,
      `➡️ ${target.name} n'a aucune carte jouable après la pénalité : son tour est terminé.`
    );


    nextPlayer(
      room,
      1
    );
  }
}


/* =========================================================
   FIN MANCHE UNO
========================================================= */

function finishRound(
  room,
  winner
) {

  let points =
    0;


  for (
    const player of
    room.players
  ) {

    if (
      player.id ===
      winner.id
    ) {
      continue;
    }


    for (
      const card of
      player.hand
    ) {

      points +=
        cardPoints(card);
    }
  }


  winner.score +=
    points;


  room.winner =
    winner.id;

  room.status =
    "finished";

  room.currentPlayerId =
    null;

  room.pendingDraw =
    0;

  room.unoChallenge =
    null;


  addLog(
    room,
    `🏆 ${winner.name} remporte la manche et gagne ${points} point(s).`
  );


  broadcast(
    room,
    {
      type:
        "round_end",

      winner:
        winner.name,

      points,

      score:
        winner.score
    }
  );


  sendState(room);
}


/* =========================================================
   UNO CHALLENGE
========================================================= */

function beginUnoChallenge(
  room,
  player
) {

  room.unoChallenge = {

    targetId:
      player.id,

    targetName:
      player.name,

    resolved:
      false
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
) {

  const challenge =
    room.unoChallenge;


  if (
    !challenge ||
    challenge.resolved
  ) {
    return;
  }


  challenge.resolved =
    true;


  const target =
    room.players.find(
      player =>
        player.id ===
        challenge.targetId
    );


  const claimedBy =
    room.players.find(
      player =>
        player.id ===
        claimedById
    );


  if (!target) {

    room.unoChallenge =
      null;

    sendState(room);

    return;
  }


  if (
    claimedBy &&
    claimedBy.id ===
    target.id
  ) {

    addLog(
      room,
      `📣 ${target.name} a buzzé UNO en premier : aucun malus.`
    );

  } else {

    const amount =
      2;

    const drawn =
      drawCards(
        room,
        target,
        amount
      );


    addLog(
      room,
      `🚨 ${claimedBy ? claimedBy.name : "Un joueur"} a buzzé en premier : ${target.name} pioche ${drawn} carte(s).`
    );
  }


  room.unoChallenge =
    null;


  nextPlayer(
    room,
    1
  );


  sendState(room);
}


/* =========================================================
   JOUER CARTE UNO
========================================================= */

function playCard(
  room,
  player,
  index,
  chosenColor
) {

  if (
    room.status !==
    "playing"
  ) {
    return;
  }


  if (
    room.unoChallenge
  ) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          "Buzzez d'abord !"
      }
    );

    return;
  }


  const current =
    currentPlayer(room);


  if (
    !current ||
    current.id !==
    player.id
  ) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          "Ce n'est pas ton tour."
      }
    );

    return;
  }


  if (
    !Number.isInteger(
      index
    ) ||
    index < 0 ||
    index >=
      player.hand.length
  ) {
    return;
  }


  const card =
    player.hand[index];


  /*
     Après une pioche normale,
     seule la carte piochée
     peut être jouée.
  */

  if (
    player.hasDrawn &&
    player.drawnCardId &&
    card.id !==
      player.drawnCardId
  ) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          "Après une pioche normale, tu peux seulement jouer la carte que tu viens de piocher."
      }
    );

    return;
  }


  if (
    !isPlayable(
      room,
      player,
      card
    )
  ) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          "Cette carte ne peut pas être jouée ici."
      }
    );

    return;
  }


  if (
    (
      card.type ===
      "wild" ||
      card.type ===
      "wild4"
    ) &&
    !COLORS.includes(
      chosenColor
    )
  ) {

    send(
      player.socket,
      {
        type:
          "color_required",

        cardIndex:
          index
      }
    );

    return;
  }


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


  if (
    card.type ===
      "wild" ||
    card.type ===
      "wild4"
  ) {

    room.currentColor =
      chosenColor;

  } else {

    room.currentColor =
      card.color;
  }


  addLog(
    room,
    `🃏 ${player.name} joue ${cardLabel(card)}${chosenColor ? ` → ${chosenColor.toUpperCase()}` : ""}.`
  );


  /*
     Victoire.
  */

  if (
    player.hand.length ===
    0
  ) {

    finishRound(
      room,
      player
    );

    return;
  }


  /*
     UNO challenge.
  */

  if (
    player.hand.length ===
    1
  ) {

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
   PIOCHE NORMALE UNO
========================================================= */

function drawNormal(
  room,
  player
) {

  const card =
    drawOne(room);


  if (!card) {

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


  player.hasDrawn =
    true;

  player.drawnCardId =
    card.id;


  addLog(
    room,
    `🃏 ${player.name} pioche une carte.`
  );


  if (
    !basePlayable(
      room,
      player,
      card
    )
  ) {

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

  } else {

    addLog(
      room,
      `✨ ${player.name} peut jouer la carte piochée.`
    );
  }


  sendState(room);
}


/* =========================================================
   DRAW UNO
========================================================= */

function drawCard(
  room,
  player
) {

  if (
    room.status !==
    "playing"
  ) {
    return;
  }


  if (
    room.unoChallenge
  ) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          "Buzzez d'abord !"
      }
    );

    return;
  }


  const current =
    currentPlayer(room);


  if (
    !current ||
    current.id !==
    player.id
  ) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          "Ce n'est pas ton tour."
      }
    );

    return;
  }


  /*
     Sécurité pénalité.
  */

  if (
    room.pendingDraw >
    0
  ) {

    applyPenaltyImmediately(
      room
    );

    sendState(room);

    return;
  }


  if (
    player.hasDrawn
  ) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          "Tu as déjà pioché."
      }
    );

    return;
  }


  drawNormal(
    room,
    player
  );
}


/* =========================================================
   UNO BUZZ
========================================================= */

function challengeUno(
  room,
  player
) {

  if (
    !room.unoChallenge
  ) {
    return;
  }

  resolveUnoChallenge(
    room,
    player.id
  );
}


/* =========================================================
   NOUVELLE MANCHE UNO
========================================================= */

function resetRound(
  room
) {

  room.status =
    "waiting";

  room.deck =
    [];

  room.discard =
    [];

  room.currentPlayerId =
    null;

  room.currentColor =
    null;

  room.direction =
    1;

  room.pendingDraw =
    0;

  room.unoChallenge =
    null;

  room.winner =
    null;


  for (
    const player of
    room.players
  ) {

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
   =================== BATAILLE NAVALE =====================
========================================================= */


/* =========================================================
   PLATEAU
========================================================= */

function createBattleBoard() {

  return Array.from(
    {
      length:
        BATTLESHIP_SIZE
    },
    () =>
      Array(
        BATTLESHIP_SIZE
      ).fill(null)
  );
}


function battleCoord(
  row,
  col
) {

  return `${row},${col}`;
}


function parseBattleCoord(
  value
) {

  if (
    typeof value !==
    "string"
  ) {
    return null;
  }


  const parts =
    value.split(",");


  if (
    parts.length !==
    2
  ) {
    return null;
  }


  const row =
    Number(parts[0]);

  const col =
    Number(parts[1]);


  if (
    !Number.isInteger(
      row
    ) ||
    !Number.isInteger(
      col
    )
  ) {
    return null;
  }


  if (
    row < 0 ||
    row >=
      BATTLESHIP_SIZE ||
    col < 0 ||
    col >=
      BATTLESHIP_SIZE
  ) {
    return null;
  }


  return {
    row,
    col
  };
}


/* =========================================================
   FLOTTES
========================================================= */

function battleFleetDefinition(
  type
) {

  return (
    BATTLESHIP_FLEET.find(
      ship =>
        ship.type ===
        type
    ) || null
  );
}


function emptyBattleFleet() {

  return BATTLESHIP_FLEET.map(
    ship => ({

      type:
        ship.type,

      name:
        ship.name,

      size:
        ship.size,

      cells: [],

      hits: [],

      sunk:
        false
    })
  );
}


function createBattlePlayer(
  idValue,
  name,
  socket
) {

  return {

    id:
      idValue,

    name:
      String(
        name ||
        "Joueur"
      )
        .trim()
        .slice(0,18) ||
      "Joueur",

    socket,

    board:
      createBattleBoard(),

    ships:
      emptyBattleFleet(),

    ready:
      false,

    shots:
      new Set()
  };
}


/* =========================================================
   CREER SALON BATAILLE
========================================================= */

function createBattleRoom(
  hostSocket,
  mode,
  hostName
) {

  const safeMode =
    mode === "phones"
      ? "phones"
      : "tv";


  const room = {

    game:
      "battleship",

    room:
      makeRoomCode(),

    host:
      hostSocket,

    mode:
      safeMode,

    players: [],

    logs: [],

    status:
      "waiting",

    currentPlayerId:
      null,

    winner:
      null,

    lastShot:
      null
  };


  rooms.set(
    room.room,
    room
  );


  /*
     En mode téléphones,
     le créateur est aussi joueur.
  */

  if (
    safeMode ===
    "phones"
  ) {

    const player =
      createBattlePlayer(
        makeId(),
        hostName ||
          "Créateur",
        hostSocket
      );


    room.players.push(
      player
    );


    hostSocket.playerId =
      player.id;
  }


  addLog(
    room,
    "🚢 Salon Bataille Navale créé."
  );

  addLog(
    room,
    "📐 Plateau 10 × 10 • flotte de 5 navires."
  );


  return room;
}


/* =========================================================
   JOUEUR BATAILLE
========================================================= */

function battlePlayer(
  room,
  idValue
) {

  return (
    room.players.find(
      player =>
        player.id ===
        idValue
    ) || null
  );
}


function battleCurrentPlayer(
  room
) {

  return battlePlayer(
    room,
    room.currentPlayerId
  );
}


/* =========================================================
   VERIFICATION FLOTTE
========================================================= */

function battleAllPlaced(
  player
) {

  return (
    player.ships.length ===
      BATTLESHIP_FLEET.length &&

    player.ships.every(
      ship =>
        ship.cells.length ===
        ship.size
    )
  );
}


/* =========================================================
   PLACEMENT
========================================================= */

function battleCanPlace(
  player,
  definition,
  row,
  col,
  orientation
) {

  if (!definition) {

    return {
      ok:
        false,

      message:
        "Navire inconnu."
    };
  }


  if (
    !Number.isInteger(
      row
    ) ||
    !Number.isInteger(
      col
    )
  ) {

    return {
      ok:
        false,

      message:
        "Position invalide."
    };
  }


  const dir =
    orientation ===
    "vertical"
      ? "vertical"
      : "horizontal";


  const cells =
    [];


  for (
    let i = 0;
    i < definition.size;
    i++
  ) {

    const r =
      dir === "vertical"
        ? row + i
        : row;

    const c =
      dir === "horizontal"
        ? col + i
        : col;


    if (
      r < 0 ||
      r >=
        BATTLESHIP_SIZE ||
      c < 0 ||
      c >=
        BATTLESHIP_SIZE
    ) {

      return {
        ok:
          false,

        message:
          `${definition.name} sort du plateau.`
      };
    }


    const occupied =
      player.board[r][c];


    if (
      occupied !== null &&
      occupied !==
        definition.type
    ) {

      return {
        ok:
          false,

        message:
          "Les navires ne peuvent pas se chevaucher."
      };
    }


    cells.push({
      row:
        r,

      col:
        c
    });
  }


  return {

    ok:
      true,

    cells,

    orientation:
      dir
  };
}


function battlePlaceShip(
  player,
  type,
  row,
  col,
  orientation
) {

  const definition =
    battleFleetDefinition(
      type
    );


  if (!definition) {

    return {
      ok:
        false,

      message:
        "Navire inconnu."
    };
  }


  const existing =
    player.ships.find(
      ship =>
        ship.type ===
        type
    );


  if (!existing) {

    return {
      ok:
        false,

      message:
        "Navire introuvable."
    };
  }


  const placement =
    battleCanPlace(
      player,
      definition,
      row,
      col,
      orientation
    );


  if (
    !placement.ok
  ) {
    return placement;
  }


  /*
     Retirer l'ancienne
     position du navire.
  */

  for (
    const rowCells of
    player.board
  ) {

    for (
      let c = 0;
      c <
        rowCells.length;
      c++
    ) {

      if (
        rowCells[c] ===
        type
      ) {
        rowCells[c] =
          null;
      }
    }
  }


  existing.cells =
    placement.cells;


  existing.hits =
    existing.hits.filter(
      hit =>
        placement.cells.some(
          cell =>
            cell.row ===
              hit.row &&
            cell.col ===
              hit.col
        )
    );


  existing.sunk =
    false;


  for (
    const cell of
    placement.cells
  ) {

    player.board[
      cell.row
    ][
      cell.col
    ] = type;
  }


  player.ready =
    false;


  return {

    ok:
      true,

    ship:
      existing
  };
}


/* =========================================================
   RESET FLOTTE
========================================================= */

function battleClearFleet(
  player
) {

  player.board =
    createBattleBoard();

  player.ships =
    emptyBattleFleet();

  player.ready =
    false;
}


/* =========================================================
   PLACEMENT ALEATOIRE
========================================================= */

function battleRandomFleet(
  player
) {

  battleClearFleet(
    player
  );


  for (
    const definition of
    BATTLESHIP_FLEET
  ) {

    let placed =
      false;


    for (
      let attempt = 0;
      attempt < 500 &&
      !placed;
      attempt++
    ) {

      const orientation =
        crypto.randomInt(2) ===
        0
          ? "horizontal"
          : "vertical";


      const row =
        crypto.randomInt(
          BATTLESHIP_SIZE
        );


      const col =
        crypto.randomInt(
          BATTLESHIP_SIZE
        );


      const result =
        battlePlaceShip(
          player,
          definition.type,
          row,
          col,
          orientation
        );


      if (
        result.ok
      ) {
        placed =
          true;
      }
    }


    /*
       Secours déterministe
       extrêmement improbable.
    */

    if (!placed) {

      battleClearFleet(
        player
      );

      return battleRandomFleetDeterministic(
        player
      );
    }
  }


  return true;
}


function battleRandomFleetDeterministic(
  player
) {

  battleClearFleet(
    player
  );


  const layouts = [

    [
      [
        "carrier",
        0,
        0,
        "horizontal"
      ],

      [
        "battleship",
        2,
        0,
        "horizontal"
      ],

      [
        "cruiser",
        4,
        0,
        "horizontal"
      ],

      [
        "submarine",
        6,
        0,
        "horizontal"
      ],

      [
        "destroyer",
        8,
        0,
        "horizontal"
      ]
    ],

    [
      [
        "carrier",
        0,
        0,
        "vertical"
      ],

      [
        "battleship",
        0,
        2,
        "vertical"
      ],

      [
        "cruiser",
        0,
        4,
        "vertical"
      ],

      [
        "submarine",
        0,
        6,
        "vertical"
      ],

      [
        "destroyer",
        0,
        8,
        "vertical"
      ]
    ]
  ];


  const layout =
    layouts[
      crypto.randomInt(
        layouts.length
      )
    ];


  for (
    const [
      type,
      row,
      col,
      orientation
    ] of layout
  ) {

    const result =
      battlePlaceShip(
        player,
        type,
        row,
        col,
        orientation
      );


    if (
      !result.ok
    ) {
      return false;
    }
  }


  return true;
}


/* =========================================================
   PREPARATION NOUVELLE PARTIE
========================================================= */

function battlePrepareNewRound(
  room
) {

  room.status =
    "placement";

  room.currentPlayerId =
    null;

  room.winner =
    null;

  room.lastShot =
    null;


  for (
    const player of
    room.players
  ) {

    battleClearFleet(
      player
    );

    player.shots =
      new Set();
  }
}


/* =========================================================
   DEMARRAGE BATAILLE
========================================================= */

function battleStart(
  room
) {

  if (
    room.players.length !==
    BATTLESHIP_MAX_PLAYERS
  ) {

    send(
      room.host,
      {
        type:
          "error",

        message:
          "La Bataille Navale nécessite exactement 2 joueurs."
      }
    );

    return;
  }


  if (
    !room.players.every(
      battleAllPlaced
    )
  ) {

    send(
      room.host,
      {
        type:
          "error",

        message:
          "Les deux joueurs doivent placer leurs 5 navires."
      }
    );

    return;
  }


  if (
    !room.players.every(
      player =>
        player.ready
    )
  ) {

    send(
      room.host,
      {
        type:
          "error",

        message:
          "Les deux joueurs doivent valider leur flotte."
      }
    );

    return;
  }


  room.status =
    "playing";

  room.winner =
    null;

  room.lastShot =
    null;


  room.currentPlayerId =
    room.players[
      crypto.randomInt(
        room.players.length
      )
    ].id;


  for (
    const player of
    room.players
  ) {

    player.shots =
      new Set();
  }


  const starter =
    battleCurrentPlayer(
      room
    );


  addLog(
    room,
    `🎲 ${starter.name} commence la Bataille Navale.`
  );


  addLog(
    room,
    "💥 La bataille commence !"
  );


  sendBattleState(
    room
  );
}


/* =========================================================
   TOUR SUIVANT
========================================================= */

function battleAdvanceTurn(
  room
) {

  const currentIndex =
    room.players.findIndex(
      player =>
        player.id ===
        room.currentPlayerId
    );


  if (
    currentIndex < 0
  ) {

    room.currentPlayerId =
      room.players[0]?.id ||
      null;

    return;
  }


  room.currentPlayerId =
    room.players[
      (
        currentIndex + 1
      ) %
      room.players.length
    ].id;
}


/* =========================================================
   NAVIRE SUR CASE
========================================================= */

function battleShipByCell(
  player,
  row,
  col
) {

  const type =
    player.board[
      row
    ]?.[
      col
    ];


  if (!type) {
    return null;
  }


  return (
    player.ships.find(
      ship =>
        ship.type ===
        type
    ) || null
  );
}


/* =========================================================
   NAVIRE COULE
========================================================= */

function battleShipSunk(
  ship
) {

  return (
    ship.hits.length >=
    ship.cells.length
  );
}


function battleAllShipsSunk(
  player
) {

  return player.ships.every(
    ship =>
      ship.sunk
  );
}


/* =========================================================
   ETAT BATAILLE
========================================================= */

function battlePublicShips(
  player
) {

  return player.ships.map(
    ship => ({

      type:
        ship.type,

      name:
        ship.name,

      size:
        ship.size,

      cells:
        ship.cells,

      hits:
        ship.hits,

      sunk:
        ship.sunk
    })
  );
}


function battlePublicEnemyShips(
  player
) {

  return player.ships.map(
    ship => ({

      type:
        ship.type,

      name:
        ship.name,

      size:
        ship.size,

      sunk:
        ship.sunk,

      hits:
        ship.hits.map(
          hit => ({
            row:
              hit.row,

            col:
              hit.col
          })
        )
    })
  );
}


function battlePublicState(
  room,
  viewerId
) {

  const viewer =
    battlePlayer(
      room,
      viewerId
    );


  const enemy =
    room.players.find(
      player =>
        player.id !==
        viewerId
    ) || null;


  const current =
    battleCurrentPlayer(
      room
    );


  return {

    game:
      "battleship",

    mode:
      room.mode,

    status:
      room.status,

    room:
      room.room,

    players:
      room.players.map(
        player => ({

          id:
            player.id,

          name:
            player.name,

          ready:
            player.ready,

          allPlaced:
            battleAllPlaced(
              player
            ),

          host:
            player.socket ===
            room.host
        })
      ),

    currentPlayer:
      current
        ? current.id
        : null,

    currentPlayerName:
      current
        ? current.name
        : null,

    winner:
      room.winner,

    lastShot:
      room.lastShot,

    logs:
      room.logs,

    me:
      viewer
        ? {

            id:
              viewer.id,

            name:
              viewer.name,

            ready:
              viewer.ready,

            allPlaced:
              battleAllPlaced(
                viewer
              ),

            ships:
              battlePublicShips(
                viewer
              ),

            board:
              viewer.board,

            shots:
              Array.from(
                viewer.shots
              )
                .map(
                  parseBattleCoord
                )
                .filter(Boolean)
          }
        : null,

    enemy:
      enemy
        ? {

            id:
              enemy.id,

            name:
              enemy.name,

            ready:
              enemy.ready,

            allPlaced:
              battleAllPlaced(
                enemy
              ),

            ships:
              battlePublicEnemyShips(
                enemy
              ),

            shots:
              Array.from(
                enemy.shots
              )
                .map(
                  parseBattleCoord
                )
                .filter(Boolean)
          }
        : null,

    isHost:
      viewer
        ? viewer.socket ===
          room.host
        : true
  };
}


/* =========================================================
   ENVOI ETAT BATAILLE
========================================================= */

function sendBattleState(
  room
) {

  for (
    const player of
    room.players
  ) {

    send(
      player.socket,
      {
        type:
          "battleship_state",

        state:
          battlePublicState(
            room,
            player.id
          )
      }
    );
  }


  const hostIsPlayer =
    room.players.some(
      player =>
        player.socket ===
        room.host
    );


  if (
    !hostIsPlayer
  ) {

    send(
      room.host,
      {
        type:
          "battleship_state",

        state:
          battlePublicState(
            room,
            null
          )
      }
    );
  }
}


/* =========================================================
   PLACER NAVIRE
========================================================= */

function battlePlace(
  room,
  player,
  type,
  row,
  col,
  orientation
) {

  if (
    room.status !==
      "placement" &&
    room.status !==
      "waiting"
  ) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          "Le placement est terminé."
      }
    );

    return;
  }


  const result =
    battlePlaceShip(
      player,
      type,
      row,
      col,
      orientation
    );


  if (
    !result.ok
  ) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          result.message
      }
    );

    return;
  }


  room.status =
    "placement";


  addLog(
    room,
    `🚢 ${player.name} place son ${result.ship.name}.`
  );


  sendBattleState(
    room
  );
}


/* =========================================================
   RETIRER NAVIRE
========================================================= */

function battleRemove(
  room,
  player,
  type
) {

  if (
    room.status !==
      "placement" &&
    room.status !==
      "waiting"
  ) {
    return;
  }


  const ship =
    player.ships.find(
      item =>
        item.type ===
        type
    );


  if (!ship) {
    return;
  }


  for (
    const rowCells of
    player.board
  ) {

    for (
      let c = 0;
      c <
        rowCells.length;
      c++
    ) {

      if (
        rowCells[c] ===
        type
      ) {

        rowCells[c] =
          null;
      }
    }
  }


  ship.cells =
    [];

  ship.hits =
    [];

  ship.sunk =
    false;

  player.ready =
    false;


  sendBattleState(
    room
  );
}


/* =========================================================
   FLOTTE ALEATOIRE
========================================================= */

function battleRandomize(
  room,
  player
) {

  if (
    room.status !==
      "placement" &&
    room.status !==
      "waiting"
  ) {
    return;
  }


  if (
    !battleRandomFleet(
      player
    )
  ) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          "Impossible de placer automatiquement la flotte."
      }
    );

    return;
  }


  addLog(
    room,
    `🎲 ${player.name} place automatiquement sa flotte.`
  );


  sendBattleState(
    room
  );
}


/* =========================================================
   READY
========================================================= */

function battleReady(
  room,
  player
) {

  if (
    room.status !==
      "placement" &&
    room.status !==
      "waiting"
  ) {
    return;
  }


  if (
    !battleAllPlaced(
      player
    )
  ) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          "Place les 5 navires avant de valider ta flotte."
      }
    );

    return;
  }


  player.ready =
    !player.ready;


  addLog(
    room,

    player.ready
      ? `✅ ${player.name} valide sa flotte.`
      : `↩️ ${player.name} annule la validation de sa flotte.`
  );


  if (
    room.players.length ===
      2 &&
    room.players.every(
      item =>
        item.ready
    )
  ) {

    battleStart(
      room
    );

    return;
  }


  room.status =
    "placement";


  sendBattleState(
    room
  );
}


/* =========================================================
   TIR
========================================================= */

function battleShoot(
  room,
  player,
  row,
  col
) {

  if (
    room.status !==
    "playing"
  ) {
    return;
  }


  const current =
    battleCurrentPlayer(
      room
    );


  if (
    !current ||
    current.id !==
      player.id
  ) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          "Ce n'est pas ton tour."
      }
    );

    return;
  }


  const target =
    room.players.find(
      item =>
        item.id !==
        player.id
    );


  if (!target) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          "Adversaire introuvable."
      }
    );

    return;
  }


  if (
    !Number.isInteger(
      row
    ) ||
    !Number.isInteger(
      col
    ) ||
    row < 0 ||
    row >=
      BATTLESHIP_SIZE ||
    col < 0 ||
    col >=
      BATTLESHIP_SIZE
  ) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          "Case invalide."
      }
    );

    return;
  }


  const key =
    battleCoord(
      row,
      col
    );


  if (
    player.shots.has(
      key
    )
  ) {

    send(
      player.socket,
      {
        type:
          "error",

        message:
          "Tu as déjà tiré sur cette case."
      }
    );

    return;
  }


  player.shots.add(
    key
  );


  const cellValue =
    target.board[
      row
    ][
      col
    ];


  let result =
    "miss";

  let sunkShip =
    null;


  if (
    cellValue !==
    null
  ) {

    result =
      "hit";


    const ship =
      battleShipByCell(
        target,
        row,
        col
      );


    if (ship) {

      if (
        !ship.hits.some(
          hit =>
            hit.row ===
              row &&
            hit.col ===
              col
        )
      ) {

        ship.hits.push({
          row,
          col
        });
      }


      if (
        battleShipSunk(
          ship
        )
      ) {

        ship.sunk =
          true;

        sunkShip =
          ship;

        result =
          "sunk";
      }
    }
  }


  room.lastShot = {

    playerId:
      player.id,

    playerName:
      player.name,

    row,

    col,

    result,

    shipType:
      sunkShip
        ? sunkShip.type
        : null,

    shipName:
      sunkShip
        ? sunkShip.name
        : null
  };


  const coord =
    `${String.fromCharCode(
      65 + col
    )}${row + 1}`;


  if (
    result ===
    "miss"
  ) {

    addLog(
      room,
      `💦 ${player.name} tire en ${coord} : À L'EAU !`
    );

  } else if (
    result ===
    "hit"
  ) {

    addLog(
      room,
      `💥 ${player.name} touche un navire en ${coord} !`
    );

  } else {

    addLog(
      room,
      `🔥 ${player.name} coule le ${sunkShip.name} !`
    );
  }


  /*
     Victoire.
  */

  if (
    battleAllShipsSunk(
      target
    )
  ) {

    room.status =
      "finished";

    room.winner =
      player.id;

    room.currentPlayerId =
      null;


    addLog(
      room,
      `🏆 ${player.name} remporte la Bataille Navale !`
    );


    broadcast(
      room,
      {
        type:
          "battleship_end",

        winner:
          player.name,

        winnerId:
          player.id
      }
    );


    sendBattleState(
      room
    );

    return;
  }


  battleAdvanceTurn(
    room
  );


  sendBattleState(
    room
  );
}


/* =========================================================
   NOUVELLE PARTIE BATAILLE
========================================================= */

function battleNewGame(
  room
) {

  battlePrepareNewRound(
    room
  );


  addLog(
    room,
    "🔄 Nouvelle partie de Bataille Navale prête."
  );


  sendBattleState(
    room
  );
}


/* =========================================================
   ====================== CONNEXIONS =======================
========================================================= */

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


        try {

          data =
            JSON.parse(
              raw.toString()
            );

        } catch {

          return;
        }


        /* =================================================
           CREATION SALON
        ================================================= */

        if (
          data.type ===
          "create_room"
        ) {

          /*
             Nouveau jeu :
             Bataille Navale.
          */

          if (
            data.game ===
            "battleship"
          ) {

            const room =
              createBattleRoom(
                socket,
                data.mode,
                data.name
              );


            socket.room =
              room.room;


            send(
              socket,
              {
                type:
                  "battleship_room_created",

                room:
                  room.room,

                playerId:
                  socket.playerId ||
                  null,

                mode:
                  room.mode
              }
            );


            sendBattleState(
              room
            );


            return;
          }


          /*
             Sinon :
             UNO classique.
          */

          const room =
            makeRoom(
              socket,
              data.mode,
              data.name,
              data.stacking,
              data.handSize
            );


          socket.room =
            room.room;


          send(
            socket,
            {
              type:
                "room_created",

              room:
                room.room,

              playerId:
                socket.playerId ||
                null,

              mode:
                room.mode
            }
          );


          sendState(
            room
          );


          return;
        }


        /* =================================================
           REJOINDRE BATAILLE NAVALE
        ================================================= */

        if (
          data.type ===
          "join_battleship_room"
        ) {

          const code =
            String(
              data.room ||
              ""
            )
              .trim()
              .toUpperCase();


          const room =
            rooms.get(
              code
            );


          if (
            !room ||
            room.game !==
              "battleship"
          ) {

            send(
              socket,
              {
                type:
                  "error",

                message:
                  "Salon de Bataille Navale introuvable."
              }
            );

            return;
          }


          if (
            room.players.length >=
            BATTLESHIP_MAX_PLAYERS
          ) {

            send(
              socket,
              {
                type:
                  "error",

                message:
                  "La partie est déjà complète."
              }
            );

            return;
          }


          if (
            room.status ===
              "playing" ||
            room.status ===
              "finished"
          ) {

            send(
              socket,
              {
                type:
                  "error",

                message:
                  "La partie a déjà commencé."
              }
            );

            return;
          }


          const name =
            String(
              data.name ||
              "Joueur"
            )
              .trim()
              .slice(
                0,
                18
              ) ||
            "Joueur";


          const player =
            createBattlePlayer(
              makeId(),
              name,
              socket
            );


          room.players.push(
            player
          );


          socket.room =
            room.room;

          socket.playerId =
            player.id;


          room.status =
            "placement";


          addLog(
            room,
            `👋 ${player.name} rejoint la Bataille Navale.`
          );


          send(
            socket,
            {
              type:
                "battleship_joined",

              room:
                room.room,

              playerId:
                player.id,

              mode:
                room.mode
            }
          );


          sendBattleState(
            room
          );


          return;
        }


        /* =================================================
           REJOINDRE UNO
        ================================================= */

        if (
          data.type ===
          "join_room"
        ) {

          const code =
            String(
              data.room ||
              ""
            )
              .trim()
              .toUpperCase();


          const room =
            rooms.get(
              code
            );


          if (!room) {

            send(
              socket,
              {
                type:
                  "error",

                message:
                  "Salon introuvable."
              }
            );

            return;
          }


          /*
             Empêche un joueur UNO
             de rejoindre une salle
             Bataille Navale.
          */

          if (
            room.game ===
            "battleship"
          ) {

            send(
              socket,
              {
                type:
                  "error",

                message:
                  "Ce code correspond à une partie de Bataille Navale."
              }
            );

            return;
          }


          if (
            room.status !==
            "waiting"
          ) {

            send(
              socket,
              {
                type:
                  "error",

                message:
                  "La partie a déjà commencé."
              }
            );

            return;
          }


          if (
            room.players.length >=
            MAX_PLAYERS
          ) {

            send(
              socket,
              {
                type:
                  "error",

                message:
                  "Salon complet."
              }
            );

            return;
          }


          const name =
            String(
              data.name ||
              "Joueur"
            )
              .trim()
              .slice(
                0,
                18
              ) ||
            "Joueur";


          const player = {

            id:
              makeId(),

            name,

            socket,

            hand: [],

            score:
              0,

            hasDrawn:
              false,

            drawnCardId:
              null
          };


          room.players.push(
            player
          );


          socket.room =
            room.room;

          socket.playerId =
            player.id;


          addLog(
            room,
            `👋 ${player.name} rejoint le salon.`
          );


          send(
            socket,
            {
              type:
                "joined",

              room:
                room.room,

              playerId:
                player.id,

              mode:
                room.mode
            }
          );


          sendState(
            room
          );


          return;
        }


        /* =================================================
           ROOM ACTUEL
        ================================================= */

        const room =
          rooms.get(
            socket.room
          );


        if (!room) {
          return;
        }


        const player =
          room.players.find(
            p =>
              p.id ===
              socket.playerId
          );


        /* =================================================
           ROUTAGE BATAILLE NAVALE
        ================================================= */

        if (
          room.game ===
          "battleship"
        ) {

          /*
             Placement.
          */

          if (
            data.type ===
            "battle_place_ship"
          ) {

            if (player) {

              battlePlace(
                room,
                player,
                String(
                  data.shipType ||
                  ""
                ),
                Number(
                  data.row
                ),
                Number(
                  data.col
                ),
                data.orientation
              );
            }

            return;
          }


          /*
             Retirer un navire.
          */

          if (
            data.type ===
            "battle_remove_ship"
          ) {

            if (player) {

              battleRemove(
                room,
                player,
                String(
                  data.shipType ||
                  ""
                )
              );
            }

            return;
          }


          /*
             Placement aléatoire.
          */

          if (
            data.type ===
            "battle_randomize"
          ) {

            if (player) {

              battleRandomize(
                room,
                player
              );
            }

            return;
          }


          /*
             Prêt.
          */

          if (
            data.type ===
            "battle_ready"
          ) {

            if (player) {

              battleReady(
                room,
                player
              );
            }

            return;
          }


          /*
             Tir.
          */

          if (
            data.type ===
            "battle_shoot"
          ) {

            if (player) {

              battleShoot(
                room,
                player,
                Number(
                  data.row
                ),
                Number(
                  data.col
                )
              );
            }

            return;
          }


          /*
             Nouvelle partie.
          */

          if (
            data.type ===
            "battle_new_game"
          ) {

            if (
              socket ===
              room.host
            ) {

              battleNewGame(
                room
              );
            }

            return;
          }


          return;
        }


        /* =================================================
           ====================== UNO =======================
        ================================================= */

        /*
           Démarrer.
        */

        if (
          data.type ===
          "start_game"
        ) {

          if (
            socket ===
            room.host
          ) {

            startGame(
              room
            );
          }

          return;
        }


        /*
           Jouer carte.
        */

        if (
          data.type ===
          "play_card"
        ) {

          if (player) {

            playCard(
              room,
              player,
              Number(
                data.index
              ),
              data.color
            );
          }

          return;
        }


        /*
           Pioche.
        */

        if (
          data.type ===
          "draw"
        ) {

          if (player) {

            drawCard(
              room,
              player
            );
          }

          return;
        }


        /*
           UNO challenge.
        */

        if (
          data.type ===
          "uno_challenge"
        ) {

          if (player) {

            challengeUno(
              room,
              player
            );
          }

          return;
        }


        /*
           Nouvelle manche.
        */

        if (
          data.type ===
          "new_game"
        ) {

          if (
            socket ===
            room.host
          ) {

            resetRound(
              room
            );
          }

          return;
        }
      }
    );


    /* =====================================================
       DECONNEXION
    ===================================================== */

    socket.on(
      "close",
      () => {

        const room =
          rooms.get(
            socket.room
          );


        if (!room) {
          return;
        }


        /* ================================================
           DECONNEXION BATAILLE
        ================================================ */

        if (
          room.game ===
          "battleship"
        ) {

          const leaving =
            room.players.find(
              player =>
                player.socket ===
                socket
            );


          if (!leaving) {
            return;
          }


          const wasCurrent =
            leaving.id ===
            room.currentPlayerId;


          const index =
            room.players.findIndex(
              player =>
                player.id ===
                leaving.id
            );


          if (
            index !==
            -1
          ) {

            room.players.splice(
              index,
              1
            );
          }


          addLog(
            room,
            `🚪 ${leaving.name} quitte le salon.`
          );


          /*
             Plus personne.
          */

          if (
            room.players.length ===
            0
          ) {

            rooms.delete(
              room.room
            );

            return;
          }


          /*
             Transfert du créateur
             en mode téléphones.
          */

          if (
            room.host ===
            leaving.socket
          ) {

            if (
              room.mode ===
              "phones"
            ) {

              room.host =
                room.players[
                  0
                ].socket;


              addLog(
                room,
                `👑 ${room.players[0].name} devient créateur.`
              );

            } else {

              /*
                 En mode TV,
                 si l'écran part,
                 on supprime la salle.
              */

              rooms.delete(
                room.room
              );

              return;
            }
          }


          /*
             Si la partie était en cours
             et que le joueur actif part,
             l'autre joueur récupère le tour.
          */

          if (
            room.status ===
              "playing" &&
            wasCurrent
          ) {

            room.currentPlayerId =
              room.players[
                0
              ]?.id ||
              null;
          }


          /*
             S'il ne reste qu'un joueur,
             retour au lobby.
          */

          if (
            room.players.length <
            2
          ) {

            room.status =
              "waiting";

            room.currentPlayerId =
              null;

            room.winner =
              null;
          }


          sendBattleState(
            room
          );


          return;
        }


        /* ================================================
           DECONNEXION UNO
        ================================================ */

        const index =
          room.players.findIndex(
            player =>
              player.socket ===
              socket
          );


        if (
          index !==
          -1
        ) {

          const leaving =
            room.players[index];


          const wasCurrent =
            leaving.id ===
            room.currentPlayerId;


          room.players.splice(
            index,
            1
          );


          addLog(
            room,
            `🚪 ${leaving.name} quitte le salon.`
          );


          /*
             Challenge UNO.
          */

          if (
            room.unoChallenge &&
            room.unoChallenge.targetId ===
              leaving.id
          ) {

            room.unoChallenge =
              null;
          }


          /*
             Transfert du créateur
             en mode téléphones.
          */

          if (
            socket ===
            room.host
          ) {

            if (
              room.mode ===
              "phones" &&
              room.players.length
            ) {

              room.host =
                room.players[
                  0
                ].socket;


              addLog(
                room,
                `👑 ${room.players[0].name} devient créateur.`
              );

            } else if (
              room.mode ===
              "tv"
            ) {

              rooms.delete(
                room.room
              );

              return;

            } else if (
              !room.players.length
            ) {

              rooms.delete(
                room.room
              );

              return;
            }
          }


          if (
            !room.players.length
          ) {

            rooms.delete(
              room.room
            );

            return;
          }


          /*
             Si le joueur actif part,
             on passe au joueur suivant.
          */

          if (
            wasCurrent &&
            room.status ===
              "playing"
          ) {

            const nextIndex =
              Math.min(
                index,
                room.players.length -
                  1
              );


            room.currentPlayerId =
              room.players[
                nextIndex
              ].id;


            addLog(
              room,
              `➡️ Le tour passe à ${currentPlayer(room).name}.`
            );
          }


          sendState(
            room
          );
        }

      }
    );
  }
);


/* =========================================================
   LANCEMENT SERVEUR
========================================================= */

server.listen(
  PORT,
  () => {

    console.log(
      `Jeux2Soirée server lancé sur le port ${PORT} — UNO + Bataille Navale`
    );
  }
);
