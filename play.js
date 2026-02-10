const {reshuffle} = require("./deck");
const {RouletteDraw, chooseColor, applyDiscardAll, sevenRule, zeroRule} = require("./cardeffect");

function isplayable(card, game){
    if(game.pendingDrawPenalties > 0){
        return card.drawAmount > 0;
    }

    return(
        card.color === game.currentColor ||
        card.value === game.currentValue ||
        card.type === 'wild'
    );
}    

function hasPlayableCard(player, game) {
  for (const card of player.hand) {
    if (isplayable(card, game)) {
      return true;
    }
  }
  return false;
}

function checkElimination(game, player) {
  if (!player.active) return false;

  if (player.hand.length >= 25) {
    const { eliminatePlayer} = require("./player");
    eliminatePlayer(game, player);
    checkWin(game, player);
    return true;
  }
  return false;
}

function applySpecialEffect(game, player, card) {

  if(!player.active){
    return;
  }

  const {nextPlayer} = require("./player");

  console.log(`Applying special effect of ${card.specialMove}`);

  switch (card.specialMove) {
    
    case "reverse":
      game.direction *= -1;
      break;

    case "skip":
      nextPlayer(game);
      break;
    
    case "draw2":
      game.pendingDrawPenalties += 2;
      break;
    case "draw4":
      game.pendingDrawPenalties += 4;
      break;
    case "wild_draw6":
      game.pendingDrawPenalties += 6;
      game.currentColor = player.isAI ? chooseColor(player) : game.currentColor;
      break;
    case "wild_draw10":
      game.pendingDrawPenalties += 10;
      game.currentColor = player.isAI ? chooseColor(player) : game.currentColor;
      break;      

    case "discard_all":
      applyDiscardAll(game, player);
      checkWin(game, player);
      break;

    case "skip_all":
      game.currentPlayerIndex = (game.currentPlayerIndex - game.direction + game.players.length) % game.players.length;
      break;

    case "wild_draw4":
      game.direction *= -1;
      game.pendingDrawPenalties += 4;
      game.currentColor = player.isAI ? chooseColor(player) : game.currentColor;
      break;  

    case "roulette":
      game.rouletteActive = true;

      break;

    case "seven":
      sevenRule(game, player);
      nextPlayer(game);
      break;  

    case "zero":
      zeroRule(game, player);
      nextPlayer(game);
      break;  
  }
}
 

function playCard(game, player, cardIndex, chosenColor = null){
    const card = player.hand[cardIndex];

    if(!isplayable(card, game)){
        return false; // Invalid move
    }

    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);

    game.currentColor = card.color === 'wild' ? chosenColor : card.color;
    game.currentValue = card.value;

    applySpecialEffect(game, player, card);
}

function drawCards(game, player) {
  while(true){
    if(game.drawPile.length === 0 && game.discardPile.length > 1){
      console.log("deck is empty");
      return null;
    }

    if(game.drawPile.length === 0){
      reshuffle(game);
    }

    const card = game.drawPile.pop();
    player.hand.push(card);

    if(player.hand.length >= 25){
      const {eliminatePlayer} = require("./player");
      eliminatePlayer(game, player);
      checkWin(game, player);
      return null;
    }

    if(isplayable(card, game)){
      const wantToPlay = player.isAI ? true : decidePlayOrDraw(player, card);

      if(wantToPlay){
        return card;
      }
    }
  }
}  

function drawOneCard(game, player) {
  if(game.drawPile.length === 0)
    reshuffle(game); 
  if(game.drawPile.length === 0){
    return null;
  }
  const card = game.drawPile.pop();
  player.hand.push(card);
  return card;
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


module.exports = { isplayable, playCard, drawCards, checkWin, applySpecialEffect, checkElimination, hasPlayableCard, drawOneCard };