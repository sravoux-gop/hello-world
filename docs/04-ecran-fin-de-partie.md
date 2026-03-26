# Blind Test - Specification ecran Fin de partie

## Role de l'ecran

L'ecran Fin de partie est la sortie commune des joueurs et des spectateurs. Il doit conclure clairement la session et afficher le classement final.

## Route

- `/end?session=CODE`

## Utilisateurs cibles

- Joueur redirige depuis la vue Joueur
- Spectateur redirige depuis la vue Spectateur
- Utilisateur revenant sur le resultat d'une session terminee

## Objectifs fonctionnels

1. Afficher le gagnant de maniere ceremonielle et immediate.
2. Afficher le podium.
3. Afficher le classement complet final.
4. Donner une sortie simple vers l'accueil.

## Contenu attendu

### Entete

- Titre `Blind Test`
- Lien vers l'accueil

### Hero de fin

- Libelle `Fin de partie`
- Titre `And the winner is...`
- Nom du gagnant en evidence
- Sous-titre avec code session et statut final

### Bloc `Podium`

- Top 3 des joueurs si disponible
- Rang explicite
- Score de chaque joueur du podium

### Bloc `Classement complet`

- Tableau complet ordonne par score

### Bloc d'erreur optionnel

- Message explicite si les donnees de session sont introuvables ou incompletes

## Regles de gestion

1. L'ecran doit fonctionner avec les donnees finales d'une session `stopped`.
2. Si le gagnant est disponible, il est affiche en priorite absolue.
3. Si le classement est vide, l'ecran doit rester comprehensible avec un message d'etat.
4. Le podium affiche jusqu'a trois joueurs, pas davantage.
5. Le classement complet reprend l'ordre final par score.
6. L'ecran doit etre accessible directement via URL pour une session terminee connue.

## Etats visuels principaux

### Session terminee avec classement

- Gagnant visible en hero
- Podium visible
- Tableau complet visible

### Session terminee sans classement exploitable

- Message d'erreur ou d'information visible
- Ecran non casse

## Cas limites

1. Session inconnue : afficher une erreur explicite.
2. Session connue mais sans gagnant calcule : afficher un fallback `Aucun gagnant disponible`.
