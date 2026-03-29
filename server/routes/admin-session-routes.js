import express from 'express';
import QRCode from 'qrcode';
import { getSession, getJoinUrl } from '../utils/http.js';
import { connectedPlayersPayload, serializePlayer } from '../utils/session-state.js';
import { uuid } from '../utils/ids.js';

export function createAdminSessionRoutes({
	authService,
	gameService,
	persistenceService,
	state,
	llmAnswerValidatorService
}) {
	const router = express.Router();

	router.use('/admin/api', authService.mustBeAdmin);

	router.post('/admin/api/sessions', (_req, res) => {
		const session = gameService.createSession();

		res.status(201).json({
			id: session.id,
			code: session.code,
			status: session.status
		});
	});

	router.get('/admin/api/sessions/:id', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		res.json({
			id: session.id,
			code: session.code,
			status: session.status,
			currentPlaylistLibraryId: session.currentPlaylistLibraryId,
			playlist: session.playlist,
			currentTrackIndex: session.currentTrackIndex,
			currentRound: session.currentRound
		});
	});

	router.get('/admin/api/sessions/:id/qrcode', async (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		const joinUrl = getJoinUrl(req, session);

		try {
			const dataUrl = await QRCode.toDataURL(joinUrl, { width: 300, margin: 2 });
			res.json({ dataUrl, joinUrl });
		} catch {
			res.status(500).json({ error: 'qrcode_generation_failed' });
		}
	});

	router.get('/admin/api/sessions/:id/players', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		res.json({
			players: session.players.map((player) => ({
				...serializePlayer(player, true),
				connected: session.connectedPlayerIds.has(player.id)
			}))
		});
	});

	router.post('/admin/api/sessions/:id/start', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		gameService.startSession(session);
		res.json({ ok: true, status: session.status });
	});

	router.post('/admin/api/sessions/:id/stop', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		const { winner } = gameService.stopSession(session);
		res.json({ ok: true, status: session.status, winner });
	});

	router.delete('/admin/api/sessions/:id', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		if (session.status === 'running') {
			return res.status(409).json({ error: 'session_running' });
		}

		gameService.deleteSession(session);

		res.json({ ok: true, id: session.id });
	});

	router.post('/admin/api/sessions/:id/rounds', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		const { title, artist, year, yearBonus = 0 } = req.body ?? {};
		if (!title || !artist || !year) {
			return res.status(400).json({ error: 'missing_round_data' });
		}

		const currentRound = gameService.startRound(session, { title, artist, year, yearBonus });
		res.json({ ok: true, currentRound });
	});

	router.get('/admin/api/sessions/:id/playlist', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		res.json({ playlist: session.playlist, currentTrackIndex: session.currentTrackIndex });
	});

	router.put('/admin/api/sessions/:id/playlist', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		const { playlist } = req.body ?? {};
		if (!Array.isArray(playlist)) {
			return res.status(400).json({ error: 'invalid_playlist' });
		}

		session.playlist = playlist.map((track) => ({
			id: track.id ?? uuid(),
			title: String(track.title ?? '').trim(),
			artist: String(track.artist ?? '').trim(),
			year: Number(track.year) || 0,
			yearBonus: Number(track.yearBonus) || 0
		}));
		session.currentPlaylistLibraryId = null;

		if (session.currentTrackIndex >= session.playlist.length) {
			session.currentTrackIndex = session.playlist.length - 1;
		}

		persistenceService.persistSessionsToDisk();

		res.json({
			ok: true,
			playlist: session.playlist,
			currentTrackIndex: session.currentTrackIndex,
			currentPlaylistLibraryId: session.currentPlaylistLibraryId
		});
	});

	router.post('/admin/api/sessions/:id/playlist/load', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		const playlistLibraryId = String(req.body?.playlistLibraryId ?? '').trim();
		if (!playlistLibraryId) {
			return res.status(400).json({ error: 'missing_playlist_library_id' });
		}

		const libraryEntry = persistenceService.getPlaylistLibraryEntry(playlistLibraryId);
		if (!libraryEntry) {
			return res.status(404).json({ error: 'playlist_library_not_found' });
		}

		let playlist;
		try {
			playlist = persistenceService.readPlaylistFromLibraryEntry(libraryEntry);
		} catch (err) {
			if (err.code === 'playlist_library_not_found') {
				return res.status(404).json({ error: 'playlist_library_not_found' });
			}

			throw err;
		}

		session.playlist = playlist.map((track) => ({ id: track.id ?? uuid(), ...track }));
		session.currentPlaylistLibraryId = libraryEntry.id;
		session.currentTrackIndex = -1;
		session.currentRound = null;
		session.currentBuzzPlayerId = null;
		session.currentBuzzProposal = null;
		session.buzzLocked = false;

		persistenceService.persistSessionsToDisk();

		res.json({
			ok: true,
			playlist: session.playlist,
			currentTrackIndex: session.currentTrackIndex,
			currentPlaylistLibraryId: session.currentPlaylistLibraryId,
			loadedPlaylist: libraryEntry,
			currentRound: session.currentRound
		});
	});

	router.post('/admin/api/sessions/:id/playlist/play', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		const rawIndex = req.body?.index;
		const trackIndex = rawIndex !== undefined ? Number(rawIndex) : session.currentTrackIndex;

		if (trackIndex < 0 || trackIndex >= session.playlist.length) {
			return res.status(400).json({ error: 'invalid_track_index' });
		}

		const result = gameService.launchTrack(session, trackIndex);
		res.json({ ok: true, ...result });
	});

	router.post('/admin/api/sessions/:id/playlist/pause', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		const result = gameService.pauseTrack(session);
		res.json({ ok: true, ...result });
	});

	router.post('/admin/api/sessions/:id/playlist/next', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		const nextIndex = session.currentTrackIndex + 1;
		if (nextIndex >= session.playlist.length) {
			return res.status(400).json({ error: 'no_next_track' });
		}

		const result = gameService.launchTrack(session, nextIndex);
		res.json({ ok: true, ...result });
	});

	router.post('/admin/api/sessions/:id/playlist/prev', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		const prevIndex = session.currentTrackIndex - 1;
		if (prevIndex < 0) {
			return res.status(400).json({ error: 'no_prev_track' });
		}

		const result = gameService.launchTrack(session, prevIndex);
		res.json({ ok: true, ...result });
	});

	router.get('/admin/api/sessions/:id/stats', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		const currentBuzzPlayer = session.players.find((entry) => entry.id === session.currentBuzzPlayerId) ?? null;

		res.json({
			status: session.status,
			...connectedPlayersPayload(session),
			currentBuzzPlayer: currentBuzzPlayer ? serializePlayer(currentBuzzPlayer, true) : null,
			currentBuzzProposal: session.currentBuzzProposal,
			currentRound: session.currentRound,
			lastDecision: session.lastDecision,
			currentPlaylistLibraryId: session.currentPlaylistLibraryId,
			playlist: session.playlist,
			currentTrackIndex: session.currentTrackIndex
		});
	});


	router.post('/admin/api/sessions/:id/decision/ai', async (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		if (!llmAnswerValidatorService?.enabled) {
			return res.status(503).json({ error: 'llm_validation_not_configured' });
		}

		const buzzPlayer = session.players.find((entry) => entry.id === session.currentBuzzPlayerId);
		if (!buzzPlayer || !session.currentRound) {
			return res.status(409).json({ error: 'no_current_buzz' });
		}

		const answerText = String(req.body?.answerText ?? session.currentBuzzProposal?.text ?? '').trim();
		if (!answerText) {
			return res.status(400).json({ error: 'missing_answer_text' });
		}

		let aiValidation;
		try {
			aiValidation = await llmAnswerValidatorService.validateAnswer({
				currentRound: session.currentRound,
				playerAnswerText: answerText
			});
		} catch (error) {
			return res.status(503).json({
				error: error.code || 'llm_validation_failed',
				details: error.message
			});
		}

		const result = gameService.applyDecision(session, aiValidation.verdict);
		if (!result) {
			return res.status(409).json({ error: 'no_current_buzz' });
		}

		res.json({
			ok: true,
			decision: aiValidation.verdict,
			aiValidation,
			ranking: result.ranking,
			scoreDelta: result.scoreDelta,
			playerId: buzzPlayer.id
		});
	});

	router.post('/admin/api/sessions/:id/decision', (req, res) => {
		const session = getSession(req, res, state.sessions);
		if (!session) return;

		const { decision } = req.body ?? {};
		if (!['accepted', 'rejected'].includes(decision)) {
			return res.status(400).json({ error: 'invalid_decision' });
		}

		const result = gameService.applyDecision(session, decision);
		if (!result) {
			return res.status(409).json({ error: 'no_current_buzz' });
		}

		res.json({ ok: true, ranking: result.ranking, scoreDelta: result.scoreDelta });
	});

	return router;
}