console.log("🔥 card.js loaded");

function CreateCard({
    type,
    color,
    value,
    drawAmount = 0,
    specialMove = null
}) {
    return {
        type,
        color,
        value,
        drawAmount,
        specialMove,
    };
}

module.exports = { CreateCard };