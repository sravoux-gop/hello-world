# Blind Test App – MVP implémenté (Node.js + WebSocket)

Prototype fonctionnel pour un blind test temps réel avec :
- interface joueur (inscription + buzzer),
- interface admin (création de session, start/stop, décision +1/-1),
- classement mis à jour en direct via WebSocket,
- stockage en mémoire (MVP).

## Lancer le projet

```bash
npm install
npm start
```

Puis ouvrir `http://localhost:3000`.

## Variables d'environnement
- `PORT` (défaut `3000`)
- `ADMIN_PASSWORD` (défaut `admin123`)

## API disponible

### HTTP
- `POST /admin/login`
- `POST /sessions` (admin)
- `POST /sessions/:id/start` (admin)
- `POST /sessions/:id/stop` (admin)
- `POST /sessions/:id/players`
- `POST /sessions/:id/buzz`
- `POST /sessions/:id/decision` (admin)
- `GET /sessions/:id/ranking`

### WebSocket
Connexion sur `ws://host:port/?sessionId=<SESSION_ID>`.

Événements émis :
- `session.started`
- `buzz.locked`
- `buzz.decided`
- `ranking.updated`
- `session.stopped`

## Notes
- Pas de persistance disque/DB : redémarrage serveur = perte des sessions.
- Cette base couvre le MVP et peut ensuite être branchée sur Azure App Service + Static Web Apps.
