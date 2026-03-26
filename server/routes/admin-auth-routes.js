import express from 'express';

export function createAdminAuthRoutes({ authService, adminPassword }) {
	const router = express.Router();

	router.post('/admin/login', (req, res) => {
		const { password } = req.body ?? {};
		if (password !== adminPassword) {
			return res.status(401).json({ error: 'invalid_credentials' });
		}

		const token = authService.issueToken();
		const oneDayInSeconds = 24 * 60 * 60;

		res.setHeader(
			'Set-Cookie',
			`admin_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${oneDayInSeconds}`
		);

		res.json({ ok: true });
	});

	router.post('/admin/logout', authService.mustBeAdmin, (req, res) => {
		const token = authService.getAdminToken(req);
		authService.revokeToken(token);
		res.setHeader('Set-Cookie', 'admin_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
		res.json({ ok: true });
	});

	router.get('/admin/auth-status', (req, res) => {
		res.json({ authenticated: authService.isAuthenticated(req) });
	});

	return router;
}