import { $, api, escHtml, hide, sessionCodeFromUrl, show, statusLabel } from '/app-shared.js';

function showError(message) {
	$('endError').textContent = message;
	show('endError');
}

function renderRanking(ranking) {
	$('rankingBody').innerHTML = ranking
		.map((entry, index) => `<tr><td>${index + 1}</td><td>${escHtml(entry.displayName)}</td><td>${entry.score}</td></tr>`)
		.join('');

	$('podiumList').innerHTML = ranking.slice(0, 3)
		.map((entry, index) => `<li><span class="podium-rank">${index + 1}</span><span>${escHtml(entry.displayName)}</span><strong>${entry.score} pt(s)</strong></li>`)
		.join('');
}

async function bootstrap() {
	const code = sessionCodeFromUrl();
	if (!code) {
		showError('Code session manquant pour afficher la fin de partie.');
		return;
	}

	try {
		const details = await api(`/sessions/by-code/${encodeURIComponent(code)}`);
		const rankingPayload = await api(`/sessions/${details.id}/ranking`);
		const ranking = Array.isArray(rankingPayload.ranking) ? rankingPayload.ranking : [];
		const winner = rankingPayload.winner || ranking[0] || null;

		$('endSubtitle').textContent = `Session ${details.code} · Statut ${statusLabel(details.status)}`;
		$('winnerAnnouncement').textContent = winner
			? `${winner.displayName}`
			: 'Aucun gagnant disponible';
		renderRanking(ranking);

		if (!winner) {
			showError('Le classement final est vide ou indisponible.');
			return;
		}

		hide('endError');
	} catch (err) {
		showError(err.code === 'session_not_found'
			? 'Session introuvable.'
			: `Impossible de charger la fin de partie (${err.message}).`);
	}
}

bootstrap();