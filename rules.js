const {nextPlayer, createPlayer, eliminatePlayer} = require("./player");
const {aiChooseMove, chooseColor} = require("./ai");
const {playCard, drawCards, checkElimination, hasPlayableCard, checkWin} = require("./play");
const {applyDiscardAll, RouletteDraw} = require("./cardeffect");


function takeTurn(game) {

  if (game.gameOver) return;

  const player = game.players[game.currentPlayerIndex];

  if(!player || !player.active){
    nextPlayer(game);
    return;
  }

  if (game.rouletteActive) {
  console.log(`🎰 Roulette effect for ${player.name}`);

  const color = chooseColor(player);
  console.log(`Roulette color chosen: ${color}`);
  game.currentColor = color;
  console.log(`${player.name} chose ${color}`);

  RouletteDraw(game, player, color);

  if(player.hand.length >= 25){
    eliminatePlayer(game, player);
  }

  game.rouletteActive = false;

  nextPlayer(game);
  return; 
}
  console.log(`👉 ${player.name}'s turn`);
  console.log(
    `Turn ${game.turnCount} | Hand: ${player.hand.length}`
  );

  game.turnCount++;

  // ⛔ Hard stop
  if (game.turnCount >= game.maxTurns) {
    game.gameOver = true;
    console.log("⏹ Game stopped (turn limit reached)");
    return;
  }

  // 🔴 Handle draw penalties FIRST
  if (game.pendingDrawPenalties > 0) {

    const move = aiChooseMove(game, player);

    if (move.type === "play") {
        const card = player.hand[move.cardIndex];
        const chosenColor = card.type === "wild" ? chooseColor(player) : null;
        playCard(game, player, move.cardIndex, chosenColor);
        nextPlayer(game);
        return;
    }

    console.log(`${player.name} draws ${game.pendingDrawPenalties} cards (penalty)`);

    if(!hasPlayableCard(player, game)){
      const drawnCards = drawCards(game, player);
      if (!drawnCards) {
        nextPlayer(game);
        return;
      }
      playCard(game, player, player.hand.indexOf(drawnCards));
      checkWin(game, player);
      nextPlayer(game);
      return;
    }

    game.pendingDrawPenalties = 0;
    checkElimination(game, player);
    nextPlayer(game);
  }

  // 🤖 Decide move
  const move = player.isAI
    ? aiChooseMove(game, player)
    : null;

  // ▶️ PLAY CARD
  if (move && move.type === "play") {
    const card = player.hand[move.cardIndex];
    const chosenColor =
      card.type === "wild" ? chooseColor(player) : null;

    playCard(game, player, move.cardIndex, chosenColor);

    // 🏆 Check win AFTER play
    if (player.hand.length === 0) {
      game.gameOver = true;
      console.log(`🏆 ${player.name} wins!`);
      return;
    }
    if(player.hand.length >= 25){
      eliminatePlayer(game, player); 
      nextPlayer(game);
      return;
    }

    nextPlayer(game);
    return;
  }

  // ➕ DRAW CARD (no playable card)
  if (!hasPlayableCard(player, game)) {
  const drawnCard = drawCards(game, player);

  if (!drawnCard) {
    nextPlayer(game);
    return;
  }

  playCard(game, player, player.hand.indexOf(drawnCard));
  checkWin(game, player);
  nextPlayer(game);
  return;
}

  checkElimination(game, player);
  nextPlayer(game);
  return;
}



module.exports = { takeTurn };
