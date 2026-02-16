const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require('path');

const { creategame, takeTurn, checkWin, createPlayer, nextPlayer, playCard} = require("./engine/game");
const { hostname } = require("os");
const { aiChooseMove } = require("./engine/ai");
const { drawOneCard, checkElimination } = require("./engine/play");
const { nextTick } = require("process");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {}; // roomId -> room data
let connectedPlayer = [];

app.use(express.static(path.join(__dirname, 'public')));

server.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});


io.on("connection", socket => {
  console.log('user connected : ', socket.id);

  socket.on("createRoom", ({ name }) => {
    const roomId = Math.floor(10000 + Math.random() * 90000).toString();
    const player = createPlayer(socket.id, name, false );

    rooms[roomId] = {
      id: roomId,
      hostId : socket.id,
      players: [player],
      game: null,
      started: false
    };

    connectedPlayer.push(player);

    socket.join(roomId);
    socket.emit("roomCreated", { roomId });
    io.to(roomId).emit("roomUpdate", rooms[roomId]);
  });

    socket.on("joinRoom", ({ roomId, name }) => {
        const room = rooms[roomId];

        if (!room) {
            socket.emit("error", "Room not found");
            return;
        }

        if (room.players.length >= 6) {
            socket.emit("error", "Room full (max 6 players)");
            return;
        }

        const player = createPlayer(socket.id, name, false );
        connectedPlayer.push(player);
        
        room.players.push(player);
        socket.join(roomId);
        socket.emit("joinedRoom", { roomId });

        io.to(roomId).emit("roomUpdate", room);
    });

    socket.on("startGame", ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) {
          console.log("room not exist");
          return;
        }

        if (room.started){ 
          console.log("room sreated already");
          return;
        }
        if (room.players.length < 2) {
            console.log("error", "Need at least 2 players");
            return;
        }
        if (room.hostId !== socket.id) {
          console.log("error", "Only the host can start the game!");
          return;
        }
        room.game = creategame(room.players);
        room.started = true;

        io.to(roomId).emit("gameStarted");

        sendGameState(roomId);

    });

    socket.on("playCard", ({ roomId, cardIndex, chosenColor }) => {
        const room = rooms[roomId];
        if (!room || !room.game) return;

        const game = room.game;
        const currentPlayer = game.players[game.currentPlayerIndex];

        // Not your turn
        if (currentPlayer.id !== socket.id) {
          socket.emit("error", "It's not your turn!");
          return;
        }

       // 1. Capture the result of the play
      const success = playCard(game, currentPlayer, cardIndex, chosenColor);

      if (success === false) {
          // This is why you were seeing "Invalid move"
          socket.emit("error", "That card cannot be played now!");
          return; 
      }

      // 2. If play was successful, proceed
      checkWin(game);
      nextPlayer(game);

      // 3. Handle AI turns
      let nextPerson = game.players[game.currentPlayerIndex];
      while (nextPerson && nextPerson.isAI && !game.gameOver) {
          console.log(`AI ${nextPerson.name} is thinking...`);
          takeTurn(game);
          nextPerson = game.players[game.currentPlayerIndex];
      }

      sendGameState(roomId);
    });

    socket.on("drawCard", ({roomId}) => {
      const room = rooms[roomId];
        if (!room || !room.game) return;

        const game = room.game;
        const currentPlayer = game.player[game.currentPlayerIndex];

        if(currentPlayer.id != socket.id){
          socket.emit("error", "It's not your turn!");
          return;
        }

        if(game.pendingDrawPenalties > 0){
          const amount = game.pendingDrawPenalties;
          for(let i = 0; i < amount; i++){
            drawOneCard(game, currentPlayer);
            checkElimination(game, currentPlayer);
          }

          game.pendingDrawPenalties = 0;
          nextPlayer(game);
        }
        else{
          drawCard(game, currentPlayer);

          if (!hasPlayableCard(player, game)) {
             nextPlayer(game); // Only skip if they STILL can't play (safety)
          }
        }
        sendGameState(roomId);
    });

    socket.on("disconnect", () => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            room.players = room.players.filter(p => p.id !== socket.id);

            if (room.players.length === 0) {
            delete rooms[roomId];
            } else {
            io.to(roomId).emit("roomUpdate", room);
            }
        }
    });

});

function sendGameState(roomId) {
  const room = getRoom(roomId);
  if (!room || !room.game) return;

  const game = room.game;

  io.to(roomId).emit("gameState", {
    currentPlayer: game.players[game.currentPlayerIndex].name,
    discardTop: game.discardPile.at(-1),
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      active: p.active
    })),
    gameOver : game.gameOver,
    winner : game.gameOver ? game.players.find(p => p.active).name : null
    
  });
}

function sendGameState(roomId) {
  const room = rooms[roomId];
  const game = room.game;
  if (!game || !game.discardPile) {
    console.log("discard not loaded");
    return;}

  room.players.forEach((player, index) => {
    const isMyTurn = game.currentPlayerIndex === index;
    const fristCard = game.discardPile[game.discardPile.length - 1];
    io.to(player.id).emit("gameState", {
      hand: player.hand,
      topCard : fristCard,
      isMyTurn: isMyTurn,
      currentTurnName: room.players[game.currentPlayerIndex].name
    });
  });
}
