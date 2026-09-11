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


// ============================================================
// SERVEUR HTTP
// ============================================================

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Serveur UNO Jeux2Soirée opérationnel.");
});


// ============================================================
// WEBSOCKET
// ============================================================

const wss = new WebSocket.Server({
  server
});

const rooms = new Map();


// ============================================================
// UTILITAIRES
// ============================================================

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
  for (
    let i = deck.length - 1;
    i > 0;
    i--
  ) {
    const j = crypto.randomInt(i + 1);

    [deck[i], deck[j]] = [
      deck[j],
      deck[i]
    ];
  }

  return deck;
}


// ============================================================
// CREATION DU PAQUET UNO
// ============================================================

function createDeck() {

  const deck = [];


  for (const color of COLORS) {

    // 0
    deck.push({
      id: makeId(),
      color,
      type: "number",
      value: 0
    });


    // 1 à 9 : deux exemplaires
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


    // Skip / Reverse / +2
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


  // 4 Jokers + 4 +4
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


// ============================================================
// WEBSOCKET
// ============================================================

function send(socket, data) {

  if (
    socket &&
    socket.readyState ===
      WebSocket.OPEN
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
        player.socket ===
        room.host
    );


  if (!hostIsPlayer) {

    send(
      room.host,
      data
    );
  }
}


// ============================================================
// LOGS
// ============================================================

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
    room.logs.length >
    MAX_LOGS
  ) {

    room.logs.shift();
  }
}


// ============================================================
// JOUEURS / TOURS
// ============================================================

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


// ============================================================
// PIOCHE
// ============================================================

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
    shuffle(
      recycled
    );


  room.discard.push(
    top
  );
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


    player.hand.push(
      card
    );


    count++;
  }


  return count;
}


// ============================================================
// REGLES DES CARTES
// ============================================================

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


  // Joker
  if (
    card.type === "wild"
  ) {

    return true;
  }


  // +4
  if (
    card.type === "wild4"
  ) {

    return canPlayWild4(
      room,
      player
    );
  }


  // Même couleur
  if (
    card.color ===
    room.currentColor
  ) {

    return true;
  }


  // Même chiffre
  if (
    card.type === "number" &&
    top.type === "number" &&
    card.value ===
      top.value
  ) {

    return true;
  }


  // Même symbole
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


// ============================================================
// SCORE
// ============================================================

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

  }[
    card.type
  ] || card.type;
}


// ============================================================
// ETAT PUBLIC
// ============================================================

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
              room.unoChallenge
                .targetId,

            targetName:
              room.unoChallenge
                .targetName

          }
        : null,


    /*
      Informations du joueur connecté.
    */

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

            /*
              Pioche normale :
              contient l'id de la carte piochée.

              Pénalité +2/+4 :
              null = toutes les cartes
              jouables sont autorisées.
            */

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


// ============================================================
// ENVOI DE L'ETAT
// ============================================================

