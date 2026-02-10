const { ShuffleDeck } = require("./deck");
const { checkWin } = require("./play");


console.log("🔥 player.js loaded");

function createPlayer(id,name, isAi = false) {
  console.log(`Creating player: ${name} (AI: ${isAi})`);
    return {
       id,
       name,
       isAI: isAi,
       hand : [],
       calleduno : false,
       active: true
    }
}

function nextPlayer(game) {
  if(game.gameOver) return;

  const total = game.players.length;
  do {
    game.currentPlayerIndex =
      (game.currentPlayerIndex + game.direction + game.players.length) %
      total;
  } while (!game.players[game.currentPlayerIndex].active);
}

function eliminatePlayer(game, player) {
  if (!player.active) return;

  console.log(`💀 ${player.name} eliminated (${player.hand.length} cards)`);
  if(checkWin(game, player)) return;

  // Move ALL cards to discard pile
  game.discardPile.push(...player.hand);
  ShuffleDeck(game.discardPile);

  // Clear hand
  player.hand = [];

  // Mark inactive
  player.active = false;

  // Track eliminated players
  game.eliminatedPlayers.push(player.name);
}

function decidePlayOrDraw(player, card) {
  return true;
}

function chooseTargetPlayer(player, targets) {
  return targets[0];
}



module.exports = { createPlayer, nextPlayer, eliminatePlayer, decidePlayOrDraw, chooseTargetPlayer };