# Blind Test - Navigation et regles transverses

## Objectif

Ce document decrit les regles communes a tous les ecrans publics et admin de l'application Blind Test.

## Cartographie des ecrans

### Documents transverses

- [06-design-system.md](c:/Projets/Quiz/hello-world/docs/06-design-system.md)
- [07-wireframes-de-reference.md](c:/Projets/Quiz/hello-world/docs/07-wireframes-de-reference.md)

### Vues publiques

- [01-ecran-accueil.md](c:/Projets/Quiz/hello-world/docs/01-ecran-accueil.md)
- [02-ecran-joueur.md](c:/Projets/Quiz/hello-world/docs/02-ecran-joueur.md)
- [03-ecran-spectateur.md](c:/Projets/Quiz/hello-world/docs/03-ecran-spectateur.md)
- [04-ecran-fin-de-partie.md](c:/Projets/Quiz/hello-world/docs/04-ecran-fin-de-partie.md)

### Vues admin

- [05-ecran-admin.md](c:/Projets/Quiz/hello-world/docs/05-ecran-admin.md)

## Routes de reference

- `/` : accueil, verification du code session, choix du role
- `/player?session=CODE` : vue joueur
- `/spectator?session=CODE` : vue spectateur
- `/end?session=CODE` : vue fin de partie
- `/admin` : interface admin ou ecran de connexion admin

## Regles de navigation

1. L'entree publique unique se fait par l'accueil.
2. Le QR code genere par l'admin pointe vers `/?session=CODE`.
3. L'accueil est le seul ecran qui autorise le choix entre mode `Joueur` et mode `Spectateur`.
4. La vue Joueur n'est pas une page d'accueil bis : si le contexte session est manquant ou invalide, elle doit rediriger ou inviter a revenir a l'accueil.
5. La vue Spectateur est en lecture seule.
6. La vue Fin de partie est une vue de sortie commune pour les joueurs et les spectateurs.

## Regles d'entete

1. Toutes les vues publiques affichent un entete compact sur une seule ligne.
2. Le titre de l'application est toujours `Blind Test`.
3. Le titre doit rester lisible avec un contraste fort par rapport au fond.
4. Les actions secondaires de navigation sont placees a droite de l'entete quand necessaire : retour accueil, quitter la partie, etc.

## Regles de persistance locale

1. Le navigateur memorise le dernier code session saisi.
2. Le navigateur memorise le pseudo joueur saisi.
3. Le navigateur memorise la session joueur active pour permettre une reprise ou une sortie propre.
4. Une session locale obsolete ne doit jamais afficher des actions qui ne sont plus valides.

## Regles de verification du code session

1. Tant qu'un code n'est pas verifie, aucun bouton `Joueur` ou `Spectateur` n'est visible sur l'accueil.
2. Si le code est invalide, un message d'erreur explicite est affiche.
3. Si le code est valide et que la session existe avec `status = waiting` ou `status = running`, les informations de partie s'affichent et l'entree publique reste autorisee.
4. Si le code est valide mais que la session est terminee (`status = stopped`), les actions d'entree sont masquees.
5. L'absence de session creee signifie qu'il n'existe ni code secret ni QR code exploitables cote public.

## Etats fonctionnels transverses

1. `Pas encore creee` : aucune session active, aucun code secret, aucun joueur ou spectateur ne peut rejoindre.
2. `Session creee en attente` : `status = waiting`, le code secret est deja valable pour rejoindre, mais aucune action de buzz n'est disponible.
3. `Session demarree sans lecture` : `status = running` et `currentRound = null`, le code secret reste valable, mais le buzz reste indisponible.
4. `Session demarree avec lecture` : `status = running` et `currentRound != null`, les joueurs peuvent rejoindre et buzzer tant que `buzzLocked = false`.
5. `Buzz verrouille` : `status = running`, `currentRound != null`, `buzzLocked = true`, les nouveaux buzz sont refuses jusqu'a la decision admin.
6. `Session terminee` : `status = stopped`, les entrees publiques sont fermees et les clients basculent vers la vue de fin.

## Regles temps reel

1. Les vues Joueur et Spectateur doivent reagir aux mises a jour WebSocket sans rechargement manuel.
2. Les changements de statut critiques sont :
   - session creee en attente,
   - session demarree sans lecture,
   - session demarree avec lecture,
   - buzz verrouille,
   - decision admin appliquee,
   - fin de partie.
3. Si l'admin met fin a la session, les joueurs et spectateurs sont rediriges automatiquement vers la vue Fin de partie.
4. Si l'admin supprime un joueur encore connecte, ce joueur est retire de la session en temps reel, sa session locale est invalidee et il est redirige automatiquement vers l'accueil.
5. Si l'admin supprime toute la session, les joueurs et spectateurs connectes sont rediriges automatiquement vers l'accueil et le code session devient invalide.

## Regles UX/UI transverses

1. Une seule action primaire doit dominer chaque zone fonctionnelle.
2. Les messages critiques doivent etre compréhensibles sans interpretation.
3. Les ecrans doivent rester utilisables sur smartphone en mode portrait.
4. Les icones accompagnent les libelles mais ne remplacent pas les actions critiques.
5. Les informations doivent etre hierarchisees : action en cours d'abord, details secondaires ensuite.