function sendState(room) {

  for (
    const player of room.players
  ) {

    send(
      player.socket,
      {

        type:
          "state",

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


  if (
    !hostIsPlayer
  ) {

    send(
      room.host,
      {

        type:
          "state",

        state:
          publicState(
            room,
            null
          )
      }
    );
  }
}


// ============================================================
// CREATION DU SALON
// ============================================================

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


  // Mode téléphones :
  // le créateur joue aussi.

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
        .slice(
          0,
          18
        ) ||
        "Créateur",

      socket:
        hostSocket,

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


// ============================================================
// DEMARRAGE DE PARTIE
// ============================================================

function startGame(room) {

  if (
    room.players.length < 2
  ) {

    send(
      room.host,
      {

        type:
          "error",

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

        type:
          "error",

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
    const player of room.players
  ) {

    player.hand = [];

    player.hasDrawn =
      false;

    player.drawnCardId =
      null;
  }


  // Distribution
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


  // Première carte numérique
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
    const card of rejected
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


  // Premier joueur aléatoire
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


// ============================================================
// FLAGS DE TOUR
// ============================================================

function resetPlayerTurnFlags(
  player
) {

  player.hasDrawn =
    false;

  player.drawnCardId =
    null;
}


// ============================================================
// PENALITE +2 / +4
// ============================================================

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


  // Pioche obligatoire
  const drawn =
    drawCards(
      room,
      target,
      amount
    );


  // La pénalité est consommée.
  room.pendingDraw =
    0;


  /*
    IMPORTANT :

    Le joueur garde son tour.

    hasDrawn = true
    => il ne peut pas refaire
       une pioche normale.

    drawnCardId = null
    => aucune carte précise
       n'est imposée.

    Il peut donc jouer N'IMPORTE
    QUELLE carte jouable de sa main.
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
    Si aucune carte n'est jouable
    après la pénalité, on évite de
    bloquer la partie.
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


// ============================================================
// EFFETS DES CARTES
// ============================================================

function advanceAfterCard(
  room,
  card
) {

  // PASS
  if (
    card.type === "skip"
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


  // REVERSE
  if (
    card.type === "reverse"
  ) {

    if (
      room.players.length === 2
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

      room.direction *= -1;


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


  // +2
  if (
    card.type === "draw2"
  ) {

    room.pendingDraw =
      2;


    nextPlayer(
      room,
      1
    );


    /*
      La pioche est AUTOMATIQUE.
      Le joueur garde ensuite son tour.
    */

    applyPenaltyImmediately(
      room
    );


    return;
  }


  // +4
  if (
    card.type === "wild4"
  ) {

    room.pendingDraw =
      4;


    nextPlayer(
      room,
      1
    );


    /*
      La pioche est AUTOMATIQUE.
      Le joueur garde ensuite son tour.
    */

    applyPenaltyImmediately(
      room
    );


    return;
  }


  // Carte normale
  nextPlayer(
    room,
    1
  );
}


// ============================================================
// FIN DE MANCHE
// ============================================================

function finishRound(
  room,
  winner
) {

  let points =
    0;


  for (
    const player of room.players
  ) {

    if (
      player.id ===
      winner.id
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


// ============================================================
// UNO
// ============================================================

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

    const drawn =
      drawCards(
        room,
        target,
        2
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


// ============================================================
// JOUER UNE CARTE
// ============================================================

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


  // UNO en attente
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
    !Number.isInteger(index) ||
    index < 0 ||
    index >= player.hand.length
  ) {

    return;
  }


  const card =
    player.hand[index];


  /*
    PIoche NORMALE

    Si une carte vient d'être
    piochée normalement, seule
    cette carte peut être jouée.

    Après +2/+4 :

      hasDrawn = true
      drawnCardId = null

    donc cette restriction
    ne s'applique PAS.
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


  // Joker / +4
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

        type:
          "color_required",

        cardIndex:
          index
      }
    );

    return;
  }


  // Retirer la carte
  player.hand.splice(
    index,
    1
  );


  resetPlayerTurnFlags(
    player
  );


  // Défausse
  room.discard.push(
    card
  );


  // Couleur
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
    `🃏 ${player.name} joue ${cardLabel(card)}${chosenColor ? ` → ${chosenColor.toUpperCase()}` : ""}.`
  );


  // Victoire
  if (
    player.hand.length === 0
  ) {

    finishRound(
      room,
      player
    );

    return;
  }


  // UNO
  if (
    player.hand.length === 1
  ) {

    beginUnoChallenge(
      room,
      player
    );

    return;
  }


  // Effet carte
  advanceAfterCard(
    room,
    card
  );


  sendState(room);
}


// ============================================================
// PIOCHE NORMALE
// ============================================================

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


  /*
    Pioche normale :

    on mémorise exactement
    la carte piochée.
  */

  player.hasDrawn =
    true;

  player.drawnCardId =
    card.id;


  addLog(
    room,
    `🃏 ${player.name} pioche une carte.`
  );


  /*
    Si la carte n'est pas jouable :
    le tour passe immédiatement.
  */

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
      `✨ ${player.name} peut jouer la carte qu'il vient de piocher.`
    );
  }


  sendState(room);
}


// ============================================================
// FONCTION PIOCHE
// ============================================================

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
    Sécurité au cas où une pénalité
    serait encore présente.
  */

  if (
    room.pendingDraw > 0
  ) {

    applyPenaltyImmediately(
      room
    );

    sendState(room);

    return;
  }


  /*
    Une seule pioche normale.
  */

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


// ============================================================
// BUZZ UNO
// ============================================================

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


// ============================================================
// NOUVELLE MANCHE
// ============================================================

function resetRound(room) {

  room.status =
    "waiting";

  room.deck = [];

  room.discard = [];

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


// ============================================================
// CONNEXIONS
// ============================================================

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


        // ====================================================
        // CREER UN SALON
        // ====================================================

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


          sendState(
            room
          );


          return;
        }


        // ====================================================
        // REJOINDRE
        // ====================================================

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


        // ====================================================
        // RECUPERATION SALON
        // ====================================================

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


        // ====================================================
        // DEMARRER
        // ====================================================

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


        // ====================================================
        // JOUER
        // ====================================================

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


        // ====================================================
        // PIOCHER
        // ====================================================

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


        // ====================================================
        // BUZZ UNO
        // ====================================================

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


        // ====================================================
        // NOUVELLE MANCHE
        // ====================================================

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


    // ========================================================
    // DECONNEXION
    // ========================================================

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
            room.unoChallenge &&
            room.unoChallenge.targetId ===
              leaving.id
          ) {

            room.unoChallenge =
              null;
          }


          // Transfert du créateur
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


          // Si le joueur actuel part
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
              `➡️ Le tour passe à ${currentPlayer(room).name}.`
            );
          }


          sendState(
            room
          );

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


// ============================================================
// DEMARRAGE SERVEUR
// ============================================================

server.listen(
  PORT,
  () => {

    console.log(
      `UNO server lancé sur le port ${PORT}`
    );
  }
);
