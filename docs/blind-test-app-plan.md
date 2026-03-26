# Projet : Application Blind Test (web mobile) hébergée sur Azure

## 1) Objectif

Créer une application **accessible depuis Android/iOS via navigateur**, avec un **buzzer en temps réel**, un **admin** qui valide/refuse, et un **classement visible en continu**.

## 2) Contraintes et hypothèses

- Charge cible : **10 à 100 joueurs** simultanés par partie.
- Déploiement simple, coût réduit.
- Pas de base de données managée coûteuse (ex: PostgreSQL managé).
- La perte de partie en cas de redémarrage serveur est acceptable pour un MVP (option persistance légère possible).

## Documentation produit

Les specifications detaillees sont maintenues dans les documents suivants :

- [00-navigation-et-regles.md](/docs/00-navigation-et-regles.md)
- [01-ecran-accueil.md](/docs/01-ecran-accueil.md)
- [02-ecran-joueur.md](/docs/02-ecran-joueur.md)
- [03-ecran-spectateur.md](/docs/03-ecran-spectateur.md)
- [04-ecran-fin-de-partie.md](/docs/04-ecran-fin-de-partie.md)
- [05-ecran-admin.md](/docs/05-ecran-admin.md)
- [06-design-system.md](/docs/06-design-system.md)
- [07-wireframes-de-reference.md](/docs/07-wireframes-de-reference.md)

---

## 3) Architecture cible la plus simple (recommandée)

### 3.1 Vue d'ensemble

1. **Front unique (PWA)** : une application web responsive avec 2 vues (joueur + admin).
2. **Back unique** : API HTTP + WebSocket dans un seul service Node.js.
3. **Stockage d'état en mémoire** (RAM) par partie : joueurs, scores, buzz en cours.
4. **Déploiement Azure minimal** :
   - Front : **Azure Static Web Apps**
   - Back : **Azure App Service (1 instance)**

> Pourquoi ce choix : très peu de composants, mise en production rapide, coût minimal, suffisant pour 10-100 joueurs.

### 3.2 Option persistance légère (facultative)

Si vous voulez conserver les résultats après redémarrage sans DB coûteuse :

- Ajouter **Azure Table Storage** uniquement pour stocker les scores finaux et l'historique de parties.

### 3.3 Stack UI/UX recommandée (MVP)

- **Base CSS** : **Pico.css** pour obtenir rapidement une interface propre, responsive et cohérente sans pipeline de build.
- **Icônes** : **Bootstrap Icons** pour les actions d'interface courantes (lecture, navigation, validation, arrêt, QR code, classement).
- **JavaScript UI** : rester en **JavaScript vanilla** ; aucun framework frontend n'est requis pour le MVP.
- **Personnalisation** : ajouter une petite feuille de style locale pour les couleurs métier, les états de buzz et les composants spécifiques.

> Pourquoi ce choix : coût d'intégration faible, poids limité, courbe d'apprentissage faible, compatibilité immédiate avec des pages HTML simples côté joueur et côté admin.

---

## 4) Organisation de la specification fonctionnelle

Le present document reste volontairement transverse et ne porte plus les specifications d'ecran detaillees.

- Les regles de navigation, de persistance locale et les principes communs sont documentes dans [00-navigation-et-regles.md](/docs/00-navigation-et-regles.md).
- Les specifications par ecran sont documentees dans [01-ecran-accueil.md](/docs/01-ecran-accueil.md), [02-ecran-joueur.md](/docs/02-ecran-joueur.md), [03-ecran-spectateur.md](/docs/03-ecran-spectateur.md), [04-ecran-fin-de-partie.md](/docs/04-ecran-fin-de-partie.md) et [05-ecran-admin.md](/docs/05-ecran-admin.md).
- Les regles visuelles et de composants sont documentees dans [06-design-system.md](/docs/06-design-system.md).
- Les wireframes de cadrage sont documentes dans [07-wireframes-de-reference.md](/docs/07-wireframes-de-reference.md).

Synthese du parcours cible :

1. L'accueil est l'entree publique unique et gere la verification du code session.
2. Le joueur rejoint via une vue dediee avec pseudo obligatoire, profil facultatif et interface de buzz.
3. Le spectateur consulte une vue en lecture seule avec etat de partie et classement temps reel.
4. La fin de partie est une sortie commune pour les clients publics quand l'admin arrete la session.
5. L'admin pilote la session, le QR code, la playlist et les decisions de buzz depuis sa vue dediee.

---

