const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 10000;

/* =========================================================
   CONFIGURATION UNO
========================================================= */

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

const HEARTBEAT_INTERVAL = 20000;

/* =========================================================
   CONFIGURATION MONOPOLY
========================================================= */

const MONOPOLY_MIN_PLAYERS = 2;
const MONOPOLY_MAX_PLAYERS = 8;
const MONOPOLY_START_MONEY = 1500;
const MONOPOLY_MAX_LOGS = 100;

/* =========================================================
   SERVEUR HTTP
========================================================= */

const server = http.createServer((req, res) => {

  res.writeHead(
    200,
    {
      "Content-Type": "text/plain; charset=utf-8"
    }
  );

  res.end(
    "Serveur Jeux2Soirée opérationnel. UNO + Monopoly."
  );

});

/* =========================================================
   WEBSOCKET
========================================================= */

const wss = new WebSocket.Server({
  server
});

/* =========================================================
   SALONS UNO
========================================================= */

const rooms = new Map();

/* =========================================================
   SALONS MONOPOLY
========================================================= */

const monopolyRooms = new Map();

/* =========================================================
   OUTILS COMMUNS
========================================================= */

function makeId() {

  return crypto
    .randomBytes(8)
    .toString("hex");

}

function makeRoomCode() {

  let code;

  do {

    code =
      crypto
        .randomBytes(3)
        .toString("hex")
        .slice(0, 4)
        .toUpperCase();

  } while (
    rooms.has(code) ||
    monopolyRooms.has(code)
  );

  return code;

}

