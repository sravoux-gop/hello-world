import { code, uuid } from '../utils/ids.js';

export function createGameService({ state, persistSessionsToDisk, broadcast, buildSessionSnapshot, serializeRanking, displayName }) {
	function createSession() {
		const id = uuid();
		const session = {
			id,
			code: code(),
			status: 'waiting',
			buzzLocked: false,
			currentBuzzPlayerId: null,
			currentBuzzProposal: null,
			currentRound: null,
			lastDecision: null,
			currentPlaylistLibraryId: null,
			playlist: [],
			currentTrackIndex: -1,
			connectedPlayerIds: new Set(),
			players: []
		};

		state.sessions.set(id, session);
		persistSessionsToDisk();
		return session;
	}

	function startSession(session) {
		session.status = 'running';
		persistSessionsToDisk();
		broadcast(session.id, 'session.started', { sessionId: session.id });
		return session;
	}

	function stopSession(session) {
		session.status = 'stopped';
		session.buzzLocked = true;

		const ranking = serializeRanking(session);
		const winner = ranking.length > 0 ? ranking[0] : null;

		persistSessionsToDisk();

		broadcast(session.id, 'session.stopped', {
			sessionId: session.id,
			winner,
			ranking
		});

		return { winner, ranking };
	}

	function deleteSession(session) {
		broadcast(session.id, 'session.deleted', { sessionId: session.id });
		state.sessions.delete(session.id);
		if (state.sessionSockets instanceof Map) {
			state.sessionSockets.delete(session.id);
		}
		persistSessionsToDisk();
	}

	function startRound(session, roundData) {
		const startedAt = Date.now();
		session.currentRound = {
			title: roundData.title,
			artist: roundData.artist,
			year: roundData.year,
			yearBonus: roundData.yearBonus ?? 0,
			startedAt
		};
		session.buzzLocked = false;
		session.currentBuzzPlayerId = null;
		session.currentBuzzProposal = null;

		persistSessionsToDisk();

		broadcast(session.id, 'round.started', {
			hint: 'Nouveau morceau en cours',
			yearBonus: session.currentRound.yearBonus,
			startedAt
		});

		return session.currentRound;
	}

	function launchTrack(session, trackIndex) {
		const track = session.playlist[trackIndex];
		session.currentTrackIndex = trackIndex;

		const startedAt = Date.now();
		session.currentRound = { ...track, startedAt };
		session.buzzLocked = false;
		session.currentBuzzPlayerId = null;
		session.currentBuzzProposal = null;

		persistSessionsToDisk();

		broadcast(session.id, 'round.started', {
			hint: 'Nouveau morceau en cours',
			yearBonus: track.yearBonus,
			startedAt,
			trackIndex
		});

		return { currentRound: session.currentRound, currentTrackIndex: trackIndex };
	}

	function pauseTrack(session) {
		session.currentRound = null;
		session.buzzLocked = false;
		session.currentBuzzPlayerId = null;
		session.currentBuzzProposal = null;

		persistSessionsToDisk();

		broadcast(session.id, 'round.paused', {
			sessionId: session.id,
			currentTrackIndex: session.currentTrackIndex
		});
		broadcast(session.id, 'session.state', buildSessionSnapshot(session));

		return {
			currentRound: session.currentRound,
			currentTrackIndex: session.currentTrackIndex
		};
	}

	function lockBuzz(session, player, proposal) {
		const reactionTime = session.currentRound?.startedAt ? Date.now() - session.currentRound.startedAt : null;

		session.buzzLocked = true;
		session.currentBuzzPlayerId = player.id;
		session.currentBuzzProposal = proposal ?? null;

		persistSessionsToDisk();

		broadcast(session.id, 'buzz.locked', {
			playerId: player.id,
			playerName: displayName(player),
			playerAvatar: player.avatar ?? null,
			playerDevise: player.devise ?? null,
			reactionTime,
			proposal: session.currentBuzzProposal
		});

		return { accepted: true, playerId: player.id, reactionTime };
	}

	function applyDecision(session, decision) {
		const player = session.players.find((entry) => entry.id === session.currentBuzzPlayerId);
		if (!player) {
			return null;
		}

		let scoreDelta = decision === 'accepted' ? 1 : -1;

		if (decision === 'accepted' && session.currentRound && session.currentBuzzProposal?.year) {
			const gap = Math.abs(Number(session.currentRound.year) - Number(session.currentBuzzProposal.year));
			if (Number.isFinite(gap) && gap <= 1) {
				scoreDelta += Number(session.currentRound.yearBonus || 0);
			}
		}

		player.score += scoreDelta;
		const ranking = serializeRanking(session);
		const currentRoundInfo = session.currentRound
			? {
				title: session.currentRound.title,
				artist: session.currentRound.artist,
				year: Number(session.currentRound.year) || 0,
				yearBonus: Number(session.currentRound.yearBonus) || 0,
				startedAt: Number(session.currentRound.startedAt) || 0
			}
			: null;

		session.lastDecision = {
			playerId: player.id,
			playerName: displayName(player),
			playerAvatar: player.avatar ?? null,
			decision,
			score: player.score,
			scoreDelta,
			decidedAt: Date.now(),
			round: decision === 'accepted' ? currentRoundInfo : null,
			roundRef: currentRoundInfo ? { startedAt: currentRoundInfo.startedAt } : null
		};

		broadcast(session.id, 'buzz.decided', {
			playerId: player.id,
			playerName: displayName(player),
			playerAvatar: player.avatar ?? null,
			decision,
			score: player.score,
			scoreDelta,
			round: decision === 'accepted' ? currentRoundInfo : null,
			roundRef: currentRoundInfo ? { startedAt: currentRoundInfo.startedAt } : null,
			decidedAt: session.lastDecision.decidedAt
		});

		broadcast(session.id, 'ranking.updated', { ranking });

		session.buzzLocked = false;
		session.currentBuzzPlayerId = null;
		session.currentBuzzProposal = null;

		persistSessionsToDisk();

		return { ranking, scoreDelta };
	}

	return {
		createSession,
		startSession,
		stopSession,
		deleteSession,
		startRound,
		launchTrack,
		pauseTrack,
		lockBuzz,
		applyDecision
	};
}