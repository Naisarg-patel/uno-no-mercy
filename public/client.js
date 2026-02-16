const socket = io();
let currentRoom = null;
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
  socket.emit("drawCard", { roomId: currentRoom });
}

function playCard(cardIndex) {
  const card = myHand[cardIndex];

  if(card.type === 'wild'){
    savedCardIndex = cardIndex;
    document.getElementById('colorModal').style.display = "block";
  }
  else
  {socket.emit("playCard", { roomId : currentRoom, cardIndex });}
}

function pickColor(color){
  socket.emit("playCard", { 
        roomId: currentRoom, 
        cardIndex: savedCardIndex, 
        chosenColor: color 
  });
  document.getElementById("colorModal").style.display = "none";
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
  if(data.topCard){
    topCardDiv.innerText = `${data.topCard.color} ${data.topCard.value}`;
    topCardDiv.style.backgroundColor = data.topCard.color;}
  else{
    console.error("Top card data missing from server!");
    topCardElement.innerText = "Waiting...";
  }  

  handDiv.innerHTML = ""; // Clear old cards
  data.hand.forEach((card, index) => {
    const cardEl = document.createElement("div");
    cardEl.className = "card";
    cardEl.innerText = `${card.color} ${card.value}`;
    cardEl.style.cssText = `
      padding: 15px; 
      border: 1px solid black; 
      border-radius: 5px; 
      background-color: ${card.color}; 
      color: white; 
      cursor: pointer;
    `;
    cardEl.onclick = () => playCard(index);
    handDiv.appendChild(cardEl);
  });
  playersBar.innerText = data.isMyTurn ? "🟢 YOUR TURN!" : `⌛ Waiting for ${data.currentTurnName}...`;
});

socket.on("gameOver", (data) => {
  alert("Game Over");
});

socket.on("error", (msg) => {
  console.log(msg);
});

function renderHand() {
  const container = handDiv;
  container.innerHTML = "";

  myHand.forEach((card, index) => {
    const btn = document.createElement("button");
    btn.innerText = card.color + " " + card.value;

    btn.onclick = () => {
      if (card.type === 'wild') {
        const chosenColor = prompt('Choose color (red, yellow, green, blue)');
        if (!chosenColor) return;
        socket.emit("playCard", { roomId: currentRoom, cardIndex: index, chosenColor });
      } else {
        socket.emit("playCard", { roomId: currentRoom, cardIndex: index });
      }
    };

    container.appendChild(btn);
  });
}