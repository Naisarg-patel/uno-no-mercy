
console.log("🔥 player.js loaded");

function createPlayer(id,name, isAi = false) {
    console.log("player cretaed:", name);
    return {
       id,
       name,
       isAI: isAi,
       hand : [],
       calleduno : false,
       active: true
    }
}

module.exports = { createPlayer };