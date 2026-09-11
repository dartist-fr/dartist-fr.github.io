const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 10000;

const SIZE = 10;
const MAX_LOGS = 100;

const ROOM_TTL = 60 * 60 * 1000;
const RECONNECT_TTL = 2 * 60 * 1000;

const FLEET = [
    {
        type: "carrier",
        name: "Porte-avions",
        size: 5
    },
    {
        type: "battleship",
        name: "Cuirassé",
        size: 4
    },
    {
        type: "cruiser",
        name: "Croiseur",
        size: 3
    },
    {
        type: "submarine",
        name: "Sous-marin",
        size: 3
    },
    {
        type: "destroyer",
        name: "Torpilleur",
        size: 2
    }
];

const rooms = new Map();


/* =========================
   HTTP
========================= */

const server = http.createServer(
    (req, res) => {

        res.writeHead(
            200,
            {
                "Content-Type":
                    "text/plain; charset=utf-8"
            }
        );

        res.end(
            "Serveur Bataille Navale Jeux2Soirée opérationnel."
        );
    }
);


/* =========================
   WEBSOCKET
========================= */

const wss =
    new WebSocket.Server({
        server
    });


/* =========================
   OUTILS
========================= */

function makeId(){

    return crypto
        .randomBytes(12)
        .toString("hex");
}


function makeToken(){

    return crypto
        .randomBytes(24)
        .toString("hex");
}


