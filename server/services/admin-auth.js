import { uuid } from '../utils/ids.js';

export function createAdminAuthService({ state }) {
	function parseCookies(req) {
		const cookieHeader = req.headers.cookie ?? '';

		return cookieHeader
			.split(';')
			.map((entry) => entry.trim())
			.filter(Boolean)
			.reduce((accumulator, entry) => {
				const [name, ...rest] = entry.split('=');
				accumulator[name] = decodeURIComponent(rest.join('='));
				return accumulator;
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

	function isAuthenticated(req) {
		const token = getAdminToken(req);
		return Boolean(token && state.adminTokens.has(token));
	}

	function issueToken() {
		const token = uuid();
		state.adminTokens.add(token);
		return token;
	}

	function revokeToken(token) {
		if (token) {
			state.adminTokens.delete(token);
		}
	}

	function mustBeAdmin(req, res, next) {
		const token = getAdminToken(req);
		if (!token || !state.adminTokens.has(token)) {
			return res.status(401).json({ error: 'unauthorized' });
		}

		next();
	}

	return {
		getAdminToken,
		isAuthenticated,
		issueToken,
		revokeToken,
		mustBeAdmin
	};
}