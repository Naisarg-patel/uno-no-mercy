const {isplayable} = require("./play");

function aiChooseMove(game, player) {
  // 1. If draw penalty exists → try to stack
  if (game.pendingDrawPenalties > 0) {
   for (let i = 0; i < player.hand.length; i++) {
    const card = player.hand[i];
    if (card.value === "draw2" || card.value === "draw4" || card.value === "wild_draw6" || card.value === "wild_draw10" || card.value === "wild_draw4") {
      return { type: "play", cardIndex: i };
    }
  }
  return { type: "drawPenalty" };
  }

  // 2. Find any playable card
  for (let i = 0; i < player.hand.length; i++) {
    if (isplayable(player.hand[i], game)) {
      return { type: "play", cardIndex: i };
    }
  }

  // 3. Otherwise draw
  return { type: "draw" };
}

function chooseColor(player) {
  console.log(`AI choosing color for ${player.name}`);
  const colors = { red: 0, blue: 0, green: 0, yellow: 0 };

  for (const card of player.hand) {
    if (colors.hasOwnProperty(card.color)) {
      colors[card.color]++;
    }
  }

  return Object.keys(colors).reduce((a, b) =>
    colors[a] > colors[b] ? a : b
  );
}



module.exports = { aiChooseMove, chooseColor };
