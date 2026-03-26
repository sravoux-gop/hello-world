import { $, api, buildEndUrl, escHtml, hide, sessionCodeFromUrl, show, statusLabel } from '/app-shared.js';

const state = {
	sessionId: '',
	sessionCode: '',
	sessionName: '',
	status: 'waiting',
	currentRound: null,
	currentBuzz: null,
	lastDecision: null,
	previousRoundResult: null,
	ranking: [],
	highlightedPlayerId: null,
	registeredPlayers: 0,
	connectedPlayers: 0,
	qrDataUrl: '',
	ws: null
};

function showError(text) {
	$('spectatorError').textContent = text;
	show('spectatorError');
	hide('spectatorGrid');
}

function showGrid() {
	hide('spectatorError');
	show('spectatorGrid');
}

function setStatusBadge(status) {
	$('sessionStatusBadge').textContent = statusLabel(status);
	$('sessionStatusBadge').className = `status-badge ${status}`;
}

function avatarOrFallback(avatar, label) {
	if (avatar) {
		return `<img src="${escHtml(avatar)}" alt="Avatar ${escHtml(label)}" />`;
	}
	return `<span class="no-avatar">${escHtml(String(label || '?').slice(0, 1).toUpperCase())}</span>`;
}

function roundMarker(roundOrDecision) {
	if (!roundOrDecision) {
		return 0;
	}

	return Number(roundOrDecision.roundRef?.startedAt ?? roundOrDecision.startedAt ?? roundOrDecision.round?.startedAt) || 0;
}

function isSameRound(left, right) {
	const leftMarker = roundMarker(left);
	const rightMarker = roundMarker(right);

	if (leftMarker && rightMarker) {
		return leftMarker === rightMarker;
	}

	return String(left?.title ?? '') === String(right?.title ?? '')
		&& String(left?.artist ?? '') === String(right?.artist ?? '')
		&& Number(left?.year ?? 0) === Number(right?.year ?? 0)
		&& Number(left?.yearBonus ?? 0) === Number(right?.yearBonus ?? 0);
}

function decisionTargetsCurrentRound(decision = state.lastDecision) {
	if (!decision || !state.currentRound) {
		return false;
	}

	const marker = roundMarker(decision);
	if (marker && roundMarker(state.currentRound)) {
		return marker === roundMarker(state.currentRound);
	}

	if (!decision.round) {
		return false;
	}

	return isSameRound(decision.round, state.currentRound);
}

function syncPreviousRoundResult() {
	if (!state.lastDecision) {
		return;
	}

	if (!state.currentRound || !decisionTargetsCurrentRound(state.lastDecision) || state.status === 'stopped') {
		state.previousRoundResult = state.lastDecision;
	}
}

function formatRoundMeta(round) {
	if (!round) {
		return '';
	}

	const parts = [];
	if (round.artist) {
		parts.push(escHtml(round.artist));
	}
	if (Number(round.year)) {
		parts.push(String(Number(round.year)));
	}

	return parts.join(' · ');
}

function renderHeader() {
	const title = state.sessionName || `Session ${state.sessionCode}`;
	$('spectatorSubtitle').textContent = title;
	$('playerCountBadge').textContent = `${state.connectedPlayers} connecte(s) / ${state.registeredPlayers} joueur(s)`;
	setStatusBadge(state.status);
	$('sessionInfoText').textContent = state.qrDataUrl
		? 'Scannez le QR code pour rejoindre la partie.'
		: 'Le QR code apparaitra ici des qu\'il sera disponible pour les spectateurs.';

	if (state.qrDataUrl) {
		$('spectatorQrImage').src = state.qrDataUrl;
		show('sessionInfoQr');
	} else {
		hide('sessionInfoQr');
	}
}

function renderRanking() {
	if (!state.ranking.length) {
		$('rankingBody').innerHTML = '<tr><td colspan="3" class="ranking-empty">Aucun joueur inscrit pour le moment.</td></tr>';
		return;
	}

	$('rankingBody').innerHTML = state.ranking
		.map((entry, index) => {
			const highlight = entry.id === state.highlightedPlayerId ? 'ranking-highlight' : '';
			const deviseHtml = entry.devise
				? `<div class="ranking-devise">${escHtml(entry.devise)}</div>`
				: '<div class="ranking-devise ranking-devise-empty">Aucune devise</div>';

			return `<tr class="ranking-row ${highlight}">
				<td class="ranking-rank">${index + 1}</td>
				<td>
					<div class="ranking-player-cell">
						<div class="ranking-avatar">${avatarOrFallback(entry.avatar, entry.displayName)}</div>
						<div class="ranking-player-meta">
							<div class="ranking-player-name">${escHtml(entry.displayName)}</div>
							${deviseHtml}
						</div>
					</div>
				</td>
				<td class="ranking-score">${entry.score}</td>
			</tr>`;
		})
		.join('');
}

