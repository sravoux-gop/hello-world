# Projet : Application Blind Test (web mobile) hébergée sur Azure

## 1) Objectif
Créer une application **accessible depuis Android/iOS via navigateur**, avec un **buzzer en temps réel**, un **admin** qui valide/refuse, et un **classement visible en continu**.

## 2) Contraintes et hypothèses
- Charge cible : **10 à 100 joueurs** simultanés par partie.
- Déploiement simple, coût réduit.
- Pas de base de données managée coûteuse (ex: PostgreSQL managé).
- La perte de partie en cas de redémarrage serveur est acceptable pour un MVP (option persistance légère possible).

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

---

## 4) Parcours utilisateur

### 4.1 Joueur
1. Scanne un QR code.
2. Arrive sur `/join?session=CODE`.
3. Saisit nom + prénom.
4. Accède à l'écran buzzer (gros bouton image).
5. Clique : le premier buzz serveur verrouille le tour.
6. Voit en continu :
   - son score,
   - le classement global mis à jour.

### 4.2 Administrateur
1. Ouvre l'interface admin (route dédiée + mot de passe).
2. Lance la partie.
3. Voit le premier joueur ayant buzzé.
4. Clique **Valider (+1)** ou **Refuser (-1)**.
5. Peut arrêter la partie.
6. Voit le classement final décroissant.

---

## 5) Règles métier
1. Partie en `waiting` : buzz désactivé.
2. Partie en `running` : buzz autorisé.
3. Premier buzz reçu côté serveur => `buzz_locked = true`.
4. Tant que l'admin n'a pas décidé, les autres buzz sont refusés.
5. Décision admin :
   - `accepted` => +1
   - `rejected` => -1
6. Après décision : déverrouillage du tour suivant.
7. Partie en `stopped` : buzz désactivé.
8. Classement : tri `score DESC`, puis `joinedAt ASC`.
9. Le classement est diffusé à tous les joueurs **à chaque décision** (temps réel).

---

## 6) Modèle d'état (en mémoire)

```ts
type SessionState = {
  id: string;
  code: string;
  status: 'waiting' | 'running' | 'stopped';
  buzzLocked: boolean;
  currentBuzzPlayerId?: string;
  players: Array<{
    id: string;
    firstName: string;
    lastName: string;
    joinedAt: number;
    score: number;
  }>;
};
```

---

## 7) API minimale

### HTTP
- `POST /admin/login`
- `POST /sessions` (admin)
- `POST /sessions/:id/start` (admin)
- `POST /sessions/:id/stop` (admin)
- `POST /sessions/:id/players` (join nom/prénom)
- `POST /sessions/:id/buzz` (joueur)
- `POST /sessions/:id/decision` (admin, body: accepted|rejected)
- `GET /sessions/:id/ranking` (admin + joueur)

### WebSocket
- `session.started`
- `buzz.locked`
- `buzz.decided`
- `ranking.updated` (envoyé à tous)
- `session.stopped`

---

## 8) QR code
- Format : `https://<votre-domaine>/join?session=ABC123`
- Le QR code peut être généré côté admin à la création de partie.

---

## 9) Sécurité simple (MVP)
- Interface admin protégée (mot de passe + token).
- Token joueur signé après inscription.
- Rate limit sur `/buzz`.
- Horodatage côté serveur uniquement pour arbitrer le premier buzz.

---

## 10) Plan de livraison

### Sprint 1
- Front joueur/admin basique.
- Création de session + QR code.
- Inscription joueur.
- Démarrage/arrêt.

### Sprint 2
- Buzzer temps réel + verrouillage.
- Validation/refus admin.
- Mise à jour live du classement pour tous.

### Sprint 3
- Durcissement sécurité.
- Option persistance légère (Table Storage) si nécessaire.
- Déploiement Azure + supervision.

---

## 11) Critères d'acceptation
- 10 à 100 joueurs connectés dans une même partie sans latence bloquante.
- Un seul buzz gagnant par tour.
- Décision admin impacte immédiatement le score.
- Classement visible à tout moment pour chaque joueur et pour l'admin.
- Déploiement Azure avec coût minimal et architecture simple.
