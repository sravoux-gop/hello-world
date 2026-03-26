export const PLAYER_PREFS_STORAGE_KEY = 'blindtest.player.prefs';
export const ACTIVE_PLAYER_SESSION_STORAGE_KEY = 'blindtest.player.activeSession';

export const $ = (id) => document.getElementById(id);

export function show(idOrElement) {
	const element = typeof idOrElement === 'string' ? $(idOrElement) : idOrElement;
	element?.classList.remove('hidden');
}

export function hide(idOrElement) {
	const element = typeof idOrElement === 'string' ? $(idOrElement) : idOrElement;
	element?.classList.add('hidden');
}

export function normalizeSessionCode(value) {
	return String(value ?? '').trim().toUpperCase();
}

export function escHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

export function statusLabel(status) {
	return status === 'running' ? 'en cours' : status === 'stopped' ? 'terminee' : 'en attente';
}

export function sessionCodeFromUrl() {
	const params = new URLSearchParams(location.search);
	return normalizeSessionCode(params.get('session'));
}

export function buildPlayerUrl(sessionCode) {
	return `/player?session=${encodeURIComponent(sessionCode)}`;
}

export function buildSpectatorUrl(sessionCode) {
	return `/spectator?session=${encodeURIComponent(sessionCode)}`;
}

export function buildEndUrl(sessionCode) {
	return `/end?session=${encodeURIComponent(sessionCode)}`;
}

export async function api(path, method = 'GET', payload) {
	const response = await fetch(path, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: payload ? JSON.stringify(payload) : undefined
	});

	const contentType = response.headers.get('content-type') || '';
	const isJson = contentType.includes('application/json');
	const data = isJson ? await response.json() : null;

	if (!response.ok) {
		const message = data?.error
			? data.error
			: response.status === 404
				? 'session_not_found'
				: `http_${response.status}`;
		throw Object.assign(new Error(message), { code: data?.error || message, status: response.status });
	}

	if (!isJson || !data) {
		throw Object.assign(new Error('invalid_api_response'), { code: 'invalid_api_response', status: response.status });
	}

	return data;
}

export function persistJoinPrefs({ sessionCode, pseudo } = {}) {
	const current = loadJoinPrefs() || {};
	const payload = {
		sessionCode: sessionCode !== undefined ? String(sessionCode).trim() : String(current.sessionCode ?? '').trim(),
		pseudo: pseudo !== undefined ? String(pseudo).trim() : String(current.pseudo ?? '').trim()
	};
	localStorage.setItem(PLAYER_PREFS_STORAGE_KEY, JSON.stringify(payload));
}

export function loadJoinPrefs() {
	try {
		const raw = localStorage.getItem(PLAYER_PREFS_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		return {
			sessionCode: String(parsed?.sessionCode ?? '').trim(),
			pseudo: String(parsed?.pseudo ?? '').trim()
		};
	} catch {
		return null;
	}
}

export function persistActivePlayerSession(session) {
	if (!session?.sessionId || !session?.sessionCode || !session?.playerId) return;
	localStorage.setItem(ACTIVE_PLAYER_SESSION_STORAGE_KEY, JSON.stringify({
		sessionId: String(session.sessionId),
		sessionCode: normalizeSessionCode(session.sessionCode),
		playerId: String(session.playerId),
		pseudo: String(session.pseudo ?? '').trim()
	}));
}

export function loadActivePlayerSession() {
	try {
		const raw = localStorage.getItem(ACTIVE_PLAYER_SESSION_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed?.sessionId || !parsed?.sessionCode || !parsed?.playerId) return null;
		return {
			sessionId: String(parsed.sessionId),
			sessionCode: normalizeSessionCode(parsed.sessionCode),
			playerId: String(parsed.playerId),
			pseudo: String(parsed.pseudo ?? '').trim()
		};
	} catch {
		return null;
	}
}

export function clearActivePlayerSession() {
	localStorage.removeItem(ACTIVE_PLAYER_SESSION_STORAGE_KEY);
}

export function resizeImage(file, maxSide = 150) {
	return new Promise((resolve, reject) => {
		const image = new Image();
		const blobUrl = URL.createObjectURL(file);
		image.onload = () => {
			const ratio = Math.min(maxSide / image.width, maxSide / image.height, 1);
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(image.width * ratio);
			canvas.height = Math.round(image.height * ratio);
			canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
			URL.revokeObjectURL(blobUrl);
			resolve(canvas.toDataURL('image/jpeg', 0.82));
		};
		image.onerror = reject;
		image.src = blobUrl;
	});
}