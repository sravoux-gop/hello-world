import {
	$, api, buildEndUrl, clearActivePlayerSession, escHtml, hide, loadActivePlayerSession, loadJoinPrefs,
	persistActivePlayerSession, persistJoinPrefs, resizeImage, sessionCodeFromUrl, show, statusLabel
} from '/app-shared.js';

const state = {
	sessionId: '',
	sessionCode: '',
	pseudo: '',
	playerId: '',
	buzzPhase: null,
	sessionStatus: 'waiting',
	currentRoundActive: false,
	ws: null,
	profile: {
		avatar: null,
		devise: null
	},
	profileDraft: {
		avatar: null,
		devise: null
	},
	isEditingProfile: false,
	isProfileCollapsed: false,
	profileMessageTimer: null,
	hasBeenRemoved: false
};

function redirectToHomeAfterRemoval() {
	if (state.hasBeenRemoved) {
		return;
	}

	state.hasBeenRemoved = true;
	clearActivePlayerSession();
	state.ws?.close();
	location.href = `/?session=${encodeURIComponent(state.sessionCode)}&removed=1`;
}

function redirectToHomeAfterSessionDeleted() {
	if (state.hasBeenRemoved) {
		return;
	}

	state.hasBeenRemoved = true;
	clearActivePlayerSession();
	state.ws?.close();
	location.href = `/?session=${encodeURIComponent(state.sessionCode)}&deleted=1`;
}

function clearProfileMessageTimer() {
	if (state.profileMessageTimer) {
		window.clearTimeout(state.profileMessageTimer);
		state.profileMessageTimer = null;
	}
}

function setProfileMessage(message = '', autoHide = false) {
	clearProfileMessageTimer();
	$('profileMsg').textContent = message;
	if (message && autoHide) {
		state.profileMessageTimer = window.setTimeout(() => {
			$('profileMsg').textContent = '';
			state.profileMessageTimer = null;
		}, 2500);
	}
}

function normalizeProfile(player = {}) {
	return {
		avatar: typeof player.avatar === 'string' && player.avatar.startsWith('data:image/') ? player.avatar : null,
		devise: typeof player.devise === 'string' && player.devise.trim() ? player.devise.trim() : null
	};
}

function renderAvatar(imgId, fallbackId, avatar) {
	const image = $(imgId);
	const fallback = $(fallbackId);
	const initial = String(state.pseudo || '?').trim().charAt(0).toUpperCase() || '?';

	fallback.textContent = initial;

	if (avatar) {
		image.src = avatar;
		show(image);
		hide(fallback);
		return;
	}

	image.removeAttribute('src');
	hide(image);
	show(fallback);
}

function renderProfileSummary() {
	$('playerPseudo').textContent = state.pseudo || 'Joueur';
	$('playerDeviseText').textContent = state.profile.devise
		? `"${state.profile.devise}"`
		: 'Pas de devise.';
	renderAvatar('profileAvatar', 'profileAvatarFallback', state.profile.avatar);
}

function renderProfileEditor() {
	$('deviseInput').value = state.profileDraft.devise ?? '';
	renderAvatar('avatarPreview', 'avatarPreviewFallback', state.profileDraft.avatar);
}

function renderProfile() {
	$('playerViewTitle').textContent = state.sessionCode ? `Partie ${state.sessionCode}` : 'Connexion a la partie';
	renderProfileSummary();
	renderProfileEditor();
	$('profileSection').classList.toggle('is-collapsed', state.isProfileCollapsed);
	$('profileCardBody').classList.toggle('hidden', state.isProfileCollapsed);
	$('profileToggleBtn').setAttribute('aria-expanded', String(!state.isProfileCollapsed));
	$('profileToggleIcon').innerHTML = state.isProfileCollapsed
		? '<i class="bi bi-chevron-down"></i>'
		: '<i class="bi bi-chevron-up"></i>';

	if (state.isEditingProfile) {
		hide('profileDisplay');
		show('profileEditor');
	} else {
		show('profileDisplay');
		hide('profileEditor');
	}

	if (state.playerId) {
		show('editProfileBtn');
		$('editProfileBtn').setAttribute('aria-pressed', state.isEditingProfile ? 'true' : 'false');
		$('editProfileBtn').innerHTML = state.isEditingProfile
			? '<i class="bi bi-x-lg"></i>'
			: '<i class="bi bi-pencil-square"></i>';
	} else {
		hide('editProfileBtn');
	}
}