function renderPreviousRound() {
	const previousRound = state.previousRoundResult ?? (state.status === 'stopped' ? state.lastDecision : null);

	if (!previousRound) {
		$('previousRoundTitle').textContent = 'Aucun resultat';
		$('previousRoundText').textContent = 'La precedente manche n\'est pas encore disponible.';
		$('previousRoundDetails').innerHTML = '';
		return;
	}

	const accepted = previousRound.decision === 'accepted';
	$('previousRoundTitle').textContent = accepted ? 'Manche gagnee' : 'Decision admin rendue';
	$('previousRoundText').textContent = accepted
		? `${previousRound.playerName} a ete valide par l\'admin.`
		: `${previousRound.playerName} a buzze, mais la proposition a ete refusee.`;

	if (accepted && previousRound.round) {
		$('previousRoundDetails').innerHTML = `
			<div class="result-box success-tone">
				<p><strong>Morceau</strong></p>
				<p>${escHtml(previousRound.round.title)}</p>
				<p>${formatRoundMeta(previousRound.round)}</p>
				<p><strong>Gagnant</strong> · ${escHtml(previousRound.playerName)}</p>
			</div>`;
		return;
	}

	$('previousRoundDetails').innerHTML = '<div class="result-box warning-tone"><p>Aucun morceau n\'a ete valide sur cette manche.</p></div>';
}

function renderCurrentRound() {
	if (state.status === 'running' && !state.currentRound) {
		$('currentRoundStatus').textContent = 'Demarree';
		$('currentRoundText').textContent = 'La session est lancee, mais aucun morceau n\'est encore en lecture.';
		$('currentRoundDetails').innerHTML = '';
		return;
	}

	if (state.currentBuzz) {
		$('currentRoundStatus').textContent = 'Buzz !!!';
		$('currentRoundText').textContent = 'Un joueur attend la validation de l\'admin.';
		$('currentRoundDetails').innerHTML = `
			<div class="player-event-box">
				${avatarOrFallback(state.currentBuzz.playerAvatar, state.currentBuzz.playerName)}
				<div>
					<strong>${escHtml(state.currentBuzz.playerName)}</strong>
					<p class="muted">Les autres joueurs ne peuvent plus buzzer.</p>
				</div>
			</div>`;
		return;
	}

	if (state.status === 'running' && decisionTargetsCurrentRound()) {
		const accepted = state.lastDecision?.decision === 'accepted';
		$('currentRoundStatus').textContent = accepted ? 'Morceau trouve' : 'Decision admin';
		$('currentRoundText').textContent = accepted
			? `${state.lastDecision.playerName} a trouve le morceau. En attente du prochain lancement.`
			: `${state.lastDecision?.playerName || 'Un joueur'} a ete refuse. Le prochain morceau rouvrira le buzz.`;
		$('currentRoundDetails').innerHTML = `
			<div class="player-event-box ${accepted ? 'success-tone' : 'warning-tone'}">
				${avatarOrFallback(state.lastDecision?.playerAvatar, state.lastDecision?.playerName)}
				<div>
					<strong>${escHtml(state.lastDecision?.playerName || 'Joueur')}</strong>
					<p class="muted">${accepted ? 'L\'admin a valide la reponse.' : 'La proposition a ete refusee par l\'admin.'}</p>
				</div>
			</div>`;
		return;
	}

	if (state.status === 'running' && state.currentRound) {
		$('currentRoundStatus').textContent = 'Buzzer ouvert';
		$('currentRoundText').textContent = 'Le morceau est en lecture. Les joueurs peuvent encore tenter leur chance.';
		$('currentRoundDetails').innerHTML = '<div class="wave-box">Buzz disponible</div>';
		return;
	}

	if (state.status === 'stopped') {
		$('currentRoundStatus').textContent = 'Terminee';
		$('currentRoundText').textContent = 'La partie est terminee. Redirection vers l\'ecran final...';
		$('currentRoundDetails').innerHTML = '';
		return;
	}

	$('currentRoundStatus').textContent = 'En attente';
	$('currentRoundText').textContent = "L'admin n'a pas encore lance la prochaine manche.";
	$('currentRoundDetails').innerHTML = '';
}

function renderAll() {
	renderHeader();
	renderPreviousRound();
	renderCurrentRound();
	renderRanking();
}

