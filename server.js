const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require('path');

const { creategame, takeTurn, checkWin, createPlayer, nextPlayer, playCard, drawCards} = require("./engine/game");
const { drawOneCard, checkElimination, hasPlayableCard } = require("./engine/play");
const { RouletteDraw, applySpecialEffect, applyDiscardAll, zeroRule, sevenRule } = require("./engine/cardeffect");
const { reshuffle } = require("./engine/deck");

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
    
        const helpers = { nextPlayer, checkWin, checkElimination, RouletteDraw, reshuffle, applySpecialEffect, applyDiscardAll, zeroRule, sevenRule };

        // Not your turn
        
      if(game.rouletteActive && game.rouletteVictimId === socket.id){
        const victim = game.players.find(p => p.id === socket.id);
        
        RouletteDraw(game, victim, chosenColor, helpers);
        if(checkWin(game)){
          io.to(roomId).emit("gameOver", {winner : victim});
          return;
        }
        game.rouletteActive = false;
        game.rouletteVictimId = null;
        nextPlayer(game);
        sendGameState(roomId);
        return;
      }

        // 1. Capture the result of the play
        
      const currentPlayer = game.players[game.currentPlayerIndex];

       if (currentPlayer.id !== socket.id) {
          socket.emit("error", "It's not your turn!");
          return;
        }

      const success = playCard(game, currentPlayer, cardIndex, chosenColor, helpers);

      if (success === false) {
          // This is why you were seeing "Invalid move"
          socket.emit("error", "That card cannot be played now!");
          return; 
      }

      if (success && success.action === "chooseSwapTarget") {
          io.to(currentPlayer.id).emit("chooseSwapTarget", {
              targets: success.targets
          });
          return; // STOP TURN FLOW
      }

      // 2. If play was successful, proceed
      if(checkWin(game)){
        io.to(roomId).emit("gameOver", {winner : currentPlayer});
        return;
      }
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
        const currentPlayer = game.players[game.currentPlayerIndex];

        if(currentPlayer.id != socket.id){
          socket.emit("error", "It's not your turn!");
          return;
        }

        if(game.pendingDrawPenalties > 0){
          const amount = game.pendingDrawPenalties;
          console.log(`${currentPlayer.name} is taking a penalty of ${amount}`);
          for(let i = 0; i < amount; i++){
            drawOneCard(game, currentPlayer);
            checkElimination(game, currentPlayer);
          }

          game.pendingDrawPenalties = 0;
          nextPlayer(game);
        }
        else{
          drawCards(game, currentPlayer);

          if (!hasPlayableCard(currentPlayer, game)) {
             nextPlayer(game); // Only skip if they STILL can't play (safety)
          }
        }
        sendGameState(roomId);
    });

    socket.on("swapHands", ({ roomId, targetId }) => {
        const room = rooms[roomId];
        if (!room || !room.game) return;

        const game = room.game;

        if (!game.waitingForSeven || game.sevenInitiatorId !== socket.id) return;

        const player1 = game.players.find(p => p.id === socket.id);
        const player2 = game.players.find(p => p.id === targetId);

        if (!player1 || !player2 || !player2.active) return;

        // 🔥 swap
        const hand1 = [...player1.hand];
        const hand2 = [...player2.hand];

        player1.hand = hand2;
        player2.hand = hand1;

        game.waitingForSeven = false;
        game.sevenInitiatorId = null;

        nextPlayer(game);

        let nextPerson = game.players[game.currentPlayerIndex];
            while (nextPerson && nextPerson.isAI && !game.gameOver) {
                takeTurn(game);
                nextPerson = game.players[game.currentPlayerIndex];
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
      currentTurnName: room.players[game.currentPlayerIndex].name,
      currentColor:game.currentColor,
      pendingDrawPenalties : game.pendingDrawPenalties,
      rouletteActive: game.rouletteActive,
      rouletteVictimId: game.rouletteVictimId
    });
  });
}
