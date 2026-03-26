import express from 'express';
import QRCode from 'qrcode';
import { getJoinUrl, getSession } from '../utils/http.js';
import { serializePlayer, serializeRanking, winnerFromSession } from '../utils/session-state.js';

export function createPublicSessionRoutes({ state }) {
	const router = express.Router();

	router.get('/sessions/by-code/:code', (req, res) => {
		const normalizedCode = String(req.params.code ?? '').trim().toUpperCase();
		if (!normalizedCode) {
			return res.status(400).json({ error: 'missing_session_code' });
		}

		const session = [...state.sessions.values()].find((entry) => entry.code === normalizedCode);
		if (!session) {
			return res.status(404).json({ error: 'session_not_found' });
		}

		res.json({
			id: session.id,
			code: session.code,
			name: `Session ${session.code}`,
			status: session.status,
			playerCount: session.players.length,
			connectedPlayers: session.connectedPlayerIds.size
		});
	});

	router.get('/sessions/by-code/:code/qrcode', async (req, res) => {
		const normalizedCode = String(req.params.code ?? '').trim().toUpperCase();
		if (!normalizedCode) {
			return res.status(400).json({ error: 'missing_session_code' });
		}

		const session = [...state.sessions.values()].find((entry) => entry.code === normalizedCode);
		if (!session) {
			return res.status(404).json({ error: 'session_not_found' });
		}

		const joinUrl = getJoinUrl(req, session);

		try {
			const dataUrl = await QRCode.toDataURL(joinUrl, { width: 220, margin: 1 });
			res.json({ dataUrl, joinUrl });
		} catch {
			res.status(500).json({ error: 'qrcode_generation_failed' });
		}
	});

	router.get('/sessions/:id/players/:playerId', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		const player = session.players.find((entry) => entry.id === req.params.playerId);
		if (!player) {
			return res.status(404).json({ error: 'player_not_found' });
		}

		res.json({
			sessionId: session.id,
			sessionCode: session.code,
			status: session.status,
			currentRound: session.currentRound ?? null,
			player: serializePlayer(player, true)
		});
	});

	router.get('/sessions/:id/ranking', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		res.json({
			ranking: serializeRanking(session),
			status: session.status,
			winner: session.status === 'stopped' ? winnerFromSession(session) : null
		});
	});

	return router;
}