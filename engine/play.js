const { applySpecialEffect } = require("./cardeffect");
const {decidePlayOrDraw, nextPlayer, checkWin} = require("./rules");
const {ShuffleDeck, reshuffle} = require("./deck");

function isplayable(card, game){
  const topCard = game.discardPile[game.discardPile.length - 1];

    if(game.pendingDrawPenalties > 0){
      if(!card.drawAmount || card.drawAmount === 0) return false;

      if(card.drawAmount >= topCard.drawAmount){
        if(card.color !== 'wild' && card.color !== game.currentColor){
          return card.drawAmount === topCard.drawAmount;
        }
        return true;
      }
      return false;
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

function checkElimination(game, player, helpers) {
  if (!player.active) return false;

  if (player.hand.length >= 25) {
    eliminatePlayer(game, player, helpers);
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
      
      const result = helpers.applySpecialEffect(game, player, card, helpers.nextPlayer, helpers);
      if (result && result.action === "chooseSwapTarget") {
        return result; 
      }
    }
    return true;
}

function drawCards(game, player) {
  while(true){
    if (!player.active) return null;

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




function eliminatePlayer(game, player, helpers) {
  if (!player.active) return;

  console.log(`💀 ${player.name} eliminated (${player.hand.length} cards)`);
 

  if (player.hand.length > 0) {
        game.drawPile.push(...player.hand);
        player.hand = []; // Force hand to be empty
    }
  player.active = false;
   game.eliminatedPlayers.push(player.name);

  if (helpers && typeof helpers.ShuffleDeck === "function") {
        helpers.ShuffleDeck(game.drawPile);
  }

  if(helpers && typeof helpers.nextPlayer === "function"){
    if (game.players[game.currentPlayerIndex]?.id === player.id) {
        helpers.nextPlayer(game);
    } 
  } 

  return true;
}


module.exports = {  playCard, drawCards, eliminatePlayer, checkElimination, drawOneCard ,isplayable, hasPlayableCard};