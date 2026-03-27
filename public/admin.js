const ADMIN_SESSION_STORAGE_KEY = 'blindtest.admin.activeSession';
const ADMIN_DRAWER_COLLAPSED_STORAGE_KEY = 'blindtest.admin.drawer.collapsed';

// -- state -------------------------------------------------------------------
const state = {
	sessionId: '',
	sessionCode: '',
	ws: null,
	playlist: [],
	currentRound: null,
	playlistLibrary: [],
	playersById: new Map(),
	ranking: [],
	sessionStatus: 'waiting',
	selectedPlaylistLibraryId: '',
	currentTrackIndex: -1,
	editingIndex: null,
	drawerCollapsed: false,
	draggingTrackIndex: null,
	activeRankingPlayerId: '',
	deletePlayerCandidate: null,
	deletingPlayerId: '',
	deletingSession: false
};

// -- DOM helpers -------------------------------------------------------------
const $ = (id) => document.getElementById(id);
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }

function escHtml(str) {
	return String(str ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function exposeSessionUi() {
	show('adminDrawerHeading');
	show('qrSection');
	show('playlistSection');
	show('rankingSection');
}

function showSessionActionsOnly() {
	show('adminDrawerHeading');
	show('qrSection');
	hide('playlistSection');
	hide('rankingSection');
}

function persistAdminSession() {
	if (!state.sessionId) return;
	localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify({
		sessionId: state.sessionId,
		sessionCode: state.sessionCode
	}));
}

function clearPersistedAdminSession() {
	localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}

function readPersistedAdminSession() {
	try {
		const raw = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed?.sessionId) return null;
		return parsed;
	} catch {
		return null;
	}
}

function persistDrawerState() {
	localStorage.setItem(ADMIN_DRAWER_COLLAPSED_STORAGE_KEY, JSON.stringify(state.drawerCollapsed));
}

function readPersistedDrawerState() {
	try {
		return JSON.parse(localStorage.getItem(ADMIN_DRAWER_COLLAPSED_STORAGE_KEY) ?? 'false') === true;
	} catch {
		return false;
	}
}

function applyDrawerState() {
	const shell = document.querySelector('.admin-shell');
	const drawer = $('adminDrawer');
	const isCollapsed = state.drawerCollapsed;

	shell?.classList.toggle('admin-shell-drawer-collapsed', isCollapsed);
	drawer?.classList.toggle('admin-side-drawer-collapsed', isCollapsed);
	$('drawerToggleBtn').setAttribute('aria-expanded', String(!isCollapsed));
	$('drawerToggleIcon').className = `bi ${isCollapsed ? 'bi-chevron-bar-left' : 'bi-chevron-bar-right'}`;
	$('drawerToggleBtn').setAttribute('aria-label', isCollapsed ? 'Ouvrir le panneau lateral' : 'Replier le panneau lateral');
	if (isCollapsed) {
		$('drawerToggleBtn').setAttribute('title', 'Ouvrir le panneau lateral');
	} else {
		$('drawerToggleBtn').setAttribute('title', 'Replier le panneau lateral');
	}
}

function setDrawerCollapsed(nextValue) {
	state.drawerCollapsed = Boolean(nextValue);
	applyDrawerState();
	persistDrawerState();
}

// -- API ---------------------------------------------------------------------
async function api(path, method = 'GET', payload) {
	const response = await fetch(path, {
		method,
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: payload ? JSON.stringify(payload) : undefined
	});
	const contentType = response.headers.get('content-type') ?? '';
	const data = contentType.includes('application/json')
		? await response.json()
		: { error: 'http_error', message: await response.text() };
	if (!response.ok) throw Object.assign(new Error(data.error ?? data.message ?? 'api_error'), { code: data.error });
	return data;
}

function setPlaylistLibraryStatus(message, tone = 'muted') {
	const status = $('playlistLibraryStatus');
	status.textContent = message;
	status.className = tone;
}

function hasActivePlayback() {
	return state.sessionStatus === 'running' && Boolean(state.currentRound);
}

function updatePlaylistPlaybackButton() {
	const button = $('playlistPlayBtn');
	const isPlaying = hasActivePlayback();

	button.classList.toggle('playlist-play-active', isPlaying);
	button.classList.toggle('secondary', !isPlaying);
	button.innerHTML = isPlaying
		? '<i class="bi bi-pause-fill"></i> Pause'
		: '<i class="bi bi-play-fill"></i> Lecture';
	button.title = isPlaying ? 'Arreter la lecture en cours' : 'Lancer la lecture';
	button.setAttribute('aria-label', button.title);
}

function setSessionStatus(status = 'waiting') {
	state.sessionStatus = status;
	const badge = $('sessionStatusBadge');
	const isRunning = status === 'running';
	const hasSession = Boolean(state.sessionId);
	const canCreate = !hasSession;
	const canStart = hasSession && !isRunning;
	const canStop = hasSession && isRunning;
	const canDelete = hasSession && !isRunning;
	const shell = document.querySelector('.admin-shell');
	const config = {
		waiting: { label: 'En attente', className: 'waiting', icon: 'bi-hourglass-split' },
		stopped: { label: 'Arretee', className: 'stopped', icon: 'bi-stop-circle-fill' },
		running: { label: 'En cours', className: 'running', icon: 'bi-play-circle-fill' }
	}[status] ?? { label: 'En attente', className: 'waiting', icon: 'bi-hourglass-split' };

	shell?.classList.toggle('admin-shell-empty', !hasSession);

	badge.className = `status-badge ${config.className}`;
	badge.innerHTML = `<i class="bi ${config.icon}"></i> ${config.label}`;
	$('createSessionBtn').classList.toggle('hidden', !canCreate);
	$('startBtn').classList.toggle('hidden', !canStart);
	$('stopBtn').classList.toggle('hidden', !canStop);
	$('deleteSessionBtn').classList.toggle('hidden', !canDelete);
	$('createSessionBtn').disabled = !canCreate;
	$('startBtn').disabled = !canStart;
	$('stopBtn').disabled = !canStop;
	$('deleteSessionBtn').disabled = !canDelete || state.deletingSession;
	$('playlistPrevBtn').disabled = !state.sessionId || !isRunning;
	$('playlistPlayBtn').disabled = !state.sessionId || !isRunning;
	$('playlistNextBtn').disabled = !state.sessionId || !isRunning;
	updatePlaylistPlaybackButton();
}