function applyPlayerProfile(player = {}) {
	state.pseudo = String(player.pseudo ?? player.displayName ?? state.pseudo ?? '').trim() || state.pseudo;
	state.profile = normalizeProfile(player);
	state.profileDraft = { ...state.profile };
	renderProfile();
}

function setProfileEditMode(isEditing) {
	state.isEditingProfile = Boolean(isEditing && state.playerId);
	if (state.isEditingProfile) {
		state.isProfileCollapsed = false;
		state.profileDraft = { ...state.profile };
		setProfileMessage('');
		$('avatarFile').value = '';
	}
	renderProfile();
	if (state.isEditingProfile) {
		$('deviseInput').focus();
		$('deviseInput').select();
	}
}

function setStatus(status) {
	state.sessionStatus = status;
	$('sessionStatus').textContent = statusLabel(status);
	$('sessionStatus').className = `status-badge ${status}`;
	$('roundHint').textContent = status === 'running'
		? state.currentRoundActive
			? 'Lecture en cours: le buzz est temporairement bloque.'
			: 'Session demarree. Le buzz reste en attente du prochain morceau.'
		: status === 'stopped'
			? 'La partie est terminee.'
			: 'La partie est en attente de lancement.';
	updateBuzzButton();
}

function updateBuzzButton() {
	const buzzBtn = $('buzzBtn');
	const disabled = !(state.sessionStatus === 'running' && state.buzzPhase === null && !state.currentRoundActive);
	buzzBtn.disabled = disabled;
	buzzBtn.classList.toggle('buzz-btn-blocked', state.currentRoundActive);
	buzzBtn.innerHTML = state.currentRoundActive
		? '<i class="bi bi-pause-circle-fill"></i> BUZZ BLOQUE'
		: '<i class="bi bi-bell-fill"></i> BUZZER';
}

function setBuzzFeedback(type, text) {
	$('buzzFeedback').innerHTML = type ? `<div class="buzz-banner ${type}">${text}</div>` : '';
}

function setWinner(winner) {
	$('winnerBox').textContent = winner ? `Gagnant actuel: ${winner.displayName} (${winner.score} pt(s))` : '';
}

function setRanking(ranking) {
	$('rankingBody').innerHTML = ranking
		.map((entry, index) => {
			const isMe = entry.id === state.playerId;
			return `<tr class="${isMe ? 'rank-me' : ''}"><td>${index + 1}</td><td>${escHtml(entry.displayName)}</td><td>${entry.score}</td></tr>`;
		})
		.join('');

	const me = ranking.find((entry) => entry.id === state.playerId);
	if (me) {
		$('myScore').textContent = String(me.score);
	}
}

function revealPlayerUi() {
	hide('joinCard');
	show('playerUi');
	show('leaveSessionBtn');
	setProfileEditMode(false);
	renderProfile();
}

function resetJoinState(message) {
	show('joinCard');
	hide('playerUi');
	hide('leaveSessionBtn');
	$('joinSessionMeta').textContent = message;
	state.isEditingProfile = false;
	state.isProfileCollapsed = false;
	renderProfile();
}

function toggleProfileCollapse() {
	if (!state.playerId) {
		return;
	}

	if (state.isEditingProfile && !state.isProfileCollapsed) {
		return;
	}

	state.isProfileCollapsed = !state.isProfileCollapsed;
	renderProfile();
}