## 5) Règles métier

### 5.1 Etats fonctionnels d'une partie

Une partie doit etre comprise comme la combinaison d'un etat de session global et d'un etat de manche.

1. `Pas encore creee`
  - aucune session active cote admin,
  - aucun code secret,
  - aucun QR code,
  - aucun joueur ne peut rejoindre.
2. `Creee, en attente de demarrer`
  - `status = waiting`,
  - code secret et QR code disponibles,
  - les joueurs peuvent rejoindre,
  - aucun buzz possible.
3. `Creee, demarree, sans lecture en cours`
  - `status = running`,
  - `currentRound = null`,
  - les joueurs peuvent rejoindre,
  - aucun buzz possible.
4. `Creee, demarree, lecture en cours`
  - `status = running`,
  - `currentRound != null`,
  - `buzzLocked = false`,
  - les joueurs peuvent rejoindre et buzzer.
5. `Creee, demarree, buzz verrouille`
  - `status = running`,
  - `currentRound != null`,
  - `buzzLocked = true`,
  - les joueurs peuvent rejoindre,
  - les autres buzz sont refuses tant que l'admin n'a pas decide.
6. `Partie terminee`
  - `status = stopped`,
  - le code secret ne permet plus de rejoindre,
  - aucun buzz possible,
  - les clients publics basculent vers la fin de partie.

### 5.2 Regles de jeu

1. Le code secret existe des la creation de session et reste valable tant que `status !== stopped`.
2. Un joueur peut rejoindre une session si et seulement si la session existe et que `status !== stopped`.
3. Un buzz n'est autorise que si `status === running`, `currentRound != null` et `buzzLocked === false`.
4. Premier buzz recu cote serveur => `buzzLocked = true`.
5. Tant que l'admin n'a pas decide, les autres buzz sont refuses.
6. Decision admin :
  - `accepted` => +1,
  - `rejected` => -1.
7. Apres decision, la session reste `running`, mais le buzz redevient possible seulement quand une nouvelle manche est lancee ou si les regles produit autorisent explicitement de poursuivre la manche courante.
8. Classement : tri `score DESC`, puis `joinedAt ASC`.
9. Le classement est diffuse a tous les joueurs **a chaque decision** en temps reel.

---

## 6) Modèle d'état (en mémoire)

```ts
type Track = {
  id: string;
  title: string;
  artist: string;
  year: number;
  yearBonus: number;
};

type SessionState = {
  id: string;
  code: string;
  status: 'waiting' | 'running' | 'stopped';
  buzzLocked: boolean;
  currentBuzzPlayerId?: string;
  currentBuzzProposal?: { title?: string; artist?: string; year?: number } | null;
  currentRound: (Track & { startedAt: number }) | null;  // startedAt = Date.now() au lancement
  playlist: Track[];
  currentTrackIndex: number;  // -1 si aucune piste sélectionnée
  players: Array<{
    id: string;
    pseudo: string;
    joinedAt: number;
    score: number;
    avatar: string | null;   // data URL JPEG base64 (150×150 px max)
    devise: string | null;   // dicton / slogan (max 200 car.)
  }>;
};
```

Derives fonctionnelles recommandees cote UI :

```ts
type DerivedSessionFlags = {
  hasJoinCode: boolean;      // session creee et non terminee
  joinAllowed: boolean;      // status !== 'stopped'
  roundActive: boolean;      // currentRound != null
  buzzAllowed: boolean;      // status === 'running' && currentRound != null && !buzzLocked
  transportAllowed: boolean; // status === 'running'
  stopAllowed: boolean;      // status === 'running'
  startAllowed: boolean;     // status === 'waiting'
};
```

---

## 7) API minimale

### HTTP

