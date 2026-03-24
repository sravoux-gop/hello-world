import crypto from 'node:crypto';
import express from 'express';
import { WebSocketServer } from 'ws';

const app = express();
const port = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(express.json());
app.use(express.static('public'));

const sessions = new Map();
const sessionSockets = new Map();
const adminTokens = new Set();

const uuid = () => crypto.randomUUID();

function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function ranking(session) {
  return [...session.players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
}

function socketGroup(sessionId) {
  if (!sessionSockets.has(sessionId)) {
    sessionSockets.set(sessionId, new Set());
  }

  return sessionSockets.get(sessionId);
}

function broadcast(sessionId, event, payload = {}) {
  const message = JSON.stringify({ event, payload });
  for (const ws of socketGroup(sessionId)) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}

function mustBeAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  next();
}

function getSession(req, res) {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'session_not_found' });
    return null;
  }

  return session;
}

app.post('/admin/login', (req, res) => {
  const { password } = req.body ?? {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const token = uuid();
  adminTokens.add(token);
  res.json({ token });
});

app.post('/sessions', mustBeAdmin, (_req, res) => {
  const id = uuid();
  const newSession = {
    id,
    code: code(),
    status: 'waiting',
    buzzLocked: false,
    currentBuzzPlayerId: null,
    players: []
  };

  sessions.set(id, newSession);
  res.status(201).json(newSession);
});

app.post('/sessions/:id/start', mustBeAdmin, (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  session.status = 'running';
  broadcast(session.id, 'session.started', { sessionId: session.id });
  res.json({ ok: true, status: session.status });
});

app.post('/sessions/:id/stop', mustBeAdmin, (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  session.status = 'stopped';
  session.buzzLocked = true;
  broadcast(session.id, 'session.stopped', { sessionId: session.id });
  res.json({ ok: true, status: session.status });
});

app.post('/sessions/:id/players', (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  const { firstName, lastName } = req.body ?? {};
  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'missing_name' });
  }

  const player = {
    id: uuid(),
    firstName,
    lastName,
    joinedAt: Date.now(),
    score: 0
  };

  session.players.push(player);
  res.status(201).json({ playerId: player.id, sessionId: session.id });
});

app.post('/sessions/:id/buzz', (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  const { playerId } = req.body ?? {};
  const player = session.players.find((entry) => entry.id === playerId);
  if (!player) {
    return res.status(404).json({ error: 'player_not_found' });
  }

  if (session.status !== 'running') {
    return res.status(409).json({ error: 'session_not_running' });
  }

  if (session.buzzLocked) {
    return res.status(409).json({ error: 'buzz_locked', currentBuzzPlayerId: session.currentBuzzPlayerId });
  }

  session.buzzLocked = true;
  session.currentBuzzPlayerId = player.id;

  broadcast(session.id, 'buzz.locked', {
    playerId: player.id,
    playerName: `${player.firstName} ${player.lastName}`
  });

  res.json({ accepted: true, playerId: player.id });
});

app.post('/sessions/:id/decision', mustBeAdmin, (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  const { decision } = req.body ?? {};
  if (!['accepted', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'invalid_decision' });
  }

  const player = session.players.find((entry) => entry.id === session.currentBuzzPlayerId);
  if (!player) {
    return res.status(409).json({ error: 'no_current_buzz' });
  }

  player.score += decision === 'accepted' ? 1 : -1;
  const rank = ranking(session);

  broadcast(session.id, 'buzz.decided', {
    playerId: player.id,
    decision,
    score: player.score
  });

  broadcast(session.id, 'ranking.updated', { ranking: rank });

  session.buzzLocked = false;
  session.currentBuzzPlayerId = null;

  res.json({ ok: true, ranking: rank });
});

app.get('/sessions/:id/ranking', (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  res.json({ ranking: ranking(session), status: session.status });
});

const server = app.listen(port, () => {
  console.log(`Blind test server listening on :${port}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId || !sessions.has(sessionId)) {
    ws.close(1008, 'missing_or_invalid_session');
    return;
  }

  const peers = socketGroup(sessionId);
  peers.add(ws);

  ws.on('close', () => {
    peers.delete(ws);
  });
});
