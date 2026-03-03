const socket = io();
let currentRoom = null;
let isMyTurn = false;
let myHand = [];
let savedCardIndex = null;
let modalActive = false; // prevents card clicks when a modal is showing
let rouletteColorPick = false; // true when color modal is for roulette (cancel disabled)

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

const sounds = {
  draw: new Audio("/sounds/draw.mp3"),
  eliminated: new Audio("/sounds/eliminated.mp3"),
  hover: new Audio("/sounds/hover.mp3"),
  model: new Audio("/sounds/model.mp3"),
  penalty: new Audio("/sounds/penelty.mp3"), // note spelling matches file
  play: new Audio("/sounds/play.mp3"),
  reverse: new Audio("/sounds/reverse.mp3"),
  skip: new Audio("/sounds/skip.mp3"),
};

// preload all audio and set volumes
Object.values(sounds).forEach(a => {
  a.preload = 'auto';
});

sounds.draw.volume = 0.3;
sounds.eliminated.volume = 0.6;
sounds.hover.volume = 0.2;
sounds.model.volume = 0.5;
sounds.penalty.volume = 0.8;
sounds.play.volume = 0.4;
sounds.reverse.volume = 0.5;
sounds.skip.volume = 0.5;

function goFullScreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 */
        elem.msRequestFullscreen();
    }
}

goFullScreen();

// Update your startGame function to trigger it

function playSound(name) {
  if (!sounds[name]) return;
  sounds[name].currentTime = 0;
  sounds[name].play();
}

// hover sound will be attached to cards individually in renderHand
// (avoids noisy button chattering).
// keep this snippet in case other controls need it later.
// document.addEventListener('DOMContentLoaded', () => {
//   document.querySelectorAll('button').forEach(btn => {
//     btn.addEventListener('mouseenter', () => playSound('hover'));
//   });
// });

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
    playSound("draw");
    socket.emit("drawCard", { roomId: currentRoom });  
}

