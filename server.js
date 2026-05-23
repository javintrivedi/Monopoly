// server.js - Express + WebSocket server
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const GameEngine = require('./game/GameEngine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();
const clientRooms = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateCode() : code;
}

function broadcast(roomCode, msg, excludeId) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const data = JSON.stringify(msg);
  room.clients.forEach((ws, id) => {
    if (id !== excludeId && ws.readyState === 1) ws.send(data);
  });
}

function sendTo(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcastState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const state = room.game.getState();
  room.clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'gameState', state }));
  });
}

wss.on('connection', (ws) => {
  let playerId = null;
  let roomCode = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'createRoom': {
        roomCode = generateCode();
        const game = new GameEngine(roomCode);
        playerId = `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        game.addPlayer(playerId, msg.playerName, msg.token);
        rooms.set(roomCode, { game, clients: new Map([[playerId, ws]]) });
        clientRooms.set(ws, { roomCode, playerId });
        sendTo(ws, { type: 'roomCreated', roomCode, playerId, players: game.players.map(p => p.serialize()) });
        break;
      }

      case 'joinRoom': {
        roomCode = msg.roomCode?.toUpperCase();
        const room = rooms.get(roomCode);
        if (!room) { sendTo(ws, { type: 'error', message: 'Room not found' }); return; }
        if (room.game.started) { sendTo(ws, { type: 'error', message: 'Game already started' }); return; }
        if (room.game.players.length >= 4) { sendTo(ws, { type: 'error', message: 'Room is full' }); return; }
        
        playerId = `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        room.game.addPlayer(playerId, msg.playerName, msg.token);
        room.clients.set(playerId, ws);
        clientRooms.set(ws, { roomCode, playerId });
        
        sendTo(ws, { type: 'roomJoined', roomCode, playerId, players: room.game.players.map(p => p.serialize()) });
        broadcast(roomCode, { type: 'playerJoined', players: room.game.players.map(p => p.serialize()) }, playerId);
        break;
      }

      case 'reconnect': {
        roomCode = msg.roomCode?.toUpperCase();
        playerId = msg.playerId;
        const rRoom = rooms.get(roomCode);
        if (!rRoom) { sendTo(ws, { type: 'error', message: 'Room not found' }); return; }
        const rPlayer = rRoom.game.getPlayer(playerId);
        if (!rPlayer) { sendTo(ws, { type: 'error', message: 'Player not found in room' }); return; }
        rPlayer.connected = true;
        rRoom.clients.set(playerId, ws);
        clientRooms.set(ws, { roomCode, playerId });
        sendTo(ws, { type: 'reconnected', playerId });
        sendTo(ws, { type: 'gameState', state: rRoom.game.getState() });
        broadcast(roomCode, { type: 'playerReconnected', playerId }, playerId);
        break;
      }

      case 'startGame': {
        const room = rooms.get(roomCode);
        if (!room) return;
        if (room.game.startGame()) {
          broadcastState(roomCode);
          broadcast(roomCode, { type: 'gameStarted' });
        } else {
          sendTo(ws, { type: 'error', message: 'Need at least 2 players' });
        }
        break;
      }

      case 'rollDice': {
        const room = rooms.get(roomCode);
        if (!room) return;
        const events = room.game.rollDice(playerId);
        if (events) {
          broadcastState(roomCode);
          events.forEach(e => broadcast(roomCode, e));
        }
        break;
      }

      case 'buyProperty': {
        const room = rooms.get(roomCode);
        if (!room) return;
        const events = room.game.buyProperty(playerId);
        if (events) { broadcastState(roomCode); events.forEach(e => broadcast(roomCode, e)); }
        break;
      }

      case 'declineBuy': {
        const room = rooms.get(roomCode);
        if (!room) return;
        const events = room.game.declineBuy(playerId);
        if (events) { broadcastState(roomCode); events.forEach(e => broadcast(roomCode, e)); }
        break;
      }

      case 'endTurn': {
        const room = rooms.get(roomCode);
        if (!room) return;
        const events = room.game.endTurn(playerId);
        if (events) { broadcastState(roomCode); events.forEach(e => broadcast(roomCode, e)); }
        break;
      }

      case 'buildHouse': {
        const room = rooms.get(roomCode);
        if (!room) return;
        const events = room.game.buildHouse(playerId, msg.propertyId);
        if (events) { broadcastState(roomCode); events.forEach(e => broadcast(roomCode, e)); }
        break;
      }

      case 'sellHouse': {
        const room = rooms.get(roomCode);
        if (!room) return;
        const events = room.game.sellHouse(playerId, msg.propertyId);
        if (events) { broadcastState(roomCode); events.forEach(e => broadcast(roomCode, e)); }
        break;
      }

      case 'mortgageProperty': {
        const room = rooms.get(roomCode);
        if (!room) return;
        const events = room.game.mortgageProperty(playerId, msg.propertyId);
        if (events) { broadcastState(roomCode); events.forEach(e => broadcast(roomCode, e)); }
        break;
      }

      case 'unmortgageProperty': {
        const room = rooms.get(roomCode);
        if (!room) return;
        const events = room.game.unmortgageProperty(playerId, msg.propertyId);
        if (events) { broadcastState(roomCode); events.forEach(e => broadcast(roomCode, e)); }
        break;
      }

      case 'payJailFine': {
        const room = rooms.get(roomCode);
        if (!room) return;
        const events = room.game.payJailFine(playerId);
        if (events) { broadcastState(roomCode); events.forEach(e => broadcast(roomCode, e)); }
        break;
      }

      case 'useJailCard': {
        const room = rooms.get(roomCode);
        if (!room) return;
        const events = room.game.useJailCard(playerId);
        if (events) { broadcastState(roomCode); events.forEach(e => broadcast(roomCode, e)); }
        break;
      }

      case 'proposeTrade': {
        const room = rooms.get(roomCode);
        if (!room) return;
        const events = room.game.proposeTrade(playerId, msg.toId, msg.offer, msg.request);
        if (events) { broadcastState(roomCode); events.forEach(e => broadcast(roomCode, e)); }
        break;
      }

      case 'respondTrade': {
        const room = rooms.get(roomCode);
        if (!room) return;
        const events = room.game.respondTrade(playerId, msg.tradeId, msg.accept);
        if (events) { broadcastState(roomCode); events.forEach(e => broadcast(roomCode, e)); }
        break;
      }

      case 'chat': {
        const room = rooms.get(roomCode);
        if (!room) return;
        const player = room.game.getPlayer(playerId);
        if (player) {
          broadcast(roomCode, { type: 'chat', playerId, playerName: player.name, message: msg.message });
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    const info = clientRooms.get(ws);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (room) {
      const player = room.game.getPlayer(info.playerId);
      if (player) player.connected = false;
      room.clients.delete(info.playerId);
      broadcast(info.roomCode, { type: 'playerDisconnected', playerId: info.playerId });
      // Only delete room if game hasn't started yet
      if (room.clients.size === 0 && !room.game.started) {
        rooms.delete(info.roomCode);
      }
      // For started games, set a cleanup timeout (5 min) in case everyone abandons
      if (room.clients.size === 0 && room.game.started) {
        setTimeout(() => {
          const r = rooms.get(info.roomCode);
          if (r && r.clients.size === 0) rooms.delete(info.roomCode);
        }, 5 * 60 * 1000);
      }
    }
    clientRooms.delete(ws);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎲 Monopoly server running on http://localhost:${PORT}`));