function resetSessionUi() {
	state.sessionId = '';
	state.sessionCode = '';
	state.playlist = [];
	state.currentRound = null;
	state.playersById = new Map();
	state.ranking = [];
	state.sessionStatus = 'waiting';
	state.selectedPlaylistLibraryId = '';
	state.currentTrackIndex = -1;
	state.editingIndex = null;
	state.activeRankingPlayerId = '';
	state.deletePlayerCandidate = null;
	state.deletingPlayerId = '';
	state.deletingSession = false;
	$('sessionCode').textContent = '-';
	$('connectedPlayers').textContent = '0';
	$('registeredPlayers').textContent = '0';
	$('rankingBody').innerHTML = '';
	$('playlistBody').innerHTML = '';
	$('qrImg').removeAttribute('src');
	$('qrUrl').removeAttribute('href');
	showSessionActionsOnly();
	clearBuzz();
	closeDeletePlayerModal();
	closeDeleteSessionModal();
	setSessionStatus('waiting');
}

function updatePlaylistLibraryControls() {
	const hasSelectedServerPlaylist = state.playlistLibrary.some((entry) => entry.id === state.selectedPlaylistLibraryId);
	$('playlistLibrarySelect').disabled = state.playlistLibrary.length === 0;
	$('playlistLoadServerBtn').disabled = !state.sessionId || !hasSelectedServerPlaylist;
}

function syncPlaylistLibrarySelection() {
	const select = $('playlistLibrarySelect');
	const selectedExists = state.playlistLibrary.some((entry) => entry.id === state.selectedPlaylistLibraryId);
	select.value = selectedExists ? state.selectedPlaylistLibraryId : '';
	updatePlaylistLibraryControls();
	if (!selectedExists && state.selectedPlaylistLibraryId) {
		state.selectedPlaylistLibraryId = '';
	}
}

function renderPlaylistLibrary() {
	const select = $('playlistLibrarySelect');
	const options = ['<option value="">Choisir une liste serveur</option>',
		...state.playlistLibrary.map((entry) => `<option value="${escHtml(entry.id)}">${escHtml(entry.name)} (${entry.trackCount} pistes)</option>`)
	];
	select.innerHTML = options.join('');
	syncPlaylistLibrarySelection();
	if (!state.playlistLibrary.length) {
		setPlaylistLibraryStatus('Aucune playlist serveur disponible pour le moment.', 'muted');
	}
}

async function refreshPlaylistLibrary(preferredId = state.selectedPlaylistLibraryId) {
	const data = await api('/admin/api/playlists/library');
	state.playlistLibrary = Array.isArray(data.playlists) ? data.playlists : [];
	state.selectedPlaylistLibraryId = state.playlistLibrary.some((entry) => entry.id === preferredId) ? preferredId : '';
	renderPlaylistLibrary();
}

// -- Stats -------------------------------------------------------------------
function setStats(payload) {
	if (typeof payload.connectedPlayers === 'number') $('connectedPlayers').textContent = String(payload.connectedPlayers);
	if (typeof payload.registeredPlayers === 'number') $('registeredPlayers').textContent = String(payload.registeredPlayers);
}

async function refreshStats() {
	if (!state.sessionId) return;
	const data = await api(`/admin/api/sessions/${state.sessionId}/stats`);
	setStats(data);
	setSessionStatus(data.status ?? state.sessionStatus);
	state.selectedPlaylistLibraryId = data.currentPlaylistLibraryId ?? '';
	syncPlaylistLibrarySelection();
	state.currentRound = data.currentRound ?? null;
	if (state.currentRound) {
		showCurrentTrack(state.currentRound);
	} else {
		clearBuzz();
	}
	if (data.currentBuzzPlayer) {
		showBuzz({
			playerName: data.currentBuzzPlayer.displayName,
			playerAvatar: data.currentBuzzPlayer.avatar,
			playerDevise: data.currentBuzzPlayer.devise,
			reactionTime: null,
			proposal: data.currentBuzzProposal
		});
	}
	if (Array.isArray(data.playlist)) {
		state.playlist = data.playlist;
		state.currentTrackIndex = data.currentTrackIndex ?? -1;
		state.editingIndex = null;
		renderPlaylist();
	}
}

async function refreshRanking() {
	if (!state.sessionId) return;
	const data = await api(`/sessions/${state.sessionId}/ranking`);
	setRanking(data.ranking ?? []);
}

// -- Ranking -----------------------------------------------------------------
function renderRanking() {
	const body = $('rankingBody');
	if (!state.ranking.length) {
		body.innerHTML = '<tr><td colspan="4" class="ranking-empty">Aucun joueur inscrit pour le moment.</td></tr>';
		show('rankingSection');
		return;
	}

	body.innerHTML = state.ranking
		.map((entry, i) => {
			const playerDetails = state.playersById.get(entry.id) ?? {};
			const player = { ...playerDetails, ...entry };
			const initial = escHtml((player.displayName ?? '?')[0]?.toUpperCase() ?? '?');
			const isActive = state.activeRankingPlayerId === entry.id;
			const deleteDisabled = state.deletingPlayerId === entry.id ? 'disabled' : '';
			const avatarHtml = player.avatar
				? `<img src="${escHtml(player.avatar)}" alt="" />`
				: `<div class="no-avatar">${initial}</div>`;
			const deviseHtml = player.devise
				? `<div class="ranking-devise">${escHtml(player.devise)}</div>`
				: '<div class="ranking-devise ranking-devise-empty">Aucune devise</div>';

			return `<tr class="ranking-row ${isActive ? 'is-active' : ''}" data-player-id="${entry.id}">
				<td class="ranking-rank">${i + 1}</td>
				<td>
					<div class="ranking-player-cell">
						<div class="ranking-avatar">${avatarHtml}</div>
						<div class="ranking-player-meta">
							<div class="ranking-player-name">${escHtml(player.displayName ?? '-')}</div>
							${deviseHtml}
						</div>
					</div>
				</td>
				<td class="ranking-score">${player.score ?? 0}</td>
				<td class="ranking-action-cell">
					<button class="secondary outline ranking-delete-btn" data-player-id="${entry.id}" ${deleteDisabled}
						title="Supprimer ${escHtml(player.displayName ?? 'ce joueur')}" aria-label="Supprimer ${escHtml(player.displayName ?? 'ce joueur')}">
						<i class="bi bi-trash-fill"></i>
					</button>
				</td>
			</tr>`;
		})
		.join('');
	show('rankingSection');
}

