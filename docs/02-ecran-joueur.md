# Blind Test - Specification ecran Joueur

## Role de l'ecran

L'ecran Joueur regroupe les actions necessaires pour rejoindre une partie comme joueur, enrichir son profil, proposer une reponse et suivre le classement.

## Route

- `/player?session=CODE`

## Utilisateur cible

- Joueur actif

## Objectifs fonctionnels

1. Saisir un pseudo unique pour entrer dans la session.
2. Permettre une reprise si la session joueur est memorisee localement.
3. Offrir un acces clair aux informations de profil, au buzz et au classement.
4. Rediriger automatiquement vers la vue Fin de partie quand la session est terminee.

## Contenu attendu

### Entete

- Titre `Blind Test`
- Bouton discret `Quitter la partie`

### Carte de contexte

- Libelle `Joueur`
- Titre dynamique de session
- Badge d'etat de session

### Carte d'entree joueur

- Resume de session
- Champ `Pseudo`
- Bouton `Rejoindre la partie`
- Zone d'erreur si l'inscription echoue

### Section `Enrichir mon profil`

- Rappel du pseudo actif
- Champ de fichier pour avatar
- Champ texte pour devise
- Bouton `Enregistrer le profil`
- Contraintes de format et de taille explicites

### Section `Proposition du morceau`

- Champ `Titre`
- Champ `Artiste`
- Champ `Annee`
- Bouton `BUZZER`
- Zone de feedback d'etat

### Section `Classement des joueurs`

- Score personnel
- Tableau de classement
- Gagnant courant ou final si disponible

## Regles de gestion

1. Le pseudo est obligatoire pour entrer dans la session.
2. Deux joueurs ne peuvent pas partager le meme pseudo dans une meme session.
3. Si le pseudo est refuse, un message d'erreur explicite doit etre affiche.
4. Si une session joueur valide est memorisee localement, l'utilisateur est rehydrate sans repasser par l'inscription.
5. Le bouton `Quitter la partie` supprime l'inscription joueur et renvoie vers l'accueil avec le code session conserve.
6. Le profil est facultatif mais modifiable a tout moment.
7. L'avatar accepte les formats JPEG ou PNG et doit etre redimensionne cote client en `150 x 150 px` avant envoi.
8. La charge utile avatar ne doit pas depasser environ `225 Ko` avant encodage base64.
9. La devise est une chaine libre de `200` caracteres maximum.
10. La mise a jour du profil passe par `PUT /sessions/:id/players/:playerId/profile`.
11. Avatar et devise doivent etre reutilises dans les evenements temps reel quand le joueur buzz.
12. Le bouton buzz n'est actif que si la session est `running`, qu'une manche est effectivement en cours (`currentRound != null`) et qu'aucun buzz n'est deja engage pour ce joueur.
13. Les champs `Titre`, `Artiste`, `Annee` sont facultatifs mais doivent etre transmis avec le buzz s'ils sont remplis.
14. Quand un autre joueur buzz avant lui, le joueur voit un message d'attente et ne peut plus buzzer jusqu'a la prochaine manche.
15. Quand la decision admin est recue, le joueur voit un feedback visuel positif ou negatif.
16. Quand une nouvelle manche commence, l'etat de buzz du joueur est reinitialise.
17. Quand la session passe a `stopped`, la vue redirige automatiquement vers la fin de partie.
18. Si l'admin supprime le joueur de la session, la session locale joueur est nettoyee et la vue redirige automatiquement vers l'accueil avec un message explicite.
19. Une session `running` sans manche en cours reste rejoignable, mais le buzz doit y rester desactive.
20. Si l'admin supprime entierement la session, la session locale joueur est nettoyee et la vue redirige automatiquement vers l'accueil avec un message explicite.

## Etats visuels principaux

### Avant inscription

- Carte pseudo visible
- Interface de jeu cachee

### Partie en attente

- Badge `en attente`
- Buzz desactive

### Partie demarree sans lecture

- Badge `en cours`
- Message indiquant que la partie a demarre mais qu'aucune lecture n'est active
- Buzz desactive

### Partie en cours de lecture

- Badge `en cours`
- Buzz potentiellement actif

### Buzz envoye

- Bouton buzz desactive
- Message `en attente de validation`

### Buzz concurrent

- Message indiquant qu'un autre joueur a ete plus rapide

### Fin de partie

- Redirection automatique vers `/end`

## Cas limites

1. L'utilisateur ouvre la vue Joueur sans code session valide : il doit etre invite a revenir a l'accueil.
2. La session est deja terminee au chargement : la vue doit rediriger vers la fin de partie.
3. Le joueur ferme puis rouvre l'onglet : la reprise doit utiliser la session locale si elle est encore valable.
