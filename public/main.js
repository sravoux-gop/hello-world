const state = {
  sessionId: '',
  sessionCode: '',
  playerId: '',
  pseudo: '',
  ws: null
};

const byId = (id) => document.getElementById(id);
const logEl = byId('log');

function log(message) {
  logEl.textContent = `${new Date().toLocaleTimeString()} - ${message}\n${logEl.textContent}`;
}

function setStatus(status) {
  byId('sessionStatus').textContent = status;
}

function setWinner(winner) {
  if (!winner) {
    byId('winnerBox').textContent = '';
    return;
  }

  byId('winnerBox').textContent = `🏆 Gagnant: ${winner.displayName} (${winner.score} pts)`;
}

function setDecisionMessage(payload) {
  if (!payload) {
    byId('decisionMessage').textContent = '';
    return;
  }

  const action = payload.decision === 'accepted' ? 'validée' : 'refusée';
  byId('decisionMessage').textContent = `Votre réponse a été ${action} (${payload.scoreDelta > 0 ? '+' : ''}${payload.scoreDelta}).`;
}

function setRanking(ranking) {
  const body = byId('rankingBody');
  body.innerHTML = ranking
    .map((entry) => `<tr><td>${entry.displayName}</td><td>${entry.score}</td></tr>`)
    .join('');

  const me = ranking.find((entry) => entry.id === state.playerId);
  if (me) {
    byId('myScore').textContent = String(me.score);
  }
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
  if (!state.sessionId || !state.playerId) {
    return;
  }

  const wsUrl = new URL(location.origin.replace('http', 'ws'));
  wsUrl.searchParams.set('sessionId', state.sessionId);
  wsUrl.searchParams.set('playerId', state.playerId);

  state.ws?.close();
  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => log('WebSocket connecté');
  state.ws.onmessage = (event) => {
    const { event: type, payload } = JSON.parse(event.data);
    log(`${type}: ${JSON.stringify(payload)}`);

    if (type === 'session.started') {
      setStatus('démarrée');
    }

    if (type === 'round.started') {
      setDecisionMessage(null);
    }

    if (type === 'ranking.updated') {
      setRanking(payload.ranking);
    }

    if (type === 'buzz.decided' && payload.playerId === state.playerId) {
      setDecisionMessage(payload);
    }

    if (type === 'session.stopped') {
      setStatus('terminée');
      setWinner(payload.winner);
      if (payload.ranking) {
        setRanking(payload.ranking);
      }
    }
  };

  state.ws.onclose = () => log('WebSocket fermé');
}

byId('joinBtn').onclick = async () => {
  try {
    const data = await api('/sessions/join', 'POST', {
      code: byId('sessionCode').value,
      pseudo: byId('pseudo').value
    });

    state.sessionId = data.sessionId;
    state.sessionCode = data.sessionCode;
    state.playerId = data.playerId;
    state.pseudo = data.pseudo;

    byId('sessionId').textContent = state.sessionId;
    byId('playerId').textContent = state.playerId;
    byId('playerPseudo').textContent = state.pseudo;
    setStatus(data.status === 'running' ? 'démarrée' : 'en attente');
    setWinner(null);

    log(`Joueur inscrit: ${state.pseudo} (${state.playerId})`);
    connectWs();

    const ranking = await api(`/sessions/${state.sessionId}/ranking`);
    setRanking(ranking.ranking);
    if (ranking.winner) {
      setWinner(ranking.winner);
    }
  } catch (error) {
    log(`Erreur join: ${error.message}`);
  }
};

byId('buzzBtn').onclick = async () => {
  try {
    await api(`/sessions/${state.sessionId}/buzz`, 'POST', {
      playerId: state.playerId,
      proposal: {
        title: byId('guessTitle').value,
        artist: byId('guessArtist').value,
        year: byId('guessYear').value
      }
    });
    log('Buzz envoyé');
  } catch (error) {
    log(`Erreur buzz: ${error.message}`);
  }
};
