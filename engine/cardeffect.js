const{checkWin} = require("./rules")
function applySpecialEffect(game, player, card, nextPlayer) {

  if(!player.active){
    return;
  }

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
 

function applyDiscardAll(game, player) {
  const color = game.currentColor;

  const remaining = [];
  const discarded = [];

  for (const card of player.hand) {
    if (card.color === color) {
      discarded.push(card);
    } else {
      remaining.push(card);
    }
  }

  player.hand = remaining;
  game.discardPile.push(...discarded);
}

function chooseColor(player) {
  const colors = ["red", "blue", "green", "yellow"];

  // Simple AI: choose most frequent color in hand
  const count = {};
  for (const card of player.hand) {
    if (card.color !== "wild") {
      count[card.color] = (count[card.color] || 0) + 1;
    }
  }

  let best = colors[0];
  let max = -1;
  for (const c of colors) {
    if ((count[c] || 0) > max) {
      max = count[c] || 0;
      best = c;
    }
  }

  return best;
}

function RouletteDraw(game, player,color) {

    while (true) {
        if(game.drawPile.length === 0){
            reshuffle(game);
            if(game.drawPile.length === 0){
                return;
            }
        }    

        const card = game.drawPile.pop();
        player.hand.push(card);

        if (card.color === color) {
            console.log(`Roulette success! Drew a ${card.color} ${card.value}`);
            break;
        }
    }
}

function sevenRule(game, player) {
  const targets = game.players.filter(p => p.active && p !== player);

  if (targets.length === 0) return;

  const target = player.isAI ? targets[Math.floor(Math.random() * targets.length)] : chooseTargetPlayer(player, targets);

  console.log(`${player.name} swaps hands with ${target.name}`);
  const temp = player.hand;
  player.hand = target.hand;
  target.hand = temp;
  console.log(`${player.name} choose to swap with ${target.name}`);
}

function zeroRule(game) {
  console.log("hend rotation triggered");

  const activePlayers = game.players.filter(p => p.active);
  if (activePlayers.length <= 1) return;

  const hands = activePlayers.map(p => p.hand);

  for (let i = 0; i < activePlayers.length; i++) {
    activePlayers[i].hand = hands[(i - 1 + hands.length) % hands.length];
  }
}

function chooseTargetPlayer(player, targets) {
  return targets[0];
}

module.exports = { applySpecialEffect, chooseColor, RouletteDraw, sevenRule, zeroRule, applyDiscardAll, chooseTargetPlayer };