# Blind Test - Specification ecran Spectateur

## Role de l'ecran

L'ecran Spectateur permet de suivre une partie sans participer au buzz. Il doit fournir une vue claire de la session, des manches et du classement en temps reel.

## Route

- `/spectator?session=CODE`

## Utilisateur cible

- Spectateur
- Joueur souhaitant simplement suivre l'etat de la partie

## Objectifs fonctionnels

1. Afficher les informations principales de la session en cours.
2. Montrer le resultat de la manche precedente.
3. Afficher l'etat precis de la manche en cours.
4. Afficher le classement des joueurs en temps reel.
5. Rediriger automatiquement vers la vue Fin de partie si la session s'arrete.
6. Rediriger automatiquement vers l'accueil si la session est supprimee par l'admin.

## Contenu attendu

### Entete

- Titre `Blind Test`
- Lien de retour vers l'accueil

### Carte de contexte

- Libelle `Spectateur`
- Identifiant lisible de la session
- Badge de statut de session
- Compteur de joueurs connectes et inscrits

### Bloc `Partie en cours`

- Nom ou libelle de la session
- Code session
- Statut de session
- Nombre de joueurs
- QR code pour rejoindre si disponible

### Bloc `Manche precedente`

- Etat de resultat
- Nom du joueur concerne
- Score gagne ou perdu
- Informations du morceau valide si une validation a eu lieu

### Bloc `Manche en cours`

- Statut courant de manche
- Description textuelle du statut
- Eventuellement fiche du joueur qui a buzze
- Eventuellement rappel du morceau gagne tant que la manche n'est pas passee a la suivante

### Bloc `Classement en temps reel`

- Tableau trie par score decroissant
- Mise en evidence temporaire du joueur venant d'etre impacte par une decision

## Regles de gestion

1. La vue Spectateur est accessible seulement avec un code session valide.
2. Si le code est manquant ou invalide, un message d'erreur remplace la grille principale.
3. Le bloc `Partie en cours` est toujours visible en premier.
4. Le bloc `Manche precedente` se nourrit du dernier resultat admin disponible.
5. Le bloc `Manche en cours` doit afficher les statuts suivants :
   - `Demarree` si la session est en cours mais qu'aucun morceau n'est encore lance,
   - `En cours` si le morceau joue et personne n'a encore buzze,
   - `Buzz !!!` si un joueur attend la decision admin,
   - `Gagne !!!` si un joueur a ete valide et que l'admin n'a pas encore lance la manche suivante,
   - `En attente` si rien n'est encore lance.
6. Si la session passe a `stopped`, la vue ne reste pas figee sur place : elle redirige vers `/end`.
7. Le classement est mis a jour sans rechargement de page.
8. Si l'admin supprime la session, la vue quitte la session en temps reel et redirige vers l'accueil avec un message explicite.

## Etats visuels principaux

### Session en attente

- Informations de partie visibles
- Manche courante affichee en attente

### Session en cours sans buzz

- Statut `En cours`
- Signal visuel de lecture ou d'activite

### Session demarree sans lecture

- Statut `Demarree`
- Message indiquant que la prochaine lecture n'a pas encore ete lancee
- Aucun signal de buzz actif

### Buzz verrouille

- Statut `Buzz !!!`
- Fiche du joueur buzzeur

### Manche gagnee

- Statut `Gagne !!!`
- Mise en avant du joueur et du morceau valide

### Fin de partie

- Redirection automatique vers `/end`

## Cas limites

1. Une session vide sans joueurs doit rester lisible.
2. Une session sans QR code ne doit pas casser le bloc d'information.
3. Une session terminee au chargement doit envoyer rapidement vers la vue finale.
