// gameEngine.js
const { CreateDeck, ShuffleDeck} = require("./engine/deck");
const { takeTurn, nextPlayer, checkWin } = require("./engine/rules");

function createGame(players) {
  const deck = CreateDeck();
  ShuffleDeck(deck);

  for (const player of players) {
    player.hand = deck.splice(0, 7);
    player.active = true;
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
    return game;
}

module.exports = {
  createGame,
  takeTurn,
  nextPlayer,
  checkWin
};
