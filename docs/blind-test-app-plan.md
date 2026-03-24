# Projet : Application Blind Test (web mobile) hébergée sur Azure

## 1) Objectif
Créer une application **accessible depuis un smartphone Android/iOS via navigateur web**, permettant de gérer un jeu de type **blind test** avec un **buzzer** en temps réel.

## 2) Parcours utilisateur

### 2.1 Joueur
1. Le joueur scanne un **QR code**.
2. Il arrive sur la page d'inscription et saisit **nom + prénom**.
3. Une fois inscrit, il voit un grand bouton/image **"Buzzer"**.
4. Quand il appuie :
   - son buzz est envoyé au serveur,
   - son nom apparaît côté administrateur,
   - les autres joueurs sont bloqués tant que l'admin n'a pas tranché.
5. L'admin valide ou refuse :
   - validation = **+1 point**,
   - refus = **-1 point**.
6. En fin de partie, le joueur peut voir le classement final.

### 2.2 Administrateur
1. Ouvre une interface d'administration sécurisée.
2. Lance le début de la partie.
3. Visualise le premier joueur ayant buzzé.
4. Clique sur **Valider** ( +1 ) ou **Refuser** ( -1 ).
5. Peut arrêter la partie.
6. Affiche le classement final par score décroissant.

---

## 3) Architecture recommandée

### Front-end
- **Application Web Responsive (PWA)**
  - Joueur : page inscription + page buzzer.
  - Admin : tableau de bord temps réel.
- Stack suggérée : **React + TypeScript + Vite**.

### Back-end
- **API + temps réel WebSocket**.
- Stack suggérée : **Node.js (NestJS ou Express) + Socket.IO**.

### Base de données
- **Azure Database for PostgreSQL (Flexible Server)**.
- Persistences minimales : parties, joueurs, scores, événements de buzz.

### Hébergement Azure
- Front-end : **Azure Static Web Apps**.
- Back-end : **Azure App Service** (ou Azure Container Apps).
- Temps réel : WebSocket via App Service / Socket.IO.
- Secrets : **Azure Key Vault**.
- Monitoring : **Application Insights**.

---

## 4) Modèle de données (MVP)

### Table `game_session`
- `id` (uuid, pk)
- `code` (varchar, unique) — code de partie intégré au QR
- `status` (enum: `waiting`, `running`, `stopped`)
- `created_at`, `started_at`, `stopped_at`

### Table `player`
- `id` (uuid, pk)
- `game_session_id` (fk)
- `first_name` (varchar)
- `last_name` (varchar)
- `display_name` (varchar)
- `score` (int, default 0)
- `joined_at`

### Table `buzz_event`
- `id` (uuid, pk)
- `game_session_id` (fk)
- `player_id` (fk)
- `created_at`
- `is_first` (bool)
- `admin_decision` (enum: `pending`, `accepted`, `rejected`)
- `decided_at`

---

## 5) Règles métier essentielles

1. Tant qu'une partie est en `waiting`, le buzzer est désactivé.
2. Quand la partie passe en `running`, tous les joueurs peuvent buzzer.
3. Le **premier buzz reçu côté serveur** verrouille le tour (`buzz_locked=true`).
4. Tant que l'admin n'a pas décidé, les autres buzz sont ignorés.
5. Décision admin :
   - `accepted` → score joueur +1
   - `rejected` → score joueur -1
6. Après décision, on déverrouille le buzzer pour le tour suivant.
7. Fin de partie (`stopped`) : plus aucun buzz accepté.
8. Classement : tri par `score DESC`, puis `joined_at ASC` en cas d'égalité.

---

## 6) API (exemple)

### Auth admin
- `POST /admin/login`

### Partie
- `POST /sessions` (admin) : créer une partie
- `POST /sessions/:id/start` (admin) : démarrer
- `POST /sessions/:id/stop` (admin) : arrêter
- `GET /sessions/:id/ranking` : classement final

### Joueurs
- `POST /sessions/:id/players` : inscription (nom/prénom)
- `GET /sessions/:id/players/me` : profil joueur courant

### Buzz
- `POST /sessions/:id/buzz` : tentative de buzz
- `POST /sessions/:id/buzz/:buzzId/decision` : `accepted|rejected` (admin)

### WebSocket events
- `session.started`
- `session.stopped`
- `buzz.locked` (avec joueur gagnant)
- `buzz.decided`
- `ranking.updated`

---

## 7) Flux QR code

- Le QR code encode une URL de type :
  - `https://blindtest.example.com/join?session=ABC123`
- La page lit `session` et affiche directement le formulaire nom/prénom.

---

## 8) Sécurité et anti-triche (MVP)

- Interface admin protégée par authentification.
- Un joueur = une session navigateur (token signé).
- Limitation anti-spam sur endpoint buzzer.
- Horodatage serveur uniquement (jamais client) pour déterminer le premier buzz.

---

## 9) Plan de réalisation (itératif)

### Sprint 1 (MVP technique)
- Création projet front/back.
- Création session + QR code.
- Inscription joueur.
- Démarrage/arrêt partie admin.

### Sprint 2 (jeu temps réel)
- Buzzer joueur.
- Verrouillage au premier buzz.
- Affichage admin du gagnant du buzz.
- Décision +1/-1.

### Sprint 3 (qualité)
- Classement final.
- Journal d'événements.
- Sécurisation admin.
- Monitoring Azure + tests de charge simples.

---

## 10) Critères d'acceptation

- Les joueurs se connectent via QR code depuis Android/iOS sans installation.
- L'admin peut lancer/arrêter la partie.
- Le premier buzz s'affiche correctement côté admin.
- Les autres joueurs sont bloqués jusqu'à décision admin.
- La décision admin ajoute/enlève bien 1 point.
- Le classement final est correct et trié par score décroissant.