- `POST /admin/login`
- `POST /admin/logout`
- `GET  /admin/auth-status`
- `POST /admin/api/sessions` (crée une partie)
- `GET  /admin/api/sessions/:id` (récupère l'état général d'une session)
- `GET  /admin/api/sessions/:id/qrcode` (génère le QR code)
- `GET  /admin/api/sessions/:id/players` (liste des inscrits avec avatars)
- `GET  /admin/api/sessions/:id/stats`
- `POST /admin/api/sessions/:id/start`
- `POST /admin/api/sessions/:id/stop`
- `POST /admin/api/sessions/:id/rounds` (lancement manuel d'un morceau)
- `GET  /admin/api/sessions/:id/playlist`
- `PUT  /admin/api/sessions/:id/playlist`
- `POST /admin/api/sessions/:id/playlist/play`
- `POST /admin/api/sessions/:id/playlist/next`
- `POST /admin/api/sessions/:id/playlist/prev`
- `POST /admin/api/sessions/:id/decision` (accepted | rejected)
- `POST /sessions/join`
- `PUT  /sessions/:id/players/:playerId/profile` (avatar + devise)
- `POST /sessions/:id/buzz`
- `GET  /sessions/:id/ranking`

### WebSocket

- `session.started`
- `session.state`
- `round.started`
- `buzz.locked` — inclut `playerAvatar`, `playerDevise`, `reactionTime` (ms)
- `buzz.decided`
- `ranking.updated`
- `players.connected.updated`
- `players.list.updated` — liste complète des joueurs (pseudo, pas les avatars)
- `session.stopped`

---

## 8) QR code

- Format : `https://<votre-domaine>/?session=CODE`
- Généré côté serveur avec `qrcode` npm ; retourné comme `dataUrl` base64.
- Affiché dans l'interface admin avec l'URL textuelle en dessous (copiable).
- Le joueur scanne → arrive sur la page avec le champ "Code session" pré-rempli ; saisit seulement son pseudo.

---

## 9) Sécurité simple (MVP)

- Interface admin protégée (mot de passe + token HttpOnly).
- Token joueur = `playerId` UUID ; suffisant pour MVP. Endpoints joueurs vérifient que le `playerId` correspond à un joueur inscrit dans la session.
- Avatar validé côté serveur : doit être un `data:image/...` base64, max ~225 Ko encodé (~300 Ko base64).
- Rate limit sur `/buzz` (express-rate-limit recommandé en Sprint 3).
- Payload JSON limité à 500 Ko (protection contre abus).
- Horodatage `startedAt` côté serveur uniquement pour arbitrer le premier buzz et calculer le temps de réaction.

---

## 10) Plan de livraison

### Sprint 1

- Front joueur/admin basique.
- Intégration de **Pico.css** et **Bootstrap Icons** avec une feuille de style locale pour les tokens métier.
- Création de session + QR code (scan → pseudo seulement).
- Inscription joueur avec avatar + devise (optionnels).
- Vue admin : liste des joueurs inscrits en temps réel.
- Démarrage/arrêt.

### Sprint 2

- Playlist musicale : tableau éditable en ligne, import/export CSV, contrôles ⏮ ▶ ⏭.
- Buzzer temps réel + verrouillage.
- Validation/refus admin avec affichage : avatar + devise + temps de réaction du buzzeur.
- Retour visuel joueur (1er buzz vs. trop lent).
- Mise à jour live du classement pour tous.

### Sprint 3

- Durcissement sécurité (rate limit, etc.).
- Option persistance légère (Table Storage) si nécessaire.
- Déploiement Azure + supervision.

---

## 11) Critères d'acceptation

- 10 à 100 joueurs connectés dans une même partie sans latence bloquante.
- Le joueur rejoint via QR code sans jamais saisir l'URL ni le code de session.
- Avatar et devise visibles dans l'interface admin au moment du buzz.
- Temps de réaction affiché (mesuré côté serveur).
- Un seul buzz gagnant par tour.
- Décision admin impacte immédiatement le score.
- Classement visible à tout moment pour chaque joueur et pour l'admin.
- La playlist peut être gérée en ligne et importée/exportée en CSV.
- Le curseur de lecture est visible sur la piste active.
- Un clic sur le numéro d'une ligne lance immédiatement la piste correspondante.
- Le double-clic d'une ligne de playlist ouvre l'édition de cette ligne.
- Les raccourcis clavier d'édition (`Entrée`, `Tab`, flèches) fonctionnent sur desktop.
- Le retour visuel joueur distingue clairement "premier" vs "trop lent".
- Les vues appliquent le design system documente dans [06-design-system.md](/docs/06-design-system.md) et utilisent Pico.css + Bootstrap Icons de maniere coherente.
- Déploiement Azure avec coût minimal et architecture simple.

---

## 12) Persistance locale et serveur

- Côté joueur : mémorisation locale du code session et du pseudo entre rafraîchissements/retours sur la page.
- Côté admin : mémorisation locale de la session active pour retrouver la partie après F5 ou retour sur la page.
- Côté serveur : sauvegarde automatique en JSON de l'état des parties (sessions, playlist, joueurs, scores, tour courant).
- Reprise serveur : au démarrage, chargement du fichier JSON pour restaurer les parties existantes.
