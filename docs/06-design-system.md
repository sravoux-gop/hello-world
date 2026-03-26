# Blind Test - Design system

## Role du document

Ce document centralise les regles visuelles et d'interface communes a l'ensemble de l'application Blind Test.

## Direction visuelle

- Tonalite : sobre, lisible, legerement ludique, sans surcharge decorative.
- Priorite : clarte d'action, lisibilite mobile, retours d'etat immediats.
- Ambiance : surfaces claires, accents forts sur les actions de jeu, contrastes nets sur les etats de validation et d'alerte.

## Bibliotheques retenues

- Pico.css pour la base responsive, les formulaires et les tableaux.
- Bootstrap Icons pour les icones metier et de navigation.
- JavaScript vanilla pour conserver une integration simple avec des vues HTML dediees.

## Fondations visuelles

### Typographie

- Police principale : `system-ui, sans-serif` pour le MVP.
- Titres : graisse forte, espacement compact.
- Texte secondaire : taille reduite, contraste adouci mais accessible.

### Rayons

- Cartes et champs : `12px`.
- Boutons principaux : `999px` pour les actions fortes comme le buzz.

### Espacements

- Unite de base : `8px`.
- Marges de section : `24px`.
- Espacement interne des cartes : `16px` a `24px`.

### Ombres et bordures

- Bordures fines pour structurer les zones fonctionnelles.
- Ombre legere reservee aux cartes prioritaires.

## Palette semantique

- `--color-bg` : fond principal clair.
- `--color-surface` : carte ou panneau.
- `--color-text` : texte principal.
- `--color-muted` : texte secondaire.
- `--color-primary` : action principale.
- `--color-success` : buzz accepte ou etat positif.
- `--color-warning` : attente ou concurrence plus rapide.
- `--color-danger` : buzz refuse, arret, suppression.
- `--color-border` : separateurs et contours.

Exemple de valeurs de depart :

```css
:root {
   --color-bg: #f6f7f4;
   --color-surface: #ffffff;
   --color-text: #1f2937;
   --color-muted: #667085;
   --color-primary: #0f766e;
   --color-success: #15803d;
   --color-warning: #d97706;
   --color-danger: #b42318;
   --color-border: #d0d5dd;
}
```

## Composants UI standardises

- App shell : conteneur centre, largeur max `960px` cote public et `1280px` cote admin.
- Card : bloc standard pour chaque zone metier.
- Status pill : puce compacte pour `en attente`, `en cours`, `terminee`, `connecte`, `verrouille`.
- Primary button : action dominante de la zone.
- Secondary button : action secondaire sans ambiguite.
- Danger button : action destructive ou de cloture.
- Icon button : reserve aux actions repetitives avec libelle visible ou contexte explicite.
- Banner : retour global pour `buzz envoye`, `devance`, `reponse validee`, `reponse refusee`.
- Data table : classement, playlist, liste des joueurs.
- Stat tile : indicateur compact pour score, connectes, inscrits, piste active.

## Regles d'usage des icones

- `bi-play-fill` : lancer
- `bi-stop-fill` : arreter
- `bi-skip-forward-fill` : piste suivante
- `bi-skip-backward-fill` : piste precedente
- `bi-trophy-fill` : classement ou gagnant
- `bi-lightning-charge-fill` : buzz
- `bi-check-circle-fill` : validation
- `bi-x-circle-fill` : refus
- `bi-people-fill` : joueurs connectes
- `bi-qr-code` : lien de jointure ou QR code
- Taille standard : `16px` dans les boutons, `20px` a `24px` dans les tuiles d'information.
- Une icone seule ne doit jamais porter une action critique sans libelle.

## Responsive

- Mobile joueur : une seule colonne, bouton buzz pleine largeur, classement sous l'action principale.
- Tablette admin : deux colonnes possibles, avec priorite au bloc de decision et a la playlist.
- Desktop admin : tableau de bord en grille avec supervision, playlist et arbitrage visibles en meme temps.

## Etats interactifs

- Waiting : actions bloquees visuellement, message explicite.
- Running : action primaire mise en avant.
- Buzz locked : bouton joueur desactive, bandeau d'attente visible.
- Accepted : banniere positive et variation de score visible.
- Rejected : banniere negative et variation de score visible.
- Session stopped : actions de jeu desactivees, classement final mis en avant.

## Regles de composition

1. Une seule action primaire doit dominer chaque zone fonctionnelle.
2. Les etats critiques doivent etre visibles en moins d'une seconde.
3. Les ecrans doivent etre utilisables sur smartphone sans zoom, en orientation portrait par defaut.
4. Les messages critiques doivent etre lisibles sans interpretation.
5. Les donnees temps reel doivent etre hierarchisees : action en cours, score personnel, classement global, informations secondaires ensuite.

## Reference d'implementation

- Les tokens, composants communs et variations d'etat sont implementes principalement dans `public/app.css`.
- Les vues publiques doivent reutiliser le meme shell compact et les memes styles semantiques.
- Les vues admin doivent rester coherentes avec le meme vocabulaire visuel, meme si leur densite d'information est plus elevee.
