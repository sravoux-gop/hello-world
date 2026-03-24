const state = {
  sessionId: '',
  playerId: '',
  adminToken: '',
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
    .map((entry) => `<tr><td>${entry.firstName} ${entry.lastName}</td><td>${entry.score}</td></tr>`)
    .join('');
}

async function api(path, method = 'GET', payload) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.adminToken) {
    headers.Authorization = `Bearer ${state.adminToken}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erreur API');
  }

  return data;
}

byId('connectBtn').onclick = () => {
  state.sessionId = byId('sessionId').value;
  state.ws?.close();
  state.ws = new WebSocket(`${location.origin.replace('http', 'ws')}?sessionId=${state.sessionId}`);

  state.ws.onopen = () => log('WebSocket connecté');
  state.ws.onmessage = (event) => {
    const { event: type, payload } = JSON.parse(event.data);
    log(`${type}: ${JSON.stringify(payload)}`);
    if (type === 'ranking.updated') {
      setRanking(payload.ranking);
    }
  };
  state.ws.onclose = () => log('WebSocket fermé');
};

byId('loginBtn').onclick = async () => {
  const data = await api('/admin/login', 'POST', { password: byId('adminPassword').value });
  state.adminToken = data.token;
  byId('adminToken').textContent = state.adminToken;
  log('Admin connecté');
};

byId('createSessionBtn').onclick = async () => {
  const data = await api('/sessions', 'POST');
  state.sessionId = data.id;
  byId('sessionId').value = state.sessionId;
  log(`Session créée: ${data.id} (code ${data.code})`);
};

byId('startBtn').onclick = async () => {
  await api(`/sessions/${state.sessionId}/start`, 'POST');
  log('Session démarrée');
};

byId('stopBtn').onclick = async () => {
  await api(`/sessions/${state.sessionId}/stop`, 'POST');
  log('Session stoppée');
};

byId('joinBtn').onclick = async () => {
  const data = await api(`/sessions/${state.sessionId}/players`, 'POST', {
    firstName: byId('firstName').value,
    lastName: byId('lastName').value
  });

  state.playerId = data.playerId;
  byId('playerId').textContent = state.playerId;
  log(`Joueur inscrit: ${state.playerId}`);
};

byId('buzzBtn').onclick = async () => {
  await api(`/sessions/${state.sessionId}/buzz`, 'POST', { playerId: state.playerId });
  log('Buzz envoyé');
};

byId('acceptBtn').onclick = async () => {
  const data = await api(`/sessions/${state.sessionId}/decision`, 'POST', { decision: 'accepted' });
  setRanking(data.ranking);
  log('Décision: accepted');
};

byId('rejectBtn').onclick = async () => {
  const data = await api(`/sessions/${state.sessionId}/decision`, 'POST', { decision: 'rejected' });
  setRanking(data.ranking);
  log('Décision: rejected');
};
