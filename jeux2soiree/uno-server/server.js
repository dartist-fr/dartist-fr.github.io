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
   MONOPOLY  (moteur complet — voir monopoly-server.js)
   =========================================================
========================================================= */

const monopolyEngine = (function () {
'use strict';
/* =========================================================
   MONOPOLY • Jeux2Soirée — logique serveur (édition Europe)
   Usage 1 : node monopoly-server.js         (serveur autonome, PORT)
   Usage 2 : intégré à ton serveur ws existant :
       const monopoly = require('./monopoly-server');
       ws.on('message', raw => { const d = JSON.parse(raw);
            if (monopoly.handle(ws, d)) return;   // messages "monopoly_*"
            ...ton code existant... });
       ws.on('close', () => monopoly.handleClose(ws));
========================================================= */
const crypto = require('crypto');

const START_MONEY = 1500, GO_SALARY = 200, JAIL_FINE = 50, MAX_PLAYERS = 8;
const TOKENS = ['voiture', 'bateau', 'bottes', 'brouette', 'chapeau', 'chien', 'de', 'fer']; // pions (Monopoly/pions/<id>.png)
const COLORS = ['#e92852', '#20bd63', '#2075e8', '#ffd928', '#b566ff', '#ff8a1f', '#20d9d9', '#ff6fb5'];

/* ---------- Plateau ---------- */
// pos, nom, groupe, prix, [loyer, loyer couleur complète, 1M, 2M, 3M, 4M, hôtel], prix maison, carte loyer, carte hypothèque
const PROPS = [
  [1, 'Vilnius', 'brown', 60, [2, 4, 10, 30, 90, 160, 250], 50, 'vilnius', 'hyp-vilnius'],
  [3, 'Riga', 'brown', 60, [4, 8, 20, 60, 180, 320, 450], 50, 'riga', 'hyp-riga'],
  [6, 'Sofia', 'lightblue', 100, [6, 12, 30, 90, 270, 400, 550], 50, 'sofia', 'hyp-sofia'],
  [8, 'Bucarest', 'lightblue', 100, [6, 12, 30, 90, 270, 400, 550], 50, 'bucarest', 'hyp-bucarest'],
  [9, 'Varsovie', 'lightblue', 120, [8, 16, 40, 100, 300, 450, 600], 50, 'varsovie', 'hyp-varsovie'],
  [11, 'Budapest', 'pink', 140, [10, 20, 50, 150, 450, 625, 750], 100, 'budapest', 'hyp-budapest'],
  [13, 'Berne', 'pink', 140, [10, 20, 50, 150, 450, 625, 750], 100, 'berne', 'hyp-berne'],
  [14, 'Helsinki', 'pink', 160, [12, 24, 60, 180, 500, 700, 900], 100, 'helsinki', 'hyp-helsinki'],
  [16, 'Stockholm', 'orange', 180, [14, 28, 70, 200, 550, 750, 950], 100, 'stockholm', 'hyp-stockholm'],
  [18, 'Vienne', 'orange', 180, [14, 28, 70, 200, 550, 750, 950], 100, 'vienne', 'hyp-vienne'],
  [19, 'Lisbonne', 'orange', 200, [16, 32, 80, 220, 600, 800, 1000], 100, 'lisbonne', 'hyp-lisbonne'],
  [21, 'Madrid', 'red', 220, [18, 36, 90, 250, 700, 875, 1050], 150, 'madrid', 'hyp-madrid'],
  [23, 'Athènes', 'red', 220, [18, 36, 90, 250, 700, 875, 1050], 150, 'athenes', 'hyp-athenes'],
  [24, 'Dublin', 'red', 240, [20, 40, 100, 300, 750, 925, 1100], 150, 'dublin', 'hyp-dublin'],
  [26, 'Londres', 'yellow', 260, [22, 44, 110, 330, 800, 975, 1150], 150, 'londres', 'hyp-londres'],
  [27, 'Copenhague', 'yellow', 260, [22, 44, 110, 330, 800, 975, 1150], 150, 'copenhague', 'hyp-copenhague'],
  [29, 'Luxembourg', 'yellow', 280, [24, 48, 120, 360, 850, 1025, 1200], 150, 'luxenbourg', 'hyp-luxembourg'],
  [31, 'Bruxelles', 'green', 300, [26, 52, 130, 390, 900, 1100, 1275], 200, 'bruxelles', 'hyp-bruxelles'],
  [32, 'Amsterdam', 'green', 300, [26, 52, 130, 390, 900, 1100, 1275], 200, 'amsterdam', 'hyp-amsterdam'],
  [34, 'Rome', 'green', 320, [28, 56, 150, 450, 1000, 1200, 1400], 200, 'rome', 'hyp-rome'],
  [37, 'Berlin', 'darkblue', 350, [35, 70, 175, 500, 1100, 1300, 1500], 200, 'berlin', 'hyp-berlin'],
  [39, 'Paris', 'darkblue', 400, [50, 100, 200, 600, 1400, 1700, 2000], 200, 'paris', 'hyp-paris']
];
const STATIONS = [
  [5, 'Aéroport Schiphol', 'schiphol', 'hyp-schiphol'],
  [15, 'Aéroport de Francfort', 'francfort', 'hyp-francfort'],
  [25, 'Aéroport de Londres-Heathrow', 'londres-heathrow', 'hyp-londres-heathrow'],
  [35, 'Aéroport Roissy-CDG', 'roissy', 'hyp-cdg']
];
const UTILITIES = [
  [12, 'Parlement européen', 'parlement', 'hyp-parlement europeen'],
  [28, 'Cour européenne de justice', 'cour', 'hyp-cour de justice']
];
const SPECIAL = {
  0: ['Départ', 'start'], 2: ['Coffre de communauté', 'community'], 4: ['Taxe sur le revenu', 'tax', 150],
  7: ['Chance', 'chance'], 10: ['Prison / Simple visite', 'jail'], 17: ['Coffre de communauté', 'community'],
  20: ['Parc gratuit', 'free_parking'], 22: ['Chance', 'chance'], 30: ['Allez en prison', 'go_to_jail'],
  33: ['Coffre de communauté', 'community'], 36: ['Chance', 'chance'], 38: ['Taxe de luxe', 'tax', 150]
};
const BOARD = [];
for (let i = 0; i < 40; i++) BOARD[i] = { position: i };
Object.entries(SPECIAL).forEach(([i, [name, type, price]]) => Object.assign(BOARD[i], { name, type, price }));
PROPS.forEach(([position, name, group, price, rent, houseCost, img, hyp]) =>
  Object.assign(BOARD[position], { name, type: 'property', group, price, rent, houseCost, img, hyp }));
STATIONS.forEach(([position, name, img, hyp]) =>
  Object.assign(BOARD[position], { name, type: 'station', group: 'station', price: 200, img, hyp }));
UTILITIES.forEach(([position, name, img, hyp]) =>
  Object.assign(BOARD[position], { name, type: 'utility', group: 'utility', price: 150, img, hyp }));

const GROUPS = {};
PROPS.forEach(p => (GROUPS[p[2]] = GROUPS[p[2]] || []).push(p[0]));
const STATION_POS = STATIONS.map(s => s[0]), UTILITY_POS = UTILITIES.map(s => s[0]);

/* ---------- Cartes : [fichier, effet, a, b] ---------- */
const CHANCE = [
  ['cartes-chance_Allez_Prison_Direct', 'jail'],
  ['cartes-chance_Amende_ExcesVitesse_15', 'pay', 15],
  ['cartes-chance_Avancez_Aeroport', 'near', 'station'],
  ['cartes-chance_Avancez_Aeroport_2', 'near', 'station'],
  ['cartes-chance_Avancez_Budapest_200', 'go', 11],
  ['cartes-chance_Avancez_Depart_200', 'go', 0],
  ['cartes-chance_Avancez_Dublin_200', 'go', 24],
  ['cartes-chance_Avancez_Paris', 'go', 39],
  ['cartes-chance_Avancez_ServicePublic', 'near', 'utility'],
  ['cartes-chance_Banque_Dividende_50', 'get', 50],
  ['cartes-chance_Libere_Prison_Conservable', 'keep'],
  ['cartes-chance_President_Conseil_Payez_50', 'payAll', 50],
  ['cartes-chance_PretImmobilier_Echeance_150', 'get', 150],
  ['cartes-chance_Reculez_3_cases', 'back', 3],
  ['cartes-chance_Reparations_25_100', 'repair', 25, 100],
  ['cartes-chance_Voyage_Schiphol_200', 'go', 5]
];
const COMMUNITY = [
  ['caisse-commu_Allez_Prison_Direct', 'jail'],
  ['caisse-commu_Anniversaire_Recevez_10', 'getAll', 10],
  ['caisse-commu_AssuranceVie_Recevez_100', 'get', 100],
  ['caisse-commu_Avancez_Depart_200', 'go', 0],
  ['caisse-commu_ConcoursBeaute_Recevez_10', 'get', 10],
  ['caisse-commu_ErreurBanque_Recevez_200', 'get', 200],
  ['caisse-commu_FondsVacances_Recevez_100.png', 'get', 100], // le fichier s'appelle ...100.png.png
  ['caisse-commu_FraisConsultance_Recevez_25', 'get', 25],
  ['caisse-commu_FraisHopital_Payez_100', 'pay', 100],
  ['caisse-commu_FraisMedecin_Payez_50', 'pay', 50],
  ['caisse-commu_FraisScolarite_Payez_50', 'pay', 50],
  ['caisse-commu_Heritage_Recevez_100', 'get', 100],
  ['caisse-commu_Libere_Prison_Conservable', 'keep'],
  ['caisse-commu_RemboursementImpot_20', 'get', 20],
  ['caisse-commu_ReparationsVoirie_40_115', 'repair', 40, 115],
  ['caisse-commu_VenteActions_Recevez_50', 'get', 50]
];
const DECKS = { chance: CHANCE, community: COMMUNITY };
const JAILIDX = { chance: CHANCE.findIndex(c => c[1] === 'keep'), community: COMMUNITY.findIndex(c => c[1] === 'keep') };
const cardLabel = c => ({
  jail: () => 'Allez en prison', pay: () => `payez ${c[2]}`, get: () => `recevez ${c[2]}`, getAll: () => `recevez ${c[2]} de chaque joueur`,
  payAll: () => `payez ${c[2]} à chaque joueur`, go: () => `avancez à ${BOARD[c[2]].name}`,
  near: () => c[2] === 'station' ? "avancez à l'aéroport le plus proche" : 'avancez au service public le plus proche',
  keep: () => 'Libéré de prison (conservable)', back: () => `reculez de ${c[2]} cases`, repair: () => `réparations (${c[2]}/maison, ${c[3]}/hôtel)`
}[c[1]]());

/* ---------- Utilitaires ---------- */
// Intégré au serveur UNO : on réutilise sa Map monopolyRooms (sinon Map locale en mode autonome)
const rooms = (typeof monopolyRooms !== 'undefined') ? monopolyRooms : new Map();
const socketInfo = new WeakMap();
const rid = n => crypto.randomBytes(n).toString('hex');
const rint = n => crypto.randomInt(n);
const clean = s => String(s || '').replace(/[<>&"'`]/g, '').trim().slice(0, 18);
const hhmm = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const byId = (r, id) => r.players.find(p => p.id === id);
const cur = r => r.players[r.cur];
const log = (r, text) => { r.logs.push({ time: hhmm(), text }); if (r.logs.length > 80) r.logs.shift(); };
const unCost = s => Math.round(s.price / 2 * 1.1);
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
const err = (ws, message, code) => send(ws, { type: 'monopoly_error', message, code });
const genCode = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let c;
  do { c = Array.from({ length: 5 }, () => a[rint(a.length)]).join(''); } while (rooms.has(c));
  return c;
};

/* ---------- Salon / partie ---------- */
function newPlayer(r, id, name) {
  return { id, name, token: null, color: COLORS[r.players.length % COLORS.length], money: START_MONEY, position: 0, jail: false, jailTurns: 0, cards: { chance: 0, community: 0 }, bankrupt: false };
}
function initGame(r) {
  Object.assign(r, {
    status: 'waiting', owners: {}, houses: {}, mortgaged: {}, cur: 0, hasRolled: false, extra: false, doubles: 0, canBuy: false,
    dice: { one: 0, two: 0, total: 0 }, rollSeq: 0, debt: null, logs: [], winner: null, card: null, cardSeq: 0, pot: 0, trade: null,
    decks: { chance: shuffle(CHANCE.map((_, i) => i)), community: shuffle(COMMUNITY.map((_, i) => i)) }
  });
  r.players.forEach((p, i) => Object.assign(p, { color: COLORS[i % COLORS.length], money: START_MONEY, position: 0, jail: false, jailTurns: 0, cards: { chance: 0, community: 0 }, bankrupt: false }));
}
function attach(r, ws, pid) {
  r.members.set(pid, ws);
  socketInfo.set(ws, { room: r.code, pid });
}
function broadcast(r) {
  r.touched = Date.now();
  r.members.forEach((ws, pid) => send(ws, { type: 'monopoly_state', state: view(r, pid) }));
}

/* ---------- Règles ---------- */
function supply(r) {
  let used = 0, hotels = 0;
  Object.values(r.houses).forEach(h => { if (h === 5) hotels++; else used += h; });
  return { houses: 32 - used, hotels: 12 - hotels };
}
const countType = (r, pid, type) => Object.keys(r.owners).filter(k => r.owners[k] === pid && BOARD[k].type === type).length;

function rentFor(r, pos, o = {}) {
  const s = BOARD[pos], owner = r.owners[pos], total = o.total || r.dice.total;
  if (s.type === 'station') return 25 * 2 ** (countType(r, owner, 'station') - 1) * (o.double ? 2 : 1);
  if (s.type === 'utility') return (o.x10 || countType(r, owner, 'utility') === 2 ? 10 : 4) * total;
  const h = r.houses[pos] || 0;
  if (h > 0) return s.rent[1 + h];
  return GROUPS[s.group].every(x => r.owners[x] === owner) ? s.rent[1] : s.rent[0];
}

function pay(r, p, pays, toPot) {
  pays = pays.filter(x => x[1] > 0);
  if (!pays.length) return true;
  const total = pays.reduce((a, x) => a + x[1], 0);
  if (r.debt && r.debt.pid === p.id) { r.debt.payments.push(...pays); r.debt.total += total; return false; }
  if (p.money >= total) {
    p.money -= total;
    pays.forEach(([to, a]) => { const q = to && byId(r, to); if (q) q.money += a; else if (toPot) r.pot += a; });
    return true;
  }
  r.debt = { pid: p.id, payments: pays, total, toPot };
  log(r, `⚠️ ${p.name} doit ${total} mais n'a que ${p.money} : vendre, hypothéquer ou faire faillite.`);
  return false;
}
function settle(r) {
  const d = r.debt; if (!d) return;
  const p = byId(r, d.pid);
  if (p.money >= d.total) { r.debt = null; pay(r, p, d.payments, d.toPot); log(r, `✅ ${p.name} règle sa dette (${d.total}).`); }
}

function sendToJail(r, p) {
  p.position = 10; p.jail = true; p.jailTurns = 0; r.extra = false; r.canBuy = false;
  log(r, `🔒 ${p.name} va en prison.`);
}
function goTo(r, p, dest, passGo, o) {
  p.position = dest;
  if (passGo) { p.money += GO_SALARY; log(r, `💶 ${p.name} passe par le Départ (+${GO_SALARY}).`); }
  land(r, p, o);
}
const move = (r, p, steps) => { const np = p.position + steps; goTo(r, p, ((np % 40) + 40) % 40, np >= 40); };
const advance = (r, p, dest) => goTo(r, p, dest, dest < p.position);

function land(r, p, o = {}) {
  const s = BOARD[p.position];
  r.canBuy = false;
  switch (s.type) {
    case 'tax': log(r, `💸 ${p.name} paie ${s.price} (${s.name}).`); pay(r, p, [[null, s.price]], true); break;
    case 'go_to_jail': sendToJail(r, p); break;
    case 'free_parking':
      if (r.pot > 0) { log(r, `🅿️ ${p.name} rafle la cagnotte du Parc gratuit (${r.pot}).`); p.money += r.pot; r.pot = 0; }
      else log(r, `🅿️ ${p.name} se repose au Parc gratuit.`);
      break;
    case 'chance': case 'community': draw(r, p, s.type); break;
    case 'property': case 'station': case 'utility': {
      const ow = r.owners[p.position];
      if (!ow) { r.canBuy = true; log(r, `📍 ${p.name} arrive sur ${s.name} (${s.price}).`); }
      else if (ow !== p.id && !r.mortgaged[p.position]) {
        const rent = rentFor(r, p.position, o);
        log(r, `🏠 ${p.name} paie ${rent} à ${byId(r, ow).name} (${s.name}).`);
        pay(r, p, [[ow, rent]]);
      }
    }
  }
}

function draw(r, p, deck) {
  const idx = r.decks[deck].shift(), c = DECKS[deck][idx], [file, kind, a, b] = c;
  r.card = { seq: ++r.cardSeq, deck, file, player: p.name };
  log(r, `🃏 ${p.name} pioche ${deck === 'chance' ? 'Chance' : 'Caisse de communauté'} : ${cardLabel(c)}.`);
  if (kind === 'keep') { p.cards[deck]++; return; }
  r.decks[deck].push(idx);
  const others = r.players.filter(q => q !== p && !q.bankrupt);
  switch (kind) {
    case 'jail': sendToJail(r, p); break;
    case 'pay': pay(r, p, [[null, a]], true); break;
    case 'get': p.money += a; break;
    case 'getAll': others.forEach(q => { const x = Math.min(a, q.money); q.money -= x; p.money += x; }); break;
    case 'payAll': pay(r, p, others.map(q => [q.id, a])); break;
    case 'go': advance(r, p, a); break;
    case 'back': move(r, p, -a); break;
    case 'near': {
      const list = a === 'station' ? STATION_POS : UTILITY_POS;
      const dest = list.find(x => x > p.position) ?? list[0];
      const total = a === 'utility' ? rint(6) + rint(6) + 2 : 0;
      goTo(r, p, dest, dest < p.position, { double: a === 'station', x10: a === 'utility', total });
      break;
    }
    case 'repair': {
      let h = 0, ho = 0;
      Object.keys(r.owners).forEach(k => { if (r.owners[k] === p.id) { const n = r.houses[k] || 0; if (n === 5) ho++; else h += n; } });
      if (h + ho) { log(r, `🔧 ${p.name} : ${h} maison(s), ${ho} hôtel(s).`); pay(r, p, [[null, h * a + ho * b]], true); }
    }
  }
}

function doRoll(r, p) {
  const d1 = rint(6) + 1, d2 = rint(6) + 1, dbl = d1 === d2, total = d1 + d2;
  r.dice = { one: d1, two: d2, total }; r.rollSeq++; r.canBuy = false; r.extra = false; r.hasRolled = true;
  log(r, `🎲 ${p.name} lance ${d1}+${d2}=${total}${dbl ? ' (double !)' : ''}.`);
  if (d1 === 6 && d2 === 6 && r.pot > 0) { log(r, `🎰 Double 6 ! ${p.name} rafle la cagnotte du Parc gratuit (${r.pot}).`); p.money += r.pot; r.pot = 0; }
  if (p.jail) {
    if (dbl) { p.jail = false; p.jailTurns = 0; log(r, `🔓 ${p.name} sort de prison grâce au double.`); move(r, p, total); return; }
    if (++p.jailTurns >= 3) {
      p.jail = false; p.jailTurns = 0;
      log(r, `🔓 ${p.name} paie ${JAIL_FINE} et sort de prison.`);
      pay(r, p, [[null, JAIL_FINE]]); move(r, p, total);
    } else log(r, `${p.name} reste en prison (${p.jailTurns}/3).`);
    return;
  }
  if (dbl && ++r.doubles >= 3) { log(r, `🚨 3 doubles de suite !`); sendToJail(r, p); return; }
  move(r, p, total);
  if (dbl && !p.jail && !p.bankrupt) r.extra = true;
}

function nextTurn(r) {
  do { r.cur = (r.cur + 1) % r.players.length; } while (cur(r).bankrupt);
  Object.assign(r, { hasRolled: false, extra: false, doubles: 0, canBuy: false });
  log(r, `▶ Tour de ${cur(r).name}.`);
}
function goBankrupt(r, p) {
  if (r.trade && (r.trade.from === p.id || r.trade.to === p.id)) r.trade = null;
  const d = r.debt;
  const cid = d && new Set(d.payments.map(x => x[0])).size === 1 ? d.payments[0][0] : null;
  const q = cid && byId(r, cid);
  log(r, `💀 ${p.name} est en faillite${q ? ` face à ${q.name}` : ''} !`);
  ['chance', 'community'].forEach(k => {
    for (let i = 0; i < p.cards[k]; i++) { if (q) q.cards[k]++; else r.decks[k].push(JAILIDX[k]); }
  });
  if (q) q.money += p.money;
  Object.keys(r.owners).forEach(pos => {
    if (r.owners[pos] !== p.id) return;
    delete r.houses[pos];
    if (q) r.owners[pos] = q.id; else { delete r.owners[pos]; delete r.mortgaged[pos]; }
  });
  Object.assign(p, { money: 0, bankrupt: true, jail: false, cards: { chance: 0, community: 0 } });
  r.debt = null; r.canBuy = false;
  const alive = r.players.filter(x => !x.bankrupt);
  if (alive.length === 1) {
    r.status = 'finished'; r.winner = { id: alive[0].id, name: alive[0].name, money: alive[0].money };
    log(r, `🏆 ${alive[0].name} remporte la partie !`);
  } else if (cur(r) === p) nextTurn(r);
}

const interestFor = (r, pos) => r.mortgaged[pos] ? Math.round(BOARD[pos].price / 2 * 0.1) : 0;

function moveJailCards(giver, receiver, n) {
  let left = n;
  ['chance', 'community'].forEach(k => { const t = Math.min(left, giver.cards[k]); giver.cards[k] -= t; receiver.cards[k] += t; left -= t; });
}

function sanitizeTradeSide(r, player, side) {
  if (!side || typeof side !== 'object') return null;
  const money = Math.max(0, Math.floor(Number(side.money) || 0));
  const props = Array.isArray(side.props) ? [...new Set(side.props.map(Number))] : [];
  for (const pos of props) { if (r.owners[pos] !== player.id || r.houses[pos]) return null; }
  const cards = Math.max(0, Math.min(player.cards.chance + player.cards.community, Math.floor(Number(side.cards) || 0)));
  return { money, props, cards };
}

function tradeDesc(side) {
  const parts = [];
  if (side.props.length) parts.push(side.props.map(k => BOARD[k].name).join(', '));
  if (side.money) parts.push(`${side.money}`);
  if (side.cards) parts.push(`${side.cards} carte(s) prison`);
  return parts.join(' + ') || 'rien';
}

function executeTrade(r, tr) {
  if (r.debt) return false;
  const from = byId(r, tr.from), to = byId(r, tr.to);
  if (!from || !to || from.bankrupt || to.bankrupt) return false;
  const ownsAll = (pl, props) => props.every(pos => r.owners[pos] === pl.id && !r.houses[pos]);
  if (!ownsAll(from, tr.offer.props) || !ownsAll(to, tr.request.props)) return false;
  const offerInterest = tr.offer.props.reduce((sum, pos) => sum + interestFor(r, pos), 0);
  const requestInterest = tr.request.props.reduce((sum, pos) => sum + interestFor(r, pos), 0);
  if (from.money < tr.offer.money + requestInterest) return false;
  if (to.money < tr.request.money + offerInterest) return false;
  if (from.cards.chance + from.cards.community < tr.offer.cards) return false;
  if (to.cards.chance + to.cards.community < tr.request.cards) return false;

  from.money += tr.request.money - tr.offer.money - requestInterest;
  to.money += tr.offer.money - tr.request.money - offerInterest;
  tr.offer.props.forEach(pos => { r.owners[pos] = to.id; });
  tr.request.props.forEach(pos => { r.owners[pos] = from.id; });
  moveJailCards(from, to, tr.offer.cards);
  moveJailCards(to, from, tr.request.cards);

  log(r, `🤝 Échange conclu : ${from.name} donne ${tradeDesc(tr.offer)} · ${to.name} donne ${tradeDesc(tr.request)}.`);
  if (offerInterest || requestInterest) log(r, `🏦 Intérêts d'hypothèque à la banque : ${offerInterest + requestInterest}.`);
  return true;
}

function manageInfo(r, p, pos) {
  const s = BOARD[pos], out = {};
  if (r.owners[pos] !== p.id) return out;
  const mort = !!r.mortgaged[pos], h = r.houses[pos] || 0;
  if (s.type === 'property') {
    const grp = GROUPS[s.group], hs = grp.map(x => r.houses[x] || 0), sup = supply(r);
    const full = grp.every(x => r.owners[x] === p.id), anyMort = grp.some(x => r.mortgaged[x]);
    if (!r.debt && full && !anyMort && h < 5 && h <= Math.min(...hs) && p.money >= s.houseCost && (h < 4 ? sup.houses > 0 : sup.hotels > 0)) out.build = s.houseCost;
    if (h > 0 && h >= Math.max(...hs) && (h < 5 || sup.houses >= 4)) out.sell = s.houseCost / 2;
    if (!mort && hs.every(x => x === 0)) out.mortgage = s.price / 2;
  } else if (!mort) out.mortgage = s.price / 2;
  if (mort && !r.debt && p.money >= unCost(s)) out.unmortgage = unCost(s);
  return out;
}

/* ---------- Vue envoyée à chaque client ---------- */
const pub = (r, p) => ({ id: p.id, name: p.name, token: p.token, color: p.color, money: p.money, position: p.position, jail: p.jail, bankrupt: p.bankrupt, host: p.id === r.hostId, online: !!r.members.get(p.id), jailCards: p.cards.chance + p.cards.community });
function view(r, pid) {
  const me = byId(r, pid), c = cur(r), playing = r.status === 'playing';
  const mine = !!(playing && me && c === me && !me.bankrupt);
  const s = c ? BOARD[c.position] : null;
  const manage = {};
  if (mine) Object.keys(r.owners).forEach(k => { if (r.owners[k] === me.id) manage[k] = manageInfo(r, me, +k); });
  return {
    status: r.status, mode: r.mode, room: r.code, isHost: pid === r.hostId,
    me: me ? pub(r, me) : null, players: r.players.map(p => pub(r, p)),
    currentPlayer: playing && c ? c.id : null, currentPlayerName: playing && c ? c.name : '',
    myTurn: mine, hasRolled: r.hasRolled,
    canRoll: mine && (!r.hasRolled || r.extra) && !r.debt,
    canEnd: mine && r.hasRolled && !r.extra && !r.debt,
    canBuy: mine && r.canBuy && c.money >= s.price,
    buyable: mine && r.canBuy ? { pos: s.position, name: s.name, price: s.price } : null,
    canPayJail: mine && c.jail && !r.hasRolled && !r.debt && c.money >= JAIL_FINE,
    canUseCard: mine && c.jail && !r.hasRolled && c.cards.chance + c.cards.community > 0,
    debt: r.debt ? { pid: r.debt.pid, total: r.debt.total } : null,
    dice: r.dice, rollSeq: r.rollSeq, board: BOARD, properties: r.owners, houses: r.houses, mortgaged: r.mortgaged, pot: r.pot, trade: r.trade,
    manage, supply: supply(r), logs: r.logs.slice(-40), winner: r.winner, card: r.card
  };
}

/* ---------- Messages ---------- */
function handle(ws, m) {
  if (!m || typeof m.type !== 'string' || !m.type.startsWith('monopoly_')) return false;
  try { dispatch(ws, m); } catch (e) { console.error('[monopoly]', e); err(ws, 'Erreur serveur.'); }
  return true;
}

function dispatch(ws, m) {
  const t = m.type;
  if (t === 'monopoly_create_room') {
    const mode = m.mode === 'phones' ? 'phones' : 'tv';
    const r = { code: genCode(), mode, hostId: rid(4), members: new Map(), players: [], touched: Date.now() };
    initGame(r); rooms.set(r.code, r);
    attach(r, ws, r.hostId);
    if (mode === 'phones') r.players.push(newPlayer(r, r.hostId, clean(m.name) || 'Joueur'));
    send(ws, { type: 'monopoly_room_created', room: r.code, playerId: r.hostId, mode });
    return broadcast(r);
  }
  if (t === 'monopoly_join_room' || t === 'monopoly_rejoin') {
    const r = rooms.get(String(m.room || '').toUpperCase());
    if (!r) return err(ws, 'Salon introuvable.', 'no_room');
    if (t === 'monopoly_rejoin') {
      if (!r.members.has(m.playerId)) return err(ws, 'Session expirée.', 'no_room');
      attach(r, ws, m.playerId);
      send(ws, { type: 'monopoly_joined', room: r.code, playerId: m.playerId, mode: m.playerId === r.hostId && r.mode === 'tv' ? 'tv' : 'phones' });
      return broadcast(r);
    }
    if (r.status !== 'waiting') return err(ws, 'La partie a déjà commencé.');
    if (r.players.length >= MAX_PLAYERS) return err(ws, 'Salon complet (8 joueurs max).');
    let name = clean(m.name) || 'Joueur';
    if (r.players.some(p => p.name.toLowerCase() === name.toLowerCase())) name = `${name.slice(0, 15)}${r.players.length + 1}`;
    const pid = rid(4);
    attach(r, ws, pid);
    r.players.push(newPlayer(r, pid, name));
    send(ws, { type: 'monopoly_joined', room: r.code, playerId: pid, mode: 'phones' });
    return broadcast(r);
  }

  const info = socketInfo.get(ws), r = info && rooms.get(info.room);
  if (!r) return err(ws, 'Tu n\'es dans aucun salon.', 'no_room');
  const pid = info.pid, p = byId(r, pid), c = cur(r);

  if (t === 'monopoly_leave') {
    // Quitter volontairement : le salon se ferme si c'est l'écran TV (ou le dernier joueur), sinon abandon / retrait du joueur
    const others = r.players.filter(q => q.id !== pid);
    if (pid === r.hostId && (r.mode === 'tv' || !others.length)) {
      r.members.forEach((w, id) => { if (id !== pid) send(w, { type: 'monopoly_closed', message: 'Le salon a été fermé par son créateur.' }); });
      rooms.delete(r.code);
      return send(ws, { type: 'monopoly_left' });
    }
    if (r.status === 'playing' && p && !p.bankrupt) {
      const isCur = c === p, keepDebt = !isCur && r.debt && r.debt.pid !== p.id ? r.debt : null, keepBuy = isCur ? false : r.canBuy;
      if (keepDebt) r.debt = null;
      goBankrupt(r, p);
      if (!isCur) { r.canBuy = keepBuy; if (keepDebt && r.status === 'playing') r.debt = keepDebt; }
    } else if (r.status !== 'playing') r.players = r.players.filter(q => q.id !== pid);
    r.members.delete(pid);
    socketInfo.delete(ws);
    if (pid === r.hostId) { const nh = r.players.find(q => !q.bankrupt) || r.players[0]; if (nh) r.hostId = nh.id; }
    if (!r.players.length) rooms.delete(r.code); else broadcast(r);
    return send(ws, { type: 'monopoly_left' });
  }
  if (t === 'monopoly_pick_token') {
    if (r.status !== 'waiting' || !p || !TOKENS.includes(m.token)) return;
    if (r.players.some(q => q !== p && q.token === m.token)) return err(ws, 'Ce pion est déjà pris.');
    p.token = m.token;
    return broadcast(r);
  }
  if (t === 'monopoly_kick') {
    if (pid !== r.hostId || r.status !== 'waiting') return;
    const target = byId(r, m.target);
    if (!target || target.id === r.hostId) return;
    const tws = r.members.get(target.id);
    r.players = r.players.filter(q => q.id !== target.id);
    r.members.delete(target.id);
    log(r, `👢 ${target.name} a été exclu(e) par ${p.name}.`);
    send(tws, { type: 'monopoly_kicked' });
    return broadcast(r);
  }
  if (t === 'monopoly_start_game') {
    if (pid !== r.hostId || r.status !== 'waiting') return;
    if (r.players.length < 2) return err(ws, 'Il faut au moins 2 joueurs.');
    const free = shuffle(TOKENS.filter(k => !r.players.some(q => q.token === k)));
    r.players.forEach(q => { if (!q.token) q.token = free.pop(); }); // pion au hasard pour ceux qui n'ont pas choisi
    shuffle(r.players).forEach((q, i) => { q.color = COLORS[i % COLORS.length]; });
    r.status = 'playing'; r.cur = 0;
    log(r, `🎩 La partie commence ! ${r.players[0].name} joue en premier.`);
    return broadcast(r);
  }
  if (t === 'monopoly_new_game') {
    if (pid !== r.hostId || r.status !== 'finished') return;
    initGame(r);
    return broadcast(r);
  }
  if (r.status !== 'playing' || !p || p.bankrupt) return;

  if (t === 'monopoly_give_money') {
    if (r.debt) return err(ws, "Règle ta dette avant de donner de l'argent.");
    const to = byId(r, m.to), amount = Math.floor(Number(m.amount) || 0);
    if (!to || to === p || to.bankrupt || amount <= 0) return err(ws, 'Don invalide.');
    if (p.money < amount) return err(ws, 'Fonds insuffisants.');
    p.money -= amount; to.money += amount;
    log(r, `💸 ${p.name} donne ${amount} à ${to.name}.`);
    return broadcast(r);
  }
  if (t === 'monopoly_trade_propose') {
    if (r.trade) return err(ws, 'Un échange est déjà en cours.');
    if (r.debt) return err(ws, 'Règle ta dette avant de proposer un échange.');
    const to = byId(r, m.to);
    if (!to || to === p || to.bankrupt) return err(ws, 'Joueur invalide.');
    const offer = sanitizeTradeSide(r, p, m.offer), request = sanitizeTradeSide(r, to, m.request);
    if (!offer || !request) return err(ws, 'Échange invalide.');
    if (!offer.props.length && !offer.money && !offer.cards && !request.props.length && !request.money && !request.cards) return err(ws, 'Échange vide.');
    r.trade = { from: p.id, to: to.id, offer, request };
    log(r, `🤝 ${p.name} propose un échange à ${to.name}.`);
    return broadcast(r);
  }
  if (t === 'monopoly_trade_cancel') {
    if (!r.trade || r.trade.from !== pid) return;
    log(r, `❌ ${p.name} retire sa proposition d'échange.`);
    r.trade = null;
    return broadcast(r);
  }
  if (t === 'monopoly_trade_respond') {
    if (!r.trade || r.trade.to !== pid) return;
    const tr = r.trade; r.trade = null;
    if (!m.accept) { log(r, `❌ ${p.name} refuse l'échange.`); return broadcast(r); }
    if (!executeTrade(r, tr)) log(r, `⚠️ Échange impossible (conditions non remplies).`);
    return broadcast(r);
  }
  if (t === 'monopoly_manage') {
    if (c !== p) return;
    const pos = +m.pos, s = BOARD[pos];
    if (!s || !['property', 'station', 'utility'].includes(s.type)) return;
    const info2 = manageInfo(r, p, pos);
    if (!info2[m.act]) return err(ws, 'Action impossible.');
    if (m.act === 'build') { p.money -= s.houseCost; r.houses[pos] = (r.houses[pos] || 0) + 1; log(r, `🏗️ ${p.name} construit ${r.houses[pos] === 5 ? 'un hôtel' : 'une maison'} à ${s.name}.`); }
    if (m.act === 'sell') { p.money += s.houseCost / 2; r.houses[pos]--; if (!r.houses[pos]) delete r.houses[pos]; log(r, `🏚️ ${p.name} vend un bâtiment à ${s.name}.`); }
    if (m.act === 'mortgage') { p.money += s.price / 2; r.mortgaged[pos] = true; log(r, `🏦 ${p.name} hypothèque ${s.name} (+${s.price / 2}).`); }
    if (m.act === 'unmortgage') { p.money -= unCost(s); delete r.mortgaged[pos]; log(r, `💰 ${p.name} lève l'hypothèque de ${s.name} (-${unCost(s)}).`); }
    settle(r);
    return broadcast(r);
  }
  if (c !== p) return;

  if (t === 'monopoly_roll') { if (r.debt || (r.hasRolled && !r.extra)) return; doRoll(r, p); }
  else if (t === 'monopoly_buy') {
    const s = BOARD[p.position];
    if (!r.canBuy || p.money < s.price) return;
    p.money -= s.price; r.owners[p.position] = p.id; r.canBuy = false;
    log(r, `✅ ${p.name} achète ${s.name} pour ${s.price}.`);
  }
  else if (t === 'monopoly_end_turn') { if (!r.hasRolled || r.extra || r.debt) return; nextTurn(r); }
  else if (t === 'monopoly_pay_jail') {
    if (!p.jail || r.hasRolled || r.debt || p.money < JAIL_FINE) return;
    p.money -= JAIL_FINE; p.jail = false; p.jailTurns = 0; log(r, `🔓 ${p.name} paie ${JAIL_FINE} pour sortir de prison.`);
  }
  else if (t === 'monopoly_use_card') {
    if (!p.jail || r.hasRolled) return;
    const k = p.cards.chance > 0 ? 'chance' : p.cards.community > 0 ? 'community' : null;
    if (!k) return;
    p.cards[k]--; r.decks[k].push(JAILIDX[k]); p.jail = false; p.jailTurns = 0;
    log(r, `🔓 ${p.name} utilise sa carte « Libéré de prison ».`);
  }
  else if (t === 'monopoly_bankrupt') goBankrupt(r, p);
  else return;
  broadcast(r);
}

function handleClose(ws) {
  const info = socketInfo.get(ws);
  if (!info) return;
  const r = rooms.get(info.room);
  if (!r || r.members.get(info.pid) !== ws) return;
  r.members.set(info.pid, null);
  if (r.status === 'waiting' && info.pid !== r.hostId) {
    r.players = r.players.filter(p => p.id !== info.pid);
    r.members.delete(info.pid);
  }
  broadcast(r);
}

setInterval(() => rooms.forEach((r, k) => { if (Date.now() - r.touched > 3 * 3600 * 1000) rooms.delete(k); }), 10 * 60 * 1000).unref();


return { handle, handleClose };
})();

/* Points d'entrée déjà appelés par le code UNO (inchangé) */

function handleMonopolyMessage(socket, data) {
  monopolyEngine.handle(socket, data);
}

function handleMonopolyDisconnect(socket) {
  monopolyEngine.handleClose(socket);
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