async function saveProfile() {
	setProfileMessage('');
	const nextDevise = $('deviseInput').value.trim() || null;
	const payload = {};

	if (state.profileDraft.avatar && state.profileDraft.avatar !== state.profile.avatar) {
		payload.avatar = state.profileDraft.avatar;
	}

	if (nextDevise !== state.profile.devise) {
		payload.devise = nextDevise;
	}

	if (!payload.avatar && payload.devise === undefined) {
		setProfileMessage('Aucune modification a enregistrer.', true);
		return;
	}

	try {
		await api(`/sessions/${state.sessionId}/players/${state.playerId}/profile`, 'PUT', payload);
		state.profile = {
			avatar: payload.avatar !== undefined ? payload.avatar : state.profile.avatar,
			devise: payload.devise !== undefined ? payload.devise : state.profile.devise
		};
		state.profileDraft = { ...state.profile };
		setProfileEditMode(false);
		setProfileMessage('Profil enregistre.', true);
	} catch (err) {
		setProfileMessage(`Erreur : ${err.message}`);
	}
}

async function verifySession(code) {
	const details = await api(`/sessions/by-code/${encodeURIComponent(code)}`);
	state.sessionId = details.id;
	state.sessionCode = details.code;
	$('joinSessionMeta').textContent = `Session ${details.code} · ${statusLabel(details.status)} · ${details.playerCount} joueur(s)`;
	if (details.status === 'stopped') {
		location.href = buildEndUrl(details.code);
	}
}

async function restoreExistingPlayer(activeSession) {
	const payload = await api(`/sessions/${activeSession.sessionId}/players/${activeSession.playerId}`);
	state.sessionId = activeSession.sessionId;
	state.sessionCode = activeSession.sessionCode;
	state.playerId = activeSession.playerId;
	state.pseudo = payload.player?.pseudo || activeSession.pseudo || '';
	$('pseudo').value = activeSession.pseudo || '';
	applyPlayerProfile(payload.player || { pseudo: state.pseudo });
	persistActivePlayerSession({
		sessionId: state.sessionId,
		sessionCode: state.sessionCode,
		playerId: state.playerId,
		pseudo: state.pseudo
	});
	revealPlayerUi();
	connectWs();
	const ranking = await api(`/sessions/${state.sessionId}/ranking`);
	state.currentRoundActive = payload.status === 'running';
	setStatus(payload.status);
	setRanking(ranking.ranking || []);
	setWinner(ranking.winner || null);
}

function connectWs() {
	const wsUrl = new URL(location.origin.replace(/^http/, 'ws'));
	wsUrl.searchParams.set('sessionId', state.sessionId);
	wsUrl.searchParams.set('playerId', state.playerId);

	state.ws?.close();
	state.ws = new WebSocket(wsUrl);

	state.ws.onmessage = (event) => {
		const { event: type, payload } = JSON.parse(event.data);

		if (type === 'session.state') {
			state.currentRoundActive = Boolean(payload.currentRound);
			setStatus(payload.status ?? 'waiting');
			if (Array.isArray(payload.ranking)) {
				if (state.playerId && !payload.ranking.some((entry) => entry.id === state.playerId)) {
					redirectToHomeAfterRemoval();
					return;
				}
				setRanking(payload.ranking);
			}
			setWinner(payload.winner ?? null);

			if (payload.buzzLocked && payload.currentBuzzPlayerId && payload.currentBuzzPlayerId !== state.playerId) {
				state.buzzPhase = 'locked_by_other';
				setBuzzFeedback('waiting', 'Quelqu\'un vous a devance. En attente de la decision admin.');
			} else if (payload.lastDecision?.playerId === state.playerId) {
				state.buzzPhase = 'decided';
				const accepted = payload.lastDecision.decision === 'accepted';
				const delta = payload.lastDecision.scoreDelta > 0
					? `+${payload.lastDecision.scoreDelta}`
					: String(payload.lastDecision.scoreDelta);
				setBuzzFeedback(accepted ? 'accepted' : 'rejected', accepted
					? `Bonne reponse ! ${delta} pt(s)`
					: `Proposition refusee. ${delta} pt(s)`);
			}

			updateBuzzButton();
			return;
		}

		if (type === 'session.started') {
			state.currentRoundActive = false;
			setStatus('running');
			return;
		}

		if (type === 'round.started') {
			state.currentRoundActive = true;
			state.buzzPhase = null;
			setBuzzFeedback(null);
			setStatus('running');
			return;
		}

		if (type === 'round.paused') {
			state.currentRoundActive = false;
			state.buzzPhase = null;
			setBuzzFeedback(null);
			setStatus('running');
			return;
		}

		if (type === 'buzz.locked' && payload.playerId !== state.playerId) {
			state.buzzPhase = 'locked_by_other';
			updateBuzzButton();
			setBuzzFeedback('waiting', 'Un autre joueur a buzze. Attendez la decision admin.');
			return;
		}

		if (type === 'buzz.decided') {
			if (payload.playerId === state.playerId) {
				const accepted = payload.decision === 'accepted';
				const delta = payload.scoreDelta > 0 ? `+${payload.scoreDelta}` : String(payload.scoreDelta);
				setBuzzFeedback(accepted ? 'accepted' : 'rejected', accepted
					? `Bonne reponse ! ${delta} pt(s)`
					: `Proposition refusee. ${delta} pt(s)`);
			} else if (state.buzzPhase === 'locked_by_other') {
				setBuzzFeedback('waiting', payload.decision === 'accepted'
					? 'Le buzz concurrent a ete valide.'
					: 'Le buzz concurrent a ete refuse.');
			}
			state.buzzPhase = 'decided';
			updateBuzzButton();
			return;
		}

		if (type === 'ranking.updated') {
			if (state.playerId && Array.isArray(payload.ranking) && !payload.ranking.some((entry) => entry.id === state.playerId)) {
				redirectToHomeAfterRemoval();
				return;
			}
			setRanking(payload.ranking || []);
			return;
		}

		if (type === 'players.list.updated') {
			if (state.playerId && Array.isArray(payload.players) && !payload.players.some((entry) => entry.id === state.playerId)) {
				redirectToHomeAfterRemoval();
			}
			return;
		}

		if (type === 'session.stopped') {
			state.currentRoundActive = false;
			location.href = buildEndUrl(state.sessionCode);
			return;
		}

		if (type === 'session.deleted') {
			redirectToHomeAfterSessionDeleted();
		}
	};
}

