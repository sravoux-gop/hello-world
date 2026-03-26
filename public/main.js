import {
  $, api, buildPlayerUrl, buildSpectatorUrl, clearActivePlayerSession, escHtml, hide, loadActivePlayerSession,
  loadJoinPrefs, normalizeSessionCode, persistJoinPrefs, sessionCodeFromUrl, show, statusLabel
} from '/app-shared.js';

const state = {
  verifiedSessionCode: '',
  activePlayerSession: null
};

const removedByAdmin = new URLSearchParams(location.search).get('removed') === '1';
const deletedByAdmin = new URLSearchParams(location.search).get('deleted') === '1';

function applyTransientNotice() {
  if (deletedByAdmin) {
    $('verifyError').textContent = 'Cette partie a ete supprimee par l\'admin.';
    show('verifyError');
    return;
  }

  if (removedByAdmin) {
    $('verifyError').textContent = 'Vous avez ete retire de la partie par l\'admin.';
    show('verifyError');
  }
}

function renderActiveSessionNotice(activeSession, status) {
  if (!activeSession?.sessionCode || !activeSession?.playerId) {
    hide('activeSessionNotice');
    $('activeSessionText').textContent = '';
    $('resumePlayerLink').setAttribute('href', '/player');
    return;
  }

  $('activeSessionText').textContent = `${activeSession.pseudo || 'Joueur'} est encore inscrit sur ${activeSession.sessionCode}. Statut: ${statusLabel(status)}`;
  $('resumePlayerLink').setAttribute('href', buildPlayerUrl(activeSession.sessionCode));
  show('activeSessionNotice');
}

function resetRoleChoice() {
  state.verifiedSessionCode = '';
  $('sessionMeta').innerHTML = '';
  hide('sessionMeta');
  hide('roleChoice');
}

function setSessionMeta(details) {
  const qrMarkup = details.qrCodeDataUrl
    ? `<div class="session-meta-qr"><img src="${details.qrCodeDataUrl}" alt="QR code de la session ${escHtml(details.code)}" /><span class="muted">Scanner pour rejoindre</span></div>`
    : '';

  $('sessionMeta').innerHTML = `
    <div class="session-meta-layout">
      <div>
        <strong>${escHtml(details.name || `Session ${details.code}`)}</strong>
        <p class="muted">${statusLabel(details.status)} · ${details.playerCount} joueur(s) inscrit(s)</p>
      </div>
      ${qrMarkup}
    </div>`;
  show('sessionMeta');

  if (details.status === 'stopped') {
    hide('roleChoice');
    $('verifyError').textContent = 'Cette partie est terminee. Les acces joueur et spectateur sont desactives.';
    show('verifyError');
    return;
  }

  show('roleChoice');
}

async function verifySessionCode(showErrors = true) {
  $('verifyError').textContent = '';
  const code = normalizeSessionCode($('sessionCode').value);

  if (!code) {
    if (showErrors) {
      $('verifyError').textContent = 'Veuillez saisir un code de session.';
      show('verifyError');
    }
    resetRoleChoice();
    return null;
  }

  try {
    const details = await api(`/sessions/by-code/${encodeURIComponent(code)}`);
    try {
      const qrPayload = await api(`/sessions/by-code/${encodeURIComponent(details.code)}/qrcode`);
      details.qrCodeDataUrl = qrPayload.dataUrl || '';
    } catch {
      details.qrCodeDataUrl = '';
    }

    state.verifiedSessionCode = details.code;
    $('sessionCode').value = details.code;
    persistJoinPrefs({ sessionCode: details.code });
    setSessionMeta(details);
    return details;
  } catch (err) {
    resetRoleChoice();
    if (showErrors) {
      $('verifyError').textContent = err.code === 'session_not_found'
        ? 'Code session introuvable.'
        : `Erreur : ${err.message}`;
      show('verifyError');
    }
    return null;
  }
}

async function refreshActivePlayerSession() {
  const activeSession = loadActivePlayerSession();
  if (!activeSession) {
    renderActiveSessionNotice(null);
    return;
  }

  try {
    const payload = await api(`/sessions/${activeSession.sessionId}/players/${activeSession.playerId}`);
    state.activePlayerSession = activeSession;
    renderActiveSessionNotice(activeSession, payload.status);
  } catch (err) {
    if (err.code === 'session_not_found' || err.code === 'player_not_found') {
      clearActivePlayerSession();
      renderActiveSessionNotice(null);
      return;
    }
    renderActiveSessionNotice(activeSession, 'waiting');
  }
}

async function leaveCurrentSession() {
  const activeSession = loadActivePlayerSession();
  if (!activeSession) return;

  try {
    await api(`/sessions/${activeSession.sessionId}/players/${activeSession.playerId}`, 'DELETE');
  } catch (err) {
    if (!['session_not_found', 'player_not_found'].includes(err.code)) {
      throw err;
    }
  }

  clearActivePlayerSession();
  renderActiveSessionNotice(null);
  if (normalizeSessionCode($('sessionCode').value) === activeSession.sessionCode) {
    resetRoleChoice();
  }
}

$('verifyCodeBtn').addEventListener('click', async () => {
  await verifySessionCode(true);
});

$('sessionCode').addEventListener('input', () => {
  state.verifiedSessionCode = '';
  persistJoinPrefs({ sessionCode: $('sessionCode').value });
  resetRoleChoice();
});

$('playerModeBtn').addEventListener('click', () => {
  if (!state.verifiedSessionCode) {
    $('verifyError').textContent = 'Veuillez verifier un code valide avant de continuer.';
    show('verifyError');
    return;
  }

  location.href = buildPlayerUrl(state.verifiedSessionCode);
});

$('spectatorBtn').addEventListener('click', () => {
  if (!state.verifiedSessionCode) {
    $('verifyError').textContent = 'Veuillez verifier un code valide avant de continuer.';
    show('verifyError');
    return;
  }

  location.href = buildSpectatorUrl(state.verifiedSessionCode);
});

$('leaveSessionBtn').addEventListener('click', async () => {
  $('verifyError').textContent = '';
  hide('verifyError');
  try {
    await leaveCurrentSession();
  } catch (err) {
    $('verifyError').textContent = `Erreur : ${err.message}`;
    show('verifyError');
  }
});

const prefilledCode = sessionCodeFromUrl();
const storedPrefs = loadJoinPrefs();
const activeSession = loadActivePlayerSession();

if (prefilledCode) {
  $('sessionCode').value = prefilledCode;
} else if (activeSession?.sessionCode) {
  $('sessionCode').value = activeSession.sessionCode;
} else if (storedPrefs?.sessionCode) {
  $('sessionCode').value = storedPrefs.sessionCode;
}

refreshActivePlayerSession();

if (prefilledCode) {
  verifySessionCode(false).finally(() => {
    applyTransientNotice();
  });
} else {
  $('sessionCode').focus();
  applyTransientNotice();
}