function playCard(cardIndex) {
  if (!isMyTurn) {
    socket.emit("error", "not yout turn");
  }

  const card = myHand[cardIndex];
  const wildcard = card.specialMove === "wild_draw4" || 
                    card.specialMove === "wild_draw6" ||
                    card.specialMove === "wild_draw10";

  if (wildcard) {
    // wild cards are treated as a "penalty" sound for the picker phase
    playSound("penalty");
    savedCardIndex = cardIndex;
    modalActive = true;
    rouletteColorPick = false; // normal wild
    console.log("card played", card.value);
    const cancelBtn = document.getElementById('colorCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'block'; // explicitly show
    document.getElementById('colorModal').style.display = "block";
    console.log("Modal opened for card index:", cardIndex);
  } else {
    // non‑wild play
    playSound("play");
    socket.emit("playCard", { roomId: currentRoom, cardIndex });
  }
}

function pickColor(color){
  if(savedCardIndex === null){
    socket.emit("error", "saved index is null");
  }

  console.log("Color picked:", color, "for card index:", savedCardIndex);
  playSound("model");
  playSound("play");
  socket.emit("playCard", { 
        roomId: currentRoom, 
        cardIndex: savedCardIndex, 
        chosenColor: color 
  });
  
  document.getElementById("colorModal").style.display = "none";
  const cancelBtn = document.getElementById('colorCancelBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
  savedCardIndex = null;
  modalActive = false;
  rouletteColorPick = false;
}

function cancelWild() {
  if (rouletteColorPick) {
    // cannot cancel roulette choice – keep modal open
    console.log("Cancel ignored during roulette");
    return;
  }
  savedCardIndex = null;
  document.getElementById("colorModal").style.display = "none";
  const cancelBtn = document.getElementById('colorCancelBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
  modalActive = false;
}

function cancelSwap() {
  document.getElementById("swapModal").style.display = "none";
  modalActive = false;

  // inform server that we changed our mind so game can continue
  if (currentRoom) {
    socket.emit("cancelSeven", { roomId: currentRoom });
  }
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

socket.on("roomUpdate", ({ players, hostId, rematch }) => {
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

  // when we're sitting in the lobby (game UI hidden), show a contextual message
  // computedStyle ensures we catch the default from CSS as well as inline styles
  const lobbyVisible = window.getComputedStyle(lobby).display !== "none";
  if (lobbyVisible) {
    if (rematch) {
      playersBar.innerText = "Game over – waiting for host to start new round";
    } else if (socket.id === hostId) {
      playersBar.innerText = "You are the host – press start to play again";
    } else {
      playersBar.innerText = "Waiting for host to start game...";
    }
    playersBar.style.display = "flex";
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
    playSound("model");
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
    modalActive = true;
});

socket.on("playerEliminated", ({ playerName }) => {
  const overlay = document.getElementById("elimination-overlay");
  if (!overlay) return;
  playSound("eliminated");
  const text = document.createElement("div");
  text.className = "elimination-text";
  text.innerText = `${playerName} ELIMINATED 💀`;

  overlay.appendChild(text);

  // also show a brief toast message at top
  const toast = document.createElement("div");
  toast.className = "toast-msg";
  toast.innerText = `${playerName} ELIMINATED`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);

  // Remove overlay text after 2 seconds
  setTimeout(() => {
    text.remove();
  }, 2000);
});

// new handler for disconnects
socket.on("playerDisconnected", ({ playerId, playerName }) => {
  const overlay = document.getElementById("elimination-overlay");
  if (!overlay) return;

  const text = document.createElement("div");
  text.className = "elimination-text";
  text.innerText = `${playerName} DISCONNECTED ❌`;
  overlay.appendChild(text);

  setTimeout(() => {
    text.remove();
  }, 2000);
});

socket.on("gameState", (data) => {
  if (!data) return;

  const gameUI = document.getElementById("game");
  if (!gameUI || gameUI.style.display === "none") return;

  // play a draw sound if our hand grew (server dealt us cards)
  if (window.lastGameState && Array.isArray(data.hand) && Array.isArray(window.lastGameState.hand)) {
    if (data.hand.length > window.lastGameState.hand.length) {
      playSound('draw');
    }
  }

  // penalty notification / looping
  if (window.lastGameState) {
    const prevPenalty = window.lastGameState.pendingDrawPenalties || 0;
    const newPenalty = data.pendingDrawPenalties || 0;
    if (prevPenalty === 0 && newPenalty > 0) {
      // penalty just started; clear any previous interval/sound
      if (window._penaltyInterval) {
        clearInterval(window._penaltyInterval);
        window._penaltyInterval = null;
      }
      sounds.penalty.pause();
      sounds.penalty.currentTime = 0;

      // check if the card that caused penalty is a wild-type
      const top = data.topCard;
      if (
        top &&
        top.color === 'wild' &&
        (top.value && top.value.toString().startsWith('draw'))
      ) {
        playSound('model');
      }

      playSound('penalty');
      // keep playing until penalty cleared
      window._penaltyInterval = setInterval(() => playSound('penalty'), 2000);
    } else if (prevPenalty > 0 && newPenalty === 0) {
      // penalty resolved
      if (window._penaltyInterval) {
        clearInterval(window._penaltyInterval);
        window._penaltyInterval = null;
      }
      // stop any currently playing penalty sound immediately
      sounds.penalty.pause();
      sounds.penalty.currentTime = 0;
    }
  }

  myHand = data.hand || [];
  isMyTurn = data.isMyTurn;

  /* ------------------ DIRECTION ------------------ */
  const arrow = document.getElementById("direction-arrow");

  if (!arrow) return;

  // Only change if direction actually changed
  if (window.lastDirection !== data.reverse) {
      playSound("reverse");
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
  // determine if this is a *new* top card compared with last state
  const prevTop = window.lastGameState && window.lastGameState.topCard;
  const newTop = data.topCard;
  if (newTop && (!prevTop || prevTop.color !== newTop.color || prevTop.value !== newTop.value)) {
    // play appropriate effect for the card that was just discarded
    if (newTop.value === 'skip') {
      playSound('skip');
    } else if (newTop.value === 'reverse') {
      // reverse sound is already handled by direction detection further down,
      // but play it early so it doesn't feel delayed
      playSound('reverse');
    } else {
      // generic card play
      playSound('play');
    }
  }

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
  if (data.players) renderOpponents(data.players, data.currentTurnName);

  window.lastGameState = data;

  const turnIndicator = document.getElementById("your-turn-indicator");
  const handContainer = document.getElementById("handContainer");

  if (turnIndicator && handContainer) {

    if (data.isMyTurn) {
      turnIndicator.style.display = "block";
      turnIndicator.innerText = "YOUR TURN";
      handContainer.classList.add("active-turn");
    } else {
      turnIndicator.style.display = "block";
      turnIndicator.innerText = "Waiting for " + data.currentTurnName;
      handContainer.classList.remove("active-turn");
    }
  }
  /* ------------------ TURN BAR ------------------ */

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
      modalActive = true;
      rouletteColorPick = true;
      // hide cancel button when roulette
      const cancelBtn = document.getElementById('colorCancelBtn');
      if (cancelBtn) cancelBtn.style.display = 'none';
      const h3 = modal.querySelector("h3");
      if (h3) {
        h3.innerText =
          "🎰 ROULETTE! Pick a color to DRAW until:";
      }
      // prevent clicking outside modal from closing
      modal.onclick = (e) => e.stopPropagation();
    }
  }
});

socket.on("gameOver", (data) => {
  const screen = document.getElementById("winner-screen");
  const name = document.getElementById("winner-name");

  // stop any looping penalty sound
  if (window._penaltyInterval) {
    clearInterval(window._penaltyInterval);
    window._penaltyInterval = null;
  }

  if (!screen) {
    console.error("gameOver: winner-screen element not found");
    return;
  }
  if (!name) {
    console.error("gameOver: winner-name element not found");
    // still show the overlay so players know game ended
    screen.style.display = "flex";
    return;
  }

  name.innerText = `🏆 ${data?.winner?.name || 'Unknown'} WINS!`;
  screen.style.display = "flex";
});

// new event sent by server when we should return to lobby state for a rematch
socket.on("backToLobby", () => {
  // clear any ringing penalty countdown
  if (window._penaltyInterval) {
    clearInterval(window._penaltyInterval);
    window._penaltyInterval = null;
  }

  lobby.style.display = "flex";
  gameUI.style.display = "none";
  const screen = document.getElementById("winner-screen");
  if (screen) screen.style.display = "none";

  playersBar.innerText = "Game over – waiting for host to start new round";
  playersBar.style.display = "flex";
});

// UI helpers for the buttons on the winner screen
function rematch() {
  if (!currentRoom) return;
  socket.emit("playAgain", { roomId: currentRoom });
}

function exitGameHandler() {
  // gracefully disconnect, then reload so the lobby is cleared
  socket.disconnect();
  location.reload();
}


socket.on("error", (msg) => {
  console.log(msg);
});

function renderHand() {
  const handDiv = document.getElementById("player-hand");
  if (!handDiv) return;

  handDiv.innerHTML = "";

  if (!Array.isArray(myHand) || myHand.length === 0) return;

  // create a sorted copy of the hand with original indices
  const sortedHand = myHand
    .map((card, idx) => ({ card, idx }))
    .sort((a, b) => {
      // reuse sort helper logic for card objects
      const order = ["red", "yellow", "green", "blue", "wild"];
      const ca = order.indexOf(a.card.color);
      const cb = order.indexOf(b.card.color);
      if (ca !== cb) return ca - cb;
      const va = a.card.value != null ? a.card.value.toString() : "";
      const vb = b.card.value != null ? b.card.value.toString() : "";
      return va.localeCompare(vb, undefined, { numeric: true });
    });

  const total = sortedHand.length;
  const fanSpread = 30; // total rotation spread
  const startAngle = -fanSpread / 2;

  sortedHand.forEach((entry, index) => {
    const card = entry.card;
    const origIndex = entry.idx;
    const cardDiv = document.createElement("div");
    cardDiv.className = "card";

    // disable clicking while a modal is active
    if (isMyTurn && !modalActive) {
      cardDiv.style.cursor = "pointer";
      cardDiv.onclick = () => playCard(origIndex);
    }

    // add hover sound immediately when pointer enters card area
    cardDiv.addEventListener('pointerenter', () => playSound('hover'));
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
    // also catch when hovering the image itself (some browsers fire on img only)
    img.addEventListener('mouseover', () => playSound('hover'));

    cardDiv.appendChild(img);

    if (isMyTurn) {
      cardDiv.style.cursor = "pointer";
      cardDiv.onclick = () => playCard(origIndex);
    }

    handDiv.appendChild(cardDiv);
  });

  const myCount = document.getElementById("my-card-count");
  if (myCount) {
    myCount.innerText = `Your Cards: ${myHand.length}`;
  }
}

function rotatePlayers(players) {
  const myIndex = players.findIndex(p => p.id === socket.id);
  const total = players.length;

  const rotated = [];

  for (let i = 0; i < total; i++) {
    rotated.push(players[(myIndex + i) % total]);
  }

  return rotated;
}

function getSeatMap(total) {
  const map = {
    2: [
      { bottom: "20px", left: "50%", transform: "translateX(-50%)" }, // YOU
      { top: "3%", left: "50%", transform: "translateX(-50%)" }
    ],

    3: [
      {}, // YOU
      { bottom: "15%", left: "8%" },        // bottom left
      { top: "3%", left: "50%", transform: "translateX(-50%)" }
    ],

    4: [
      {}, // YOU
      { bottom: "15%", left: "8%" },        // bottom left
      { top: "3%", left: "8%" },            // top left
      { top: "3%", right: "8%" }            // top right
    ],

    5: [
      {}, // YOU
      { bottom: "15%", left: "8%" },
      { top: "3%", left: "8%" },
      { top: "3%", left: "50%", transform: "translateX(-50%)" },
      { top: "3%", right: "8%" }
    ],

    6: [
      {}, // YOU
      { bottom: "15%", left: "8%" },       // relative 1
      { top: "3%", left: "8%" },           // relative 2
      { top: "3%", left: "50%", transform: "translateX(-50%)" }, // relative 3
      { top: "3%", right: "8%" },          // relative 4
      { bottom: "15%", right: "8%" }       // relative 5
    ]
  };

  return map[total] || [];
}

function renderOpponents(players, currentTurnName) {

  const container = document.getElementById("opponents-container");
  container.innerHTML = "";

  const rotated = rotatePlayers(players);
  const total = rotated.length;

  const seats = getSeatMap(total);

  rotated.forEach((player, index) => {

    if (index === 0) return; // skip YOU

    const slot = document.createElement("div");
    slot.className = "opponent-slot";
    slot.style.position = "absolute";

    const pos = seats[index];

    if (pos.top) slot.style.top = pos.top;
    if (pos.bottom) slot.style.bottom = pos.bottom;
    if (pos.left) slot.style.left = pos.left;
    if (pos.right) slot.style.right = pos.right;
    if (pos.transform) slot.style.transform = pos.transform;

    if (player.name === currentTurnName) {
      slot.style.boxShadow = "0 0 25px gold";
    }

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = player.name + " (" + player.handCount + ")";

    const handDiv = document.createElement("div");
    handDiv.className = "opp-hand";

    createCurvedHand(handDiv, player.handCount);

    slot.appendChild(name);
    slot.appendChild(handDiv);
    container.appendChild(slot);
  });
}

function createCurvedHand(container, total) {
  const spread = window.innerWidth < 900 ? 6 : 10;
  const radius = window.innerWidth < 900 ? 30 : 50;

  for (let i = 0; i < total; i++) {
    const isMobile = window.innerHeight < 500;

    const spread = isMobile ? 5 : 10;
    const radius = isMobile ? 25 : 50;
    const curveHeight = isMobile ? 6 : 12;

    const img = document.createElement("img");
    img.src = "cards/card_back.png";
    img.className = "mini-card";

    const angle = (i - (total - 1) / 2) * spread;
    const rad = angle * Math.PI / 180;

    const x = Math.sin(rad) * radius;
    const y = Math.cos(rad) * curveHeight;

    img.style.position = "absolute";
    img.style.left = "50%";
    img.style.bottom = "0";
    img.style.transform =
      `translateX(-50%) translate(${x}px, ${-y}px) rotate(${angle}deg)`;

    container.appendChild(img);
  }
}