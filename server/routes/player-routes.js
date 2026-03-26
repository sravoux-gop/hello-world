import express from 'express';
import { AVATAR_MAX_BASE64 } from '../config.js';
import { getSession } from '../utils/http.js';
import { createPlayer, normalizePseudo } from '../utils/players.js';
import {
	buildSessionSnapshot,
	connectedPlayersPayload,
	serializePlayer,
	serializeRanking
} from '../utils/session-state.js';

export function createPlayerRoutes({ broadcast, gameService, persistenceService, state }) {
	const router = express.Router();

	router.post('/sessions/join', (req, res) => {
		const { code: sessionCode, pseudo } = req.body ?? {};
		if (!sessionCode || !pseudo) {
			return res.status(400).json({ error: 'missing_join_data' });
		}

		const normalizedCode = String(sessionCode).trim().toUpperCase();
		const session = [...state.sessions.values()].find((entry) => entry.code === normalizedCode);

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

		const player = createPlayer(pseudo);
		session.players.push(player);

		persistenceService.persistSessionsToDisk();
		broadcast(session.id, 'players.connected.updated', connectedPlayersPayload(session));
		broadcast(session.id, 'players.list.updated', {
			players: session.players.map((entry) => serializePlayer(entry, false))
		});

		res.status(201).json({
			sessionId: session.id,
			sessionCode: session.code,
			playerId: player.id,
			pseudo: player.pseudo,
			status: session.status
		});
	});

	router.put('/sessions/:id/players/:playerId/profile', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		const player = session.players.find((entry) => entry.id === req.params.playerId);
		if (!player) {
			return res.status(404).json({ error: 'player_not_found' });
		}

		const { avatar, devise } = req.body ?? {};

		if (avatar !== undefined) {
			if (typeof avatar !== 'string') {
				return res.status(400).json({ error: 'invalid_avatar' });
			}
			if (avatar.length > AVATAR_MAX_BASE64) {
				return res.status(413).json({ error: 'avatar_too_large' });
			}
			if (avatar && !avatar.startsWith('data:image/')) {
				return res.status(400).json({ error: 'invalid_avatar_format' });
			}
			player.avatar = avatar || null;
		}

		if (devise !== undefined) {
			player.devise = typeof devise === 'string' ? devise.trim().slice(0, 200) : null;
		}

		persistenceService.persistSessionsToDisk();

		broadcast(session.id, 'players.list.updated', {
			players: session.players.map((entry) => serializePlayer(entry, false))
		});

		res.json({ ok: true });
	});

	router.delete('/sessions/:id/players/:playerId', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		const playerIndex = session.players.findIndex((entry) => entry.id === req.params.playerId);
		if (playerIndex < 0) {
			return res.status(404).json({ error: 'player_not_found' });
		}

		const [player] = session.players.splice(playerIndex, 1);
		session.connectedPlayerIds.delete(player.id);

		if (session.currentBuzzPlayerId === player.id) {
			session.currentBuzzPlayerId = null;
			session.currentBuzzProposal = null;
			session.buzzLocked = false;
		}

		persistenceService.persistSessionsToDisk();

		broadcast(session.id, 'players.connected.updated', connectedPlayersPayload(session));
		broadcast(session.id, 'players.list.updated', {
			players: session.players.map((entry) => serializePlayer(entry, false))
		});
		broadcast(session.id, 'ranking.updated', { ranking: serializeRanking(session) });
		broadcast(session.id, 'session.state', buildSessionSnapshot(session));

		res.json({ ok: true, playerId: player.id });
	});

	router.post('/sessions/:id/buzz', (req, res) => {
		const session = getSession(req, res, state.sessions);
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

		const result = gameService.lockBuzz(session, player, proposal);
		res.json(result);
	});

	return router;
}