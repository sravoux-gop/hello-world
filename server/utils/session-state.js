import { displayName, serializePlayer, serializeRanking } from './players.js';

export function connectedPlayersPayload(session) {
  return {
    connectedPlayers: session.connectedPlayerIds.size,
    registeredPlayers: session.players.length
  };
}

export function winnerFromSession(session) {
  const ranking = serializeRanking(session);
  return ranking.length > 0 ? ranking[0] : null;
}

export function buildSessionSnapshot(session) {
  const currentBuzzPlayer = session.players.find((entry) => entry.id === session.currentBuzzPlayerId) ?? null;

  return {
    sessionId: session.id,
    sessionCode: session.code,
    status: session.status,
    ranking: serializeRanking(session),
    winner: session.status === 'stopped' ? winnerFromSession(session) : null,
    buzzLocked: Boolean(session.buzzLocked),
    currentBuzzPlayerId: session.currentBuzzPlayerId ?? null,
    currentBuzzPlayerName: currentBuzzPlayer ? displayName(currentBuzzPlayer) : null,
    currentBuzzPlayerAvatar: currentBuzzPlayer?.avatar ?? null,
    currentBuzzProposal: session.currentBuzzProposal ?? null,
    currentRound: session.currentRound ?? null,
    lastDecision: session.lastDecision ?? null,
    ...connectedPlayersPayload(session)
  };
}

export { displayName, serializePlayer, serializeRanking };