function shuffle(deck) {

  for (
    let i = deck.length - 1;
    i > 0;
    i--
  ) {

    const j =
      crypto.randomInt(i + 1);

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

  for (
    const player of room.players
  ) {

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

/* =========================================================
   =========================================================
   UNO
   =========================================================
========================================================= */

/* =========================================================
   PAQUET UNO
========================================================= */

function createDeck() {

  const deck = [];

  for (
    const color of COLORS
  ) {

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

    for (
      let i = 0;
      i < 2;
      i++
    ) {

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

  for (
    let i = 0;
    i < 4;
    i++
  ) {

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
   LOGS UNO
========================================================= */

function addLog(room, text) {

  room.logs.push({
    time:
      new Date().toLocaleTimeString(
        "fr-FR",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      ),

    text
  });

  if (
    room.logs.length > MAX_LOGS
  ) {

    room.logs.shift();

  }

}

/* =========================================================
   JOUEURS UNO
========================================================= */

function currentPlayer(room) {

  return room.players.find(
    player =>
      player.id ===
      room.currentPlayerId
  ) || null;

}

function getNextPlayer(
  room,
  steps = 1
) {

  if (
    !room.players.length
  ) {

    return null;

  }

  const currentIndex =
    room.players.findIndex(
      player =>
        player.id ===
        room.currentPlayerId
    );

  if (
    currentIndex < 0
  ) {

    return room.players[0];

  }

  const index =
    (
      currentIndex +
      room.direction *
      steps +
      room.players.length *
      1000
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
   PIOCHE UNO
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

  if (
    !room.deck.length
  ) {

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
   RÈGLES UNO
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
   POINTS UNO
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

    return String(card.value);

  }

  return {
    skip: "PASS",
    reverse: "REVERSE",
    draw2: "+2",
    wild: "CHANGEMENT DE COULEUR",
    wild4: "+4"
  }[
    card.type
  ] || card.type;

}

/* =========================================================
   ÉTAT PUBLIC UNO
========================================================= */

function publicState(
  room,
  viewerId
) {

  const viewer =
    room.players.find(
      player =>
        player.id === viewerId
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

          id:
            player.id,

          name:
            player.name,

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

    penaltyDecision:
      room.penaltyDecision
        ? {

          targetId:
            room.penaltyDecision.targetId,

          targetName:
            room.penaltyDecision.targetName,

          amount:
            room.penaltyDecision.amount

        }
        : null,

    me:
      viewer
        ? {

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

function sendState(room) {

  for (
    const player of room.players
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
   CRÉATION SALON UNO
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

    currentPlayerId: null,

    direction: 1,

    currentColor: null,

    pendingDraw: 0,

    status: "waiting",

    winner: null,

    logs: [],

    unoChallenge: null,

    penaltyDecision: null,

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

  if (
    room.mode === "phones"
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
        .slice(0, 18) ||
        "Créateur",

      socket:
        hostSocket,

      hand: [],

      score: 0,

      roundWins: 0,

      hasDrawn: false,

      drawnCardId: null

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
   DÉMARRAGE UNO
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

  room.discard = [];

  room.pendingDraw = 0;

  room.direction = 1;

  room.currentPlayerId = null;

  room.currentColor = null;

  room.winner = null;

  room.status = "playing";

  room.unoChallenge = null;

  room.penaltyDecision = null;

  for (
    const player of room.players
  ) {

    player.hand = [];

    player.hasDrawn = false;

    player.drawnCardId = null;

  }

  for (
    let round = 0;
    round <
    room.settings.handSize;
    round++
  ) {

    for (
      const player of room.players
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

  let first = null;

  const rejected = [];

  while (
    room.deck.length
  ) {

    const card =
      drawOne(room);

    if (!card) {
      break;
    }

    if (
      card.type === "number"
    ) {

      first = card;

      break;

    }

    rejected.push(card);

  }

  for (
    const card of rejected
  ) {

    room.deck.push(card);

  }

  shuffle(room.deck);

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
   FLAGS UNO
========================================================= */

function resetPlayerTurnFlags(
  player
) {

  player.hasDrawn = false;

  player.drawnCardId = null;

}

/* =========================================================
   FIN CARTE UNO
========================================================= */

function advanceAfterCard(
  room,
  card
) {

  if (
    card.type === "skip"
  ) {

    nextPlayer(room, 2);

    addLog(
      room,
      "⛔ Le tour est passé."
    );

    return;

  }

  if (
    card.type === "reverse"
  ) {

    if (
      room.players.length === 2
    ) {

      nextPlayer(room, 2);

      addLog(
        room,
        "↔ Reverse à 2 joueurs : le joueur suivant est passé."
      );

    } else {

      room.direction *= -1;

      nextPlayer(room, 1);

      addLog(
        room,
        "↔ Sens de jeu inversé."
      );

    }

    return;

  }

  if (
    card.type === "draw2"
  ) {

    room.pendingDraw =
      room.settings.stacking
        ? room.pendingDraw + 2
        : 2;

    nextPlayer(room, 1);

    addLog(
      room,
      `⚠️ +${room.pendingDraw} en attente : le joueur suivant peut répondre ou piocher.`
    );

    return;

  }

  if (
    card.type === "wild4"
  ) {

    room.pendingDraw = 4;

    nextPlayer(room, 1);

    addLog(
      room,
      "⚠️ +4 en attente : le joueur suivant peut répondre ou piocher."
    );

    return;

  }

  nextPlayer(room, 1);

}

/* =========================================================
   FIN MANCHE UNO
========================================================= */

function finishRound(
  room,
  winner
) {

  let points = 0;

  for (
    const player of room.players
  ) {

    if (
      player.id === winner.id
    ) {
      continue;
    }

    for (
      const card of player.hand
    ) {

      points +=
        cardPoints(card);

    }

  }

  winner.score += points;

  winner.roundWins =
    (winner.roundWins || 0) + 1;

  room.winner =
    winner.id;

  room.status =
    "finished";

  room.currentPlayerId =
    null;

  room.pendingDraw = 0;

  room.penaltyDecision = null;

  room.unoChallenge = null;

  addLog(
    room,
    `🏆 ${winner.name} remporte la manche et gagne ${points} point(s).`
  );

  broadcast(
    room,
    {
      type: "round_end",

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
) {

  room.unoChallenge = {

    targetId:
      player.id,

    targetName:
      player.name,

    resolved: false

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

  challenge.resolved = true;

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

    room.unoChallenge = null;

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

    const amount = 2;

    const drawn =
      drawCards(
        room,
        target,
        amount
      );

    addLog(
      room,
      `🚨 ${
        claimedBy
          ? claimedBy.name
          : "Un joueur"
      } a buzzé en premier : ${target.name} pioche ${drawn} carte(s).`
    );

  }

  room.unoChallenge = null;

  nextPlayer(room, 1);

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
    room.status !== "playing"
  ) {
    return;
  }

  if (
    room.unoChallenge
  ) {

    send(
      player.socket,
      {
        type: "error",
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
    current.id !== player.id
  ) {

    send(
      player.socket,
      {
        type: "error",
        message:
          "Ce n'est pas ton tour."
      }
    );

    return;

  }

  if (
    room.penaltyDecision &&
    room.penaltyDecision.targetId !==
    player.id
  ) {

    send(
      player.socket,
      {
        type: "error",
        message:
          "Le joueur visé doit d'abord décider."
      }
    );

    return;

  }

  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= player.hand.length
  ) {

    return;

  }

  const card =
    player.hand[index];

  if (
    player.hasDrawn &&
    player.drawnCardId &&
    card.id !==
    player.drawnCardId
  ) {

    send(
      player.socket,
      {
        type: "error",
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
        type: "error",
        message:
          "Cette carte ne peut pas être jouée ici."
      }
    );

    return;

  }

  if (
    (
      card.type === "wild" ||
      card.type === "wild4"
    ) &&
    !COLORS.includes(
      chosenColor
    )
  ) {

    send(
      player.socket,
      {
        type: "color_required",
        cardIndex: index
      }
    );

    return;

  }

  const wasPenalty =
    room.pendingDraw > 0;

  const previousPenalty =
    room.pendingDraw;

  room.pendingDraw = 0;

  room.penaltyDecision = null;

  player.hand.splice(
    index,
    1
  );

  resetPlayerTurnFlags(
    player
  );

  room.discard.push(card);

  if (
    card.type === "wild" ||
    card.type === "wild4"
  ) {

    room.currentColor =
      chosenColor;

  } else {

    room.currentColor =
      card.color;

  }

  addLog(
    room,
    `🃏 ${player.name} joue ${cardLabel(card)}${
      chosenColor
        ? ` → ${chosenColor.toUpperCase()}`
        : ""
    }.`
  );

  if (wasPenalty) {

    addLog(
      room,
      `🛡️ ${player.name} répond à la pénalité de +${previousPenalty} au lieu de la prendre.`
    );

  }

  if (
    player.hand.length === 0
  ) {

    finishRound(
      room,
      player
    );

    return;

  }

  if (
    player.hand.length === 1
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

    nextPlayer(room, 1);

    sendState(room);

    return;

  }

  player.hand.push(card);

  player.hasDrawn = true;

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

    nextPlayer(room, 1);

  } else {

    addLog(
      room,
      `✨ ${player.name} peut jouer la carte piochée.`
    );

  }

  sendState(room);

}

/* =========================================================
   PIOCHE PÉNALITÉ UNO
========================================================= */

function drawPenalty(
  room,
  player
) {

  const amount =
    room.pendingDraw;

  if (!amount) {
    return;
  }

  const drawn =
    drawCards(
      room,
      player,
      amount
    );

  room.pendingDraw = 0;

  room.penaltyDecision = null;

  resetPlayerTurnFlags(
    player
  );

  addLog(
    room,
    `⚠️ ${player.name} prend la pénalité de +${amount} et pioche ${drawn} carte(s).`
  );

  nextPlayer(room, 1);

  sendState(room);

}

/* =========================================================
   ACTION PIOCHER UNO
========================================================= */

function drawCard(
  room,
  player
) {

  if (
    room.status !== "playing"
  ) {
    return;
  }

  if (
    room.unoChallenge
  ) {

    send(
      player.socket,
      {
        type: "error",
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
    current.id !== player.id
  ) {

    send(
      player.socket,
      {
        type: "error",
        message:
          "Ce n'est pas ton tour."
      }
    );

    return;

  }

  if (
    room.penaltyDecision &&
    room.penaltyDecision.targetId !==
    player.id
  ) {

    send(
      player.socket,
      {
        type: "error",
        message:
          "Le joueur visé doit d'abord décider."
      }
    );

    return;

  }

  if (
    player.hasDrawn
  ) {

    send(
      player.socket,
      {
        type: "error",
        message:
          "Tu as déjà pioché."
      }
    );

    return;

  }

  if (
    room.pendingDraw > 0
  ) {

    room.penaltyDecision = {

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

function resetRound(room) {

  room.status = "waiting";

  room.deck = [];

  room.discard = [];

  room.currentPlayerId =
    null;

  room.currentColor =
    null;

  room.direction = 1;

  room.pendingDraw = 0;

  room.unoChallenge =
    null;

  room.penaltyDecision =
    null;

  room.winner =
    null;

  for (
    const player of room.players
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
   =========================================================
   MONOPOLY
   =========================================================
========================================================= */

/*
 * Monopoly Europe 2001 - France
 *
 * Positions :
 *
 * 0  Départ
 * 1  Vilnius
 * 2  Caisse de communauté
 * 3  Riga
 * 4  Impôt sur le revenu
 * 5  Aéroport Schiphol
 * 6  Sofia
 * 7  Chance
 * 8  Bucarest
 * 9  Varsovie
 * 10 Prison / Simple visite
 * 11 Budapest
 * 12 Parlement européen
 * 13 Berne
 * 14 Helsinki
 * 15 Aéroport de Francfort
 * 16 Stockholm
 * 17 Caisse de communauté
 * 18 Vienne
 * 19 Lisbonne
 * 20 Parc gratuit
 * 21 Madrid
 * 22 Chance
 * 23 Athènes
 * 24 Dublin
 * 25 Aéroport de Londres-Heathrow
 * 26 Londres
 * 27 Copenhague
 * 28 Cour européenne de justice
 * 29 Luxembourg
 * 30 Allez en prison
 * 31 Bruxelles
 * 32 Amsterdam
 * 33 Caisse de communauté
 * 34 Rome
 * 35 Aéroport Roissy-CDG
 * 36 Chance
 * 37 Berlin
 * 38 Taxe de luxe
 * 39 Paris
 */

const MONOPOLY_BOARD = [

  {
    position: 0,
    type: "start",
    name: "Départ"
  },

  {
    position: 1,
    type: "property",
    name: "Vilnius",
    group: "brown",
    price: 60,
    rent: [2, 10, 30, 90, 160, 250]
  },

  {
    position: 2,
    type: "community",
    name: "Caisse de communauté"
  },

  {
    position: 3,
    type: "property",
    name: "Riga",
    group: "brown",
    price: 60,
    rent: [4, 20, 60, 180, 320, 450]
  },

  {
    position: 4,
    type: "tax",
    name: "Impôt sur le revenu",
    amount: 200
  },

  {
    position: 5,
    type: "station",
    name: "Aéroport Schiphol",
    price: 200,
    rent: [25, 50, 100, 200]
  },

  {
    position: 6,
    type: "property",
    name: "Sofia",
    group: "lightblue",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550]
  },

  {
    position: 7,
    type: "chance",
    name: "Chance"
  },

  {
    position: 8,
    type: "property",
    name: "Bucarest",
    group: "lightblue",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550]
  },

  {
    position: 9,
    type: "property",
    name: "Varsovie",
    group: "lightblue",
    price: 120,
    rent: [8, 40, 100, 300, 450, 600]
  },

  {
    position: 10,
    type: "jail",
    name: "Prison / Simple visite"
  },

  {
    position: 11,
    type: "property",
    name: "Budapest",
    group: "pink",
    price: 140,
    rent: [10, 50, 150, 450, 625, 750]
  },

  {
    position: 12,
    type: "utility",
    name: "Parlement européen",
    price: 150
  },

  {
    position: 13,
    type: "property",
    name: "Berne",
    group: "pink",
    price: 140,
    rent: [10, 50, 150, 450, 625, 750]
  },

  {
    position: 14,
    type: "property",
    name: "Helsinki",
    group: "pink",
    price: 160,
    rent: [12, 60, 180, 500, 700, 900]
  },

  {
    position: 15,
    type: "station",
    name: "Aéroport de Francfort",
    price: 200,
    rent: [25, 50, 100, 200]
  },

  {
    position: 16,
    type: "property",
    name: "Stockholm",
    group: "orange",
    price: 180,
    rent: [14, 70, 200, 550, 750, 950]
  },

  {
    position: 17,
    type: "community",
    name: "Caisse de communauté"
  },

  {
    position: 18,
    type: "property",
    name: "Vienne",
    group: "orange",
    price: 180,
    rent: [14, 70, 200, 550, 750, 950]
  },

  {
    position: 19,
    type: "property",
    name: "Lisbonne",
    group: "orange",
    price: 200,
    rent: [16, 80, 220, 600, 800, 1000]
  },

  {
    position: 20,
    type: "freeparking",
    name: "Parc gratuit"
  },

  {
    position: 21,
    type: "property",
    name: "Madrid",
    group: "red",
    price: 220,
    rent: [18, 90, 250, 700, 875, 1050]
  },

  {
    position: 22,
    type: "chance",
    name: "Chance"
  },

  {
    position: 23,
    type: "property",
    name: "Athènes",
    group: "red",
    price: 220,
    rent: [18, 90, 250, 700, 875, 1050]
  },

  {
    position: 24,
    type: "property",
    name: "Dublin",
    group: "red",
    price: 240,
    rent: [20, 100, 300, 750, 925, 1100]
  },

  {
    position: 25,
    type: "station",
    name: "Aéroport de Londres-Heathrow",
    price: 200,
    rent: [25, 50, 100, 200]
  },

  {
    position: 26,
    type: "property",
    name: "Londres",
    group: "yellow",
    price: 260,
    rent: [22, 110, 330, 800, 975, 1150]
  },

  {
    position: 27,
    type: "property",
    name: "Copenhague",
    group: "yellow",
    price: 260,
    rent: [22, 110, 330, 800, 975, 1150]
  },

  {
    position: 28,
    type: "utility",
    name: "Cour européenne de justice",
    price: 150
  },

  {
    position: 29,
    type: "property",
    name: "Luxembourg",
    group: "yellow",
    price: 280,
    rent: [24, 120, 360, 850, 1025, 1200]
  },

  {
    position: 30,
    type: "gotojail",
    name: "Allez en prison"
  },

  {
    position: 31,
    type: "property",
    name: "Bruxelles",
    group: "green",
    price: 300,
    rent: [26, 130, 390, 900, 1100, 1275]
  },

  {
    position: 32,
    type: "property",
    name: "Amsterdam",
    group: "green",
    price: 300,
    rent: [26, 130, 390, 900, 1100, 1275]
  },

  {
    position: 33,
    type: "community",
    name: "Caisse de communauté"
  },

  {
    position: 34,
    type: "property",
    name: "Rome",
    group: "green",
    price: 320,
    rent: [28, 150, 450, 1000, 1200, 1400]
  },

  {
    position: 35,
    type: "station",
    name: "Aéroport Roissy-Charles-de-Gaulle",
    price: 200,
    rent: [25, 50, 100, 200]
  },

  {
    position: 36,
    type: "chance",
    name: "Chance"
  },

  {
    position: 37,
    type: "property",
    name: "Berlin",
    group: "darkblue",
    price: 350,
    rent: [35, 175, 500, 1100, 1300, 1500]
  },

  {
    position: 38,
    type: "tax",
    name: "Taxe de luxe",
    amount: 100
  },

  {
    position: 39,
    type: "property",
    name: "Paris",
    group: "darkblue",
    price: 400,
    rent: [50, 200, 600, 1400, 1700, 2000]
  }

];

const MONOPOLY_GROUPS = {

  brown: [
    1,
    3
  ],

  lightblue: [
    6,
    8,
    9
  ],

  pink: [
    11,
    13,
    14
  ],

  orange: [
    16,
    18,
    19
  ],

  red: [
    21,
    23,
    24
  ],

  yellow: [
    26,
    27,
    29
  ],

  green: [
    31,
    32,
    34
  ],

  darkblue: [
    37,
    39
  ]

};

/* =========================================================
   OUTILS MONOPOLY
========================================================= */

function monopolyBoardTile(position) {

  return (
    MONOPOLY_BOARD[position] ||
    null
  );

}

function monopolyCreateRoom(
  socket,
  hostName
) {

  const room = {

    room:
      makeRoomCode(),

    host:
      socket,

    players: [],

    status:
      "waiting",

    currentPlayerId:
      null,

    turn:
      0,

    dice: null,

    hasRolled:
      false,

    doubles:
      0,

    properties:
      {},

    logs: [],

    winner:
      null

  };

  monopolyRooms.set(
    room.room,
    room
  );

  const player = {

    id:
      makeId(),

    name:
      String(
        hostName ||
        "Créateur"
      )
      .trim()
      .slice(0, 18) ||
      "Créateur",

    socket,

    money:
      MONOPOLY_START_MONEY,

    position:
      0,

    bankrupt:
      false,

    inJail:
      false,

    jailTurns:
      0

  };

  room.players.push(
    player
  );

  socket.monopolyRoom =
    room.room;

  socket.monopolyPlayerId =
    player.id;

  monopolyAddLog(
    room,
    `🏠 Salon Monopoly créé par ${player.name}.`
  );

  return room;

}

function monopolyAddLog(
  room,
  text
) {

  room.logs.push({

    time:
      new Date().toLocaleTimeString(
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
    MONOPOLY_MAX_LOGS
  ) {

    room.logs.shift();

  }

}

function monopolyCurrentPlayer(
  room
) {

  return room.players.find(
    player =>
      player.id ===
      room.currentPlayerId
  ) || null;

}

function monopolyGetNextPlayer(
  room,
  fromId
) {

  const activePlayers =
    room.players.filter(
      player =>
        !player.bankrupt
    );

  if (
    activePlayers.length === 0
  ) {

    return null;

  }

  const index =
    activePlayers.findIndex(
      player =>
        player.id === fromId
    );

  if (
    index === -1
  ) {

    return activePlayers[0];

  }

  return activePlayers[
    (index + 1) %
    activePlayers.length
  ];

}

function monopolySendState(
  room
) {

  for (
    const player of room.players
  ) {

    send(
      player.socket,
      {
        type:
          "monopoly_state",

        state:
          monopolyPublicState(
            room,
            player.id
          )
      }
    );

  }

  if (
    room.host &&
    !room.players.some(
      player =>
        player.socket ===
        room.host
    )
  ) {

    send(
      room.host,
      {
        type:
          "monopoly_state",

        state:
          monopolyPublicState(
            room,
            null
          )
      }
    );

  }

}

function monopolyPublicState(
  room,
  viewerId
) {

  return {

    room:
      room.room,

    status:
      room.status,

    players:
      room.players.map(
        player => ({

          id:
            player.id,

          name:
            player.name,

          money:
            player.money,

          position:
            player.position,

          bankrupt:
            player.bankrupt,

          inJail:
            player.inJail,

          jailTurns:
            player.jailTurns,

          host:
            player.socket ===
            room.host

        })
      ),

    currentPlayer:
      room.currentPlayerId,

    currentPlayerName:
      monopolyCurrentPlayer(room)
        ?.name || null,

    dice:
      room.dice,

    hasRolled:
      room.hasRolled,

    doubles:
      room.doubles,

    properties:
      room.properties,

    logs:
      room.logs,

    winner:
      room.winner,

    me:
      viewerId
        ? room.players.find(
            player =>
              player.id ===
              viewerId
          ) || null
        : null,

    board:
      MONOPOLY_BOARD

  };

}

/* =========================================================
   DÉMARRAGE MONOPOLY
========================================================= */

function monopolyStartGame(
  room,
  socket
) {

  if (
    socket !==
    room.host
  ) {

    send(
      socket,
      {
        type:
          "monopoly_error",

        message:
          "Seul le créateur peut démarrer la partie."
      }
    );

    return;

  }

  if (
    room.players.length <
    MONOPOLY_MIN_PLAYERS
  ) {

    send(
      socket,
      {
        type:
          "monopoly_error",

        message:
          `Il faut au moins ${MONOPOLY_MIN_PLAYERS} joueurs.`
      }
    );

    return;

  }

  room.status =
    "playing";

  room.properties =
    {};

  room.dice =
    null;

  room.hasRolled =
    false;

  room.doubles =
    0;

  room.turn =
    0;

  room.winner =
    null;

  for (
    const player of room.players
  ) {

    player.money =
      MONOPOLY_START_MONEY;

    player.position =
      0;

    player.bankrupt =
      false;

    player.inJail =
      false;

    player.jailTurns =
      0;

  }

  const starter =
    room.players[
      crypto.randomInt(
        room.players.length
      )
    ];

  room.currentPlayerId =
    starter.id;

  monopolyAddLog(
    room,
    `🎲 ${starter.name} commence la partie.`
  );

  monopolyAddLog(
    room,
    `💰 Chaque joueur commence avec ${MONOPOLY_START_MONEY} €.`
  );

  monopolySendState(room);

}

/* =========================================================
   LANCER LES DÉS MONOPOLY
========================================================= */

function monopolyRoll(
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
    !player ||
    player.id !==
    room.currentPlayerId
  ) {

    send(
      player?.socket,
      {
        type:
          "monopoly_error",

        message:
          "Ce n'est pas ton tour."
      }
    );

    return;

  }

  if (
    room.hasRolled
  ) {

    send(
      player.socket,
      {
        type:
          "monopoly_error",

        message:
          "Tu as déjà lancé les dés."
      }
    );

    return;

  }

  if (
    player.bankrupt
  ) {
    return;
  }

  const die1 =
    crypto.randomInt(1, 7);

  const die2 =
    crypto.randomInt(1, 7);

  const total =
    die1 + die2;

  room.dice = {

    one:
      die1,

    two:
      die2,

    total

  };

  room.hasRolled =
    true;

  if (
    die1 === die2
  ) {

    room.doubles++;

  } else {

    room.doubles = 0;

  }

  /*
   * Trois doubles :
   * direction prison.
   */

  if (
    room.doubles >= 3
  ) {

    player.position =
      10;

    player.inJail =
      true;

    player.jailTurns =
      0;

    room.doubles = 0;

    monopolyAddLog(
      room,
      `🚔 ${player.name} fait trois doubles et va en prison.`
    );

    monopolyFinishTurn(
      room,
      player,
      false
    );

    return;

  }

  const oldPosition =
    player.position;

  const newPosition =
    (
      oldPosition +
      total
    ) % 40;

  if (
    oldPosition +
    total >=
    40
  ) {

    player.money += 200;

    monopolyAddLog(
      room,
      `💶 ${player.name} passe par Départ et reçoit 200 €.`
    );

  }

  player.position =
    newPosition;

  const tile =
    monopolyBoardTile(
      newPosition
    );

  monopolyAddLog(
    room,
    `🎲 ${player.name} fait ${die1} + ${die2} = ${total} et arrive sur ${tile.name}.`
  );

  monopolyResolveLanding(
    room,
    player,
    tile
  );

  monopolySendState(room);

}

/* =========================================================
   ARRIVÉE SUR UNE CASE
========================================================= */

function monopolyResolveLanding(
  room,
  player,
  tile
) {

  if (!tile) {
    return;
  }

  switch (
    tile.type
  ) {

    case "start":

      player.money += 200;

      monopolyAddLog(
        room,
        `💶 ${player.name} reçoit 200 € sur Départ.`
      );

      break;

    case "property":
    case "station":
    case "utility":

      monopolyHandleBuyable(
        room,
        player,
        tile
      );

      break;

    case "tax":

      player.money -=
        tile.amount;

      monopolyAddLog(
        room,
        `🧾 ${player.name} paie ${tile.amount} € de ${tile.name}.`
      );

      monopolyCheckBankruptcy(
        room,
        player
      );

      break;

    case "gotojail":

      player.position =
        10;

      player.inJail =
        true;

      player.jailTurns =
        0;

      monopolyAddLog(
        room,
        `🚔 ${player.name} va directement en prison.`
      );

      break;

    case "jail":

      if (
        player.position === 10 &&
        player.inJail
      ) {

        monopolyAddLog(
          room,
          `🚔 ${player.name} est en prison.`
        );

      } else {

        monopolyAddLog(
          room,
          `👀 ${player.name} est simplement en visite.`
        );

      }

      break;

    case "chance":

      monopolyApplyChance(
        room,
        player
      );

      break;

    case "community":

      monopolyApplyCommunity(
        room,
        player
      );

      break;

    case "freeparking":

      monopolyAddLog(
        room,
        `🅿️ ${player.name} se repose au Parc gratuit.`
      );

      break;

  }

}

/* =========================================================
   ACHATS / LOYERS
========================================================= */

function monopolyHandleBuyable(
  room,
  player,
  tile
) {

  const ownerId =
    room.properties[
      tile.position
    ];

  if (!ownerId) {

    monopolyAddLog(
      room,
      `🏠 ${tile.name} est disponible à l'achat pour ${tile.price} €.`
    );

    return;

  }

  if (
    ownerId ===
    player.id
  ) {

    monopolyAddLog(
      room,
      `🏠 ${player.name} arrive sur sa propriété ${tile.name}.`
    );

    return;

  }

  const owner =
    room.players.find(
      p =>
        p.id ===
        ownerId
    );

  if (
    !owner ||
    owner.bankrupt
  ) {

    delete room.properties[
      tile.position
    ];

    monopolyAddLog(
      room,
      `🏦 ${tile.name} revient à la banque.`
    );

    return;

  }

  const rent =
    monopolyCalculateRent(
      room,
      tile,
      owner
    );

  player.money -= rent;

  owner.money += rent;

  monopolyAddLog(
    room,
    `💸 ${player.name} paie ${rent} € à ${owner.name} pour ${tile.name}.`
  );

  monopolyCheckBankruptcy(
    room,
    player
  );

}

/* =========================================================
   CALCUL LOYER
========================================================= */

function monopolyCalculateRent(
  room,
  tile,
  owner
) {

  if (
    tile.type === "station"
  ) {

    const count =
      room.players.length &&
      Object.values(
        room.properties
      ).filter(
        ownerId =>
          ownerId ===
          owner.id
      ).length;

    /*
     * Nombre de gares possédées.
     */

    const stations =
      MONOPOLY_BOARD.filter(
        item =>
          item.type ===
          "station" &&
          room.properties[
            item.position
          ] ===
          owner.id
      ).length;

    return (
      tile.rent[
        Math.max(
          0,
          Math.min(
            stations - 1,
            tile.rent.length - 1
          )
        )
      ] ||
      25
    );

  }

  if (
    tile.type === "utility"
  ) {

    const utilities =
      MONOPOLY_BOARD.filter(
        item =>
          item.type ===
          "utility" &&
          room.properties[
            item.position
          ] ===
          owner.id
      ).length;

    const diceTotal =
      room.dice?.total ||
      7;

    return utilities >= 2
      ? diceTotal * 10
      : diceTotal * 4;

  }

  /*
   * V1 :
   * loyer de base.
   * Les maisons/hôtels pourront
   * être ajoutés ensuite.
   */

  return (
    tile.rent?.[0] ||
    0
  );

}

/* =========================================================
   ACHETER
========================================================= */

function monopolyBuy(
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
    !player ||
    player.id !==
    room.currentPlayerId
  ) {

    return;

  }

  if (
    !room.hasRolled
  ) {

    send(
      player.socket,
      {
        type:
          "monopoly_error",

        message:
          "Lance d'abord les dés."
      }
    );

    return;

  }

  const tile =
    monopolyBoardTile(
      player.position
    );

  if (
    !tile ||
    ![
      "property",
      "station",
      "utility"
    ].includes(
      tile.type
    )
  ) {

    send(
      player.socket,
      {
        type:
          "monopoly_error",

        message:
          "Cette case ne peut pas être achetée."
      }
    );

    return;

  }

  if (
    room.properties[
      tile.position
    ]
  ) {

    send(
      player.socket,
      {
        type:
          "monopoly_error",

        message:
          "Cette propriété appartient déjà à quelqu'un."
      }
    );

    return;

  }

  if (
    player.money <
    tile.price
  ) {

    send(
      player.socket,
      {
        type:
          "monopoly_error",

        message:
          `Tu n'as pas assez d'argent. Prix : ${tile.price} €.`
      }
    );

    return;

  }

  player.money -=
    tile.price;

  room.properties[
    tile.position
  ] =
    player.id;

  monopolyAddLog(
    room,
    `🏠 ${player.name} achète ${tile.name} pour ${tile.price} €.`
  );

  monopolySendState(room);

}

/* =========================================================
   FIN DE TOUR
========================================================= */

function monopolyFinishTurn(
  room,
  player,
  allowExtraRoll = true
) {

  if (
    room.status !==
    "playing"
  ) {
    return;
  }

  /*
   * Un double permet de rejouer.
   */

  if (
    allowExtraRoll &&
    room.dice &&
    room.dice.one ===
    room.dice.two &&
    !player.inJail
  ) {

    room.hasRolled =
      false;

    monopolyAddLog(
      room,
      `🎲 Double ! ${player.name} rejoue.`
    );

    monopolySendState(room);

    return;

  }

  room.hasRolled =
    false;

  room.dice =
    null;

  room.doubles =
    0;

  const next =
    monopolyGetNextPlayer(
      room,
      player.id
    );

  if (!next) {

    monopolyEndGame(
      room
    );

    return;

  }

  room.currentPlayerId =
    next.id;

  room.turn++;

  monopolyAddLog(
    room,
    `➡️ C'est au tour de ${next.name}.`
  );

  monopolySendState(room);

}

/* =========================================================
   FIN DE TOUR DEMANDÉE PAR CLIENT
========================================================= */

function monopolyEndTurn(
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
    !player ||
    player.id !==
    room.currentPlayerId
  ) {
    return;
  }

  if (
    !room.hasRolled
  ) {

    send(
      player.socket,
      {
        type:
          "monopoly_error",

        message:
          "Tu dois d'abord lancer les dés."
      }
    );

    return;

  }

  /*
   * Si le joueur fait un double,
   * le serveur laisse normalement
   * rejouer automatiquement.
   *
   * Ici end_turn force simplement
   * le passage.
   */

  room.hasRolled =
    false;

  room.dice =
    null;

  room.doubles =
    0;

  const next =
    monopolyGetNextPlayer(
      room,
      player.id
    );

  if (!next) {

    monopolyEndGame(
      room
    );

    return;

  }

  room.currentPlayerId =
    next.id;

  room.turn++;

  monopolyAddLog(
    room,
    `➡️ ${player.name} termine son tour.`
  );

  monopolyAddLog(
    room,
    `🎲 C'est au tour de ${next.name}.`
  );

  monopolySendState(room);

}

/* =========================================================
   CHANCE
========================================================= */

function monopolyApplyChance(
  room,
  player
) {

  const cards = [

    {
      text:
        "Avance jusqu'à Paris.",
      action() {

        player.position = 39;

      }
    },

    {
      text:
        "Avance jusqu'à Londres.",
      action() {

        player.position = 26;

      }
    },

    {
      text:
        "Recule de 3 cases.",
      action() {

        player.position =
          (
            player.position -
            3 +
            40
          ) % 40;

      }
    },

    {
      text:
        "Recevez 50 €.",
      action() {

        player.money += 50;

      }
    },

    {
      text:
        "Payez 50 €.",
      action() {

        player.money -= 50;

      }
    },

    {
      text:
        "Allez en prison.",
      action() {

        player.position = 10;

        player.inJail = true;

      }
    }

  ];

  const card =
    cards[
      crypto.randomInt(
        cards.length
      )
    ];

  card.action();

  monopolyAddLog(
    room,
    `❓ Chance : ${card.text}`
  );

  monopolyCheckBankruptcy(
    room,
    player
  );

}

/* =========================================================
   CAISSE DE COMMUNAUTÉ
========================================================= */

function monopolyApplyCommunity(
  room,
  player
) {

  const cards = [

    {
      text:
        "Vous recevez 100 €.",
      action() {

        player.money += 100;

      }
    },

    {
      text:
        "Vous recevez 50 €.",
      action() {

        player.money += 50;

      }
    },

    {
      text:
        "Payez 50 €.",
      action() {

        player.money -= 50;

      }
    },

    {
      text:
        "Payez 100 €.",
      action() {

        player.money -= 100;

      }
    },

    {
      text:
        "Allez en prison.",
      action() {

        player.position = 10;

        player.inJail = true;

      }
    }

  ];

  const card =
    cards[
      crypto.randomInt(
        cards.length
      )
    ];

  card.action();

  monopolyAddLog(
    room,
    `📦 Caisse de communauté : ${card.text}`
  );

  monopolyCheckBankruptcy(
    room,
    player
  );

}

/* =========================================================
   FAILLITE
========================================================= */

function monopolyCheckBankruptcy(
  room,
  player
) {

  if (
    player.money >= 0 ||
    player.bankrupt
  ) {

    return false;

  }

  player.bankrupt =
    true;

  /*
   * On libère les propriétés.
   */

  for (
    const position of Object.keys(
      room.properties
    )
  ) {

    if (
      room.properties[
        position
      ] === player.id
    ) {

      delete room.properties[
        position
      ];

    }

  }

  monopolyAddLog(
    room,
    `💥 ${player.name} est en faillite !`
  );

  if (
    room.currentPlayerId ===
    player.id
  ) {

    room.hasRolled =
      false;

    room.dice =
      null;

    room.doubles =
      0;

  }

  const active =
    room.players.filter(
      p =>
        !p.bankrupt
    );

  if (
    active.length <= 1
  ) {

    monopolyEndGame(
      room
    );

    return true;

  }

  if (
    room.currentPlayerId ===
    player.id
  ) {

    const next =
      monopolyGetNextPlayer(
        room,
        player.id
      );

    room.currentPlayerId =
      next
        ? next.id
        : null;

  }

  monopolySendState(room);

  return true;

}

/* =========================================================
   FIN DE PARTIE
========================================================= */

function monopolyEndGame(
  room
) {

  const active =
    room.players.filter(
      player =>
        !player.bankrupt
    );

  if (
    active.length === 1
  ) {

    room.winner =
      active[0].id;

    room.status =
      "finished";

    room.currentPlayerId =
      null;

    room.hasRolled =
      false;

    room.dice =
      null;

    monopolyAddLog(
      room,
      `🏆 ${active[0].name} remporte la partie !`
    );

  } else {

    room.status =
      "finished";

    room.currentPlayerId =
      null;

  }

  monopolySendState(room);

}

/* =========================================================
   REJOINDRE MONOPOLY
========================================================= */

function monopolyJoinRoom(
  socket,
  data
) {

  const code =
    String(
      data.room || ""
    )
    .trim()
    .toUpperCase();

  const room =
    monopolyRooms.get(code);

  if (!room) {

    send(
      socket,
      {
        type:
          "monopoly_error",

        message:
          "Salon Monopoly introuvable."
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
          "monopoly_error",

        message:
          "La partie a déjà commencé."
      }
    );

    return;

  }

  if (
    room.players.length >=
    MONOPOLY_MAX_PLAYERS
  ) {

    send(
      socket,
      {
        type:
          "monopoly_error",

        message:
          "Le salon est complet."
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
    .slice(0, 18) ||
    "Joueur";

  const player = {

    id:
      makeId(),

    name,

    socket,

    money:
      MONOPOLY_START_MONEY,

    position:
      0,

    bankrupt:
      false,

    inJail:
      false,

    jailTurns:
      0

  };

  room.players.push(
    player
  );

  socket.monopolyRoom =
    room.room;

  socket.monopolyPlayerId =
    player.id;

  monopolyAddLog(
    room,
    `👋 ${player.name} rejoint le salon.`
  );

  send(
    socket,
    {
      type:
        "monopoly_joined",

      room:
        room.room,

      playerId:
        player.id

    }
  );

  monopolySendState(room);

}

/* =========================================================
   ROUTEUR MONOPOLY
========================================================= */

function handleMonopolyMessage(
  socket,
  data
) {

  /* =======================================================
     CRÉER
  ======================================================= */

  if (
    data.type ===
    "monopoly_create_room"
  ) {

    const room =
      monopolyCreateRoom(
        socket,
        data.name
      );

    send(
      socket,
      {
        type:
          "monopoly_room_created",

        room:
          room.room,

        playerId:
          socket.monopolyPlayerId

      }
    );

    monopolySendState(room);

    return;

  }

  /* =======================================================
     REJOINDRE
  ======================================================= */

  if (
    data.type ===
    "monopoly_join_room"
  ) {

    monopolyJoinRoom(
      socket,
      data
    );

    return;

  }

  /* =======================================================
     RÉCUPÉRER LE SALON
  ======================================================= */

  const room =
    monopolyRooms.get(
      socket.monopolyRoom
    );

  if (!room) {

    send(
      socket,
      {
        type:
          "monopoly_error",

        message:
          "Tu n'es pas dans un salon Monopoly."
      }
    );

    return;

  }

  const player =
    room.players.find(
      p =>
        p.id ===
        socket.monopolyPlayerId
    );

  /* =======================================================
     DÉMARRER
  ======================================================= */

  if (
    data.type ===
    "monopoly_start_game"
  ) {

    monopolyStartGame(
      room,
      socket
    );

    return;

  }

  /* =======================================================
     LANCER LES DÉS
  ======================================================= */

  if (
    data.type ===
    "monopoly_roll"
  ) {

    if (player) {

      monopolyRoll(
        room,
        player
      );

    }

    return;

  }

  /* =======================================================
     ACHETER
  ======================================================= */

  if (
    data.type ===
    "monopoly_buy"
  ) {

    if (player) {

      monopolyBuy(
        room,
        player
      );

    }

    return;

  }

  /* =======================================================
     FIN DE TOUR
  ======================================================= */

  if (
    data.type ===
    "monopoly_end_turn"
  ) {

    if (player) {

      monopolyEndTurn(
        room,
        player
      );

    }

    return;

  }

  /* =======================================================
     NOUVELLE PARTIE
  ======================================================= */

  if (
    data.type ===
    "monopoly_new_game"
  ) {

    if (
      socket ===
      room.host
    ) {

      room.status =
        "waiting";

      room.currentPlayerId =
        null;

      room.properties =
        {};

      room.dice =
        null;

      room.hasRolled =
        false;

      room.doubles =
        0;

      room.winner =
        null;

      room.logs = [];

      for (
        const p of room.players
      ) {

        p.money =
          MONOPOLY_START_MONEY;

        p.position =
          0;

        p.bankrupt =
          false;

        p.inJail =
          false;

        p.jailTurns =
          0;

      }

      monopolyAddLog(
        room,
        "🔄 Nouvelle partie Monopoly prête."
      );

      monopolySendState(room);

    }

    return;

  }

}

/* =========================================================
   DÉCONNEXION MONOPOLY
========================================================= */

function handleMonopolyDisconnect(
  socket
) {

  const room =
    monopolyRooms.get(
      socket.monopolyRoom
    );

  if (!room) {
    return;
  }

  const index =
    room.players.findIndex(
      player =>
        player.socket ===
        socket
    );

  if (
    index === -1
  ) {

    return;

  }

  const leaving =
    room.players[index];

  const wasCurrent =
    leaving.id ===
    room.currentPlayerId;

  room.players.splice(
    index,
    1
  );

  /*
   * Les propriétés du joueur
   * reviennent à la banque.
   */

  for (
    const position of Object.keys(
      room.properties
    )
  ) {

    if (
      room.properties[
        position
      ] === leaving.id
    ) {

      delete room.properties[
        position
      ];

    }

  }

  monopolyAddLog(
    room,
    `🚪 ${leaving.name} quitte le salon Monopoly.`
  );

  /*
   * Si le créateur quitte,
   * on transmet l'hôte au suivant.
   */

  if (
    socket ===
    room.host
  ) {

    if (
      room.players.length
    ) {

      room.host =
        room.players[0].socket;

      monopolyAddLog(
        room,
        `👑 ${room.players[0].name} devient créateur du salon.`
      );

    } else {

      monopolyRooms.delete(
        room.room
      );

      return;

    }

  }

  if (
    !room.players.length
  ) {

    monopolyRooms.delete(
      room.room
    );

    return;

  }

  /*
   * Si le joueur qui part était
   * celui dont c'était le tour.
   */

  if (
    wasCurrent &&
    room.status ===
    "playing"
  ) {

    const next =
      monopolyGetNextPlayer(
        room,
        leaving.id
      );

    room.currentPlayerId =
      next
        ? next.id
        : null;

    room.hasRolled =
      false;

    room.dice =
      null;

    room.doubles =
      0;

    if (next) {

      monopolyAddLog(
        room,
        `➡️ Le tour passe à ${next.name}.`
      );

    }

  }

  const active =
    room.players.filter(
      p =>
        !p.bankrupt
    );

  if (
    room.status ===
    "playing" &&
    active.length <= 1
  ) {

    monopolyEndGame(
      room
    );

    return;

  }

  monopolySendState(room);

}

/* =========================================================
   =========================================================
   CONNEXIONS WEBSOCKET
   =========================================================
========================================================= */

wss.on(
  "connection",
  socket => {

    /*
     * =====================================================
     * HEARTBEAT
     * =====================================================
     */

    socket.isAlive = true;

    socket.room = null;

    socket.playerId = null;

    socket.monopolyRoom = null;

    socket.monopolyPlayerId = null;

    socket.on(
      "pong",
      () => {

        socket.isAlive = true;

      }
    );

    /* =====================================================
       MESSAGE
    ===================================================== */

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
           HEARTBEAT APPLICATION
        ================================================= */

        if (
          data.type ===
          "ping"
        ) {

          send(
            socket,
            {
              type:
                "pong"
            }
          );

          return;

        }

        /* =================================================
           ROUTAGE MONOPOLY
           IMPORTANT :
           Les messages Monopoly sont totalement séparés
           du système UNO.
        ================================================= */

        if (
          data.type &&
          data.type.startsWith(
            "monopoly_"
          )
        ) {

          handleMonopolyMessage(
            socket,
            data
          );

          return;

        }

        /* =================================================
           CRÉER SALON UNO
        ================================================= */

        if (
          data.type ===
          "create_room"
        ) {

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

          sendState(room);

          return;

        }

        /* =================================================
           REJOINDRE SALON UNO
        ================================================= */

        if (
          data.type ===
          "join_room"
        ) {

          const code =
            String(
              data.room || ""
            )
            .trim()
            .toUpperCase();

          const room =
            rooms.get(code);

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
            .slice(0, 18) ||
            "Joueur";

          const player = {

            id:
              makeId(),

            name,

            socket,

            hand: [],

            score: 0,

            roundWins: 0,

            hasDrawn: false,

            drawnCardId: null

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

          sendState(room);

          return;

        }

        /* =================================================
           SALON DU SOCKET UNO
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
           START UNO
        ================================================= */

        if (
          data.type ===
          "start_game"
        ) {

          if (
            socket ===
            room.host
          ) {

            startGame(room);

          }

          return;

        }

        /* =================================================
           JOUER CARTE UNO
        ================================================= */

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

        /* =================================================
           PIOCHER UNO
        ================================================= */

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

        /* =================================================
           UNO CHALLENGE
        ================================================= */

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

        /* =================================================
           PRENDRE PÉNALITÉ
        ================================================= */

        if (
          data.type ===
          "penalty_draw"
        ) {

          if (
            player &&
            room.penaltyDecision?.targetId ===
            player.id
          ) {

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

        if (
          data.type ===
          "penalty_cancel"
        ) {

          if (
            player &&
            room.penaltyDecision?.targetId ===
            player.id
          ) {

            room.penaltyDecision =
              null;

            addLog(
              room,
              `🛡️ ${player.name} choisit de jouer une carte pour répondre à la pénalité.`
            );

            sendState(room);

          }

          return;

        }

        /* =================================================
           NOUVELLE MANCHE UNO
        ================================================= */

        if (
          data.type ===
          "new_game"
        ) {

          if (
            socket ===
            room.host
          ) {

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
      () => {

        /*
         * ================================================
         * MONOPOLY
         * ================================================
         */

        handleMonopolyDisconnect(
          socket
        );

        /*
         * ================================================
         * UNO
         * ================================================
         */

        const room =
          rooms.get(
            socket.room
          );

        if (!room) {
          return;
        }

        const index =
          room.players.findIndex(
            player =>
              player.socket ===
              socket
          );

        if (
          index !== -1
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

          if (
            room.unoChallenge?.targetId ===
            leaving.id
          ) {

            room.unoChallenge =
              null;

          }

          if (
            room.penaltyDecision?.targetId ===
            leaving.id
          ) {

            room.penaltyDecision =
              null;

          }

          /*
           * Si le créateur part.
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
                room.players[0].socket;

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
           * Si le joueur qui part était
           * celui dont c'était le tour.
           */

          if (
            wasCurrent &&
            room.status ===
            "playing"
          ) {

            const nextIndex =
              Math.min(
                index,
                room.players.length - 1
              );

            room.currentPlayerId =
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

        } else if (
          socket ===
          room.host &&
          room.mode ===
          "tv"
        ) {

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
========================================================= */

const heartbeatInterval =
  setInterval(
    () => {

      wss.clients.forEach(
        socket => {

          if (
            socket.isAlive ===
            false
          ) {

            console.warn(
              "💀 Connexion WebSocket morte supprimée."
            );

            return socket.terminate();

          }

          socket.isAlive =
            false;

          socket.ping();

        }
      );

    },
    HEARTBEAT_INTERVAL
  );

heartbeatInterval.unref();

/* =========================================================
   SERVEUR HTTP
========================================================= */

server.listen(
  PORT,
  () => {

    console.log(
      `🎮 Serveur Jeux2Soirée lancé sur le port ${PORT}`
    );

    console.log(
      `🎴 UNO : actif`
    );

    console.log(
      `🎩 Monopoly : actif`
    );

    console.log(
      `💓 Heartbeat : toutes les ${HEARTBEAT_INTERVAL / 1000}s`
    );

  }
);