async function leaveCurrentSession() {
	if (!state.sessionId || !state.playerId) {
		location.href = '/';
		return;
	}

	try {
		await api(`/sessions/${state.sessionId}/players/${state.playerId}`, 'DELETE');
	} catch (err) {
		if (!['session_not_found', 'player_not_found'].includes(err.code)) {
			throw err;
		}
	}

	clearActivePlayerSession();
	location.href = `/?session=${encodeURIComponent(state.sessionCode)}`;
}

$('joinBtn').addEventListener('click', async () => {
	$('joinError').textContent = '';
	const pseudo = $('pseudo').value.trim();
	if (!state.sessionCode || !pseudo) {
		$('joinError').textContent = 'Veuillez saisir au minimum un pseudo valide.';
		return;
	}

	try {
		const payload = await api('/sessions/join', 'POST', { code: state.sessionCode, pseudo });
		state.sessionId = payload.sessionId;
		state.sessionCode = payload.sessionCode;
		state.playerId = payload.playerId;
		state.pseudo = payload.pseudo;
		applyPlayerProfile({ pseudo: state.pseudo, avatar: null, devise: null });
		persistJoinPrefs({ sessionCode: state.sessionCode, pseudo: state.pseudo });
		persistActivePlayerSession({
			sessionId: state.sessionId,
			sessionCode: state.sessionCode,
			playerId: state.playerId,
			pseudo: state.pseudo
		});
		revealPlayerUi();
		setStatus(payload.status);
		connectWs();
		const ranking = await api(`/sessions/${state.sessionId}/ranking`);
		setRanking(ranking.ranking || []);
		setWinner(ranking.winner || null);
	} catch (err) {
		const messages = {
			session_not_found: 'Code session introuvable.',
			pseudo_already_used: 'Ce pseudo est deja utilise.',
			session_stopped: 'Cette partie est terminee.'
		};
		$('joinError').textContent = messages[err.code] ?? `Erreur : ${err.message}`;
	}
});

$('editProfileBtn').addEventListener('click', () => {
	setProfileEditMode(!state.isEditingProfile);
});

$('profileToggleBtn').addEventListener('click', () => {
	toggleProfileCollapse();
});

