# Blind Test App – MVP (Node.js + WebSocket)

Prototype fonctionnel pour un blind test temps réel avec :
- interface joueur dédiée (`/`),
- interface admin dédiée (`/admin`) protégée par mot de passe serveur,
- pseudo joueur unique par partie,
- création de partie, démarrage/arrêt, lancement de manche musicale,
- suivi des joueurs connectés,
- notification du premier buzz avec proposition,
- validation/refus par l'admin et classement en direct via WebSocket,
- annonce du gagnant en fin de partie,
- stockage en mémoire (MVP).

## Lancer le projet

```bash
npm install
npm start
```

Puis ouvrir :
- Joueur : `http://localhost:3000/`
- Admin : `http://localhost:3000/admin`

## Variables d'environnement
- `PORT` (défaut `3000`)
- `ADMIN_PASSWORD` (défaut `admin123`)

## API disponible

### Admin (protégée)
- `POST /admin/login`
- `POST /admin/logout`
- `GET /admin/auth-status`
- `POST /admin/api/sessions`
- `POST /admin/api/sessions/:id/start`
- `POST /admin/api/sessions/:id/stop`
- `POST /admin/api/sessions/:id/rounds`
- `GET /admin/api/sessions/:id/stats`
- `POST /admin/api/sessions/:id/decision`

### Joueur
- `POST /sessions/join` (code session + pseudo unique)
- `POST /sessions/:id/buzz`
- `GET /sessions/:id/ranking`

### WebSocket
Connexion sur `ws://host:port/?sessionId=<SESSION_ID>&playerId=<PLAYER_ID>`.

Événements émis :
- `session.started`
- `session.stopped` (inclut le gagnant)
- `round.started`
- `players.connected.updated`
- `buzz.locked`
- `buzz.decided`
- `ranking.updated`

## Notes
- Pas de persistance disque/DB : redémarrage serveur = perte des sessions.
- Auth admin gérée côté serveur via cookie HTTP-only après login.
