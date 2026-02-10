const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const { createGame, takeTurn} = require("./gameEngine");
const {getRoom, createRoom, joinRoom, removePlayer} = require("./rooms");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {}; // roomId -> room data

server.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});


io.on("connection", socket => {

  socket.on("createRoom", ({ name }) => {
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();

    rooms[roomId] = {
      id: roomId,
      players: [{ id: socket.id, name }],
      game: null,
      started: false
    };

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

        room.players.push({ id: socket.id, name });
        socket.join(roomId);

        io.to(roomId).emit("roomUpdate", room);
    });

    socket.on("startGame", ({ roomId }) => {
        const room = getRoom(roomId);
        if (!room) return;

        if (room.started) return;
        if (room.players.length < 2) {
            socket.emit("error", "Need at least 2 players");
            return;
        }

        const enginePlayers = room.players.map(p => ({
            id: p.id,
            name: p.name,
            hand: [],
            active: true,
            isAI: false
        }));

        room.game = createGame(enginePlayers);
        room.started = true;

        io.to(roomId).emit("gameStarted", {
            players: enginePlayers.map(p => p.name)
        });

        sendGameState(roomId);
    });

    socket.on("playCard", ({ roomId, cardIndex }) => {
        const room = getRoom(roomId);
        if (!room || !room.game) return;

        const game = room.game;
        const currentPlayer = game.players[game.currentPlayerIndex];

        // Not your turn
        if (currentPlayer.id !== socket.id) return;

        // Engine handles EVERYTHING
        takeTurn(game, cardIndex);

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

  
