console.log("🔥 game.js loaded");

const { createPlayer, nextPlayer } = require("./player");
const { CreateDeck, ShuffleDeck } = require("./deck");
const { checkWin, playCard } = require("./play");
const { takeTurn } = require("./rules");
const { validateGameState } = require("./validateGameState");

function creategame(players) {
  console.log("creategame working");
    const deck = CreateDeck();
    ShuffleDeck(deck);

    for (const player of players) {
        player.hand = deck.splice(0, 7);
    }

    const illegalFirstCard = ['wild', 'action'];

    let firstCard;

    do {
        firstCard = deck.pop();
        if (illegalFirstCard.includes(firstCard.type)) {
          deck.unshift(firstCard); // Put the card back at the bottom of the deck
        }
    }while (illegalFirstCard.includes(firstCard.type)); 

    return {
        players,
        drawPile: deck,
        discardPile: [firstCard],
        currentColor: firstCard.color,
        currentValue: firstCard.value,
        currentPlayerIndex: 0,
        direction: 1, // 1 for clockwise, -1 for counterclockwise
        pendingDrawPenalties: 0,
        gameOver: false,
        eliminatedPlayers: [],
    };
    validateGameState(game);
    return game;
}    

function sleep(ms) {
   return new Promise(resolve => setTimeout(resolve, ms));
}

async function runGame(game) {
  console.log("🎮 Game started");

  while (!game.gameOver) {
    takeTurn(game);
    validateGameState(game);
    await sleep(500); // half second per turn
    if(game.gameOver) break;
  }
 

  console.log("🏁 Game finished");
}



module.exports = { creategame, createPlayer, runGame, takeTurn, checkWin, validateGameState, nextPlayer, playCard};