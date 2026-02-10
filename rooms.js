// rooms.js

const rooms = {};

function createRoom(socket, name) {
  const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();

  rooms[roomId] = {
    id: roomId,
    players: [
      {
        id: socket.id,
        name,
        active: true
      }
    ],
    game: null,
    started: false
  };

  socket.join(roomId);
  return roomId;
}

function joinRoom(socket, roomId, name) {
  const room = rooms[roomId];
  if (!room) return { error: "Room not found" };

  if (room.players.length >= 6) {
    return { error: "Room full (max 6 players)" };
  }

  room.players.push({
    id: socket.id,
    name,
    active: true
  });

  socket.join(roomId);
  return room;
}

function removePlayer(socketId) {
  for (const roomId in rooms) {
    const room = rooms[roomId];
    room.players = room.players.filter(p => p.id !== socketId);

    if (room.players.length === 0) {
      delete rooms[roomId];
    }
  }
}

function getRoom(roomId) {
  return rooms[roomId];
}

module.exports = {
  rooms,
  createRoom,
  joinRoom,
  removePlayer,
  getRoom
};
