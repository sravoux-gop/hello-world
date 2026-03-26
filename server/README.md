# Backend README

## Objectif

Le backend du projet pilote :

- les routes HTTP publiques et admin,
- l'authentification admin,
- la gestion des sessions de jeu en memoire,
- la persistance JSON sur disque,
- la bibliotheque de playlists CSV,
- la diffusion temps reel via WebSocket.

Le point d'entree applicatif est [index.js](c:/Projets/Quiz/hello-world/server/index.js).

## Organisation

### Bootstrap

- [index.js](c:/Projets/Quiz/hello-world/server/index.js)
  - cree l'application Express,
  - initialise l'etat memoire,
  - charge les donnees persistantes,
  - assemble les services et les routeurs,
  - demarre le serveur HTTP,
  - attache le serveur WebSocket.

### Configuration

- [config.js](c:/Projets/Quiz/hello-world/server/config.js)
  - chemins serveur,
  - port,
  - mot de passe admin,
  - limites de taille avatar et upload playlist.

### Routes

- [routes/page-routes.js](c:/Projets/Quiz/hello-world/server/routes/page-routes.js)
  - sert les vues HTML publiques et admin.
- [routes/admin-auth-routes.js](c:/Projets/Quiz/hello-world/server/routes/admin-auth-routes.js)
  - login, logout, statut d'authentification admin.
- [routes/admin-playlist-routes.js](c:/Projets/Quiz/hello-world/server/routes/admin-playlist-routes.js)
  - bibliotheque de playlists serveur.
- [routes/admin-session-routes.js](c:/Projets/Quiz/hello-world/server/routes/admin-session-routes.js)
  - creation, pilotage, stats, playlist de session, decisions admin.
- [routes/public-session-routes.js](c:/Projets/Quiz/hello-world/server/routes/public-session-routes.js)
  - recherche publique de session, QR code, profil joueur, classement.
- [routes/player-routes.js](c:/Projets/Quiz/hello-world/server/routes/player-routes.js)
  - join joueur, profil, suppression joueur, buzz.

### Services

- [services/admin-auth.js](c:/Projets/Quiz/hello-world/server/services/admin-auth.js)
  - tokens admin en memoire,
  - lecture cookie/header,
  - middleware de protection.
- [services/persistence.js](c:/Projets/Quiz/hello-world/server/services/persistence.js)
  - chargement/sauvegarde des sessions,
  - chargement/sauvegarde de la bibliotheque de playlists,
  - lecture/ecriture des CSV playlists.
- [services/game.js](c:/Projets/Quiz/hello-world/server/services/game.js)
  - logique metier de session, manche, buzz et score.
- [services/websocket.js](c:/Projets/Quiz/hello-world/server/services/websocket.js)
  - gestion des groupes de sockets,
  - diffusion des evenements,
  - synchronisation initiale a la connexion.

### Utilitaires

- [utils/ids.js](c:/Projets/Quiz/hello-world/server/utils/ids.js)
  - UUID et code session.
- [utils/playlist.js](c:/Projets/Quiz/hello-world/server/utils/playlist.js)
  - parsing CSV, serialisation CSV, nommage des fichiers.
- [utils/players.js](c:/Projets/Quiz/hello-world/server/utils/players.js)
  - creation et serialisation des joueurs.
- [utils/session-state.js](c:/Projets/Quiz/hello-world/server/utils/session-state.js)
  - snapshot de session, classement, compteurs, gagnant.
- [utils/http.js](c:/Projets/Quiz/hello-world/server/utils/http.js)
  - helpers requete/reponse et URL de jointure.

## Etat en memoire

L'application assemble explicitement un objet d'etat partage contenant :

- `sessions: Map`
- `sessionSockets: Map`
- `adminTokens: Set`
- `playlistLibrary: Array`

Ce choix permet de garder un refactor conservateur : pas de singleton cache dans plusieurs modules, pas de rupture des contrats existants.

## Persistance

Fichiers utilises :

- [data/sessions.json](c:/Projets/Quiz/hello-world/server/data/sessions.json)
- [data/playlists.json](c:/Projets/Quiz/hello-world/server/data/playlists.json)
- [data/playlists](c:/Projets/Quiz/hello-world/server/data/playlists)

Le backend recharge ces donnees au demarrage et les reecrit apres les operations qui modifient l'etat.

## Demarrage

Depuis la racine du projet :

```bash
npm install
npm start
```

Verification syntaxique utile :

```bash
node --check server/index.js
```

## Variables d'environnement

- `PORT` : port HTTP du serveur, par defaut `3000`
- `ADMIN_PASSWORD` : mot de passe admin, par defaut `admin123`

## Contrats a preserver

Les points suivants doivent rester stables lors des prochains refactors :

- URLs et methodes HTTP existantes,
- noms d'evenements WebSocket,
- payloads JSON consommes par le front,
- regle de score,
- ordre du classement,
- format des fichiers JSON de persistance.

En pratique, avant toute evolution, verifier la compatibilite avec :

- [../public/admin.js](c:/Projets/Quiz/hello-world/public/admin.js)
- [../public/main.js](c:/Projets/Quiz/hello-world/public/main.js)
- [../public/player.js](c:/Projets/Quiz/hello-world/public/player.js)
- [../public/spectator.js](c:/Projets/Quiz/hello-world/public/spectator.js)

## Evolution recommandee

Si le backend continue de grossir, la suite logique est :

1. ajouter des tests unitaires sur le parsing CSV, le calcul de score et les serialiseurs,
2. isoler davantage les regles de session/joueur dans des modules de domaine,
3. documenter les payloads WebSocket si plusieurs clients doivent consommer l'API.