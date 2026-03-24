import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const sessions = new Map();
const sessionSockets = new Map();
const adminTokens = new Set();

const uuid = () => crypto.randomUUID();

function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function normalizePseudo(value = '') {
  return value.trim().toLowerCase();
}

function displayName(player) {
  if (player.pseudo) {
    return player.pseudo;
  }

  return `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();
}

function serializeRanking(session) {
  return [...session.players]
    .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt)
    .map((player) => ({
      id: player.id,
      pseudo: player.pseudo,
      displayName: displayName(player),
      score: player.score
    }));
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

function parseCookies(req) {
  const cookieHeader = req.headers.cookie ?? '';
  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, entry) => {
      const [name, ...rest] = entry.split('=');
      acc[name] = decodeURIComponent(rest.join('='));
      return acc;
    }, {});
}

function getAdminToken(req) {
  const authHeader = req.headers.authorization?.replace('Bearer ', '');
  if (authHeader) {
    return authHeader;
  }

  const cookies = parseCookies(req);
  return cookies.admin_token;
}

function mustBeAdmin(req, res, next) {
  const token = getAdminToken(req);
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

function connectedPlayersPayload(session) {
  return {
    connectedPlayers: session.connectedPlayerIds.size,
    registeredPlayers: session.players.length
  };
}

function winnerFromSession(session) {
  const rank = serializeRanking(session);
  return rank.length > 0 ? rank[0] : null;
}

app.get('/admin', (req, res) => {
  const token = getAdminToken(req);
  const view = token && adminTokens.has(token) ? 'admin.html' : 'admin-login.html';
  res.sendFile(path.join(__dirname, 'views', view));
});

app.post('/admin/login', (req, res) => {
  const { password } = req.body ?? {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const token = uuid();
  adminTokens.add(token);

  const oneDayInSeconds = 24 * 60 * 60;
  res.setHeader(
    'Set-Cookie',
    `admin_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${oneDayInSeconds}`
  );

  res.json({ ok: true });
});

app.post('/admin/logout', mustBeAdmin, (req, res) => {
  const token = getAdminToken(req);
  adminTokens.delete(token);
  res.setHeader('Set-Cookie', 'admin_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/admin/auth-status', (req, res) => {
  const token = getAdminToken(req);
  res.json({ authenticated: Boolean(token && adminTokens.has(token)) });
});

app.post('/admin/api/sessions', mustBeAdmin, (_req, res) => {
  const id = uuid();
  const newSession = {
    id,
    code: code(),
    status: 'waiting',
    buzzLocked: false,
    currentBuzzPlayerId: null,
    currentBuzzProposal: null,
    currentRound: null,
    connectedPlayerIds: new Set(),
    players: []
  };

  sessions.set(id, newSession);

  res.status(201).json({
    id: newSession.id,
    code: newSession.code,
    status: newSession.status
  });
});

app.post('/admin/api/sessions/:id/start', mustBeAdmin, (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  session.status = 'running';
  broadcast(session.id, 'session.started', { sessionId: session.id });
  res.json({ ok: true, status: session.status });
});

app.post('/admin/api/sessions/:id/stop', mustBeAdmin, (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  session.status = 'stopped';
  session.buzzLocked = true;

  const finalRanking = serializeRanking(session);
  const winner = finalRanking.length > 0 ? finalRanking[0] : null;

  broadcast(session.id, 'session.stopped', {
    sessionId: session.id,
    winner,
    ranking: finalRanking
  });

  res.json({ ok: true, status: session.status, winner });
});

app.post('/admin/api/sessions/:id/rounds', mustBeAdmin, (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  const { title, artist, year, yearBonus = 0 } = req.body ?? {};
  if (!title || !artist || !year) {
    return res.status(400).json({ error: 'missing_round_data' });
  }

  session.currentRound = {
    title,
    artist,
    year,
    yearBonus
  };

  session.buzzLocked = false;
  session.currentBuzzPlayerId = null;
  session.currentBuzzProposal = null;

  broadcast(session.id, 'round.started', {
    hint: 'Nouveau morceau en cours',
    yearBonus
  });

  res.json({ ok: true, currentRound: session.currentRound });
});

app.get('/admin/api/sessions/:id/stats', mustBeAdmin, (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  const currentBuzzPlayer = session.players.find((entry) => entry.id === session.currentBuzzPlayerId) ?? null;

  res.json({
    status: session.status,
    ...connectedPlayersPayload(session),
    currentBuzzPlayer: currentBuzzPlayer
      ? {
          id: currentBuzzPlayer.id,
          pseudo: currentBuzzPlayer.pseudo,
          displayName: displayName(currentBuzzPlayer),
          score: currentBuzzPlayer.score
        }
      : null,
    currentBuzzProposal: session.currentBuzzProposal
  });
});

app.post('/sessions/join', (req, res) => {
  const { code: sessionCode, pseudo } = req.body ?? {};
  if (!sessionCode || !pseudo) {
    return res.status(400).json({ error: 'missing_join_data' });
  }

  const normalizedCode = String(sessionCode).trim().toUpperCase();
  const session = [...sessions.values()].find((entry) => entry.code === normalizedCode);

  if (!session) {
    return res.status(404).json({ error: 'session_not_found' });
  }

  if (session.status === 'stopped') {
    return res.status(409).json({ error: 'session_stopped' });
  }

  const normalizedPseudo = normalizePseudo(pseudo);
  const pseudoAlreadyUsed = session.players.some((entry) => normalizePseudo(entry.pseudo) === normalizedPseudo);
  if (pseudoAlreadyUsed) {
    return res.status(409).json({ error: 'pseudo_already_used' });
  }

  const player = {
    id: uuid(),
    pseudo: String(pseudo).trim(),
    joinedAt: Date.now(),
    score: 0
  };

  session.players.push(player);
  broadcast(session.id, 'players.connected.updated', connectedPlayersPayload(session));

  res.status(201).json({
    sessionId: session.id,
    sessionCode: session.code,
    playerId: player.id,
    pseudo: player.pseudo,
    status: session.status
  });
});

app.post('/sessions/:id/buzz', (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  const { playerId, proposal } = req.body ?? {};
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
  session.currentBuzzProposal = proposal ?? null;

  broadcast(session.id, 'buzz.locked', {
    playerId: player.id,
    playerName: displayName(player),
    proposal: session.currentBuzzProposal
  });

  res.json({ accepted: true, playerId: player.id });
});

app.post('/admin/api/sessions/:id/decision', mustBeAdmin, (req, res) => {
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

  let scoreDelta = decision === 'accepted' ? 1 : -1;

  if (decision === 'accepted' && session.currentRound && session.currentBuzzProposal?.year) {
    const gap = Math.abs(Number(session.currentRound.year) - Number(session.currentBuzzProposal.year));
    if (Number.isFinite(gap) && gap <= 1) {
      scoreDelta += Number(session.currentRound.yearBonus || 0);
    }
  }

  player.score += scoreDelta;
  const rank = serializeRanking(session);

  broadcast(session.id, 'buzz.decided', {
    playerId: player.id,
    playerName: displayName(player),
    decision,
    score: player.score,
    scoreDelta
  });

  broadcast(session.id, 'ranking.updated', { ranking: rank });

  session.buzzLocked = false;
  session.currentBuzzPlayerId = null;
  session.currentBuzzProposal = null;

  res.json({ ok: true, ranking: rank, scoreDelta });
});

app.get('/sessions/:id/ranking', (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  res.json({
    ranking: serializeRanking(session),
    status: session.status,
    winner: session.status === 'stopped' ? winnerFromSession(session) : null
  });
});

const server = app.listen(port, () => {
  console.log(`Blind test server listening on :${port}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  const playerId = url.searchParams.get('playerId');

  if (!sessionId || !sessions.has(sessionId)) {
    ws.close(1008, 'missing_or_invalid_session');
    return;
  }

  const session = sessions.get(sessionId);
  const peers = socketGroup(sessionId);
  peers.add(ws);

  if (playerId && session.players.some((entry) => entry.id === playerId)) {
    session.connectedPlayerIds.add(playerId);
    broadcast(session.id, 'players.connected.updated', connectedPlayersPayload(session));
  }

  ws.on('close', () => {
    peers.delete(ws);

    if (playerId && session.connectedPlayerIds.has(playerId)) {
      session.connectedPlayerIds.delete(playerId);
      broadcast(session.id, 'players.connected.updated', connectedPlayersPayload(session));
    }
  });
});
