# Blind Test - Wireframes de reference

## Role du document

Ce document regroupe les wireframes textuels de reference utilises pour cadrer la composition des vues avant implementation.

## Vue joueur mobile

```text
+--------------------------------------------------+
| Blind Test                                [Admin]|
+--------------------------------------------------+
| Rejoindre la partie                              |
| [ Code session              ]                    |
| [ Pseudo                    ]                    |
| [ Rejoindre ]                                    |
| Session: ABCD      Statut: [ En attente ]        |
+--------------------------------------------------+
| Reponse rapide                                   |
| [ Titre propose             ]                    |
| [ Artiste propose           ]                    |
| [ Annee                     ]                    |
|                                                  |
| [  BUZZ  ]                                       |
|                                                  |
| [Attente] Buzz envoye, decision admin en cours   |
+--------------------------------------------------+
| Mon score                                        |
| 12                                               |
+--------------------------------------------------+
| Classement                                       |
| 1. Alice                               15        |
| 2. Moi                                 12        |
| 3. Hugo                                10        |
+--------------------------------------------------+
| Logs                                             |
| 14:02 - WebSocket connecte                       |
| 14:03 - round.started                            |
+--------------------------------------------------+
```

Principes de composition :

- Le bouton buzz est le point focal principal de l'ecran.
- Les informations d'identite et de session restent visibles sans prendre le dessus.
- Le feedback d'etat est positionne juste sous l'action de buzz.
- Le score personnel precede toujours le classement global.

## Vue admin desktop

```text
+-----------------------------------------------------------------------------------+
| Back-office Admin                                             [Se deconnecter]    |
+-----------------------------------------------------------------------------------+
| [Nouvelle partie] [Lancer] [Stop] [QR Code]   Session: X123   Code: ABCD          |
| [Connectes: 8] [Inscrits: 12] [Statut: running]                                   |
+--------------------------------------+--------------------------------------------+
| Playlist                              | Premier buzz                               |
| [Prev] [Play] [Next] | Joueur : Alice |
| [Upload CSV serveur] [Liste serveur v] [Charger] |
| ------------------------------------------------ || Temps de reaction : 1.24 s               |
| > Track 04  Queen  1984  bonus 1     | Avatar : [img]                            |
|   Track 05  ABBA   1979  bonus 0     | Devise : "Toujours a l'heure"             |
|   Track 06  Bowie  1983  bonus 1     | Proposition : Queen / Radio Ga Ga / 1984  |
| [Importer CSV] [Exporter CSV]         | [Valider +1] [Refuser -1]                 |
+--------------------------------------+--------------------------------------------+
| Joueurs inscrits                      | Classement                                 |
| Alice                                 | 1. Alice                            15     |
| Hugo                                  | 2. Marc                             12     |
| Marc                                  | 3. Hugo                             10     |
+--------------------------------------+--------------------------------------------+
| Logs en temps reel                                                                  |
| session.started | buzz.locked | decision.accepted | ranking.updated                |
+-----------------------------------------------------------------------------------+
```

Principes de composition :

- Les controles de partie sont regroupes en tete de page.
- La playlist et la zone de decision sont visibles simultanement.
- Le bloc `Premier buzz` est prioritaire visuellement sur le classement.
- Les logs restent presents mais relegues en bas de page.
