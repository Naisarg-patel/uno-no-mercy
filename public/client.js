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

function cancelWild() {
  savedCardIndex = null;
  document.getElementById("colorModal").style.display = "none";
}

function cancelSwap() {
  document.getElementById("swapModal").style.display = "none";
}

function getCardImage(card) {
  if (!card) return "";

  // Wild cards
  if (card.color === "wild") {
    return `cards/wild_${card.value}.png`;
  }

  // Normal cards
  return `cards/${card.color}_${card.value}.png`;
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

socket.on("chooseSwapTarget", ( data ) => {

    if (!data || !data.targets) {
        console.error("Swap target error: No targets received", data);
        return;
    }

    const swapModal = document.getElementById("swapModal");
    const list = document.getElementById("swapPlayerList");

    list.innerHTML = "";

    data.targets.forEach(target => {
        const btn = document.createElement("button");
        btn.innerText = target.name;
        btn.onclick = () => {
            socket.emit("swapHands", {
                roomId: currentRoom,
                targetId: target.id
            });
            swapModal.style.display = "none";
        };
        list.appendChild(btn);
    });

    swapModal.style.display = "block";
});

socket.on("playerEliminated", ({ playerName }) => {
  const overlay = document.getElementById("elimination-overlay");
  if (!overlay) return;

  const text = document.createElement("div");
  text.className = "elimination-text";
  text.innerText = `${playerName} ELIMINATED 💀`;

  overlay.appendChild(text);

  // Shake table when text hits
  setTimeout(() => {
    const table = document.getElementById("table");
    if (table) {
      table.classList.add("shake");
      setTimeout(() => table.classList.remove("shake"), 400);
    }
  }, 700);

  // Remove after 2 seconds
  setTimeout(() => {
    text.remove();
  }, 2000);
});

socket.on("gameState", (data) => {
  if (!data) return;

  const gameUI = document.getElementById("game");
  if (!gameUI || gameUI.style.display === "none") return;

  myHand = data.hand || [];
  isMyTurn = data.isMyTurn;

  /* ------------------ DIRECTION ------------------ */
  const arrow = document.getElementById("direction-arrow");

  if (!arrow) return;

  // Only change if direction actually changed
  if (window.lastDirection !== data.reverse) {

    // Change image first
    arrow.src = data.reverse
      ? "images/arrowreverse.png"
      : "images/arrow.png";

    // Trigger spin animation
    arrow.classList.add("spin");

    setTimeout(() => {
      arrow.classList.remove("spin");
    }, 400);

    // Save state
    window.lastDirection = data.reverse;
  }

  /* ------------------ PENALTY BADGE ------------------ */
  const bulb = document.getElementById("light-bulb");
  const badge = document.getElementById("penalty-badge");

  if (bulb) {

    const color = data.currentColor || "white";
    bulb.classList.add("flash");
    setTimeout(() => {
      bulb.classList.remove("flash");
    }, 300);
    // 🎨 Always show current game color
    bulb.style.background = color;
    bulb.style.boxShadow = `0 0 30px ${color}`;

    // 🚨 Penalty warning mode
    if (data.pendingDrawPenalties > 0) {
      bulb.classList.add("warning-light");

      if (badge) {
        badge.style.display = "flex";
        badge.innerText = "+" + data.pendingDrawPenalties;
      }
    } else {
      bulb.classList.remove("warning-light");

      if (badge) {
        badge.style.display = "none";
      }
    }
  }
  /* ------------------ TOP CARD ------------------ */
 const topCardImg = document.getElementById("top-card-img");

if (topCardImg && data.topCard) {
  topCardImg.src = getCardImage(data.topCard);

  // Optional glow color
  if (data.topCard.color === "wild") {
    topCardImg.style.boxShadow = `0 0 20px ${data.currentColor}`;
  } else {
    topCardImg.style.boxShadow = `0 0 20px ${data.topCard.color}`;
  }
}

  /* ------------------ HAND + OPPONENTS ------------------ */
  renderHand();
  if (data.players) renderOpponents(data.players);

  window.lastGameState = data;

  /* ------------------ TURN BAR ------------------ */
  const playersBar = document.getElementById("playersBar");
  if (playersBar) {
    playersBar.innerText = data.isMyTurn
      ? "🟢 YOUR TURN!"
      : `⌛ Waiting for ${data.currentTurnName || ""}...`;
  }

  /* ------------------ DRAW BUTTON ------------------ */
  if (draw) {
    draw.disabled = !isMyTurn;

    if (data.pendingDrawPenalties > 0) {
      draw.innerText =
        `🚨 Take Penalty (+${data.pendingDrawPenalties})`;
      draw.style.backgroundColor = "black";
      draw.style.color = "red";
    } else {
      draw.innerText = "Draw Card";
      draw.style.backgroundColor = "";
      draw.style.color = "";
    }
  }

  /* ------------------ ELIMINATION WARNING ------------------ */
  const handDiv = document.getElementById("hand");
  if (handDiv && myHand.length >= 20) {
    handDiv.style.border = "5px solid red";
    if (playersBar) {
      playersBar.innerText =
        "⚠️ DANGER: CLOSE TO ELIMINATION (25 CARDS)!";
    }
  } else if (handDiv) {
    handDiv.style.border = "none";
  }

  /* ------------------ ROULETTE ------------------ */
  if (data.rouletteActive && data.rouletteVictimId === socket.id) {
    const modal = document.getElementById("colorModal");
    if (modal) {
      modal.style.display = "block";
      const h3 = modal.querySelector("h3");
      if (h3) {
        h3.innerText =
          "🎰 ROULETTE! Pick a color to DRAW until:";
      }
    }
  }
});

socket.on("gameOver", (data) => {
  const screen = document.getElementById("winner-screen");
  const name = document.getElementById("winner-name");

  if (screen && name) {
    name.innerText = `🏆 ${data.winner.name} WINS!`;
    screen.style.display = "flex";
  }
});

socket.on("error", (msg) => {
  console.log(msg);
});

function renderHand() {
  const handDiv = document.getElementById("player-hand");
  if (!handDiv) return;

  handDiv.innerHTML = "";

  if (!Array.isArray(myHand) || myHand.length === 0) return;

  const total = myHand.length;
  const fanSpread = 30; // total rotation spread
  const startAngle = -fanSpread / 2;

  myHand.forEach((card, index) => {
    const cardDiv = document.createElement("div");
    cardDiv.className = "card";

    // FAN ROTATION EFFECT
    const angle =
      total > 1
        ? startAngle + (index / (total - 1)) * fanSpread
        : 0;

    cardDiv.style.transform = `rotate(${angle}deg)`;

    const img = document.createElement("img");
    img.className = "card-img";
    img.src = getCardImage(card);

    img.onerror = () => {
      console.error("Missing image:", img.src);
    };

    cardDiv.appendChild(img);

    if (isMyTurn) {
      cardDiv.style.cursor = "pointer";
      cardDiv.onclick = () => playCard(index);
    }

    handDiv.appendChild(cardDiv);
  });

  const myCount = document.getElementById("my-card-count");
  if (myCount) {
    myCount.innerText = `Your Cards: ${myHand.length}`;
  }
}

function renderOpponents(players) {
  const container = document.getElementById("opponents-container");
  if (!container) return;

  container.innerHTML = "";

  const others = players.filter(p => p.id !== socket.id);
  const total = others.length;
  if (total === 0) return;

  const radius = 320;
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2 - 50;

  others.forEach((player, i) => {
    // Spread only across upper half circle
    const angle = (Math.PI / (total + 1)) * (i + 1);

    const x = centerX + radius * Math.cos(angle - Math.PI) - 80;
    const y = centerY + radius * Math.sin(angle - Math.PI) - 50;

    const slot = document.createElement("div");
    slot.className = "opponent-slot";
    slot.style.position = "absolute";
    slot.style.left = `${x}px`;
    slot.style.top = `${y}px`;

    const name = document.createElement("div");
    name.innerText = `${player.name} (${player.handCount})`;

    const hand = document.createElement("div");
    hand.className = "opp-hand";

    const maxCards = Math.min(player.handCount, 8);
    const spacing = 10;

    for (let j = 0; j < maxCards; j++) {
      const img = document.createElement("img");
      img.src = "cards/card_back.png";
      img.className = "mini-card";
      img.style.left = j * spacing + "px";
      img.style.position = "absolute";
      hand.appendChild(img);
    }

    slot.appendChild(name);
    slot.appendChild(hand);
    container.appendChild(slot);
  });
}