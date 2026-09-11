const http = require("http");
const WebSocket = require("ws");

const PORT =
    process.env.PORT || 8080;


/* =========================================================
   SERVEUR HTTP
========================================================= */

const server =
    http.createServer((req,res) => {

        res.writeHead(200, {
            "Content-Type":
                "text/plain; charset=utf-8"
        });

        res.end(
            "Serveur UNO Jeux2Soirée opérationnel."
        );

    });


/* =========================================================
   WEBSOCKET
========================================================= */

const wss =
    new WebSocket.Server({
        server
    });


/* =========================================================
   DONNÉES
========================================================= */

const rooms =
    new Map();


const COLORS =
    ["red","yellow","green","blue"];


const MAX_PLAYERS = 10;


/* =========================================================
   ID
========================================================= */

function id() {

    return Math.random()
        .toString(36)
        .substring(2,10);

}


function roomCode() {

    let code;

    do {

        code =
            Math.random()
            .toString(36)
            .substring(2,6)
            .toUpperCase();

    } while(rooms.has(code));

    return code;

}


/* =========================================================
   PAQUET 108 CARTES
========================================================= */

function createDeck() {

    const deck = [];


    for (
        const color of COLORS
    ) {

        deck.push({
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
                color,
                type: "number",
                value
            });

            deck.push({
                color,
                type: "number",
                value
            });

        }


        for(let i=0;i<2;i++) {

            deck.push({
                color,
                type: "skip"
            });

            deck.push({
                color,
                type: "reverse"
            });

            deck.push({
                color,
                type: "draw2"
            });

        }

    }


    for(let i=0;i<4;i++) {

        deck.push({
            color: null,
            type: "wild"
        });

        deck.push({
            color: null,
            type: "wild4"
        });

    }


    return deck;

}


/* =========================================================
   MÉLANGE
========================================================= */

function shuffle(deck) {

    for (
        let i = deck.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [
            deck[i],
            deck[j]
        ] =
        [
            deck[j],
            deck[i]
        ];

    }

    return deck;

}


/* =========================================================
   ROOM
========================================================= */

function createRoom(hostSocket) {

    const room =
        roomCode();


    rooms.set(room, {

        room,

        host: hostSocket,

        players: [],

        deck: [],

        discard: [],

        currentPlayer: 0,

        direction: 1,

        currentColor: null,

        status: "waiting",

        lastAction: null,

        winner: null

    });


    return rooms.get(room);

}


/* =========================================================
   ENVOI
========================================================= */

