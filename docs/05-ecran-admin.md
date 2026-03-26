# Blind Test - Specification ecran Admin

## Role de l'ecran

L'ecran Admin pilote la session de jeu, la playlist, les joueurs et les decisions de validation ou de refus des buzz.

## Route

- `/admin`

## Utilisateur cible

- Administrateur de la partie

## Objectifs fonctionnels

1. Authentifier l'administrateur.
2. Creer une nouvelle session.
3. Suivre les joueurs inscrits et connectes.
4. Gérer la playlist musicale.
5. Traiter les buzz en temps reel.
6. Arrêter la session et provoquer la bascule vers la fin de partie.
7. Supprimer explicitement une session existante.

## Sous-ecrans concernes

### Connexion admin

- Champ mot de passe
- Bouton de connexion
- Message d'erreur en cas d'echec

### Tableau de bord admin

- Entete admin
- Actions de session : nouvelle partie, lancer, arreter, supprimer, deconnexion
- Statistiques de session
- QR code de session
- Liste des joueurs inscrits
- Gestion de playlist
- Zone de buzz courant
- Classement
- Modale de confirmation de suppression de session

### Zone QR code

- Apercu du QR code genere cote serveur
- URL de jointure associee, copiable
- Rappel du code session

### Zone playlist

- Tableau de pistes `id`, `title`, `artist`, `year`, `yearBonus`
- Curseur visuel sur la piste active
- Lecture immediate depuis le numero de ligne
- Edition en ligne d'une piste
- Import et export CSV
- Chargement depuis la bibliotheque serveur

## Regles de gestion

1. Sans authentification valide, la route `/admin` affiche l'ecran de connexion.
2. Avec authentification valide, la route `/admin` affiche directement le tableau de bord.
3. La creation de session genere un code secret et un QR code de jointure.
4. Le QR code est genere par `GET /admin/api/sessions/:id/qrcode` via le paquet npm `qrcode`.
5. L'URL de jointure encodee dans le QR code pointe vers `/?session=CODE` pour conserver l'accueil comme point d'entree unique.
6. La liste des joueurs inscrits est actualisee en temps reel.
7. La playlist peut etre editee en ligne, importee ou exportee en CSV, chargee depuis la bibliotheque serveur et jouee piste par piste.
8. Une ligne active affiche un curseur visuel dans la premiere colonne.
9. Un clic sur le numero d'une ligne lance immediatement la piste correspondante.
10. Un double-clic sur une ligne ouvre son edition.
11. L'edition au clavier doit supporter `Entree`, `Tab`, `Shift+Tab` et les fleches de direction.
12. Les endpoints playlist de reference sont `GET /admin/api/sessions/:id/playlist`, `PUT /admin/api/sessions/:id/playlist`, `POST /admin/api/sessions/:id/playlist/play`, `POST /admin/api/sessions/:id/playlist/next` et `POST /admin/api/sessions/:id/playlist/prev`.
13. Quand une piste est lancee, `session.currentRound.startedAt` est initialise cote serveur.
14. Quand un buzz est verrouille, la zone de buzz admin doit afficher le joueur, l'avatar, la devise, le temps de reaction et la proposition.
15. Les actions `Valider (+1)` et `Refuser (-1)` mettent immediatement a jour le classement.
16. Depuis le classement, chaque ligne joueur doit permettre une suppression via une action corbeille affichee au survol ou apres selection de la ligne.
17. Si le joueur cible est encore connecte, la suppression doit demander une confirmation explicite dans une modale avant execution.
18. Si le joueur cible n'est pas connecte, la suppression peut etre lancee directement depuis le classement.
19. Si un joueur supprime etait en train de buzzer, le buzz en cours est annule et l'interface admin revient a un etat coherent.
20. L'action d'arret de session declenche la fin de partie pour tous les clients publics.
21. Le bouton `Nouvelle partie` n'est visible que s'il n'existe aucune session courante ou si la session courante est arretee.
22. Le bouton `Lancer` n'est visible que si une session existe et qu'elle n'est pas deja en cours.
23. Le bouton `Arreter` n'est visible que si la session est en cours.
24. Le bouton `Supprimer la partie` est disponible uniquement pour une session existante et demande toujours une confirmation explicite.
25. La telecommande playlist ne doit etre activee que si la session est demarree (`status = running`).
26. Une session `running` sans lecture en cours doit etre clairement differenciee d'une session `running` avec morceau en cours.
27. Si l'admin supprime la session, tous les clients publics connectes sont rediriges vers l'accueil et la session disparait du serveur.

## Matrice d'etat admin

### Pas encore creee

- Aucun code session
- Aucun QR code
- Bouton `Nouvelle partie` actif
- Bouton `Lancer` masque
- Bouton `Arreter` masque
- Bouton `Supprimer la partie` masque
- Telecommande playlist inactive

### Session creee en attente

- Code session et QR code visibles
- Joueurs autorises a rejoindre
- Bouton `Nouvelle partie` masque
- Bouton `Lancer` actif
- Bouton `Arreter` masque
- Bouton `Supprimer la partie` actif
- Telecommande playlist inactive
- Badge d'etat `En attente`

### Session demarree sans lecture

- Code session et QR code visibles
- Joueurs autorises a rejoindre
- Bouton `Lancer` masque
- Bouton `Arreter` actif
- Bouton `Supprimer la partie` actif
- Telecommande playlist active
- Badge d'etat `Demarree`
- Message `Aucune lecture en cours`

### Session demarree avec lecture

- Code session et QR code visibles
- Joueurs autorises a rejoindre et a buzzer
- Bouton `Lancer` masque
- Bouton `Arreter` actif
- Bouton `Supprimer la partie` actif
- Telecommande playlist active
- Badge d'etat `Lecture en cours`

### Buzz verrouille

- Session toujours `running`
- QR code et code session restent visibles
- Les joueurs peuvent encore rejoindre
- Les nouveaux buzz sont refuses tant que l'admin n'a pas decide
- L'etat visuel doit signaler qu'une validation admin est attendue

## Etats visuels principaux

### Non authentifie

- Carte de connexion visible

### Authentifie sans session

- Tableau de bord visible
- Invite a creer une partie

### Session en attente

- Session creee
- QR code disponible
- Joueurs visibles

### Session demarree sans lecture

- Session demarree
- QR code disponible
- Telecommande active
- Aucune manche en cours

### Session en cours de lecture

- Playlist active
- Buzz et decisions disponibles

### Session terminee

- Classement final disponible
- Plus d'actions de jeu normales cote public

## Cas limites

1. Playlist vide : l'admin doit pouvoir en charger une ou en creer une.
2. Buzz sans proposition texte : la zone admin doit rester lisible.
3. Deconnexion admin : retour a l'ecran de connexion.