function setRanking(ranking) {
	state.ranking = Array.isArray(ranking) ? ranking : [];
	renderRanking();
}

// -- Players directory -------------------------------------------------------
function updatePlayersDirectory(players) {
	state.playersById = new Map((Array.isArray(players) ? players : []).map((player) => [player.id, player]));
	if (state.activeRankingPlayerId && !state.playersById.has(state.activeRankingPlayerId)) {
		state.activeRankingPlayerId = '';
	}
	renderRanking();
}

async function refreshPlayers() {
	if (!state.sessionId) return;
	const data = await api(`/admin/api/sessions/${state.sessionId}/players`);
	updatePlayersDirectory(data.players);
}

// -- Current track display ----------------------------------------------------
function showCurrentTrack(round) {
	state.currentRound = round ?? null;
	if (!round) {
		updatePlaylistPlaybackButton();
		return;
	}
	$('currentTrackTitle').textContent = round.title ?? '-';
	$('currentTrackMeta').textContent = `${round.artist ?? ''}${round.year ? ' · ' + round.year : ''}`;
	show('currentTrackInfo');
	show('noBuzzMsg');
	hide('buzzProposalBox');
	hide('buzzPlayerPanel');
	$('acceptBtn').disabled = true;
	$('rejectBtn').disabled = true;
	$('noBuzzMsg').textContent = 'Aucun buzz en cours.';
	updatePlaylistPlaybackButton();
}

// -- Buzz display ------------------------------------------------------------
function openBuzzModal() {
	const modal = $('buzzModal');
	if (typeof modal.showModal === 'function') {
		if (!modal.open) {
			modal.showModal();
		}
	} else {
		modal.setAttribute('open', 'open');
	}
	document.body.classList.add('buzz-modal-open');
}

function closeBuzzModal() {
	const modal = $('buzzModal');
	if (typeof modal.close === 'function') {
		if (modal.open) {
			modal.close();
		}
	} else {
		modal.removeAttribute('open');
	}
	document.body.classList.remove('buzz-modal-open');
}

function openDeletePlayerModal(candidate) {
	state.deletePlayerCandidate = candidate;
	const modal = $('deletePlayerModal');
	const initial = escHtml((candidate.displayName ?? '?')[0]?.toUpperCase() ?? '?');
	const avatarHtml = candidate.avatar
		? `<img src="${escHtml(candidate.avatar)}" alt="" />`
		: `<div class="no-avatar">${initial}</div>`;
	$('deletePlayerAvatar').innerHTML = avatarHtml;
	$('deletePlayerName').textContent = candidate.displayName ?? candidate.pseudo ?? 'Joueur';
	$('deletePlayerMeta').textContent = candidate.connected
		? 'Ce joueur est actuellement connecte. La suppression le renverra vers l\'accueil.'
		: 'Ce joueur n\'est pas connecte pour le moment.';
	$('deletePlayerSubtitle').textContent = candidate.connected
		? 'Le joueur est connecte. Merci de confirmer la suppression.'
		: 'Confirmez la suppression de ce joueur.';

	if (typeof modal.showModal === 'function') {
		if (!modal.open) {
			modal.showModal();
		}
	} else {
		modal.setAttribute('open', 'open');
	}
	document.body.classList.add('buzz-modal-open');
}

function closeDeletePlayerModal() {
	state.deletePlayerCandidate = null;
	const modal = $('deletePlayerModal');
	if (typeof modal.close === 'function') {
		if (modal.open) {
			modal.close();
		}
	} else {
		modal.removeAttribute('open');
	}
	document.body.classList.remove('buzz-modal-open');
}

function openDeleteSessionModal() {
	$('deleteSessionName').textContent = state.sessionCode ? `Session ${state.sessionCode}` : 'Session courante';
	$('deleteSessionMeta').textContent = `${$('connectedPlayers').textContent || '0'} joueur(s) connecte(s) / ${$('registeredPlayers').textContent || '0'} inscrit(s). Tous les clients seront renvoyes vers l'accueil.`;
	const modal = $('deleteSessionModal');
	if (typeof modal.showModal === 'function') {
		if (!modal.open) {
			modal.showModal();
		}
	} else {
		modal.setAttribute('open', 'open');
	}
	document.body.classList.add('buzz-modal-open');
}

function closeDeleteSessionModal() {
	const modal = $('deleteSessionModal');
	if (typeof modal.close === 'function') {
		if (modal.open) {
			modal.close();
		}
	} else {
		modal.removeAttribute('open');
	}
	document.body.classList.remove('buzz-modal-open');
}

async function fetchPlayerForDeletion(playerId) {
	const data = await api(`/admin/api/sessions/${state.sessionId}/players`);
	updatePlayersDirectory(data.players ?? []);
	return (data.players ?? []).find((player) => player.id === playerId) ?? null;
}

async function deletePlayer(playerId) {
	if (!playerId || state.deletingPlayerId) {
		return;
	}

	state.deletingPlayerId = playerId;
	renderRanking();

	try {
		await api(`/sessions/${state.sessionId}/players/${playerId}`, 'DELETE');
		if (state.activeRankingPlayerId === playerId) {
			state.activeRankingPlayerId = '';
		}
		closeDeletePlayerModal();
	} catch (err) {
		closeDeletePlayerModal();
		window.alert(err.code === 'player_not_found'
			? 'Ce joueur a deja ete supprime.'
			: `Impossible de supprimer ce joueur (${err.message}).`);
	} finally {
		state.deletingPlayerId = '';
		renderRanking();
	}
}

