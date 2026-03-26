export function createWebsocketService({ state, buildSessionSnapshot, connectedPlayersPayload }) {
	function socketGroup(sessionId) {
		if (!state.sessionSockets.has(sessionId)) {
			state.sessionSockets.set(sessionId, new Set());
		}

		return state.sessionSockets.get(sessionId);
	}

	function broadcast(sessionId, event, payload = {}) {
		const message = JSON.stringify({ event, payload });
		for (const ws of socketGroup(sessionId)) {
			if (ws.readyState === ws.OPEN) {
				ws.send(message);
			}
		}
	}

	function handleConnection(ws, req) {
		const url = new URL(req.url, `http://${req.headers.host}`);
		const sessionId = url.searchParams.get('sessionId');
		const playerId = url.searchParams.get('playerId');

		if (!sessionId || !state.sessions.has(sessionId)) {
			ws.close(1008, 'missing_or_invalid_session');
			return;
		}

		const session = state.sessions.get(sessionId);
		const peers = socketGroup(sessionId);
		peers.add(ws);

		ws.send(JSON.stringify({ event: 'session.state', payload: buildSessionSnapshot(session) }));

		if (playerId && session.players.some((entry) => entry.id === playerId)) {
			session.connectedPlayerIds.add(playerId);
			broadcast(session.id, 'players.connected.updated', connectedPlayersPayload(session));
		}

		ws.on('close', () => {
			peers.delete(ws);

			if (playerId && session.connectedPlayerIds.has(playerId)) {
				session.connectedPlayerIds.delete(playerId);
				broadcast(session.id, 'players.connected.updated', connectedPlayersPayload(session));
			}
		});
	}

	return {
		broadcast,
		handleConnection
	};
}