function applySessionState(payload) {
	state.status = payload.status ?? state.status;
	state.currentRound = payload.currentRound ?? state.currentRound;
	state.lastDecision = payload.lastDecision ?? state.lastDecision;
	state.ranking = Array.isArray(payload.ranking) ? payload.ranking : state.ranking;
	syncPreviousRoundResult();

	if (payload.currentBuzzPlayerId) {
		state.currentBuzz = {
			playerId: payload.currentBuzzPlayerId,
			playerName: payload.currentBuzzPlayerName || 'Joueur',
			playerAvatar: payload.currentBuzzPlayerAvatar || null
		};
	} else {
		state.currentBuzz = null;
	}

	if (typeof payload.registeredPlayers === 'number') {
		state.registeredPlayers = payload.registeredPlayers;
	}
	if (typeof payload.connectedPlayers === 'number') {
		state.connectedPlayers = payload.connectedPlayers;
	}
}

function redirectToEndSoon() {
	window.setTimeout(() => {
		location.href = buildEndUrl(state.sessionCode);
	}, 900);
}

function connectWs() {
	const wsUrl = new URL(location.origin.replace(/^http/, 'ws'));
	wsUrl.searchParams.set('sessionId', state.sessionId);

	state.ws?.close();
	state.ws = new WebSocket(wsUrl);

	state.ws.onmessage = (event) => {
		const { event: type, payload } = JSON.parse(event.data);

		if (type === 'session.state') {
			applySessionState(payload);
			state.highlightedPlayerId = null;
			renderAll();
			return;
		}

		if (type === 'session.started') {
			state.status = 'running';
			state.currentBuzz = null;
			renderAll();
			return;
		}

		if (type === 'round.started') {
			if (state.lastDecision) {
				state.previousRoundResult = state.lastDecision;
			}
			state.status = 'running';
			state.currentRound = { startedAt: Number(payload.startedAt) || Date.now() };
			state.currentBuzz = null;
			renderAll();
			return;
		}

		if (type === 'buzz.locked') {
			state.currentBuzz = {
				playerId: payload.playerId,
				playerName: payload.playerName,
				playerAvatar: payload.playerAvatar || null
			};
			renderCurrentRound();
			return;
		}

		if (type === 'buzz.decided') {
			state.currentBuzz = null;
			state.lastDecision = {
				playerId: payload.playerId,
				playerName: payload.playerName,
				playerAvatar: payload.playerAvatar || null,
				decision: payload.decision,
				scoreDelta: Number(payload.scoreDelta) || 0,
				round: payload.round || null,
				roundRef: payload.roundRef || null,
				decidedAt: payload.decidedAt || Date.now()
			};
			state.highlightedPlayerId = payload.playerId;
			renderPreviousRound();
			renderCurrentRound();
			return;
		}

		if (type === 'ranking.updated') {
			if (Array.isArray(payload.ranking)) {
				state.ranking = payload.ranking;
			}
			renderRanking();
			return;
		}

		if (type === 'players.connected.updated') {
			if (typeof payload.registeredPlayers === 'number') {
				state.registeredPlayers = payload.registeredPlayers;
			}
			if (typeof payload.connectedPlayers === 'number') {
				state.connectedPlayers = payload.connectedPlayers;
			}
			renderHeader();
			return;
		}

		if (type === 'session.stopped') {
			state.status = 'stopped';
			if (Array.isArray(payload.ranking)) {
				state.ranking = payload.ranking;
			}
			syncPreviousRoundResult();
			renderAll();
			redirectToEndSoon();
			return;
		}

		if (type === 'session.deleted') {
			location.href = `/?session=${encodeURIComponent(state.sessionCode)}&deleted=1`;
		}
	};
}

async function bootstrap() {
	const code = sessionCodeFromUrl();
	if (!code) {
		showError('Code session manquant dans l\'URL.');
		return;
	}

	try {
		const details = await api(`/sessions/by-code/${encodeURIComponent(code)}`);
		state.sessionId = details.id;
		state.sessionCode = details.code;
		state.sessionName = details.name || `Session ${details.code}`;
		state.status = details.status || 'waiting';
		state.registeredPlayers = Number(details.playerCount) || 0;
		state.connectedPlayers = Number(details.connectedPlayers) || 0;

		try {
			const qrPayload = await api(`/sessions/by-code/${encodeURIComponent(code)}/qrcode`);
			state.qrDataUrl = qrPayload.dataUrl || '';
		} catch {
			state.qrDataUrl = '';
		}

		const rankingPayload = await api(`/sessions/${state.sessionId}/ranking`);
		state.ranking = Array.isArray(rankingPayload.ranking) ? rankingPayload.ranking : [];
		showGrid();
		renderAll();

		if (state.status === 'stopped') {
			redirectToEndSoon();
			return;
		}

		connectWs();
	} catch (err) {
		showError(err.code === 'session_not_found'
			? 'Code session introuvable.'
			: `Impossible de charger la session (${err.message}).`);
	}
}

bootstrap();