function showBuzz(payload) {
	openBuzzModal();
	show('currentTrackInfo');
	hide('noBuzzMsg');

	const avatarContainer = $('buzzPlayerAvatar');
	if (payload.playerAvatar) {
		avatarContainer.innerHTML = `<img src="${escHtml(payload.playerAvatar)}" alt="avatar" />`;
	} else {
		const initial = escHtml((payload.playerName ?? '?')[0].toUpperCase());
		avatarContainer.innerHTML = `<div class="no-avatar">${initial}</div>`;
	}
	$('buzzPlayerName').textContent = payload.playerName ?? '-';
	$('buzzPlayerDevise').textContent = payload.playerDevise ? `"${payload.playerDevise}"` : '';
	if (payload.reactionTime != null) {
		$('buzzReactionTime').textContent = `⏱ ${(payload.reactionTime / 1000).toFixed(2)} s`;
	} else {
		$('buzzReactionTime').textContent = '';
	}
	show('buzzPlayerPanel');

	if (payload.proposal && (payload.proposal.title || payload.proposal.artist || payload.proposal.year)) {
		const parts = [payload.proposal.title, payload.proposal.artist, payload.proposal.year].filter(Boolean);
		$('buzzProposalText').textContent = parts.join(' / ');
		show('buzzProposalBox');
	} else {
		hide('buzzProposalBox');
	}

	$('acceptBtn').disabled = false;
	$('rejectBtn').disabled = false;
}

function clearBuzz() {
	hide('buzzPlayerPanel');
	hide('buzzProposalBox');
	$('acceptBtn').disabled = true;
	$('rejectBtn').disabled = true;
	$('noBuzzMsg').textContent = 'Aucun buzz en cours.';
	show('noBuzzMsg');
	closeBuzzModal();
	if (!state.currentRound) {
		hide('currentTrackInfo');
	}
}

// -- Playlist ----------------------------------------------------------------
function syncCurrentTrackIndex(currentTrackId) {
	if (!currentTrackId) {
		state.currentTrackIndex = -1;
		return;
	}
	state.currentTrackIndex = state.playlist.findIndex((track) => track.id === currentTrackId);
}

async function reorderPlaylist(fromIndex, toIndex) {
	if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= state.playlist.length || toIndex >= state.playlist.length) {
		return;
	}

	if (state.editingIndex != null) {
		await commitInlineEdit(state.editingIndex);
	}

	const currentTrackId = state.playlist[state.currentTrackIndex]?.id ?? null;
	const [movedTrack] = state.playlist.splice(fromIndex, 1);
	state.playlist.splice(toIndex, 0, movedTrack);
	syncCurrentTrackIndex(currentTrackId);
	state.editingIndex = null;
	renderPlaylist();
	await savePlaylist();
}

function renderPlaylist() {
	const tbody = $('playlistBody');
	if (!state.playlist.length) {
		state.editingIndex = null;
		tbody.innerHTML = '<tr><td colspan="6" style="color:#888;font-style:italic;padding:.5rem">Playlist vide. Ajoutez des morceaux ou importez un CSV.</td></tr>';
		return;
	}

	state.editingIndex = null;
	tbody.innerHTML = state.playlist.map((track, i) => {
		const isActive = i === state.currentTrackIndex;
		const moveUpDisabled = i === 0 ? 'disabled' : '';
		const moveDownDisabled = i === state.playlist.length - 1 ? 'disabled' : '';
		return `<tr class="${isActive ? 'active-track' : ''}" data-index="${i}">
      <td class="cell-index">
		<span class="drag-handle" draggable="true" data-index="${i}" title="Glisser pour reordonner"><i class="bi bi-grip-vertical"></i></span>
        <span class="track-cursor ${isActive ? 'is-visible' : ''}"><i class="bi bi-caret-right-fill"></i></span>
        <button class="track-index-btn" data-index="${i}" title="Lire cette piste">${i + 1}</button>
      </td>
      <td class="cell-title">${escHtml(track.title)}</td>
      <td class="cell-artist">${escHtml(track.artist)}</td>
      <td class="cell-year">${track.year || ''}</td>
      <td class="cell-yearbonus">${track.yearBonus || 0}</td>
			<td class="track-actions-cell">
				<div class="track-actions-wrap">
					<button class="btn-move-up" data-index="${i}" title="Monter" ${moveUpDisabled}><i class="bi bi-chevron-up"></i></button>
					<button class="btn-move-down" data-index="${i}" title="Descendre" ${moveDownDisabled}><i class="bi bi-chevron-down"></i></button>
					<button class="btn-edit" data-index="${i}" title="Editer"><i class="bi bi-pencil-square"></i></button>
					<button class="btn-play-track" data-index="${i}" title="Lire"><i class="bi bi-play-fill"></i></button>
					<button class="btn-delete" data-index="${i}" title="Supprimer"><i class="bi bi-trash-fill"></i></button>
				</div>
      </td>
    </tr>`;
	}).join('');
}

async function savePlaylist() {
	if (!state.sessionId) return;
	const data = await api(`/admin/api/sessions/${state.sessionId}/playlist`, 'PUT', { playlist: state.playlist });
	state.currentTrackIndex = data.currentTrackIndex ?? state.currentTrackIndex;
	state.selectedPlaylistLibraryId = data.currentPlaylistLibraryId ?? '';
	syncPlaylistLibrarySelection();
}

async function playTrack(index) {
	const data = await api(`/admin/api/sessions/${state.sessionId}/playlist/play`, 'POST', { index });
	state.currentTrackIndex = data.currentTrackIndex;
	renderPlaylist();
	showCurrentTrack(data.currentRound);
}

function getEditRow(index) {
	return $('playlistBody').querySelector(`tr[data-index="${index}"]`);
}

