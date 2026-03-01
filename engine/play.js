const { applySpecialEffect } = require("./cardeffect");
const {decidePlayOrDraw, nextPlayer, checkWin} = require("./rules");
const {ShuffleDeck, reshuffle} = require("./deck");

function isplayable(card, game){
  const topCard = game.discardPile[game.discardPile.length - 1];

    if(game.pendingDrawPenalties > 0){
      // must be a draw card and meet or exceed penalty amount
      if(!card.drawAmount || card.drawAmount === 0) return false;
      if(card.drawAmount < topCard.drawAmount) return false;

      // wilds always allowed
      if(card.color === 'wild') return true;

      // if top card was a coloured draw2/draw4 (not a wild) we have
      // slightly stricter stacking. for a draw2 you can follow with any
      // draw2 or with a same-colour draw4; for a coloured draw4 you may only
      // continue with another draw4 (any colour).
      if(topCard.color !== 'wild' && (topCard.specialMove === 'draw2' || topCard.specialMove === 'draw4')){
        if(topCard.specialMove === 'draw2'){
          if(card.drawAmount > topCard.drawAmount) {
            // upgrading red draw2 -> red draw4 only
            return card.color === topCard.color;
          }
          // any draw2 colour is okay
          return true;
        } else {
          // top card is coloured draw4: only draw4 allowed (any colour)
          return card.drawAmount === topCard.drawAmount;
        }
      }

      // if the penalty started with a wild_draw4, only a draw4 of the chosen
      // colour (or another wild) can be played; draw2s are not allowed
      if(topCard.specialMove === 'wild_draw4'){
        if(card.drawAmount !== topCard.drawAmount) return false; // must be 4
        if(card.color === 'wild') return true;
        return card.color === game.currentColor;
      }

      // fallback to colour match with current game color
      if(card.color === game.currentColor) return true;
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