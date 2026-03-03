const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require('path');

const { creategame, takeTurn, checkWin, createPlayer, nextPlayer, playCard, drawCards, ShuffleDeck } = require("./engine/game");
const { drawOneCard, checkElimination: rawCheckElimination, hasPlayableCard, eliminatePlayer } = require("./engine/play");
const { RouletteDraw, applySpecialEffect, applyDiscardAll, zeroRule, sevenRule } = require("./engine/cardeffect");
const { reshuffle } = require("./engine/deck");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {}; // roomId -> room data
let connectedPlayer = [];

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port : " + PORT);
});


io.on("connection", socket => {
  console.log('user connected : ', socket.id);

  socket.on("createRoom", ({ name }) => {
    const roomId = Math.floor(10000 + Math.random() * 90000).toString();
    const player = createPlayer(socket.id, name, false);

    rooms[roomId] = {
      id: roomId,
      hostId: socket.id,
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

    const player = createPlayer(socket.id, name, false);
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

    if (room.started) {
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

    // wrap elimination so we can broadcast whenever it occurs
    const checkElimination = (g, p, h) => {
      const eliminated = rawCheckElimination(g, p, h);
      if (eliminated) {
        io.to(roomId).emit("playerEliminated", { playerId: p.id, playerName: p.name });
      }
      return eliminated;
    };

    const helpers = { nextPlayer, checkWin, checkElimination, RouletteDraw, reshuffle, applySpecialEffect, applyDiscardAll, zeroRule, sevenRule };

    // Not your turn

    if (game.rouletteActive && game.rouletteVictimId === socket.id) {
      const victim = game.players.find(p => p.id === socket.id);

      RouletteDraw(game, victim, chosenColor, helpers);
      if (checkWin(game)) {
        io.to(roomId).emit("gameOver", { winner: victim });
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
    if (checkWin(game)) {
      io.to(roomId).emit("gameOver", { winner: currentPlayer });
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

  socket.on("drawCard", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;

    const game = room.game;
    const currentPlayer = game.players[game.currentPlayerIndex];
    
    // wrapper to broadcast elimination whenever it happens
    const checkElimination = (g, p, h) => {
      const eliminated = rawCheckElimination(g, p, h);
      if (eliminated) {
        io.to(roomId).emit("playerEliminated", { playerId: p.id, playerName: p.name });
      }
      return eliminated;
    };

    const helpers = { nextPlayer, checkWin, checkElimination, ShuffleDeck, reshuffle, eliminatePlayer };

    if (currentPlayer.id != socket.id) {
      socket.emit("error", "It's not your turn!");
      return;
    }
    let wasEliminated = false;

    if (game.pendingDrawPenalties > 0) {
      const amount = game.pendingDrawPenalties;
      console.log(`${currentPlayer.name} is taking a penalty of ${amount}`);
      for (let i = 0; i < amount; i++) {
        drawOneCard(game, currentPlayer);
        if (checkElimination(game, currentPlayer, helpers)) {
          wasEliminated = true;
          break;
        }
      }

      game.pendingDrawPenalties = 0;
      if (!wasEliminated) {
        nextPlayer(game);
      }
    }
    else {
      // draw until playable or eliminated (helpers will broadcast elimination)
      drawCards(game, currentPlayer, helpers);

      // if drawCards caused elimination the player becomes inactive
      if (!currentPlayer.active) {
        wasEliminated = true;
      }

      if (!wasEliminated && !hasPlayableCard(currentPlayer, game)) {
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

  // if player cancels the seven-swap selection, restore the played card and continue
  socket.on("cancelSeven", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;

    const game = room.game;
    if (!game.waitingForSeven || game.sevenInitiatorId !== socket.id) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    // the last card in discard pile should be the seven that was played;
    // pull it back to the player's hand
    const last = game.discardPile.pop();
    if (last) {
      player.hand.push(last);
    }

    // restore colour/value from new top card (if any)
    const newTop = game.discardPile[game.discardPile.length - 1] || null;
    if (newTop) {
      game.currentColor = newTop.color === "wild" ? game.currentColor : newTop.color;
      game.currentValue = newTop.value;
    } else {
      // no cards left, reset
      game.currentColor = null;
      game.currentValue = null;
    }

    game.waitingForSeven = false;
    game.sevenInitiatorId = null;

    // do NOT advance turn; player can play again
    sendGameState(roomId);
  });

  socket.on("playAgain", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    // reset the state so we are back in the lobby but retain the player list
    room.started = false;
    room.game = null;
    room.players.forEach(p => {
      p.hand = [];
      p.active = true;
    });

    io.to(roomId).emit("backToLobby");
    // include rematch flag so clients can display proper message
    io.to(roomId).emit("roomUpdate", { ...room, rematch: true });
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) continue;

      // if game has started, recover cards and adjust turn
      if (room.started && room.game) {
        const game = room.game;
        const player = room.players[playerIndex];

        // dump their hand into draw pile
        if (player.hand && player.hand.length > 0) {
          game.drawPile.push(...player.hand);
          player.hand = [];
        }

        // remove from players list
        room.players.splice(playerIndex, 1);

        // adjust currentPlayerIndex
        if (playerIndex < game.currentPlayerIndex) {
          game.currentPlayerIndex -= 1;
        } else if (playerIndex === game.currentPlayerIndex) {
          // leave index as is; after removal this now points to the next player
          if (game.currentPlayerIndex >= room.players.length) {
            game.currentPlayerIndex = 0;
          }
        }

        // emit a notice for UI
        io.to(roomId).emit("playerDisconnected", { playerId: socket.id, playerName: player.name });

        // send updated game state so everyone sees new turn/hand counts
        sendGameState(roomId);
      } else {
        // not in a game yet, just remove
        room.players = room.players.filter(p => p.id !== socket.id);
        io.to(roomId).emit("roomUpdate", room);
      }

      // clean up empty rooms
      if (room.players.length === 0) {
        delete rooms[roomId];
      }
    }
  });

});

function sendGameState(roomId) {
  const room = rooms[roomId];
  const game = room.game;
  if (!game || !game.discardPile) {
    console.log("discard not loaded");
    return;
  }

  if (game.currentPlayerIndex >= room.players.length) {
    console.log("Fixing currentPlayerIndex overflow");
    game.currentPlayerIndex = 0;
  }

  if (game.currentPlayerIndex < 0) {
    console.log("Fixing negative currentPlayerIndex");
    game.currentPlayerIndex = 0;
  }

  const currentPlayer = room.players[game.currentPlayerIndex];

  const playerStatus = room.players.map(p => ({
    id: p.id,
    name: p.name,
    handCount: p.hand.length,
    active: p.active
  }));
  
  const fristCard = game.discardPile[game.discardPile.length - 1] || null;

  room.players.forEach((player, index) => {
    const isMyTurn = game.currentPlayerIndex === index;
    
    io.to(player.id).emit("gameState", {
      hand: player.hand,
      topCard: fristCard,
      isMyTurn: isMyTurn,
      currentTurnName: currentPlayer ? currentPlayer.name : "Unknown",
      currentColor: game.currentColor,
      pendingDrawPenalties: game.pendingDrawPenalties || 0,
      rouletteActive: game.rouletteActive || false,
      rouletteVictimId: game.rouletteVictimId || null, 
      players: playerStatus,
      reverse: game.direction === -1
    });
  });
}