function getEditInputs(row) {
	return [...row.querySelectorAll('.edit-field')];
}

function startInlineEdit(index, focusCol = 0) {
	const track = state.playlist[index];
	const row = getEditRow(index);
	if (!track || !row) return;

	state.editingIndex = index;
	row.classList.add('playlist-editing-row');
	row.innerHTML = `
    <td class="cell-index">
      <span class="track-cursor ${index === state.currentTrackIndex ? 'is-visible' : ''}"><i class="bi bi-caret-right-fill"></i></span>
      <span class="track-index-static">${index + 1}</span>
    </td>
    <td><input value="${escHtml(track.title)}" class="edit-field edit-title" data-col="0" /></td>
    <td><input value="${escHtml(track.artist)}" class="edit-field edit-artist" data-col="1" /></td>
    <td><input type="number" value="${track.year || ''}" class="edit-field edit-year" data-col="2" /></td>
    <td><input type="number" value="${track.yearBonus || 0}" class="edit-field edit-yearbonus" data-col="3" /></td>
    <td>
      <button class="btn-save-edit" data-index="${index}" title="Valider"><i class="bi bi-check-lg"></i></button>
      <button class="btn-cancel-edit" data-index="${index}" title="Annuler"><i class="bi bi-x-lg"></i></button>
    </td>`;

	const inputs = getEditInputs(row);
	const safeCol = Math.max(0, Math.min(focusCol, inputs.length - 1));
	inputs[safeCol]?.focus();
	inputs[safeCol]?.select();
}

async function commitInlineEdit(index = state.editingIndex) {
	if (index == null) return true;
	const row = getEditRow(index);
	if (!row) return false;

	state.playlist[index] = {
		id: state.playlist[index].id,
		title: row.querySelector('.edit-title').value.trim(),
		artist: row.querySelector('.edit-artist').value.trim(),
		year: Number(row.querySelector('.edit-year').value) || 0,
		yearBonus: Number(row.querySelector('.edit-yearbonus').value) || 0
	};

	state.editingIndex = null;
	renderPlaylist();
	await savePlaylist();
	return true;
}

function cancelInlineEdit() {
	state.editingIndex = null;
	renderPlaylist();
}

async function moveEditFocus(currentRow, currentCol, move) {
	let targetRow = currentRow;
	let targetCol = currentCol;

	if (move === 'next-field') targetCol += 1;
	if (move === 'prev-field') targetCol -= 1;
	if (move === 'up-row') targetRow -= 1;
	if (move === 'down-row') targetRow += 1;

	while (targetCol > 3) {
		targetCol = 0;
		targetRow += 1;
	}
	while (targetCol < 0) {
		targetCol = 3;
		targetRow -= 1;
	}

	if (targetRow < 0 || targetRow >= state.playlist.length) {
		return;
	}

	if (targetRow !== currentRow) {
		const ok = await commitInlineEdit(currentRow);
		if (!ok) return;
		startInlineEdit(targetRow, targetCol);
		return;
	}

	const row = getEditRow(currentRow);
	if (!row) return;
	const inputs = getEditInputs(row);
	inputs[targetCol]?.focus();
	inputs[targetCol]?.select();
}

$('playlistBody').addEventListener('click', async (e) => {
	const btn = e.target.closest('button');
	if (!btn) return;

	const index = Number(btn.dataset.index);

	if (btn.classList.contains('track-index-btn')) {
		if (state.editingIndex != null && state.editingIndex !== index) {
			await commitInlineEdit(state.editingIndex);
		}
		await playTrack(index);
		return;
	}

	if (btn.classList.contains('btn-edit')) {
		if (state.editingIndex != null && state.editingIndex !== index) {
			await commitInlineEdit(state.editingIndex);
		}
		startInlineEdit(index, 0);
		return;
	}

	if (btn.classList.contains('btn-move-up')) {
		await reorderPlaylist(index, index - 1);
		return;
	}

	if (btn.classList.contains('btn-move-down')) {
		await reorderPlaylist(index, index + 1);
		return;
	}

	if (btn.classList.contains('btn-play-track')) {
		if (state.editingIndex != null) {
			await commitInlineEdit(state.editingIndex);
		}
		await playTrack(index);
		return;
	}

	if (btn.classList.contains('btn-delete')) {
		if (state.editingIndex != null) {
			await commitInlineEdit(state.editingIndex);
		}
		const currentTrackId = state.playlist[state.currentTrackIndex]?.id ?? null;
		state.playlist.splice(index, 1);
		syncCurrentTrackIndex(currentTrackId);
		if (state.currentTrackIndex < 0 && state.playlist.length > 0) {
			state.currentTrackIndex = Math.min(index, state.playlist.length - 1);
		}
		renderPlaylist();
		await savePlaylist();
		return;
	}

	if (btn.classList.contains('btn-save-edit')) {
		await commitInlineEdit(index);
		return;
	}

	if (btn.classList.contains('btn-cancel-edit')) {
		cancelInlineEdit();
	}
});

$('playlistBody').addEventListener('dragstart', (e) => {
	const handle = e.target.closest('.drag-handle');
	if (!handle) return;
	state.draggingTrackIndex = Number(handle.dataset.index);
	e.dataTransfer.effectAllowed = 'move';
	e.dataTransfer.setData('text/plain', String(state.draggingTrackIndex));
	handle.closest('tr[data-index]')?.classList.add('dragging-track');
});

$('playlistBody').addEventListener('dragover', (e) => {
	const row = e.target.closest('tr[data-index]');
	if (!row || state.draggingTrackIndex == null) return;
	e.preventDefault();
	row.classList.add('drop-target-track');
	e.dataTransfer.dropEffect = 'move';
});

$('playlistBody').addEventListener('dragleave', (e) => {
	const row = e.target.closest('tr[data-index]');
	if (!row) return;
	row.classList.remove('drop-target-track');
});

