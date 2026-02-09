function validateGameState(game, expectedTotal = 168) {
  let handCount = 0;

  for (const player of game.players) {
    handCount += player.hand.length;
  }

  const total =
    game.drawPile.length +
    game.discardPile.length +
    handCount;

  if (total !== expectedTotal) {
    console.error("❌ CARD COUNT MISMATCH");
    console.error({
      drawPile: game.drawPile.length,
      discardPile: game.discardPile.length,
      hands: handCount,
      total,
      expected: expectedTotal
    });

    throw new Error("Game state corrupted: card count mismatch");
  }

  // Optional debug log
  console.log(
    `✅ Card count OK (${total}/${expectedTotal})`
  );
}

module.exports = { validateGameState };

