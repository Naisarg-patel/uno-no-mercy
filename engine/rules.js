const {aiChooseMove, chooseColor} = require("./ai");
const {playCard, drawCards, drawOneCard, eliminatePlayer} = require("./play");


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
      checkWin(game, player);
    }

    game.rouletteActive = false;

    nextPlayer(game);
    return; 
  }

  console.log(`👉 ${player.name}'s turn`);
  console.log(`Turn ${game.turnCount} | Hand: ${player.hand.length}`);

  game.turnCount++;

  //  Hard stop
  if (game.turnCount >= game.maxTurns) {
    game.gameOver = true;
    console.log("⏹ Game stopped (turn limit reached)");
    return;
  }

  // 1. Handle draw penalties FIRST
  if (game.pendingDrawPenalties > 0) {
    const move = aiChooseMove(game, player);
    
    if (move.type === "play") {
        console.log(`${player.name} STACKS a card!`);
        playCard(game, player, move.cardIndex); 
        checkWin(game, player);
        nextPlayer(game);
        return;
    } else {
        // Must draw if they can't stack
        const amount = game.pendingDrawPenalties; 
        console.log(`⚠️ ${player.name} cannot stack and must draw ${amount} cards`);
        for (let i = 0; i < amount; i++) {
            drawOneCard(game, player);
            if (checkElimination(game, player)) break;
        }
        game.pendingDrawPenalties = 0;
        nextPlayer(game);
        return;
    }
}    

  //2.check playable card 
  if(!hasPlayableCard(player, game)){
    const drawnCard = drawCards(game, player);

    if(!player.active){
      checkWin(game, player);
      nextPlayer(game);
      return;
    }

    if(!drawnCard){
      nextPlayer(game);
      return;
    }

    const cardIndex = player.hand.indexOf(drawnCard);
    playCard(game, player, cardIndex);

    checkWin(game, player);
    nextPlayer(game);
  }

  // ===== 3️⃣ NORMAL PLAY (AI) =====
  const move = aiChooseMove(game, player);

  if (move.type === "play") {
    const card = player.hand[move.cardIndex];

    playCard(game, player, move.cardIndex);

   checkWin(game, player);
    nextPlayer(game);
    return;
  }

    // ===== 4️⃣ DRAW BY CHOICE =====
  if (move.type === "draw") {
    drawOneCard(game, player);

    if (player.hand.length >= 25) {
      eliminatePlayer(game, player);
      checkWin(game, player);
      return;
    }

    nextPlayer(game);
  }

  checkWin(game, player);
  nextPlayer(game);

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

function checkWin(game) {
  const activePlayers = game.players.filter(p => p.active);


  // 🏆 Last standing
  if (activePlayers.length === 1) {
    console.log(`🏆 ${activePlayers[0].name} wins (last standing)`);
    game.gameOver = true;
    return true;
  }

  // 🎉 Normal win (hand empty)
  for (const player of activePlayers) {
    if (player.hand.length === 0) {
      console.log(`🏆 ${player.name} wins!`);
      game.gameOver = true;
      return true;
    }
  }

  return false;
}


function decidePlayOrDraw(player, card) {
  return true;
}

module.exports = { takeTurn, nextPlayer,checkWin, decidePlayOrDraw };