$('playlistBody').addEventListener('drop', async (e) => {
	const row = e.target.closest('tr[data-index]');
	if (!row || state.draggingTrackIndex == null) return;
	e.preventDefault();
	const targetIndex = Number(row.dataset.index);
	row.classList.remove('drop-target-track');
	const fromIndex = state.draggingTrackIndex;
	state.draggingTrackIndex = null;
	$('playlistBody').querySelectorAll('.dragging-track').forEach((entry) => entry.classList.remove('dragging-track'));
	await reorderPlaylist(fromIndex, targetIndex);
});

$('playlistBody').addEventListener('dragend', () => {
	state.draggingTrackIndex = null;
	$('playlistBody').querySelectorAll('.dragging-track, .drop-target-track').forEach((entry) => {
		entry.classList.remove('dragging-track');
		entry.classList.remove('drop-target-track');
	});
});

$('playlistBody').addEventListener('dblclick', async (e) => {
	const row = e.target.closest('tr[data-index]');
	if (!row) return;
	if (e.target.closest('button') || e.target.closest('input')) return;

	const cell = e.target.closest('td');
	if (!cell) return;
	if (cell.cellIndex < 1 || cell.cellIndex > 4) return;

	const index = Number(row.dataset.index);
	if (state.editingIndex != null && state.editingIndex !== index) {
		await commitInlineEdit(state.editingIndex);
	}

	startInlineEdit(index, cell.cellIndex - 1);
});

$('playlistBody').addEventListener('keydown', async (e) => {
	if (!e.target.classList.contains('edit-field')) return;

	const row = e.target.closest('tr[data-index]');
	if (!row) return;
	const rowIndex = Number(row.dataset.index);
	const colIndex = Number(e.target.dataset.col || 0);

	if (e.key === 'Enter') {
		e.preventDefault();
		await commitInlineEdit(rowIndex);
		return;
	}

	if (e.key === 'Tab') {
		e.preventDefault();
		await moveEditFocus(rowIndex, colIndex, e.shiftKey ? 'prev-field' : 'next-field');
		return;
	}

	if (e.key === 'ArrowRight') {
		e.preventDefault();
		await moveEditFocus(rowIndex, colIndex, 'next-field');
		return;
	}

	if (e.key === 'ArrowLeft') {
		e.preventDefault();
		await moveEditFocus(rowIndex, colIndex, 'prev-field');
		return;
	}

	if (e.key === 'ArrowDown') {
		e.preventDefault();
		await moveEditFocus(rowIndex, colIndex, 'down-row');
		return;
	}

	if (e.key === 'ArrowUp') {
		e.preventDefault();
		await moveEditFocus(rowIndex, colIndex, 'up-row');
	}
});

$('playlistPrevBtn').onclick = async () => {
	try {
		const data = await api(`/admin/api/sessions/${state.sessionId}/playlist/prev`, 'POST');
		state.currentTrackIndex = data.currentTrackIndex;
		state.editingIndex = null;
		renderPlaylist();
		showCurrentTrack(data.currentRound);
	} catch (err) {
		if (err.code !== 'no_prev_track') console.error(err);
	}
};

$('playlistNextBtn').onclick = async () => {
	try {
		const data = await api(`/admin/api/sessions/${state.sessionId}/playlist/next`, 'POST');
		state.currentTrackIndex = data.currentTrackIndex;
		state.editingIndex = null;
		renderPlaylist();
		showCurrentTrack(data.currentRound);
	} catch (err) {
		if (err.code !== 'no_next_track') console.error(err);
	}
};

$('playlistPlayBtn').onclick = async () => {
	if (hasActivePlayback()) {
		try {
			const data = await api(`/admin/api/sessions/${state.sessionId}/playlist/pause`, 'POST');
			state.currentTrackIndex = data.currentTrackIndex ?? state.currentTrackIndex;
			state.currentRound = null;
			clearBuzz();
			renderPlaylist();
			updatePlaylistPlaybackButton();
		} catch (err) {
			console.error(err);
		}
		return;
	}
	if (state.currentTrackIndex < 0 && state.playlist.length > 0) state.currentTrackIndex = 0;
	if (state.currentTrackIndex < 0) return;
	if (state.editingIndex != null) {
		await commitInlineEdit(state.editingIndex);
	}
	try {
		const data = await api(`/admin/api/sessions/${state.sessionId}/playlist/play`, 'POST', { index: state.currentTrackIndex });
		state.currentTrackIndex = data.currentTrackIndex;
		state.currentRound = data.currentRound ?? null;
		state.editingIndex = null;
		renderPlaylist();
		showCurrentTrack(data.currentRound);
	} catch (err) {
		console.error(err);
	}
};
$('playlistLibrarySelect').onchange = (e) => {
	state.selectedPlaylistLibraryId = e.target.value;
	updatePlaylistLibraryControls();
};

$('playlistLoadServerBtn').onclick = async () => {
	if (!state.sessionId || !state.selectedPlaylistLibraryId) return;

	try {
		const data = await api(`/admin/api/sessions/${state.sessionId}/playlist/load`, 'POST', {
			playlistLibraryId: state.selectedPlaylistLibraryId
		});
		state.playlist = Array.isArray(data.playlist) ? data.playlist : [];
		state.currentTrackIndex = data.currentTrackIndex ?? -1;
		state.selectedPlaylistLibraryId = data.currentPlaylistLibraryId ?? state.selectedPlaylistLibraryId;
		state.editingIndex = null;
		renderPlaylist();
		hide('currentTrackInfo');
		clearBuzz();
		setPlaylistLibraryStatus(`Playlist chargee dans la session: ${data.loadedPlaylist?.name ?? 'liste serveur'}.`, 'success-text');
		syncPlaylistLibrarySelection();
	} catch (err) {
		console.error(err);
		setPlaylistLibraryStatus('Impossible de charger cette playlist dans la session.', 'error-text');
	}
};

// CSV import
$('playlistImportBtn').onclick = () => $('csvFileInput').click();

