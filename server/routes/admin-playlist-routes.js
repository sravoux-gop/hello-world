import express from 'express';
import {
	PLAYLIST_UPLOAD_MAX_TEXT
} from '../config.js';
import {
	createStoredPlaylistFileName,
	normalizeUploadedPlaylistName,
	parsePlaylistCsv
} from '../utils/playlist.js';
import { uuid } from '../utils/ids.js';

export function createAdminPlaylistRoutes({ authService, persistenceService, state }) {
	const router = express.Router();

	router.use(authService.mustBeAdmin);

	router.get('/admin/api/playlists/library', (_req, res) => {
		res.json({ playlists: persistenceService.sortPlaylistLibrary() });
	});

	router.post('/admin/api/playlists/library', (req, res) => {
		const { fileName, content } = req.body ?? {};
		if (typeof fileName !== 'string' || typeof content !== 'string') {
			return res.status(400).json({ error: 'invalid_playlist_upload' });
		}

		if (Buffer.byteLength(content, 'utf8') > PLAYLIST_UPLOAD_MAX_TEXT) {
			return res.status(413).json({ error: 'playlist_upload_too_large' });
		}

		const playlist = parsePlaylistCsv(content);
		if (!playlist.length) {
			return res.status(400).json({ error: 'empty_playlist_upload' });
		}

		const id = uuid();
		const name = normalizeUploadedPlaylistName(fileName);
		const storedFileName = createStoredPlaylistFileName(id, name);

		persistenceService.writePlaylistToLibraryFile(storedFileName, playlist);

		const libraryEntry = {
			id,
			name,
			storedFileName,
			uploadedAt: Date.now(),
			trackCount: playlist.length
		};

		state.playlistLibrary.push(libraryEntry);
		persistenceService.persistPlaylistLibraryToDisk();

		res.status(201).json({ ok: true, playlist: libraryEntry });
	});

	return router;
}