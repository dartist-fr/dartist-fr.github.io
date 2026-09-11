const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const PORT =
    process.env.PORT || 10000;


/* =========================================================
   SERVEUR HTTP
========================================================= */

const server =
    http.createServer((req,res) => {

        res.writeHead(200,{
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

const COLORS = [
    "red",
    "yellow",
    "green",
    "blue"
];

const MAX_PLAYERS = 10;


/* =========================================================
   ID
========================================================= */

function makeId(){

    return crypto
        .randomBytes(8)
        .toString("hex");

}


function makeRoomCode(){

    let code;

    do{

        code =
            crypto
                .randomBytes(3)
                .toString("hex")
                .substring(0,4)
                .toUpperCase();

    }while(
        rooms.has(code)
    );

    return code;

}


/* =========================================================
   PAQUET
========================================================= */

function createDeck(){

    const deck = [];

    for(
        const color of COLORS
    ){

        /*
         * 0 = 1 exemplaire
         */

        deck.push({
            id:makeId(),
            color,
            type:"number",
            value:0
        });


        /*
         * 1 à 9 = 2 exemplaires
         */

        for(
            let value = 1;
            value <= 9;
            value++
        ){

            for(
                let copy = 1;
                copy <= 2;
                copy++
            ){

                deck.push({

                    id:makeId(),

                    color,

                    type:"number",

                    value,

                    copy

                });

            }

        }


        /*
         * Skip / Reverse / +2
         */

        for(
            let copy = 1;
            copy <= 2;
            copy++
        ){

            deck.push({

                id:makeId(),

                color,

                type:"skip",

                copy

            });


            deck.push({

                id:makeId(),

                color,

                type:"reverse",

                copy

            });


            deck.push({

                id:makeId(),

                color,

                type:"draw2",

                copy

            });

        }

    }


    /*
     * 4 Wild
     * 4 Wild +4
     */

    for(
        let copy = 1;
        copy <= 4;
        copy++
    ){

        deck.push({

            id:makeId(),

            color:null,

            type:"wild",

            copy

        });


        deck.push({

            id:makeId(),

            color:null,

            type:"wild4",

            copy

        });

    }


    return deck;

}


/* =========================================================
   MÉLANGE
========================================================= */

function shuffle(deck){

    /*
     * Fisher-Yates avec crypto.randomInt
     * pour un mélange beaucoup plus propre.
     */

    for(
        let i = deck.length - 1;
        i > 0;
        i--
    ){

        const j =
            crypto.randomInt(
                0,
                i + 1
            );

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


/* =========================================================
   CREATION SALON
========================================================= */

function createRoom(
    hostSocket,
    displayMode,
    stacking
){

    const code =
        makeRoomCode();


    const room = {

        room:code,

        host:hostSocket,

        displayMode,

        settings:{

            stacking:
                Boolean(stacking)

        },

        players:[],

        deck:[],

        discard:[],

        currentPlayerId:null,

        direction:1,

        currentColor:null,

        pendingDraw:0,

        status:"waiting",

        winner:null

    };


    rooms.set(
        code,
        room
    );


    return room;

}


/* =========================================================
   ENVOI
========================================================= */

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


/* =========================================================
   BROADCAST
========================================================= */

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
     * En mode TV,
     * le host n'est pas joueur.
     */

    if(
        room.displayMode === "tv"
    ){

        send(
            room.host,
            data
        );

    }

}


/* =========================================================
   JOUEUR COURANT
========================================================= */

function currentPlayer(room){

    return room.players.find(
        player =>
            player.id ===
            room.currentPlayerId
    ) || null;

}


/* =========================================================
   PROCHAIN JOUEUR
========================================================= */

function getNextPlayer(
    room,
    steps = 1
){

    if(
        room.players.length === 0
    ){

        return null;

    }


    const index =
        room.players.findIndex(
            player =>
                player.id ===
                room.currentPlayerId
        );


    if(index === -1)
        return room.players[0];


    const total =
        room.players.length;


    const nextIndex =
        (
            index +
            room.direction *
            steps +
            total * 100
        ) % total;


    return room.players[
        nextIndex
    ];

}


/* =========================================================
   PASSER TOUR
========================================================= */

function nextPlayer(
    room,
    steps = 1
){

    const next =
        getNextPlayer(
            room,
            steps
        );


    if(next){

        room.currentPlayerId =
            next.id;

        next.hasDrawn =
            false;

        next.drawnCardId =
            null;

    }

}


/* =========================================================
   REFILL
========================================================= */

function refillDeck(room){

    if(
        room.discard.length <= 1
    ){

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
        shuffle(
            recycled
        );


    room.discard.push(
        top
    );

}


/* =========================================================
   PIOCHE UNE CARTE
========================================================= */

function drawOne(room){

    if(
        room.deck.length === 0
    ){

        refillDeck(room);

    }


    return room.deck.pop() ||
        null;

}


/* =========================================================
   PIOCHE PLUSIEURS
========================================================= */

function drawCards(
    room,
    player,
    amount
){

    for(
        let i = 0;
        i < amount;
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


/* =========================================================
   CARTE JOUABLE
========================================================= */

function isPlayable(
    room,
    player,
    card
){

    const top =
        room.discard[
            room.discard.length - 1
        ];


    if(!top)
        return true;


    /*
     * EMPILEMENT +2
     */

    if(
        room.pendingDraw > 0
    ){

        if(
            room.settings.stacking
        ){

            return (
                card.type ===
                "draw2"
            );

        }

        return false;

    }


    /*
     * WILD
     */

    if(
        card.type === "wild"
    ){

        return true;

    }


    /*
     * +4
     */

    if(
        card.type === "wild4"
    ){

        /*
         * Un +4 n'est jouable
         * que si le joueur n'a
         * aucune carte de la couleur
         * actuelle.
         */

        return !player.hand.some(
            other =>
                other.id !== card.id &&
                other.color ===
                room.currentColor
        );

    }


    /*
     * Même couleur
     */

    if(
        card.color ===
        room.currentColor
    ){

        return true;

    }


    /*
     * Même symbole
     */

    if(
        card.type ===
        top.type &&
        card.type !==
        "number"
    ){

        return true;

    }


    /*
     * Même chiffre
     */

    if(
        card.type === "number" &&
        top.type === "number" &&
        card.value ===
        top.value
    ){

        return true;

    }


    return false;

}


/* =========================================================
   ÉTAT PUBLIC
========================================================= */

function publicState(
    room,
    viewerId
){

    const players =
        room.players.map(
            player => ({

                id:player.id,

                name:player.name,

                cardCount:
                    player.hand.length,

                host:
                    player.socket ===
                    room.host

            })
        );


    const current =
        currentPlayer(room);


    let me = null;


    if(viewerId){

        const player =
            room.players.find(
                p =>
                    p.id ===
                    viewerId
            );


        if(player){

            me = {

                id:player.id,

                name:player.name,

                hand:player.hand,

                hasDrawn:
                    player.hasDrawn,

                drawnCardId:
                    player.drawnCardId,

                uno:
                    player.uno

            };

        }

    }


    let canPlayWild4 =
        false;


    if(viewerId){

        const player =
            room.players.find(
                p =>
                    p.id ===
                    viewerId
            );


        if(player){

            canPlayWild4 =
                !player.hand.some(
                    card =>
                        card.color ===
                        room.currentColor
                );

        }

    }


    return {

        status:
            room.status,

        displayMode:
            room.displayMode,

        settings:
            room.settings,

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

        pendingDraw:
            room.pendingDraw,

        me,

        canPlayWild4,

        isHost:
            viewerId
                ? (
                    room.players.some(
                        p =>
                            p.id ===
                            viewerId &&
                            p.socket ===
                            room.host
                    )
                )
                : false

    };

}


/* =========================================================
   ENVOYER ÉTAT
========================================================= */

function sendState(room){

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
     * TV reçoit l'état complet
     */

    if(
        room.displayMode === "tv"
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


/* =========================================================
   FIN MANCHE
========================================================= */

function cardPoints(card){

    if(
        card.type === "number"
    ){

        return card.value;

    }


    if(
        card.type === "skip" ||
        card.type === "reverse" ||
        card.type === "draw2"
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
        player => {

            if(
                player.id ===
                winner.id
            ){

                return;

            }


            player.hand.forEach(
                card => {

                    points +=
                        cardPoints(
                            card
                        );

                }
            );

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
     * Nouveau paquet.
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

            player.drawnCardId =
                null;

            player.uno =
                false;

        }
    );


    /*
     * 7 cartes chacun.
     */

    for(
        let i = 0;
        i < 7;
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
     * Première carte :
     * uniquement une carte chiffre.
     */

    let first = null;


    while(
        room.deck.length > 0
    ){

        first =
            drawOne(room);


        if(
            first &&
            first.type ===
            "number"
        ){

            break;

        }


        if(first){

            room.deck.unshift(
                first
            );

        }

    }


    if(!first){

        send(
            room.host,
            {

                type:"error",

                message:
                    "Impossible de démarrer la partie."

            }
        );

        return;

    }


    room.discard.push(
        first
    );


    room.currentColor =
        first.color;


    /*
     * Premier joueur.
     */

    room.currentPlayerId =
        room.players[0].id;


    room.status =
        "playing";


    sendState(room);

}


/* =========================================================
   JOUER CARTE
========================================================= */

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


    const current =
        currentPlayer(room);


    if(
        !current ||
        current.id !==
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
        index < 0 ||
        index >=
        player.hand.length
    ){

        return;

    }


    const card =
        player.hand[index];


    /*
     * Après pioche :
     * seule la carte piochée
     * peut être jouée.
     */

    if(
        player.hasDrawn &&
        player.drawnCardId &&
        card.id !==
        player.drawnCardId
    ){

        send(
            player.socket,
            {

                type:"error",

                message:
                    "Après avoir pioché, tu peux jouer uniquement la carte piochée."

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
                    "Cette carte ne peut pas être jouée."

            }
        );

        return;

    }


    /*
     * WILD / +4 :
     * couleur obligatoire.
     */

    if(
        card.type === "wild" ||
        card.type === "wild4"
    ){

        if(
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

    }


    /*
     * Retirer la carte.
     */

    player.hand.splice(
        index,
        1
    );


    room.discard.push(
        card
    );


    /*
     * Couleur actuelle.
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


    /*
     * Si un +2 est posé,
     * le compteur augmente.
     */

    if(
        card.type === "draw2" &&
        room.settings.stacking
    ){

        room.pendingDraw += 2;

    }
    else if(
        card.type !== "draw2"
    ){

        /*
         * Une carte normale
         * annule tout compteur.
         */

        if(
            room.pendingDraw > 0
        ){

            room.pendingDraw = 0;

        }

    }


    player.hasDrawn =
        false;

    player.drawnCardId =
        null;


    /*
     * Victoire.
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
     * UNO.
     */

    if(
        player.hand.length === 1
    ){

        player.uno =
            false;

    }


    /*
     * Effets des cartes.
     */

    let steps = 1;


    switch(card.type){

        case "skip":

            steps = 2;

            break;


        case "reverse":

            if(
                room.players.length === 2
            ){

                steps = 2;

            }
            else{

                room.direction *= -1;

            }

            break;


        case "draw2":

            /*
             * Si stacking activé,
             * on ne fait PAS piocher
             * immédiatement le joueur suivant.
             *
             * Le prochain joueur pourra
             * ajouter un +2.
             */

            if(
                room.settings.stacking
            ){

                steps = 1;

            }
            else{

                const target =
                    getNextPlayer(
                        room
                    );


                if(target){

                    drawCards(
                        room,
                        target,
                        2
                    );

                }


                steps = 2;

            }

            break;


        case "wild4":

            const target4 =
                getNextPlayer(
                    room
                );


            if(target4){

                drawCards(
                    room,
                    target4,
                    4
                );

            }


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
   PIOCHE
========================================================= */

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


    const current =
        currentPlayer(room);


    if(
        !current ||
        current.id !==
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
     * CAS EMPILAGE +2
     */

    if(
        room.pendingDraw > 0
    ){

        /*
         * Le joueur ne peut pas empiler.
         *
         * Il prend toute la pénalité.
         */

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

        player.drawnCardId =
            null;


        /*
         * Le tour passe immédiatement.
         */

        nextPlayer(
            room,
            1
        );


        sendState(room);

        return;

    }


    /*
     * PIOCHE NORMALE
     */

    const card =
        drawOne(room);


    if(!card){

        send(
            player.socket,
            {

                type:"error",

                message:
                    "La pioche est vide."

            }
        );

        return;

    }


    player.hand.push(
        card
    );


    player.hasDrawn =
        true;


    player.drawnCardId =
        card.id;


    /*
     * CORRECTION PRINCIPALE :
     *
     * Si la carte piochée n'est PAS jouable,
     * le tour passe immédiatement.
     *
     * Si elle est jouable,
     * le joueur reste actif et peut
     * cliquer dessus pour la jouer.
     */

    const playable =
        isPlayable(
            room,
            player,
            card
        );


    if(!playable){

        player.hasDrawn =
            false;

        player.drawnCardId =
            null;


        nextPlayer(
            room,
            1
        );

    }


    sendState(room);

}


/* =========================================================
   UNO
========================================================= */

function callUno(
    room,
    player
){

    if(
        player.hand.length === 1
    ){

        player.uno =
            true;

        sendState(room);

    }

}


/* =========================================================
   NOUVELLE MANCHE
========================================================= */

function newGame(room){

    room.status =
        "waiting";

    room.winner =
        null;

    room.deck = [];

    room.discard = [];

    room.currentPlayerId =
        null;

    room.currentColor =
        null;

    room.pendingDraw =
        0;

    room.direction =
        1;


    room.players.forEach(
        player => {

            player.hand = [];

            player.hasDrawn =
                false;

            player.drawnCardId =
                null;

            player.uno =
                false;

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


                try{

                    data =
                        JSON.parse(
                            raw.toString()
                        );

                }catch(e){

                    return;

                }


                /* =================================================
                   CRÉATION SALON
                ================================================= */

                if(
                    data.type ===
                    "create_room"
                ){

                    const displayMode =
                        data.mode ===
                        "phones"
                            ? "phones"
                            : "tv";


                    const room =
                        createRoom(
                            socket,
                            displayMode,
                            Boolean(
                                data.stacking
                            )
                        );


                    socket.room =
                        room.room;


                    /*
                     * Mode téléphones :
                     * le créateur est aussi joueur.
                     */

                    if(
                        displayMode ===
                        "phones"
                    ){

                        const player = {

                            id:
                                makeId(),

                            name:
                                String(
                                    data.name ||
                                    "Joueur"
                                )
                                .trim()
                                .substring(
                                    0,
                                    18
                                ),

                            socket,

                            hand:[],

                            score:0,

                            hasDrawn:false,

                            drawnCardId:null,

                            uno:false

                        };


                        room.players.push(
                            player
                        );


                        socket.playerId =
                            player.id;


                        send(
                            socket,
                            {

                                type:
                                    "room_created",

                                room:
                                    room.room,

                                playerId:
                                    player.id

                            }
                        );

                    }
                    else{

                        /*
                         * Mode TV :
                         * le PC n'est pas joueur.
                         */

                        send(
                            socket,
                            {

                                type:
                                    "room_created",

                                room:
                                    room.room

                            }
                        );

                    }


                    sendState(room);

                    return;

                }


                /* =================================================
                   REJOINDRE
                ================================================= */

                if(
                    data.type ===
                    "join_room"
                ){

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


                    const name =
                        String(
                            data.name ||
                            "Joueur"
                        )
                        .trim()
                        .substring(
                            0,
                            18
                        );


                    const player = {

                        id:
                            makeId(),

                        name:
                            name ||
                            "Joueur",

                        socket,

                        hand:[],

                        score:0,

                        hasDrawn:false,

                        drawnCardId:null,

                        uno:false

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

                            type:"joined",

                            room:
                                room.room,

                            playerId:
                                player.id

                        }
                    );


                    sendState(room);

                    return;

                }


                /* =================================================
                   SALON
                ================================================= */

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


                /* =================================================
                   START
                ================================================= */

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


                /* =================================================
                   JOUER
                ================================================= */

                if(
                    data.type ===
                    "play_card"
                ){

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


                /* =================================================
                   PIOCHER
                ================================================= */

                if(
                    data.type ===
                    "draw"
                ){

                    if(!player)
                        return;


                    playerDraw(
                        room,
                        player
                    );

                    return;

                }


                /* =================================================
                   UNO
                ================================================= */

                if(
                    data.type ===
                    "uno"
                ){

                    if(!player)
                        return;


                    callUno(
                        room,
                        player
                    );

                    return;

                }


                /* =================================================
                   NOUVELLE MANCHE
                ================================================= */

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


        /* =========================================================
           DECONNEXION
        ========================================================= */

        socket.on(
            "close",
            () => {

                const room =
                    rooms.get(
                        socket.room
                    );


                if(!room)
                    return;


                const playerIndex =
                    room.players.findIndex(
                        player =>
                            player.socket ===
                            socket
                    );


                /*
                 * Si le socket correspond
                 * à un joueur.
                 */

                if(
                    playerIndex !== -1
                ){

                    const leavingPlayer =
                        room.players[
                            playerIndex
                        ];


                    const wasCurrent =
                        room.currentPlayerId ===
                        leavingPlayer.id;


                    room.players.splice(
                        playerIndex,
                        1
                    );


                    if(
                        room.players.length ===
                        0
                    ){

                        rooms.delete(
                            room.room
                        );

                        return;

                    }


                    /*
                     * Si c'était son tour,
                     * on donne le tour au suivant.
                     */

                    if(
                        wasCurrent &&
                        room.status ===
                        "playing"
                    ){

                        const next =
                            room.players[
                                playerIndex %
                                room.players.length
                            ];


                        room.currentPlayerId =
                            next.id;

                    }


                    /*
                     * Si le host TV part,
                     * supprimer le salon.
                     */

                    if(
                        room.displayMode ===
                        "tv" &&
                        socket ===
                        room.host
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
                                            "L'écran principal a quitté le salon."

                                    }
                                );

                            }
                        );

                        return;

                    }


                    /*
                     * Mode téléphone :
                     * si le créateur part,
                     * donner le host au premier joueur.
                     */

                    if(
                        room.displayMode ===
                        "phones" &&
                        socket ===
                        room.host
                    ){

                        if(
                            room.players.length >
                            0
                        ){

                            room.host =
                                room.players[0]
                                    .socket;

                        }

                    }


                    sendState(room);

                }

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