$('csvFileInput').onchange = async (e) => {
	const file = e.target.files?.[0];
	if (!file) return;
	const text = await file.text();
	const lines = text.split(/\r?\n/).filter((l) => l.trim());
	const firstLower = lines[0]?.toLowerCase() ?? '';
	const startIdx = (firstLower.includes('title') || firstLower.includes('titre')) ? 1 : 0;
	const parsed = [];
	for (let i = startIdx; i < lines.length; i++) {
		const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
		if (cols.length < 2) continue;
		parsed.push({
			id: crypto.randomUUID(),
			title: cols[0] ?? '',
			artist: cols[1] ?? '',
			year: Number(cols[2]) || 0,
			yearBonus: Number(cols[3]) || 0
		});
	}
	state.playlist.push(...parsed);
	state.editingIndex = null;
	renderPlaylist();
	await savePlaylist();
	e.target.value = '';
};

// CSV export
$('playlistExportBtn').onclick = () => {
	const rows = ['title,artist,year,yearBonus',
		...state.playlist.map((t) => `"${t.title}","${t.artist}",${t.year},${t.yearBonus}`)
	];
	const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `playlist-${state.sessionCode || 'export'}.csv`;
	a.click();
	URL.revokeObjectURL(url);
};

// -- WebSocket ---------------------------------------------------------------
function connectWs() {
	if (!state.sessionId) return;
	state.ws?.close();
	const wsUrl = new URL(location.origin.replace(/^http/, 'ws'));
	wsUrl.searchParams.set('sessionId', state.sessionId);
	wsUrl.searchParams.set('admin', '1');
	state.ws = new WebSocket(wsUrl);

	state.ws.onmessage = (event) => {
		const { event: type, payload } = JSON.parse(event.data);

		if (type === 'session.state') {
			setSessionStatus(payload.status ?? state.sessionStatus);
			setStats(payload);
			state.currentRound = payload.currentRound ?? null;
			if (Array.isArray(payload.ranking)) {
				setRanking(payload.ranking);
			}
			if (payload.currentRound) {
				showCurrentTrack(payload.currentRound);
			} else {
				clearBuzz();
			}
			if (payload.currentBuzzPlayerId) {
				showBuzz({
					playerName: payload.currentBuzzPlayerName,
					playerAvatar: payload.currentBuzzPlayerAvatar,
					playerDevise: null,
					reactionTime: null,
					proposal: payload.currentBuzzProposal
				});
			} else {
				clearBuzz();
			}
		}

		if (type === 'ranking.updated') {
			setRanking(payload.ranking);
		}

		if (type === 'players.connected.updated') {
			setStats(payload);
		}

		if (type === 'players.list.updated') {
			updatePlayersDirectory(payload.players ?? []);
		}

		if (type === 'buzz.locked') {
			showBuzz(payload);
		}

		if (type === 'buzz.decided') {
			clearBuzz();
		}

		if (type === 'round.started') {
			setSessionStatus('running');
			state.currentRound = { startedAt: Number(payload.startedAt) || Date.now() };
			clearBuzz();
			refreshStats();
		}

		if (type === 'round.paused') {
			state.currentRound = null;
			clearBuzz();
			updatePlaylistPlaybackButton();
		}

		if (type === 'session.stopped') {
			state.currentRound = null;
			setSessionStatus('stopped');
			if (payload.ranking) setRanking(payload.ranking);
		}

		if (type === 'session.deleted') {
			clearPersistedAdminSession();
			state.ws?.close();
			state.ws = null;
			resetSessionUi();
		}
	};
}

async function loadQrCode() {
	const qr = await api(`/admin/api/sessions/${state.sessionId}/qrcode`);
	$('qrImg').src = qr.dataUrl;
	// $('qrUrl').textContent = qr.joinUrl;
	$('qrUrl').href = qr.joinUrl;
}

async function hydrateSession(sessionId, fallbackCode = '') {
	const session = await api(`/admin/api/sessions/${sessionId}`);
	state.sessionId = session.id;
	state.sessionCode = session.code || fallbackCode || '';
	state.sessionStatus = session.status ?? 'waiting';
	state.currentTrackIndex = session.currentTrackIndex ?? -1;
	state.currentRound = session.currentRound ?? null;
	state.selectedPlaylistLibraryId = session.currentPlaylistLibraryId ?? '';
	state.playlist = Array.isArray(session.playlist) ? session.playlist : [];
	state.editingIndex = null;

	$('sessionCode').textContent = state.sessionCode || '-';
	setSessionStatus(state.sessionStatus);
	exposeSessionUi();
	connectWs();
	persistAdminSession();

	await Promise.all([
		loadQrCode(),
		refreshPlaylistLibrary(state.selectedPlaylistLibraryId),
		refreshPlayers(),
		refreshStats(),
		refreshRanking()
	]);
}

// -- Session creation ---------------------------------------------------------
$('createSessionBtn').onclick = async () => {
	const data = await api('/admin/api/sessions', 'POST');
	state.sessionId = data.id;
	state.sessionCode = data.code;
	state.sessionStatus = data.status ?? 'waiting';
	state.playlist = [];
	state.selectedPlaylistLibraryId = '';
	state.currentTrackIndex = -1;
	state.editingIndex = null;

	$('sessionCode').textContent = data.code;
	setSessionStatus(state.sessionStatus);
	exposeSessionUi();
	renderPlaylist();
	connectWs();
	persistAdminSession();

	await Promise.all([
		loadQrCode(),
		refreshPlaylistLibrary(),
		refreshPlayers(),
		refreshStats(),
		refreshRanking()
	]);
};

// -- Start / Stop ------------------------------------------------------------
$('startBtn').onclick = async () => {
	const data = await api(`/admin/api/sessions/${state.sessionId}/start`, 'POST');
	setSessionStatus(data.status ?? 'running');
};
$('stopBtn').onclick = async () => {
	const data = await api(`/admin/api/sessions/${state.sessionId}/stop`, 'POST');
	setSessionStatus(data.status ?? 'stopped');
};

$('deleteSessionBtn').onclick = () => {
	openDeleteSessionModal();
};