function send(socket,data) {

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


/* =========================================================
   BROADCAST
========================================================= */

function broadcast(room,data) {

    room.players.forEach(
        player => {

            send(
                player.socket,
                data
            );

        }
    );


    send(
        room.host,
        data
    );

}


/* =========================================================
   ÉTAT PUBLIC
========================================================= */

function publicState(room, viewer) {

    const players =
        room.players.map(
            player => ({

                id: player.id,

                name: player.name,

                cardCount:
                    player.hand.length,

                host:
                    player.socket ===
                    room.host

            })
        );


    let me = null;


    if(viewer) {

        const player =
            room.players.find(
                p => p.id === viewer
            );


        if(player) {

            me = {

                id: player.id,

                name: player.name,

                hand:
                    player.hand,

                hasDrawn:
                    player.hasDrawn,

                uno:
                    player.uno

            };

        }

    }


    const current =
        room.players[
            room.currentPlayer
        ];


    let canPlayWild4 = false;


    if(viewer) {

        const p =
            room.players.find(
                p => p.id === viewer
            );


        if(p) {

            canPlayWild4 =
                !p.hand.some(
                    card =>
                        card.color ===
                        room.currentColor
                );

        }

    }


    return {

        status:
            room.status,

        players,

        discard:
            room.discard[
                room.discard.length - 1
            ] || null,

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

        me,

        canPlayWild4

    };

}


/* =========================================================
   ENVOI ÉTAT
========================================================= */

function sendState(room) {

    room.players.forEach(
        player => {

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
    );


    send(
        room.host,
        {
            type: "state",
            state:
                publicState(room,null)
        }
    );

}


/* =========================================================
   PIOCHE
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
        room.discard.splice(
            0,
            room.discard.length
        );


    room.deck =
        shuffle(recycled);


    room.discard.push(top);

}


/* =========================================================
   PIOCHER
========================================================= */

function drawOne(room) {

    if(room.deck.length === 0) {

        refillDeck(room);

    }


    return room.deck.pop();

}


/* =========================================================
   PROCHAIN JOUEUR
========================================================= */

function nextPlayer(room,steps=1) {

    const total =
        room.players.length;


    room.currentPlayer =
        (
            room.currentPlayer +
            room.direction * steps +
            total * 100
        ) % total;

}


/* =========================================================
   CARTE JOUABLE
========================================================= */

function isPlayable(
    room,
    player,
    card
) {

    const top =
        room.discard[
            room.discard.length - 1
        ];


    if(!top)
        return true;


    if(card.type === "wild")
        return true;


    if(card.type === "wild4") {

        return !player.hand.some(
            c =>
                c.color ===
                room.currentColor
        );

    }


    if(
        card.color ===
        room.currentColor
    )
        return true;


    if(
        card.type === top.type &&
        card.type !== "number"
    )
        return true;


    if(
        card.type === "number" &&
        top.type === "number" &&
        card.value === top.value
    )
        return true;


    return false;

}


/* =========================================================
   SCORE
========================================================= */

function cardPoints(card) {

    if(card.type === "number")
        return card.value;

    if(
        card.type === "skip" ||
        card.type === "reverse" ||
        card.type === "draw2"
    )
        return 20;

    return 50;

}


/* =========================================================
   FIN DE MANCHE
========================================================= */

function endRound(room,winner) {

    let points = 0;


    room.players.forEach(
        player => {

            if(
                player.id === winner.id
            )
                return;


            player.hand.forEach(
                card => {

                    points +=
                        cardPoints(card);

                }
            );

        }
    );


    winner.score += points;


    room.status =
        "finished";

    room.winner =
        winner.id;


    broadcast(
        room,
        {
            type: "round_end",

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
   DÉMARRER PARTIE
========================================================= */

function startGame(room) {

    if(
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


    room.deck =
        shuffle(
            createDeck()
        );


    room.discard = [];


    room.players.forEach(
        player => {

            player.hand = [];

            player.hasDrawn = false;

            player.uno = false;

        }
    );


    /* 7 cartes chacun */

    for(let i=0;i<7;i++) {

        room.players.forEach(
            player => {

                player.hand.push(
                    drawOne(room)
                );

            }
        );

    }


    /* Première carte */

    let first;

    do {

        first =
            drawOne(room);

        if(
            first.type !==
            "number"
        ) {

            room.deck.unshift(first);

        }

    } while(
        first.type !==
        "number"
    );


    room.discard.push(first);

    room.currentColor =
        first.color;


    room.currentPlayer = 0;

    room.direction = 1;

    room.status =
        "playing";

    room.winner = null;


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
) {

    if(
        room.status !== "playing"
    )
        return;


    const current =
        room.players[
            room.currentPlayer
        ];


    if(
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


    if(
        index < 0 ||
        index >= player.hand.length
    )
        return;


    const card =
        player.hand[index];


    if(
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
                    "Cette carte ne peut pas être jouée."
            }
        );

        return;

    }


    if(
        card.type === "wild" ||
        card.type === "wild4"
    ) {

        if(
            !chosenColor ||
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

    }


    player.hand.splice(index,1);

    room.discard.push(card);


    if(
        card.type === "wild" ||
        card.type === "wild4"
    ) {

        room.currentColor =
            chosenColor;

    } else {

        room.currentColor =
            card.color;

    }


    player.hasDrawn =
        false;


    if(
        player.hand.length === 0
    ) {

        endRound(
            room,
            player
        );

        return;

    }


    /*
       UNO :
       le joueur doit annoncer UNO
       lorsqu'il n'a plus qu'une carte.
    */

    if(
        player.hand.length === 1
    ) {

        player.uno =
            false;

    }


    let steps = 1;


    switch(card.type) {

        case "skip":

            steps = 2;

            break;


        case "reverse":

            /*
               À 2 joueurs,
               Reverse agit comme Skip.
            */

            if(
                room.players.length === 2
            ) {

                steps = 2;

            } else {

                room.direction *= -1;

            }

            break;


        case "draw2":

            const target =
                getNextPlayer(
                    room
                );

            drawCards(
                room,
                target,
                2
            );

            steps = 2;

            break;


        case "wild4":

            const target4 =
                getNextPlayer(
                    room
                );

            drawCards(
                room,
                target4,
                4
            );

            steps = 2;

            break;

    }


    nextPlayer(
        room,
        steps
    );


    sendState(room);

}


/* =========================================================
   JOUEUR SUIVANT SANS LE MODIFIER
========================================================= */

function getNextPlayer(room) {

    const total =
        room.players.length;


    const index =
        (
            room.currentPlayer +
            room.direction +
            total
        ) % total;


    return room.players[index];

}


/* =========================================================
   PIOCHER PLUSIEURS
========================================================= */

function drawCards(
    room,
    player,
    amount
) {

    for(
        let i=0;
        i<amount;
        i++
    ) {

        const card =
            drawOne(room);

        if(card)
            player.hand.push(card);

    }

}


/* =========================================================
   PIOCHER UNE CARTE
========================================================= */

function playerDraw(room,player) {

    if(
        room.status !== "playing"
    )
        return;


    const current =
        room.players[
            room.currentPlayer
        ];


    if(
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


    if(player.hasDrawn) {

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


    const card =
        drawOne(room);


    if(card) {

        player.hand.push(card);

    }


    player.hasDrawn =
        true;


    /*
       Selon les règles classiques :
       si la carte piochée est jouable,
       le joueur peut la jouer.
    */

    sendState(room);

}


/* =========================================================
   UNO
========================================================= */

function callUno(room,player) {

    if(
        player.hand.length === 1
    ) {

        player.uno = true;

        sendState(room);

    }

}


/* =========================================================
   NOUVELLE MANCHE
========================================================= */

function newGame(room) {

    room.status =
        "waiting";

    room.winner =
        null;

    room.deck = [];

    room.discard = [];

    room.players.forEach(
        player => {

            player.hand = [];

            player.hasDrawn = false;

            player.uno = false;

        }
    );


    sendState(room);

}


/* =========================================================
   CONNEXIONS
========================================================= */

wss.on(
    "connection",
    socket => {

        socket.room = null;

        socket.playerId = null;


        socket.on(
            "message",
            raw => {

                let data;


                try {

                    data =
                        JSON.parse(
                            raw.toString()
                        );

                } catch(e) {

                    return;

                }


                /* -----------------------------------------
                   CRÉATION SALON
                ----------------------------------------- */

                if(
                    data.type ===
                    "create_room"
                ) {

                    const room =
                        createRoom(
                            socket
                        );


                    socket.room =
                        room.room;


                    send(
                        socket,
                        {
                            type:
                                "room_created",

                            room:
                                room.room
                        }
                    );


                    return;

                }


                /* -----------------------------------------
                   REJOINDRE
                ----------------------------------------- */

                if(
                    data.type ===
                    "join_room"
                ) {

                    const room =
                        rooms.get(
                            String(
                                data.room
                            ).toUpperCase()
                        );


                    if(!room) {

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


                    if(
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
                        .substring(0,18);


                    const player = {

                        id:
                            id(),

                        name:
                            name || "Joueur",

                        socket,

                        hand: [],

                        score: 0,

                        hasDrawn: false,

                        uno: false

                    };


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
                            type:
                                "joined",

                            room:
                                room.room,

                            playerId:
                                player.id
                        }
                    );


                    sendState(room);

                    return;

                }


                /* -----------------------------------------
                   ACTIONS
                ----------------------------------------- */

                const room =
                    rooms.get(
                        socket.room
                    );


                if(!room)
                    return;


                const player =
                    room.players.find(
                        p =>
                            p.id ===
                            socket.playerId
                    );


                if(
                    data.type ===
                    "start_game"
                ) {

                    if(
                        socket !==
                        room.host
                    ) {

                        return;

                    }

                    startGame(room);

                    return;

                }


                if(
                    data.type ===
                    "play_card"
                ) {

                    if(!player)
                        return;


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


                if(
                    data.type ===
                    "draw"
                ) {

                    if(!player)
                        return;


                    playerDraw(
                        room,
                        player
                    );

                    return;

                }


                if(
                    data.type ===
                    "uno"
                ) {

                    if(!player)
                        return;


                    callUno(
                        room,
                        player
                    );

                    return;

                }


                if(
                    data.type ===
                    "new_game"
                ) {

                    if(
                        socket !==
                        room.host
                    )
                        return;


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


                if(!room)
                    return;


                /*
                   Le serveur garde le salon
                   même si un joueur quitte.
                */

                const index =
                    room.players.findIndex(
                        p =>
                            p.socket ===
                            socket
                    );


                if(index !== -1) {

                    room.players.splice(
                        index,
                        1
                    );

                }


                /*
                   Si le joueur dont c'était
                   le tour part, on remet
                   l'index correctement.
                */

                if(
                    room.players.length === 0
                ) {

                    rooms.delete(
                        room.room
                    );

                    return;

                }


                if(
                    room.currentPlayer >=
                    room.players.length
                ) {

                    room.currentPlayer = 0;

                }


                sendState(room);

            }
        );

    }
);


/* =========================================================
   LANCEMENT
========================================================= */

server.listen(
    PORT,
    () => {

        console.log(
            `UNO server lancé sur le port ${PORT}`
        );

    }
);
