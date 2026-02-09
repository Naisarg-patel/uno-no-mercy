const {nextPlayer, eliminatePlayer, decidePlayOrDraw} = require("./player");
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
    eliminatePlayer(game, player);
    return true;
  }
  return false;
}

function applySpecialEffect(game, player, card) {

  if(!player.active){
    return;
  }

  console.log(`Applying special effect of ${card.specialMove}`);

  switch (card.specialMove) {
    
    case "reverse":
      console.log("Reversing direction");
      game.direction *= -1;
      break;

    case "skip":
      console.log("Skipping next player");
      nextPlayer(game);
      break;
    
    case "draw2":
    case "draw4":
    case "wild_draw6":
    case "wild_draw10":
      game.pendingDrawPenalties += card.drawAmount;
      game.currentColor = card.type === 'wild' ? chooseColor(player) : game.currentColor;
      break;      

    case "discard_all":
      console.log("Applying discard all effect");
      applyDiscardAll(game, player);
      checkElimination(game, player);
      break;

    case "skip_all":
      console.log("Applying skip all effect");
      game.players.forEach(p => {
        if (p !== player) {
          drawCards(game, p);
        }
      });
      break;

    case "wild_draw4":
      console.log("Next player must draw 4 cards and color is chosen by current player directin change");
      game.direction *= -1;
      game.pendingDrawPenalties += card.drawAmount;
      game.currentColor = chooseColor(player);
      break;  

    case "roulette":
      game.rouletteActive = true;

      break;

    case "seven":
      sevenRule(game, player);
      break;  

    case "zero":
      zeroRule(game, player);
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
      eliminatePlayer(game, player);
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


function checkWin(game, player) {
  if (player.hand.length === 0) {
    game.gameOver = true;
    console.log(`${player.name} wins!`);
  }

  const activePlayers = game.players.filter(p => p.active);

  if (activePlayers.length === 1) {
    console.log(`🏆 ${activePlayers[0].name} wins (last standing)`);
    game.gameOver = true;
    return true;
  }
}

module.exports = { isplayable, playCard, drawCards, checkWin, applySpecialEffect, checkElimination, hasPlayableCard };