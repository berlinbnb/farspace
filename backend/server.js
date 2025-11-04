// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { NeynarAPIClient } = require('@neynar/nodejs-sdk');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const http = require('http');
const { WebSocketServer } = require('ws');
const { loadRooms, saveRooms } = require('./storage/roomsStore');

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.NEYNAR_API_KEY || !process.env.JWT_SECRET) {
  throw new Error('NEYNAR_API_KEY and JWT_SECRET must be defined in your .env file.');
}
const neynarClient = new NeynarAPIClient(process.env.NEYNAR_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET;
const allowMockSignatures = process.env.ALLOW_MOCK_SIGNATURES
  ? process.env.ALLOW_MOCK_SIGNATURES === 'true'
  : process.env.NODE_ENV === 'development';

const nonces = new Set();

app.post('/api/siwf/request-message', (req, res) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  nonces.add(nonce);
  setTimeout(() => nonces.delete(nonce), 5 * 60 * 1000);

  const domain = "farspace-app.example.com";
  const uri = "https://farspace-app.example.com/login";
  const message = `${domain} wants you to sign in with your Farcaster account.\n\nSign in to FarSpace\n\nURI: ${uri}\nVersion: 1\nNonce: ${nonce}`;
  
  res.json({ message, nonce });
});

app.post('/api/siwf/verify-signature', async (req, res) => {
  const { message, signature, fid, nonce } = req.body;
  if (!message || !signature || !fid || !nonce) {
      return res.status(400).json({ error: 'Missing required fields for verification.' });
  }
  try {
    if (!nonces.has(nonce)) {
      return res.status(400).json({ error: 'Invalid or expired nonce.' });
    }
    nonces.delete(nonce);

    let validatedFid = fid;
    if (signature === 'mock_signature') {
      if (!allowMockSignatures) {
        return res.status(401).json({ error: 'Mock signatures are disabled on this server.' });
      }
      console.warn('--- DEVELOPMENT MODE: Mock signature received and accepted. ---');
    } else {
      const validationResponse = await neynarClient.validateMessageHashSignature(signature, Buffer.from(message));
      if (!validationResponse.valid || validationResponse.fid.toString() !== fid.toString()) {
        return res.status(401).json({ error: 'Signature could not be verified or FID mismatch.' });
      }
      validatedFid = validationResponse.fid;
    }
    
    const { users } = await neynarClient.fetchBulkUsers([parseInt(validatedFid, 10)]);
    const user = users[0];
    if (!user) {
        return res.status(404).json({ error: 'Farcaster user not found.' });
    }

    const token = jwt.sign({ fid: user.fid, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    const displayName = (user.display_name && user.display_name.trim()) ? user.display_name : user.username;
    const payloadUser = normaliseUser({
      id: user.fid.toString(),
      name: displayName,
      username: user.username,
      displayName,
      avatarUrl: user.pfp_url,
    });
    
    res.json({
      token,
      user: payloadUser,
    });
  } catch (error) {
    console.error("Verification error:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'An error occurred during signature verification.' });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Room state is persisted to disk for development via roomsStore.
// For real production workloads replace this with a database like Redis or PostgreSQL.
const sanitizeUsername = (value) => {
  if (!value) return value;
  return value.replace(/^@/, '').toLowerCase();
};

const normaliseInvites = (invited) => {
  if (!Array.isArray(invited)) return [];
  return Array.from(new Set(invited.map(sanitizeUsername).filter(Boolean)));
};

const normaliseUser = (user) => {
  if (!user) return user;
  const rawUsername = user.username || user.name || `fid-${user.id}`;
  const username = sanitizeUsername(rawUsername) || rawUsername;
  const displayName = user.displayName || user.name || username;
  return {
    ...user,
    username,
    displayName,
    name: displayName,
  };
};

const normaliseRoom = (room) => {
  if (!room) return room;
  return {
    ...room,
    host: normaliseUser(room.host),
    speakers: Array.isArray(room.speakers) ? room.speakers.map(normaliseUser) : [],
    listeners: Array.isArray(room.listeners) ? room.listeners.map(normaliseUser) : [],
    invitedUsernames: normaliseInvites(room.invitedUsernames),
  };
};

let rooms = Object.fromEntries(
  Object.entries(loadRooms()).map(([id, room]) => [id, normaliseRoom(room)])
); // { [roomId]: roomState }
const clients = new Map(); // { ws: { roomId, userId } }
const persistRooms = () => saveRooms(rooms);
persistRooms();

const broadcastRoomUpdate = (roomId) => {
    const roomState = rooms[roomId];
    if (!roomState) return;

    const roomMessage = JSON.stringify({ type: 'ROOM_STATE_UPDATE', payload: roomState });
    const allRoomsMessage = JSON.stringify({ type: 'ALL_ROOMS_UPDATE', payload: Object.values(rooms) });
    
    for (const [client, meta] of clients.entries()) {
        if (meta.roomId === roomId && client.readyState === client.OPEN) {
            client.send(roomMessage);
        }
    }

    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.send(allRoomsMessage);
        }
    });
};

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (rawMessage) => {
    const message = JSON.parse(rawMessage);
    const { type, payload } = message;
    const { roomId, user, userId, title, tags, isRaised, isLocked, invitedUsernames } = payload;

    switch (type) {
      case 'GET_INITIAL_ROOMS':
        ws.send(JSON.stringify({ type: 'ALL_ROOMS_UPDATE', payload: Object.values(rooms) }));
        break;

      case 'JOIN_ROOM': {
        const room = rooms[roomId];
        if (!room) {
            return;
        }
        const joiningUser = normaliseUser(user);
        const allowedUsernames = normaliseInvites(room.invitedUsernames);
        const existingInvites = JSON.stringify(room.invitedUsernames || []);
        const sanitisedInvites = JSON.stringify(allowedUsernames);
        room.invitedUsernames = allowedUsernames;
        if (existingInvites !== sanitisedInvites) {
            persistRooms();
        }
        const isHost = room.host.id === joiningUser.id;
        const usernameLower = joiningUser.username ? joiningUser.username.toLowerCase() : null;
        const isInvited = usernameLower ? allowedUsernames.includes(usernameLower) : allowedUsernames.includes(String(joiningUser.id).toLowerCase());
        if (room.isLocked && !isHost && !isInvited) {
            ws.send(JSON.stringify({ type: 'ROOM_JOIN_DENIED', payload: { reason: 'locked' } }));
            break;
        }
        clients.set(ws, { roomId, userId: joiningUser.id });
        const alreadyPresent = room.listeners.some(u => u.id === joiningUser.id) || room.speakers.some(u => u.id === joiningUser.id);
        if(!alreadyPresent) {
            room.listeners.push({ ...joiningUser, role: 'listener', handRaised: false });
            persistRooms();
        }
        broadcastRoomUpdate(roomId);
        break;
      }
        
      case 'CREATE_ROOM':
        const hostUser = normaliseUser(user);
        const newRoom = normaliseRoom({
          id: `room-${Date.now()}`,
          title,
          tags,
          host: { ...hostUser, role: 'host' },
          speakers: [{ ...hostUser, role: 'host' }],
          listeners: [],
          transcripts: [],
          isLocked: typeof isLocked === 'boolean' ? isLocked : false,
          invitedUsernames,
        });
        rooms[newRoom.id] = newRoom;
        persistRooms();
        // Broadcast to all clients about the new room list
         wss.clients.forEach(client => {
            if (client.readyState === client.OPEN) {
                client.send(JSON.stringify({ type: 'ALL_ROOMS_UPDATE', payload: Object.values(rooms) }));
            }
        });
        // Send the creator the new room's ID to join
        ws.send(JSON.stringify({ type: 'ROOM_CREATED', payload: newRoom }));
        break;

      case 'LEAVE_ROOM':
        if (rooms[roomId]) {
            const room = rooms[roomId];
            const originalSpeakers = room.speakers.length;
            const originalListeners = room.listeners.length;

            room.speakers = room.speakers.filter(u => u.id !== userId);
            room.listeners = room.listeners.filter(u => u.id !== userId);
            // If host leaves, might want to end room or assign new host. For now, we just remove them.
            if (rooms[roomId].host.id === userId) {
                // Simple logic: if host leaves, room is deleted.
                delete rooms[roomId];
                persistRooms();
                 wss.clients.forEach(client => {
                    if (client.readyState === client.OPEN) {
                       client.send(JSON.stringify({ type: 'ALL_ROOMS_UPDATE', payload: Object.values(rooms) }));
                    }
                });
            } else {
               if (room.speakers.length !== originalSpeakers || room.listeners.length !== originalListeners) {
                 persistRooms();
               }
               broadcastRoomUpdate(roomId);
            }
        }
        break;
      
      // ... Add cases for PROMOTE, DEMOTE, TOGGLE_HAND_RAISE, etc.
      case 'PROMOTE_TO_SPEAKER': {
          const room = rooms[roomId];
          const userToPromote = room.listeners.find(u => u.id === userId);
          if (room && userToPromote) {
              room.listeners = room.listeners.filter(u => u.id !== userId);
              room.speakers.push({ ...userToPromote, role: 'speaker', handRaised: false });
              persistRooms();
              broadcastRoomUpdate(roomId);
          }
          break;
      }
      case 'DEMOTE_TO_LISTENER': {
          const room = rooms[roomId];
          const userToDemote = room.speakers.find(u => u.id === userId);
          if (room && userToDemote && userToDemote.role !== 'host') {
              room.speakers = room.speakers.filter(u => u.id !== userId);
              room.listeners.push({ ...userToDemote, role: 'listener', handRaised: false });
              persistRooms();
              broadcastRoomUpdate(roomId);
          }
          break;
      }
      case 'TOGGLE_HAND_RAISE': {
          const room = rooms[roomId];
          if(room) {
              const updateUser = (u) => u.id === userId ? { ...u, handRaised: isRaised } : u;
              room.speakers = room.speakers.map(updateUser);
              room.listeners = room.listeners.map(updateUser);
              persistRooms();
              broadcastRoomUpdate(roomId);
          }
          break;
      }
      case 'ADD_TRANSCRIPT': {
        const room = rooms[roomId];
        if (room && payload.text.trim()) {
           const newTranscript = {
              id: `transcript-${Date.now()}-${Math.random()}`,
              userId,
              name: payload.name,
              text: payload.text,
              timestamp: Date.now(),
           };
           room.transcripts.push(newTranscript);
           if (room.transcripts.length > 100) room.transcripts.shift();
           persistRooms();
           broadcastRoomUpdate(roomId);
        }
        break;
      }
      case 'TOGGLE_LOCK_ROOM': {
          const room = rooms[roomId];
          if (!room) break;
          if (room.host.id !== userId) {
              ws.send(JSON.stringify({ type: 'LOCK_ROOM_DENIED', payload: { reason: 'not_host' } }));
              break;
          }
          room.isLocked = !room.isLocked;
          persistRooms();
          broadcastRoomUpdate(roomId);
          break;
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    const meta = clients.get(ws);
    if (meta) {
        const { roomId, userId } = meta;
        clients.delete(ws);
        if (rooms[roomId]) {
            const room = rooms[roomId];
            room.speakers = room.speakers.filter(u => u.id !== userId);
            room.listeners = room.listeners.filter(u => u.id !== userId);
            if (room.host.id === userId) {
                 delete rooms[roomId];
                 persistRooms();
                 wss.clients.forEach(client => {
                    if (client.readyState === client.OPEN) {
                       client.send(JSON.stringify({ type: 'ALL_ROOMS_UPDATE', payload: Object.values(rooms) }));
                    }
                });
            } else {
                persistRooms();
                broadcastRoomUpdate(roomId);
            }
        }
    }
  });
});


const PORT = 3001;
server.listen(PORT, () => {
  console.log(`FarSpace backend server is running on http://localhost:${PORT}`);
  if (allowMockSignatures) {
    console.log('Mock signatures are ENABLED. Only rely on this mode for local development.');
  } else {
    console.log('Mock signatures are DISABLED. Real Farcaster signatures are required.');
  }
});