function makeRoomCode(){

    let code;

    do{

        code =
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


function send(socket,data){

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


function broadcast(room,data){

    for(
        const player of room.players
    ){

        send(
            player.socket,
            data
        );
    }

    if(room.tv){

        send(
            room.tv,
            data
        );
    }
}


function addLog(room,text){

    room.logs.push({

        time:
            new Date()
                .toLocaleTimeString(
                    "fr-FR",
                    {
                        hour:"2-digit",
                        minute:"2-digit"
                    }
                ),

        text:text
    });

    if(
        room.logs.length >
        MAX_LOGS
    ){

        room.logs.shift();
    }
}


function emptyShots(){

    return Array(
        SIZE * SIZE
    ).fill(null);
}


function createPlayer(name){

    return {

        id:makeId(),

        token:makeToken(),

        name:
            String(
                name ||
                "Joueur"
            )
            .trim()
            .slice(0,18)
            ||
            "Joueur",

        socket:null,

        connected:false,

        disconnectedAt:null,

        ready:false,

        ships:[],

        shots:
            emptyShots()
    };
}


/* =========================
   SALON
========================= */

function createRoom(
    mode,
    hostSocket,
    hostName
){

    const room = {

        code:
            makeRoomCode(),

        mode:
            mode === "tv"
                ? "tv"
                : "phones",

        host:
            hostSocket,

        tv:
            mode === "tv"
                ? hostSocket
                : null,

        players:[],

        status:"waiting",

        currentPlayerId:null,

        winnerId:null,

        logs:[],

        createdAt:
            Date.now()
    };


    rooms.set(
        room.code,
        room
    );


    /*
       En mode téléphones,
       le créateur est lui-même
       le premier joueur.
    */

    if(
        room.mode === "phones"
    ){

        const player =
            createPlayer(
                hostName
            );

        player.socket =
            hostSocket;

        player.connected =
            true;

        room.players.push(
            player
        );

        hostSocket.playerId =
            player.id;

        hostSocket.sessionToken =
            player.token;
    }


    addLog(
        room,
        "🏠 Salon créé."
    );


    if(
        room.mode === "tv"
    ){

        addLog(
            room,
            "🖥️ Mode TV + téléphones."
        );

    }else{

        addLog(
            room,
            "📱 Mode téléphones uniquement."
        );
    }


    return room;
}


/* =========================
   GRILLE
========================= */

function cellIndex(
    row,
    col
){

    return row * SIZE + col;
}


function inside(
    row,
    col
){

    return (
        row >= 0 &&
        row < SIZE &&
        col >= 0 &&
        col < SIZE
    );
}


/* =========================
   BATEAUX
========================= */

function getFleetDefinition(
    type
){

    return FLEET.find(
        ship =>
            ship.type === type
    );
}


function getShipCells(ship){

    const def =
        getFleetDefinition(
            ship.type
        );

    const cells = [];

    for(
        let i = 0;
        i < def.size;
        i++
    ){

        const row =
            ship.orientation === "V"
                ? ship.row + i
                : ship.row;

        const col =
            ship.orientation === "H"
                ? ship.col + i
                : ship.col;

        cells.push(
            cellIndex(
                row,
                col
            )
        );
    }

    return cells;
}


function validateFleet(
    ships
){

    if(
        !Array.isArray(ships) ||
        ships.length !== 5
    ){

        return {
            ok:false,
            message:
                "La flotte est incomplète."
        };
    }


    const occupied =
        new Set();


    for(
        const definition of FLEET
    ){

        const ship =
            ships.find(
                s =>
                    s &&
                    s.type ===
                    definition.type
            );


        if(!ship){

            return {
                ok:false,
                message:
                    "Bateau manquant : " +
                    definition.name
            };
        }


        const row =
            Number(ship.row);

        const col =
            Number(ship.col);

        const orientation =
            ship.orientation === "V"
                ? "V"
                : "H";


        if(
            !Number.isInteger(row) ||
            !Number.isInteger(col)
        ){

            return {
                ok:false,
                message:
                    "Position invalide."
            };
        }


        for(
            let i=0;
            i<definition.size;
            i++
        ){

            const r =
                orientation === "V"
                    ? row + i
                    : row;

            const c =
                orientation === "H"
                    ? col + i
                    : col;


            if(
                !inside(r,c)
            ){

                return {
                    ok:false,
                    message:
                        definition.name +
                        " sort de la grille."
                };
            }


            const index =
                cellIndex(
                    r,
                    c
                );


            if(
                occupied.has(index)
            ){

                return {
                    ok:false,
                    message:
                        "Deux bateaux se chevauchent."
                };
            }


            occupied.add(index);
        }
    }


    return {
        ok:true
    };
}


/* =========================
   ETAT PUBLIC
========================= */

function publicState(
    room,
    viewer
){

    const me =
        viewer
            ? room.players.find(
                p =>
                    p.id ===
                    viewer.id
            )
            : null;


    const opponent =
        me
            ? room.players.find(
                p =>
                    p.id !==
                    me.id
            )
            : null;


    /*
       IMPORTANT :
       Les bateaux adverses
       ne sont JAMAIS envoyés.
    */

    const ownShips =
        me
            ? me.ships.map(
                ship => ({
                    type:
                        ship.type,

                    row:
                        ship.row,

                    col:
                        ship.col,

                    orientation:
                        ship.orientation
                })
            )
            : [];


    return {

        room:
            room.code,

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

                    connected:
                        player.connected,

                    ready:
                        player.ready
                })
            ),

        currentPlayerId:
            room.currentPlayerId,

        currentPlayerName:
            room.players.find(
                p =>
                    p.id ===
                    room.currentPlayerId
            )?.name || null,

        winnerId:
            room.winnerId,

        me:
            me
                ? {

                    id:
                        me.id,

                    name:
                        me.name,

                    ready:
                        me.ready,

                    ships:
                        ownShips,

                    /*
                       Shots de l'adversaire
                       sur notre grille.
                    */
                    incoming:
                        opponent
                            ? opponent.shots
                            : emptyShots()
                }
                : null,

        enemy:
            opponent
                ? {

                    id:
                        opponent.id,

                    name:
                        opponent.name,

                    /*
                       Nos propres tirs
                       sur l'adversaire.
                    */
                    shots:
                        me
                            ? me.shots
                            : emptyShots()
                }
                : null,

        logs:
            room.logs
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
                        player
                    )
            }
        );
    }


    if(room.tv){

        send(
            room.tv,
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
   DÉMARRAGE
========================= */

function startBattle(room){

    if(
        room.players.length !== 2
    ){

        return;
    }


    if(
        !room.players.every(
            player =>
                player.ready
        )
    ){

        return;
    }


    room.status =
        "playing";


    room.winnerId =
        null;


    room.currentPlayerId =
        room.players[
            crypto.randomInt(2)
        ].id;


    for(
        const player of room.players
    ){

        player.shots =
            emptyShots();
    }


    const starter =
        room.players.find(
            player =>
                player.id ===
                room.currentPlayerId
        );


    addLog(
        room,
        "🎲 " +
        starter.name +
        " commence la bataille !"
    );


    sendState(room);
}


/* =========================
   TIR
========================= */

function shoot(
    room,
    attacker,
    index
){

    if(
        room.status !==
        "playing"
    ){

        return;
    }


    if(
        room.currentPlayerId !==
        attacker.id
    ){

        send(
            attacker.socket,
            {
                type:"error",
                message:
                    "Ce n'est pas ton tour."
            }
        );

        return;
    }


    index =
        Number(index);


    if(
        !Number.isInteger(index) ||
        index < 0 ||
        index >= 100
    ){

        return;
    }


    if(
        attacker.shots[index]
    ){

        send(
            attacker.socket,
            {
                type:"error",
                message:
                    "Tu as déjà tiré ici."
            }
        );

        return;
    }


    const target =
        room.players.find(
            player =>
                player.id !==
                attacker.id
        );


    if(!target){

        return;
    }


    let hitShip =
        null;


    for(
        const ship of target.ships
    ){

        const cells =
            getShipCells(
                ship
            );


        if(
            cells.includes(index)
        ){

            hitShip =
                ship;

            break;
        }
    }


    /*
       À L'EAU
    */

    if(!hitShip){

        attacker.shots[index] =
            "miss";


        addLog(
            room,
            "💦 " +
            attacker.name +
            " tire en " +
            formatCoordinate(index) +
            " : À L'EAU !"
        );


        room.currentPlayerId =
            target.id;


        sendState(room);

        return;
    }


    /*
       TOUCHÉ
    */

    attacker.shots[index] =
        "hit";


    const shipCells =
        getShipCells(
            hitShip
        );


    const sunk =
        shipCells.every(
            cell =>
                attacker.shots[cell] ===
                    "hit" ||
                attacker.shots[cell] ===
                    "sunk"
        );


    const definition =
        getFleetDefinition(
            hitShip.type
        );


    if(sunk){

        for(
            const cell of shipCells
        ){

            attacker.shots[cell] =
                "sunk";
        }


        addLog(
            room,
            "💥 " +
            attacker.name +
            " COULE le " +
            definition.name +
            " de " +
            target.name +
            " !"
        );

    }else{

        addLog(
            room,
            "🎯 " +
            attacker.name +
            " touche le " +
            definition.name +
            " de " +
            target.name +
            " !"
        );
    }


    /*
       VICTOIRE
    */

    const allSunk =
        target.ships.every(
            ship =>
                getShipCells(
                    ship
                ).every(
                    cell =>
                        attacker.shots[cell] ===
                            "hit" ||
                        attacker.shots[cell] ===
                            "sunk"
                )
        );


    if(allSunk){

        room.status =
            "finished";

        room.winnerId =
            attacker.id;

        room.currentPlayerId =
            null;


        addLog(
            room,
            "🏆 " +
            attacker.name +
            " remporte la bataille !"
        );


        sendState(room);

        return;
    }


    /*
       Le tour passe après chaque tir.
    */

    room.currentPlayerId =
        target.id;


    sendState(room);
}


/* =========================
   COORDONNÉES
========================= */

function formatCoordinate(
    index
){

    const letters =
        "ABCDEFGHIJ";

    const col =
        index % 10;

    const row =
        Math.floor(
            index / 10
        ) + 1;


    return (
        letters[col] +
        row
    );
}


/* =========================
   NOUVELLE PARTIE
========================= */

function resetGame(room){

    room.status =
        "waiting";

    room.currentPlayerId =
        null;

    room.winnerId =
        null;


    for(
        const player of room.players
    ){

        player.ready =
            false;

        player.ships =
            [];

        player.shots =
            emptyShots();
    }


    addLog(
        room,
        "🔄 Nouvelle bataille : placez vos bateaux."
    );


    sendState(room);
}


/* =========================
   RECONNEXION
========================= */

function findPlayerByToken(
    room,
    sessionToken
){

    if(!sessionToken)
        return null;

    return room.players.find(
        player =>
            player.token ===
            sessionToken
    ) || null;
}


function attachPlayer(
    socket,
    room,
    player
){

    player.socket =
        socket;

    player.connected =
        true;

    player.disconnectedAt =
        null;

    socket.room =
        room.code;

    socket.playerId =
        player.id;

    socket.sessionToken =
        player.token;


    addLog(
        room,
        "🔌 " +
        player.name +
        " est reconnecté."
    );
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

        socket.sessionToken =
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

                }catch{

                    return;
                }


                /* =====================
                   CRÉATION
                ===================== */

                if(
                    data.type ===
                    "create_room"
                ){

                    const room =
                        createRoom(
                            data.mode,
                            socket,
                            data.name
                        );


                    socket.room =
                        room.code;


                    send(
                        socket,
                        {
                            type:
                                "room_created",

                            room:
                                room.code,

                            playerId:
                                socket.playerId ||
                                null,

                            sessionToken:
                                socket.sessionToken ||
                                null,

                            mode:
                                room.mode
                        }
                    );


                    sendState(room);

                    return;
                }


                /* =====================
                   REJOINDRE
                ===================== */

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


                    /*
                       Reconnexion
                    */

                    const existing =
                        findPlayerByToken(
                            room,
                            data.sessionToken
                        );


                    if(existing){

                        attachPlayer(
                            socket,
                            room,
                            existing
                        );


                        send(
                            socket,
                            {
                                type:"joined",
                                room:
                                    room.code,

                                playerId:
                                    existing.id,

                                sessionToken:
                                    existing.token,

                                mode:
                                    room.mode
                            }
                        );


                        sendState(room);

                        return;
                    }


                    /*
                       Maximum 2 joueurs.
                    */

                    if(
                        room.players.length >= 2
                    ){

                        send(
                            socket,
                            {
                                type:"error",
                                message:
                                    "Cette partie est complète."
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
                                    "La bataille a déjà commencé."
                            }
                        );

                        return;
                    }


                    const player =
                        createPlayer(
                            data.name
                        );


                    player.socket =
                        socket;

                    player.connected =
                        true;


                    room.players.push(
                        player
                    );


                    socket.room =
                        room.code;

                    socket.playerId =
                        player.id;

                    socket.sessionToken =
                        player.token;


                    addLog(
                        room,
                        "👋 " +
                        player.name +
                        " rejoint la bataille."
                    );


                    send(
                        socket,
                        {
                            type:"joined",

                            room:
                                room.code,

                            playerId:
                                player.id,

                            sessionToken:
                                player.token,

                            mode:
                                room.mode
                        }
                    );


                    sendState(room);

                    return;
                }


                /* =====================
                   SALON ACTUEL
                ===================== */

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


                /* =====================
                   PLACEMENT
                ===================== */

                if(
                    data.type ===
                    "place_fleet" &&
                    player
                ){

                    if(
                        room.status !==
                        "waiting"
                    ){

                        return;
                    }


                    const validation =
                        validateFleet(
                            data.ships
                        );


                    if(
                        !validation.ok
                    ){

                        send(
                            socket,
                            {
                                type:"error",
                                message:
                                    validation.message
                            }
                        );

                        return;
                    }


                    player.ships =
                        data.ships.map(
                            ship => ({

                                type:
                                    ship.type,

                                row:
                                    Number(
                                        ship.row
                                    ),

                                col:
                                    Number(
                                        ship.col
                                    ),

                                orientation:
                                    ship.orientation === "V"
                                        ? "V"
                                        : "H"
                            })
                        );


                    player.ready =
                        true;


                    addLog(
                        room,
                        "🚢 " +
                        player.name +
                        " a placé sa flotte."
                    );


                    if(
                        room.players.length === 2 &&
                        room.players.every(
                            p =>
                                p.ready
                        )
                    ){

                        startBattle(room);

                    }else{

                        sendState(room);
                    }


                    return;
                }


                /* =====================
                   TIR
                ===================== */

                if(
                    data.type ===
                    "shoot" &&
                    player
                ){

                    shoot(
                        room,
                        player,
                        data.index
                    );

                    return;
                }


                /* =====================
                   NOUVELLE PARTIE
                ===================== */

                if(
                    data.type ===
                    "new_game"
                ){

                    /*
                       L'hôte peut relancer.
                    */

                    if(
                        socket ===
                        room.host ||
                        (
                            room.mode ===
                            "phones" &&
                            player &&
                            room.players[0]?.id ===
                            player.id
                        )
                    ){

                        resetGame(room);
                    }

                    return;
                }
            }
        );


        /* =====================
           DÉCONNEXION
        ===================== */

        socket.on(
            "close",
            () => {

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
                    player &&
                    player.socket ===
                    socket
                ){

                    player.socket =
                        null;

                    player.connected =
                        false;

                    player.disconnectedAt =
                        Date.now();


                    addLog(
                        room,
                        "📴 " +
                        player.name +
                        " est déconnecté."
                    );


                    sendState(room);

                    return;
                }


                if(
                    socket ===
                    room.tv &&
                    room.mode === "tv"
                ){

                    room.tv =
                        null;
                }
            }
        );
    }
);


/* =========================
   NETTOYAGE
========================= */

setInterval(
    () => {

        const current =
            Date.now();


        for(
            const [code,room]
            of rooms
        ){

            /*
               Salon trop ancien.
            */

            if(
                current -
                room.createdAt >
                ROOM_TTL
            ){

                rooms.delete(
                    code
                );

                continue;
            }


            /*
               Joueur déconnecté
               depuis trop longtemps.
            */

            for(
                const player of
                [...room.players]
            ){

                if(
                    !player.connected &&
                    player.disconnectedAt &&
                    current -
                    player.disconnectedAt >
                    RECONNECT_TTL
                ){

                    addLog(
                        room,
                        "🚪 " +
                        player.name +
                        " quitte définitivement la partie."
                    );


                    const index =
                        room.players.indexOf(
                            player
                        );


                    if(index >= 0){

                        room.players.splice(
                            index,
                            1
                        );
                    }
                }
            }


            if(
                room.players.length === 0 &&
                !room.tv
            ){

                rooms.delete(
                    code
                );
            }
        }

    },
    30000
);


/* =========================
   SERVEUR
========================= */

server.listen(
    PORT,
    () => {

        console.log(
            "Bataille Navale server lancé sur le port " +
            PORT
        );
    }
);
