const { CreateCard } = require('./card');

console.log("🔥 deck.js loaded");

function CreateDeck(){
    const colors = ['red', 'yellow', 'green', 'blue'];
    const deck = [];

    for(const color of colors){
        for(let i = 0; i <= 9; i++){
            if(i === 0){
                deck.push(CreateCard({type: 'number', color, value: i, specialMove: 'zero'}));
                deck.push(CreateCard({type: 'number', color, value: i, specialMove: 'zero'}));
            }
            else if(i === 7){
                deck.push(CreateCard({type: 'number', color, value: i, specialMove: 'seven'}));
                deck.push(CreateCard({type: 'number', color, value: i, specialMove: 'seven'}));
            }
            else{
                deck.push(CreateCard({type: 'number', color, value: i}));
                deck.push(CreateCard({type: 'number', color, value: i})); //0 to 9 card with colours
            }
           
        }
        for(let i = 1; i <= 3; i++){
            deck.push(CreateCard({type: 'action', color, value: 'draw2', drawAmount: 2, specialMove: 'draw2'}));
            deck.push(CreateCard({type: 'action', color, value: 'skip', specialMove: 'skip'}));
            deck.push(CreateCard({type: 'action', color, value: 'reverse', specialMove: 'reverse'}));
            deck.push(CreateCard({type: 'action', color, value: 'discard_all', specialMove: 'discard_all'}));
        }
        for(let i = 1; i <= 2; i++){
            deck.push(CreateCard({type: 'action', color, value: 'draw4', drawAmount: 4, specialMove: 'draw4'}));
            deck.push(CreateCard({type: 'action', color, value: 'skip_all', specialMove: 'skip_all'}));
        }
    }

    for(let i = 1; i <= 4; i++){
        deck.push(CreateCard({type: 'wild', color: 'wild', value: 'wild_draw6', drawAmount: 6, specialMove: 'wild_draw6'}));
        deck.push(CreateCard({type: 'wild', color: 'wild', value: 'wild_draw10', drawAmount: 10, specialMove: 'wild_draw10'}));
    }
    for(let i = 1; i <= 8; i++){
        deck.push(CreateCard({type: 'wild', color: 'wild', value: 'wild_draw4', drawAmount: 4, specialMove: 'wild_draw4'}));
        deck.push(CreateCard({type: 'wild', color: 'wild', value: 'roulette', specialMove: 'roulette'}));
    }
    
    if(deck.length !== 168){
        console.error("Deck creation error: Incorrect number of cards", deck.length);
    }

    console.log("createDeck working");
    return deck;
}    

function ShuffleDeck(deck){
    for(let i = deck.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    console.log("shuffleDeck working");
}    

function reshuffle(game){

    if(game.drawPile.length > 0 || game.discardPile.length <= 1){
        return;
    }

    console.log("Reshuffling the discard pile into the draw pile");
    const topCard = game.discardPile.pop();
    game.drawPile = [...game.discardPile];
    game.discardPile = [topCard];

    ShuffleDeck(game.drawPile);
    
}

module.exports = { CreateDeck, ShuffleDeck, reshuffle };