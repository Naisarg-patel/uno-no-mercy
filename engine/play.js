const { applySpecialEffect } = require("./cardeffect");
const {decidePlayOrDraw, nextPlayer, checkWin} = require("./rules");
const {ShuffleDeck} = require("./deck");

function isplayable(card, game){
    if(game.pendingDrawPenalties > 0){
        return card.drawAmount > 0;
    }

    // RULE 2: Wilds are ALWAYS playable (if no penalty is active)
    if (card.type === 'wild') {
        return true;
    }

    return(
        card.color === game.currentColor ||
        card.value === game.currentValue 
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
    checkWin(game, player);
    return true;
  }
  return false;
}



function playCard(game, player, cardIndex, chosenColor, helpers){
    const card = player.hand[cardIndex];

    if (!card) {
        console.log("No card found at index:", cardIndex);
        return false; 
    }

    if(!isplayable(card, game)){
        return false; // Invalid move
    }

    if (card.type === 'wild') {
      if(card.specialMove === "roulette"){

      }
      else{
        if (!chosenColor) return false; // Fail if client didn't send a color
        game.currentColor = chosenColor; 
      }
    } else {
        game.currentColor = card.color;
    }
    game.currentValue = card.value;
    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);


    if (card.specialMove && helpers.applySpecialEffect) {
        helpers.applySpecialEffect(game, player, card, helpers.nextPlayer, helpers);
    }

    return true;
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


module.exports = {  playCard, drawCards, eliminatePlayer, checkElimination, drawOneCard ,isplayable, hasPlayableCard};