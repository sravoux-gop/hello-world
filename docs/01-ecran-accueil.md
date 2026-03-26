# Blind Test - Specification ecran Accueil

## Role de l'ecran

L'ecran Accueil est la porte d'entree unique de l'application publique. Il sert a verifier un code session, afficher l'etat de la partie et proposer les modes d'acces disponibles.

## Route

- `/`
- Variante avec code pre-rempli : `/?session=CODE`

## Utilisateurs cibles

- Joueur non encore connecte
- Spectateur
- Joueur revenant avec une session locale memorisee

## Objectifs fonctionnels

1. Saisir ou confirmer un code secret de partie.
2. Verifier que la session existe.
3. Montrer les meta-informations de partie si le code est valide.
4. Permettre le choix entre mode `Joueur` et `Spectateur` seulement si la session est exploitable.
5. Offrir un acces discret a l'admin via le pied de page.

## Contenu attendu

### Entete

- Titre `Blind Test`
- Presentation compacte sur une seule ligne

### Carte d'introduction

- Libelle de contexte `Accueil`
- Titre d'action `Rejoindre une partie`
- Texte court d'explication

### Bloc de verification de code

- Champ `Code secret`
- Bouton `Verifier le code`
- Message d'aide court tant qu'aucun code n'est valide
- Zone d'erreur si la verification echoue

### Bloc meta session

- Nom ou libelle de la session
- Statut de la partie
- Nombre de joueurs inscrits
- QR code si disponible

### Bloc de choix de role

- Bouton `Spectateur`
- Bouton `Joueur`

### Pied de page

- Lien `Admin` discret

## Regles de gestion

1. Si le champ code est vide, la verification echoue avec un message explicite.
2. Si le code est invalide, les blocs `meta session` et `choix de role` restent caches.
3. Si le code est valide et que la session est `waiting` ou `running`, les actions `Spectateur` et `Joueur` s'affichent.
4. Si le code est valide mais que la session est `stopped`, les actions `Spectateur` et `Joueur` restent masquees.
5. Si une session joueur active est memorisee localement, l'accueil affiche un encart discret avec :
   - le code session,
   - le pseudo,
   - le statut de la session,
   - un bouton `Quitter la partie`.
6. Le bouton `Joueur` ouvre la vue Joueur avec le code session verifie.
7. Le bouton `Spectateur` ouvre la vue Spectateur avec le code session verifie.
8. L'accueil doit distinguer visuellement une session `cree en attente`, une session `demarree sans lecture` et une session `demarree avec lecture`.
9. La possibilite de rejoindre comme joueur depend de l'existence et de la non-termination de la session, pas de l'existence d'une manche en cours.

## Etats visuels principaux

### Etat neutre

- Aucun code verifie
- Aucune action de role visible

### Etat code valide

- Meta session visible
- Boutons de choix visibles

### Etat code invalide

- Message d'erreur visible
- Meta session et choix de role caches

### Etat session terminee

- Meta session visible
- Message informatif de session terminee
- Pas de boutons d'acces

### Etat session demarree sans lecture

- Meta session visible
- Boutons de choix visibles
- Message indiquant que la partie est demarree mais qu'aucun morceau n'est encore en cours

## Cas limites

1. Code saisi en minuscules : il doit etre normalise en majuscules.
2. Changement manuel du champ code apres verification : l'etat verifie doit etre reinitialise.
3. Session locale obsolete : l'encart local doit pouvoir etre nettoye via `Quitter la partie`.
