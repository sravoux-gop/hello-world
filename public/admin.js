const state = {
  sessionId: '',
  sessionCode: '',
  ws: null
};

const byId = (id) => document.getElementById(id);
const logEl = byId('log');

function log(message) {
  logEl.textContent = `${new Date().toLocaleTimeString()} - ${message}\n${logEl.textContent}`;
}

function setRanking(ranking) {
  const body = byId('rankingBody');
  body.innerHTML = ranking
    .map((entry) => `<tr><td>${entry.displayName}</td><td>${entry.score}</td></tr>`)
    .join('');
}

function setStats(payload) {
  if (typeof payload.connectedPlayers === 'number') {
    byId('connectedPlayers').textContent = String(payload.connectedPlayers);
  }
  if (typeof payload.registeredPlayers === 'number') {
    byId('registeredPlayers').textContent = String(payload.registeredPlayers);
  }
}

function setBuzz(payload) {
  byId('buzzPlayer').textContent = payload?.playerName ?? '-';
  byId('buzzProposal').textContent = payload?.proposal ? JSON.stringify(payload.proposal) : '-';
}

async function api(path, method = 'GET', payload) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erreur API');
  }

  return data;
}

function connectWs() {
  if (!state.sessionId) {
    return;
  }

  state.ws?.close();
  const wsUrl = new URL(location.origin.replace('http', 'ws'));
  wsUrl.searchParams.set('sessionId', state.sessionId);
  wsUrl.searchParams.set('admin', '1');

  state.ws = new WebSocket(wsUrl);
  state.ws.onopen = () => log('WebSocket admin connecté');
  state.ws.onclose = () => log('WebSocket admin fermé');
  state.ws.onmessage = (event) => {
    const { event: type, payload } = JSON.parse(event.data);
    log(`${type}: ${JSON.stringify(payload)}`);

    if (type === 'ranking.updated') {
      setRanking(payload.ranking);
    }

    if (type === 'players.connected.updated') {
      setStats(payload);
    }

    if (type === 'buzz.locked') {
      setBuzz(payload);
    }
  };
}

async function refreshStats() {
  if (!state.sessionId) {
    return;
  }

  const data = await api(`/admin/api/sessions/${state.sessionId}/stats`);
  setStats(data);

  if (data.currentBuzzPlayer) {
    setBuzz({
      playerName: data.currentBuzzPlayer.displayName,
      proposal: data.currentBuzzProposal
    });
  }
}

byId('createSessionBtn').onclick = async () => {
  const data = await api('/admin/api/sessions', 'POST');
  state.sessionId = data.id;
  state.sessionCode = data.code;
  byId('sessionId').textContent = state.sessionId;
  byId('sessionCode').textContent = state.sessionCode;
  log(`Session créée: ${state.sessionId} (code ${state.sessionCode})`);

  connectWs();
  await refreshStats();
};

byId('startBtn').onclick = async () => {
  await api(`/admin/api/sessions/${state.sessionId}/start`, 'POST');
  log('Partie démarrée');
};

byId('stopBtn').onclick = async () => {
  await api(`/admin/api/sessions/${state.sessionId}/stop`, 'POST');
  log('Partie stoppée');
};

byId('launchRoundBtn').onclick = async () => {
  await api(`/admin/api/sessions/${state.sessionId}/rounds`, 'POST', {
    title: byId('roundTitle').value,
    artist: byId('roundArtist').value,
    year: Number(byId('roundYear').value),
    yearBonus: Number(byId('roundYearBonus').value || 0)
  });

  log('Session musicale lancée');
};

byId('acceptBtn').onclick = async () => {
  const data = await api(`/admin/api/sessions/${state.sessionId}/decision`, 'POST', { decision: 'accepted' });
  setRanking(data.ranking);
  setBuzz(null);
  log(`Décision: accepted (delta ${data.scoreDelta})`);
};

byId('rejectBtn').onclick = async () => {
  const data = await api(`/admin/api/sessions/${state.sessionId}/decision`, 'POST', { decision: 'rejected' });
  setRanking(data.ranking);
  setBuzz(null);
  log(`Décision: rejected (delta ${data.scoreDelta})`);
};

byId('logoutBtn').onclick = async () => {
  await api('/admin/logout', 'POST');
  location.href = '/admin';
};

window.addEventListener('load', async () => {
  const status = await api('/admin/auth-status');
  if (!status.authenticated) {
    location.href = '/admin';
  }
});
