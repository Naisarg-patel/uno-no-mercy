const socket = io();
let currentRoom = null;
let isMyTurn = false;
let myHand = [];
let savedCardIndex = null;

const playersList = document.getElementById("players");
const roomIdText = document.getElementById("roomId");
const lobby = document.getElementById("lobby");
const gameUI = document.getElementById("game");
const handDiv = document.getElementById("hand");
const topCardDiv = document.getElementById("topCard");
const startBtn = document.getElementById("startBtn");
const playersBar = document.getElementById("playersBar");
const draw = document.getElementById("drawBtn");
const modal = document.getElementById('colorModal');

function createRoom() {
  const name = document.getElementById("name").value;
  socket.emit("createRoom", { name });
}

function joinRoom() { 
  const name = document.getElementById("name").value;
  const roomId = document.getElementById("roomInput").value;
  socket.emit("joinRoom", { roomId, name });
}

function startGame() {
  console.log("Current Variable State:", currentRoom); // Debug line

  if (!currentRoom) {
    console.error("Error: currentRoom is null. Did the roomCreated event fire?");
    return;
  }
  socket.emit("startGame", {roomId : currentRoom});
}

function drawCard() {
  if (!currentRoom) return;
  // Now 'isMyTurn' and 'currentRoom' are available!
    if (!isMyTurn) {
        alert("It's not your turn!");
        return;
    }

    if(draw) draw.disabled = true;
    socket.emit("drawCard", { roomId: currentRoom });  
}

function playCard(cardIndex) {
  if(!isMyTurn ){
    socket.emit("error", "not yout turn");
  }

  const card = myHand[cardIndex];
  const wildcard = card.specialMove === "wild_draw4" || 
                    card.specialMove === "wild_draw6" ||
                    card.specialMove === "wild_draw10";

  if(wildcard){
    savedCardIndex = cardIndex;
    console.log("card played", card.value);
    document.getElementById('colorModal').style.display = "block";
    console.log("Modal opened for card index:", cardIndex);
  }
  else
  {
    socket.emit("playCard", { roomId : currentRoom, cardIndex});
  }
}

function pickColor(color){
  if(savedCardIndex === null){
    socket.emit("error", "saved index is null");
  }

  console.log("Color picked:", color, "for card index:", savedCardIndex);
  
  socket.emit("playCard", { 
        roomId: currentRoom, 
        cardIndex: savedCardIndex, 
        chosenColor: color 
  });
  
  document.getElementById("colorModal").style.display = "none";
  savedCardIndex = null;
}

socket.on("roomCreated", ({ roomId }) => {
  currentRoom = roomId;
  roomIdText.innerText = currentRoom;
});

socket.on("joinedRoom", ({ roomId }) => {
  console.log("succressfully joined room")
  currentRoom = roomId;
  roomIdText.innerText = currentRoom;
});

socket.on("roomUpdate", ({ players, hostId }) => {
  playersList.innerHTML = "";
  players.forEach(p => {
    const li = document.createElement("li");
    li.innerText = p.name + (p.id === hostId ? " (host)" : "");
    playersList.appendChild(li);
  });

  // enable start only for host
  if (socket.id && hostId && socket.id === hostId) {
    startBtn.disabled = false;
  } else {
    startBtn.disabled = true;
  }
});

socket.on("gameStarted", () => {
  console.log("game started");
  lobby.style.display = "none";
  gameUI.style.display = "block";
});

socket.on("yourHand", (hand) => {
  myHand = hand;
  renderHand();
});

socket.on("gameState", (data) => {
  if (!data) {
    console.log("data not fetched");
    return;}

  myHand = data.hand;  
  isMyTurn = data.isMyTurn;

  if(data.topCard){
    topCardDiv.innerText = `${data.topCard.color} ${data.topCard.value}`;
    if (data.topCard.color === 'wild') {
            topCardDiv.style.backgroundColor = data.currentColor; 
        } else {
            topCardDiv.style.backgroundColor = data.topCard.color;
        }
    }
  else{
    console.error("Top card data missing from server!");
    topCardElement.innerText = "Waiting...";
  }  

  renderHand();

  playersBar.innerText = data.isMyTurn ? "🟢 YOUR TURN!" : `⌛ Waiting for ${data.currentTurnName}...`;
  if (draw) draw.disabled = !isMyTurn;

  if (data.pendingDrawPenalties > 0) {
        draw.innerText = `🚨 Take Penalty (+${data.pendingDrawPenalties})`;
        draw.style.backgroundColor = "black";
        draw.style.color = "red";
    } else {
        draw.innerText = "Draw Card";
        draw.style.backgroundColor = ""; 
        draw .style.color = "";
    }

  if (data.hand.length >= 20) {
    handDiv.style.border = "5px solid red";
    playersBar.innerText = "⚠️ DANGER: CLOSE TO ELIMINATION (25 CARDS)!";
  } else {
      handDiv.style.border = "none";
  }  

  if (data.rouletteActive && data.rouletteVictimId === socket.id) {
      const modal = document.getElementById('colorModal');
      if (modal) {
          modal.style.display = "block";
          // Change the text so they know why the modal appeared
          document.querySelector('#colorModal h3').innerText = "🎰 ROULETTE! Pick a color to DRAW until:";
      }
      // Note: pickColor(color) will now emit 'playCard' with the chosen color
  }
});

socket.on("gameOver", (data) => {
  alert("Game Over" + data.winner.name);
  location.reload();
});

socket.on("error", (msg) => {
  console.log(msg);
});

function renderHand() {
  const container = handDiv;
  container.innerHTML = "";

  myHand.forEach((card, index) => {
    const btn = document.createElement("button");
    btn.className = "card-button";
    btn.innerText = card.color + " " + card.value;

    if (card.color === 'wild') {
      // Makes wild cards dark with white text so they are visible
      btn.style.background = "linear-gradient(45deg, #ff5555, #5555ff, #55aa55, #ffaa00)";
      btn.style.color = "white";
      btn.style.textShadow = "1px 1px 2px black";
    } else {
      btn.style.backgroundColor = card.color;
      btn.style.color = (card.color === 'yellow') ? 'black' : 'white';
    }

    btn.onclick = () => playCard(index);

    container.appendChild(btn);
  });
}