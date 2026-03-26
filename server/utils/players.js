import { uuid } from './ids.js';

export function normalizePseudo(value = '') {
	return value.trim().toLowerCase();
}

export function displayName(player) {
	if (player.pseudo) {
		return player.pseudo;
	}

	return `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();
}

export function serializePlayer(player, includeAvatar = false) {
	return {
		id: player.id,
		pseudo: player.pseudo,
		displayName: displayName(player),
		score: player.score,
		joinedAt: player.joinedAt,
		devise: player.devise ?? null,
		...(includeAvatar ? { avatar: player.avatar ?? null } : {})
	};
}

export function serializeRanking(session) {
	return [...session.players]
		.sort((left, right) => right.score - left.score || left.joinedAt - right.joinedAt)
		.map((player) => serializePlayer(player, true));
}

export function createPlayer(pseudo) {
	return {
		id: uuid(),
		pseudo: String(pseudo).trim(),
		joinedAt: Date.now(),
		score: 0,
		avatar: null,
		devise: null
	};
}