// -- Manual round launch -----------------------------------------------------
$('addRoundBtn').onclick = async () => {
	const data = await api(`/admin/api/sessions/${state.sessionId}/rounds`, 'POST', {
		title: $('roundTitle').value,
		artist: $('roundArtist').value,
		year: Number($('roundYear').value),
		yearBonus: Number($('roundYearBonus').value || 0)
	});
	showCurrentTrack(data.currentRound);
};

// -- Decision ----------------------------------------------------------------
$('acceptBtn').onclick = async () => {
	const data = await api(`/admin/api/sessions/${state.sessionId}/decision`, 'POST', { decision: 'accepted' });
	setRanking(data.ranking);
	clearBuzz();
};

$('rejectBtn').onclick = async () => {
	const data = await api(`/admin/api/sessions/${state.sessionId}/decision`, 'POST', { decision: 'rejected' });
	setRanking(data.ranking);
	clearBuzz();
};

$('rankingBody').addEventListener('click', async (event) => {
	const deleteButton = event.target.closest('.ranking-delete-btn');
	if (deleteButton) {
		event.preventDefault();
		event.stopPropagation();
		const playerId = deleteButton.dataset.playerId;
		const candidate = await fetchPlayerForDeletion(playerId);
		if (!candidate) {
			window.alert('Ce joueur n\'existe plus dans la session.');
			return;
		}

		if (candidate.connected) {
			openDeletePlayerModal(candidate);
			return;
		}

		await deletePlayer(candidate.id);
		return;
	}

	const row = event.target.closest('.ranking-row');
	if (!row) {
		return;
	}

	const playerId = row.dataset.playerId;
	state.activeRankingPlayerId = state.activeRankingPlayerId === playerId ? '' : playerId;
	renderRanking();
});

$('drawerToggleBtn').onclick = () => {
	setDrawerCollapsed(!state.drawerCollapsed);
};

$('buzzModal').addEventListener('cancel', (event) => {
	event.preventDefault();
});

$('deletePlayerModal').addEventListener('cancel', (event) => {
	event.preventDefault();
	closeDeletePlayerModal();
});

$('deleteSessionModal').addEventListener('cancel', (event) => {
	event.preventDefault();
	closeDeleteSessionModal();
});

$('cancelDeletePlayerBtn').onclick = () => {
	closeDeletePlayerModal();
};

$('confirmDeletePlayerBtn').onclick = async () => {
	if (!state.deletePlayerCandidate?.id) {
		closeDeletePlayerModal();
		return;
	}
	await deletePlayer(state.deletePlayerCandidate.id);
};

$('cancelDeleteSessionBtn').onclick = () => {
	closeDeleteSessionModal();
};

$('confirmDeleteSessionBtn').onclick = async () => {
	if (!state.sessionId || state.deletingSession) {
		return;
	}

	state.deletingSession = true;
	setSessionStatus(state.sessionStatus);
	try {
		await api(`/admin/api/sessions/${state.sessionId}`, 'DELETE');
		clearPersistedAdminSession();
		closeDeleteSessionModal();
		resetSessionUi();
	} catch (err) {
		window.alert(`Impossible de supprimer la partie (${err.message}).`);
	} finally {
		state.deletingSession = false;
		setSessionStatus(state.sessionStatus);
	}
};

// -- Change Password ---------------------------------------------------------
$('changePasswordBtn').onclick = () => {
	$('changePasswordOld').value = '';
	$('changePasswordNew').value = '';
	$('changePasswordConfirm').value = '';
	$('changePasswordError').textContent = '';
	$('changePasswordError').className = 'muted hidden';
	$('changePasswordModal').showModal();
};

$('cancelChangePasswordBtn').onclick = () => {
	$('changePasswordModal').close();
};

$('confirmChangePasswordBtn').onclick = async () => {
	const oldPassword = $('changePasswordOld').value?.trim();
	const newPassword = $('changePasswordNew').value?.trim();
	const confirmPassword = $('changePasswordConfirm').value?.trim();
	const errorEl = $('changePasswordError');

	errorEl.className = 'muted hidden';
	errorEl.textContent = '';

	// Validation
	if (!oldPassword || !newPassword || !confirmPassword) {
		errorEl.className = 'error';
		errorEl.textContent = 'Tous les champs sont obligatoires.';
		return;
	}

	if (newPassword !== confirmPassword) {
		errorEl.className = 'error';
		errorEl.textContent = 'Les nouveaux mots de passe ne correspondent pas.';
		return;
	}

	if (newPassword.length < 1) {
		errorEl.className = 'error';
		errorEl.textContent = 'Le nouveau mot de passe ne peut pas être vide.';
		return;
	}

	try {
		await api('/admin/api/change-password', 'POST', {
			oldPassword,
			newPassword
		});

		errorEl.className = 'success';
		errorEl.textContent = 'Mot de passe changé avec succès.';

		setTimeout(() => {
			$('changePasswordModal').close();
		}, 1500);
	} catch (err) {
		errorEl.className = 'error';
		if (err.code === 'invalid_old_password') {
			errorEl.textContent = 'L\'ancien mot de passe est incorrect.';
		} else if (err.code === 'missing_fields') {
			errorEl.textContent = 'Des champs sont manquants.';
		} else {
			errorEl.textContent = `Erreur: ${err.message}`;
		}
	}
};

// -- Logout ------------------------------------------------------------------
$('logoutBtn').onclick = async () => {
	clearPersistedAdminSession();
	await api('/admin/logout', 'POST');
	location.href = '/admin';
};

// -- Init --------------------------------------------------------------------
window.addEventListener('load', async () => {
	state.drawerCollapsed = readPersistedDrawerState();
	applyDrawerState();
	showSessionActionsOnly();
	setSessionStatus('waiting');

	const status = await api('/admin/auth-status');
	if (!status.authenticated) {
		location.href = '/admin';
		return;
	}

	const persisted = readPersistedAdminSession();
	if (!persisted?.sessionId) return;

	try {
		await hydrateSession(persisted.sessionId, persisted.sessionCode);
	} catch (err) {
		if (err.code === 'session_not_found') {
			clearPersistedAdminSession();
			return;
		}
		console.error(err);
	}
});
