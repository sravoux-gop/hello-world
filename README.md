# Blind Test App – MVP (Node.js + WebSocket)

Prototype fonctionnel pour un blind test temps réel avec :

- page d'accueil dédiée (`/`) avec verification du code session,
- vue joueur dédiée (`/player`),
- vue spectateur dédiée (`/spectator`),
- vue fin de partie dédiée (`/end`),
- interface admin dédiée (`/admin`) protégée par mot de passe serveur,
- pseudo joueur unique par partie,
- création de partie, démarrage/arrêt, lancement de manche musicale,
- bibliothèque de playlists CSV persistées sur le serveur (upload + chargement depuis l'admin),
- suivi des joueurs connectés,
- notification du premier buzz avec proposition,
- validation/refus par l'admin et classement en direct via WebSocket,
- annonce du gagnant en fin de partie,
- persistance JSON serveur (sessions, playlist, joueurs, scores),
- mémorisation locale du code/pseudo joueur et de la session admin active.

## Lancer le projet

```bash
npm install
npm start
```

Puis ouvrir :

- Accueil : `http://localhost:3000/`
- Joueur : `http://localhost:3000/player?session=CODE`
- Spectateur : `http://localhost:3000/spectator?session=CODE`
- Fin : `http://localhost:3000/end?session=CODE`
- Admin : `http://localhost:3000/admin`

## Documentation produit

Les specifications ecran par ecran sont disponibles dans [docs](c:/Projets/Quiz/hello-world/docs) :

- [00-navigation-et-regles.md](c:/Projets/Quiz/hello-world/docs/00-navigation-et-regles.md)
- [01-ecran-accueil.md](c:/Projets/Quiz/hello-world/docs/01-ecran-accueil.md)
- [02-ecran-joueur.md](c:/Projets/Quiz/hello-world/docs/02-ecran-joueur.md)
- [03-ecran-spectateur.md](c:/Projets/Quiz/hello-world/docs/03-ecran-spectateur.md)
- [04-ecran-fin-de-partie.md](c:/Projets/Quiz/hello-world/docs/04-ecran-fin-de-partie.md)
- [05-ecran-admin.md](c:/Projets/Quiz/hello-world/docs/05-ecran-admin.md)
- [06-design-system.md](c:/Projets/Quiz/hello-world/docs/06-design-system.md)
- [07-wireframes-de-reference.md](c:/Projets/Quiz/hello-world/docs/07-wireframes-de-reference.md)

## Variables d'environnement

- `PORT` (défaut `3000`)
- `ADMIN_PASSWORD` (défaut `admin123`)

## API disponible

## Vues publiques

- `GET /` : accueil, verification du code session et choix du role
- `GET /player?session=CODE` : vue joueur (pseudo obligatoire)
- `GET /spectator?session=CODE` : vue spectateur
- `GET /end?session=CODE` : vue fin de partie

### Admin (protégée)

- `POST /admin/login`
- `POST /admin/logout`
- `GET /admin/auth-status`
- `POST /admin/api/sessions`
- `GET /admin/api/sessions/:id`
- `POST /admin/api/sessions/:id/start`
- `POST /admin/api/sessions/:id/stop`
- `POST /admin/api/sessions/:id/rounds`
- `GET /admin/api/playlists/library`
- `POST /admin/api/playlists/library`
- `POST /admin/api/sessions/:id/playlist/load`
- `GET /admin/api/sessions/:id/stats`
- `POST /admin/api/sessions/:id/decision`

### Joueur

- `GET /sessions/by-code/:code`
- `GET /sessions/by-code/:code/qrcode`
- `POST /sessions/join` (code session + pseudo unique)
- `GET /sessions/:id/players/:playerId`
- `PUT /sessions/:id/players/:playerId/profile`
- `DELETE /sessions/:id/players/:playerId`
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

- Persistance JSON serveur dans `server/data/sessions.json`.
- Bibliothèque de playlists serveur dans `server/data/playlists/` et `server/data/playlists.json`.
- Le client joueur mémorise `code session` et `pseudo` en stockage local navigateur.
- Le client joueur mémorise aussi sa session active pour reprise sur la vue Joueur et pour quitter proprement la partie.
- Le client admin mémorise la session active pour reprise après F5/retour page.
- Auth admin gérée côté serveur via cookie HTTP-only après login.

## Déploiement Azure (PowerShell)

Un script interactif et paramétrable est disponible : `scripts/deploy-azure.ps1`.

### Prérequis

- Azure CLI (`az`)
- PowerShell 7+
- Node.js / npm

### Exemple (interactif)

```powershell
pwsh -File ./scripts/deploy-azure.ps1
```

### Exemple (paramétré)

```powershell
pwsh -File ./scripts/deploy-azure.ps1 \
  -SubscriptionId "<subscription-id>" \
  -ResourceGroup "rg-blindtest-prod" \
  -Location "westeurope" \
  -AppName "blindtest-prod-12345" \
  -PlanName "asp-blindtest-prod" \
  -Sku "B1" \
  -Runtime "NODE:20-lts" \
  -AdminPassword "<mot-de-passe-admin>"
```

Le script :
- crée/met à jour le Resource Group,
- crée/met à jour l'App Service Plan Linux,
- crée/met à jour la Web App,
- configure les variables d'environnement,
- déploie l'application sur Azure App Service.