$('cancelProfileBtn').addEventListener('click', () => {
	setProfileEditMode(false);
});

$('leaveSessionBtn').addEventListener('click', async () => {
	try {
		await leaveCurrentSession();
	} catch (err) {
		$('joinError').textContent = `Erreur : ${err.message}`;
	}
});

$('pseudo').addEventListener('input', () => {
	persistJoinPrefs({ sessionCode: state.sessionCode, pseudo: $('pseudo').value });
});

$('avatarFile').addEventListener('change', async (event) => {
	const file = event.target.files?.[0];
	if (!file) return;
	try {
		const dataUrl = await resizeImage(file);
		state.profileDraft.avatar = dataUrl;
		renderProfileEditor();
	} catch {
		setProfileMessage('Impossible de lire cette image.');
	}
});

$('saveProfileBtn').addEventListener('click', saveProfile);

$('deviseInput').addEventListener('keydown', async (event) => {
	if (event.key !== 'Enter') {
		return;
	}

	event.preventDefault();
	await saveProfile();
});

function moveGuessFocus(currentId) {
	const focusOrder = ['guessTitle', 'guessArtist', 'guessYear', 'buzzBtn'];
	const currentIndex = focusOrder.indexOf(currentId);
	if (currentIndex < 0) {
		return;
	}

	const nextId = focusOrder[currentIndex + 1];
	if (!nextId) {
		return;
	}

	$(nextId).focus();
	if ('select' in $(nextId)) {
		$(nextId).select?.();
	}
}

['guessTitle', 'guessArtist', 'guessYear'].forEach((fieldId) => {
	$(fieldId).addEventListener('keydown', (event) => {
		if (event.key !== 'Enter') {
			return;
		}

		event.preventDefault();
		moveGuessFocus(fieldId);
	});
});

$('buzzBtn').addEventListener('keydown', async (event) => {
	if (event.key !== 'Enter') {
		return;
	}

	event.preventDefault();
	$('buzzBtn').click();
});

$('buzzBtn').addEventListener('click', async () => {
	if (state.buzzPhase !== null) return;

	const proposal = {
		title: $('guessTitle').value.trim() || undefined,
		artist: $('guessArtist').value.trim() || undefined,
		year: $('guessYear').value ? Number($('guessYear').value) : undefined
	};

	try {
		await api(`/sessions/${state.sessionId}/buzz`, 'POST', { playerId: state.playerId, proposal });
		state.buzzPhase = 'first';
		updateBuzzButton();
		setBuzzFeedback('first', 'Buzz envoye. En attente de validation admin.');
	} catch (err) {
		if (err.code === 'buzz_locked') {
			state.buzzPhase = 'locked_by_other';
			setBuzzFeedback('waiting', 'Trop tard. Quelqu\'un vous a devance.');
			updateBuzzButton();
			return;
		}

		setBuzzFeedback('rejected', `Erreur : ${err.message}`);
		state.buzzPhase = null;
		updateBuzzButton();
	}
});

async function bootstrap() {
	const codeFromUrl = sessionCodeFromUrl();
	const activeSession = loadActivePlayerSession();
	const storedPrefs = loadJoinPrefs();
	const fallbackCode = codeFromUrl || activeSession?.sessionCode || storedPrefs?.sessionCode || '';

	if (!fallbackCode) {
		resetJoinState('Aucun code session fourni. Revenez a l\'accueil pour verifier une partie.');
		return;
	}

	try {
		await verifySession(fallbackCode);
		$('pseudo').value = storedPrefs?.pseudo || activeSession?.pseudo || '';

		if (activeSession && activeSession.sessionCode === state.sessionCode) {
			await restoreExistingPlayer(activeSession);
			return;
		}

		resetJoinState(`Session ${state.sessionCode} prete. Saisissez un pseudo pour entrer.`);
		$('pseudo').focus();
	} catch (err) {
		resetJoinState(err.code === 'session_not_found'
			? 'Session introuvable. Revenez a l\'accueil pour verifier un autre code.'
			: `Impossible de charger la session (${err.message}).`);
	}
}

bootstrap();