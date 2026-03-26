import path from 'node:path';
import express from 'express';
import { sendHtmlView, sendPublicView } from '../utils/http.js';

export function createPageRoutes({ publicDir, viewsDir, authService }) {
	const router = express.Router();

	router.get('/', (_req, res) => {
		sendPublicView(res, publicDir, 'index.html');
	});

	router.get('/player', (_req, res) => {
		sendPublicView(res, publicDir, 'player.html');
	});

	router.get('/spectator', (_req, res) => {
		sendPublicView(res, publicDir, 'spectator.html');
	});

	router.get('/end', (_req, res) => {
		sendPublicView(res, publicDir, 'end.html');
	});

	router.get('/admin', (req, res) => {
		const view = authService.isAuthenticated(req) ? 'admin.html' : 'admin-login.html';
		sendHtmlView(res, path.join(viewsDir, view));
	});

	return router;
}