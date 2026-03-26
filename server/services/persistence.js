import fs from 'node:fs';
import path from 'node:path';
import {
	DATA_DIR,
	PLAYLIST_LIBRARY_FILE,
	PLAYLISTS_DIR,
	SESSIONS_FILE
} from '../config.js';
import { uuid } from '../utils/ids.js';
import { parsePlaylistCsv, serializePlaylistCsv } from '../utils/playlist.js';

export function createPersistenceService({ state }) {
	function serializeSessionForDisk(session) {
		return {
			id: session.id,
			code: session.code,
			status: session.status,
			buzzLocked: Boolean(session.buzzLocked),
			currentBuzzPlayerId: session.currentBuzzPlayerId ?? null,
			currentBuzzProposal: session.currentBuzzProposal ?? null,
			currentRound: session.currentRound ?? null,
			lastDecision: session.lastDecision ?? null,
			currentPlaylistLibraryId: session.currentPlaylistLibraryId ?? null,
			playlist: Array.isArray(session.playlist) ? session.playlist : [],
			currentTrackIndex: Number.isInteger(session.currentTrackIndex) ? session.currentTrackIndex : -1,
			players: Array.isArray(session.players) ? session.players : []
		};
	}

	function ensureDataDirectories() {
		fs.mkdirSync(DATA_DIR, { recursive: true });
		fs.mkdirSync(PLAYLISTS_DIR, { recursive: true });
	}

	function persistSessionsToDisk() {
		try {
			ensureDataDirectories();
			const payload = {
				version: 1,
				savedAt: Date.now(),
				sessions: [...state.sessions.values()].map((session) => serializeSessionForDisk(session))
			};
			fs.writeFileSync(SESSIONS_FILE, JSON.stringify(payload, null, 2), 'utf8');
		} catch (err) {
			console.error('Unable to persist sessions:', err);
		}
	}

	function loadPersistedSessions() {
		try {
			if (!fs.existsSync(SESSIONS_FILE)) {
				return;
			}

			const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
			const parsed = JSON.parse(raw);
			const persistedSessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];

			for (const persisted of persistedSessions) {
				if (!persisted?.id || !persisted?.code) {
					continue;
				}

				const session = {
					id: String(persisted.id),
					code: String(persisted.code).toUpperCase(),
					status: ['waiting', 'running', 'stopped'].includes(persisted.status) ? persisted.status : 'waiting',
					buzzLocked: Boolean(persisted.buzzLocked),
					currentBuzzPlayerId: persisted.currentBuzzPlayerId ?? null,
					currentBuzzProposal: persisted.currentBuzzProposal ?? null,
					currentRound: persisted.currentRound ?? null,
					lastDecision: persisted.lastDecision ?? null,
					currentPlaylistLibraryId: persisted.currentPlaylistLibraryId ?? null,
					playlist: Array.isArray(persisted.playlist) ? persisted.playlist : [],
					currentTrackIndex: Number.isInteger(persisted.currentTrackIndex) ? persisted.currentTrackIndex : -1,
					connectedPlayerIds: new Set(),
					players: Array.isArray(persisted.players)
						? persisted.players.map((player) => ({
							id: String(player.id ?? uuid()),
							pseudo: String(player.pseudo ?? '').trim(),
							joinedAt: Number(player.joinedAt) || Date.now(),
							score: Number(player.score) || 0,
							avatar: player.avatar ?? null,
							devise: player.devise ?? null
						}))
						: []
				};

				state.sessions.set(session.id, session);
			}
		} catch (err) {
			console.error('Unable to load persisted sessions:', err);
		}
	}

	function persistPlaylistLibraryToDisk() {
		try {
			ensureDataDirectories();
			fs.writeFileSync(
				PLAYLIST_LIBRARY_FILE,
				JSON.stringify({ version: 1, savedAt: Date.now(), playlists: state.playlistLibrary }, null, 2),
				'utf8'
			);
		} catch (err) {
			console.error('Unable to persist playlist library:', err);
		}
	}

	function loadPlaylistLibraryFromDisk() {
		try {
			ensureDataDirectories();
			if (!fs.existsSync(PLAYLIST_LIBRARY_FILE)) {
				return;
			}

			const raw = fs.readFileSync(PLAYLIST_LIBRARY_FILE, 'utf8');
			const parsed = JSON.parse(raw);
			const persistedLibrary = Array.isArray(parsed?.playlists) ? parsed.playlists : [];

			state.playlistLibrary = persistedLibrary.filter((entry) => entry?.id && entry?.name && entry?.storedFileName);
		} catch (err) {
			console.error('Unable to load playlist library:', err);
		}
	}

	function getPlaylistLibraryEntry(entryId) {
		return state.playlistLibrary.find((entry) => entry.id === entryId) ?? null;
	}

	function readPlaylistFromLibraryEntry(entry) {
		const filePath = path.join(PLAYLISTS_DIR, entry.storedFileName);
		if (!fs.existsSync(filePath)) {
			const error = new Error('playlist_library_not_found');
			error.code = 'playlist_library_not_found';
			throw error;
		}

		const raw = fs.readFileSync(filePath, 'utf8');
		return parsePlaylistCsv(raw);
	}

	function writePlaylistToLibraryFile(storedFileName, playlist) {
		ensureDataDirectories();
		fs.writeFileSync(path.join(PLAYLISTS_DIR, storedFileName), serializePlaylistCsv(playlist), 'utf8');
	}

	function sortPlaylistLibrary() {
		return [...state.playlistLibrary]
			.sort((left, right) => right.uploadedAt - left.uploadedAt || left.name.localeCompare(right.name));
	}

	return {
		ensureDataDirectories,
		persistSessionsToDisk,
		loadPersistedSessions,
		persistPlaylistLibraryToDisk,
		loadPlaylistLibraryFromDisk,
		getPlaylistLibraryEntry,
		readPlaylistFromLibraryEntry,
		writePlaylistToLibraryFile,
		sortPlaylistLibrary
	};
}