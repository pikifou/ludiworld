# La fiche `ludi.json`

Chaque jeu Ludiworld est décrit par une fiche. C'est elle que le parent lit avant de dire oui, et c'est elle qui fait apparaître le jeu dans le catalogue.

Règle d'or : **la fiche dit la vérité, y compris quand elle est moins flatteuse**. Un jeu d'action qui apprend peu le dit ; un jeu qui charge une police chez Google le dit. La confiance des parents vient de là.

## Où elle vit
- **Chez le créateur** : à la racine du site publié, à côté de `index.html` (`https://<nom>.github.io/<jeu>/ludi.json`). Le jeu (`url`) doit être sur le même site que sa fiche.
- **Dans le catalogue** : une copie validée, `docs/jeux/<id>.json`, listée dans `docs/jeux/index.json`. La copie protège le catalogue : un site qui tombe ne le casse pas, et une fiche modifiée après validation doit être proposée à nouveau.

Comment un jeu entre dans le catalogue : voir `LUDIWORLD.md` (guide à donner à son IA) et la section « Proposer un jeu » plus bas.

## Champs

Les textes destinés aux gens sont bilingues : `{ "fr": "…", "en": "…" }`. Les clés sont en anglais pour que des créateurs du monde entier puissent les écrire.

| Champ | Obligatoire | Contenu |
|---|---|---|
| `ludi` | oui | Version du format. Aujourd'hui `1`. |
| `id` | oui | Identifiant court, minuscules et tirets (`pluie-de-cochons`). Le même que dans `Ludi.init`. |
| `title` | oui | Nom du jeu (fr, en). |
| `pitch` | oui | Une ou deux phrases : ce que fait l'enfant dans le jeu. |
| `url` | oui | Adresse où l'on joue. |
| `icon` | oui | Image carrée (512 px de préférence). |
| `color` | non | Couleur de fond du jeu, pour la carte du catalogue. |
| `screenshots` | non | Des images du jeu, de 1 à 5, montrées dans le catalogue. Voir ci-dessous. |
| `screens` | avec `screenshots` | Le sens des images : `portrait` (jeu en hauteur, téléphone) ou `landscape` (jeu en largeur). |
| `author` | oui | `{ "name": "…", "url": "…" }`. |
| `languages` | oui | Langues du jeu (`["fr", "en"]`). |
| `age` | oui | `{ "min": 6, "max": 10 }`, âge conseillé. |
| `reading` | oui | Lecture nécessaire : `none` (se joue sans savoir lire : voix, images), `some` (quelques mots), `fluent` (il faut bien lire). |
| `learning` | oui | Voir ci-dessous. |
| `session` | oui | Voir ci-dessous. |
| `content` | oui | Ce qu'un parent voudrait savoir sur le contenu (combat, peur, compétition). Bilingue, une phrase. |
| `devices` | oui | Parmi `phone`, `tablet`, `computer`. |
| `offline` | oui | `true` si le jeu marche sans réseau une fois ouvert. |
| `healthy` | oui | La checklist de la charte (`spec/charte.md`). |
| `third_parties` | oui | Domaines extérieurs que le jeu contacte (`[]` si aucun). |
| `kit` | oui | `true` si le jeu utilise `ludi.js`. |
| `after` | non | Une idée à faire sans écran, en lien avec le jeu, dite à l'enfant (fr, en ; une phrase, 160 signes au plus). Le launcher la montre une fois, sur l'écran « C'est fini pour aujourd'hui », pour le dernier jeu joué. Pas d'ordre sec : une proposition. |
| `together` | non | `true` si le jeu se joue aussi à deux sur le même appareil (chacun son tour, ou côte à côte). La fiche affiche alors « À deux possible ». Absent : rien n'est dit. |
| `activity` | non | L'activité hors écran pas à pas, ouverte depuis l'idée `after` (requise avec elle). Voir ci-dessous. |
| `added` | non | Ajouté par Ludiworld quand le jeu entre au catalogue : la date `AAAA-MM-JJ`. Côté parent, la mini-fiche porte une petite marque « Nouveau » pendant 30 jours, et les jeux nouveaux passent en premier dans « Tous les jeux ». Pas de notification, pas de compte à rebours. Chaque jeu du catalogue en a une. |
| `embed` | non | Ajouté à l'import : `false` si le site du jeu interdit l'affichage dans un cadre (le launcher ouvre alors un nouvel onglet). |
| `source` | non | Ajouté à l'import : `{ "card": "<adresse de la fiche>", "imported": "AAAA-MM-JJ" }`. |
| `status` | oui | `draft` (fiche pas encore relue par l'auteur) ou `published`. Le site ne l'affiche pas aux familles. |

### `learning`
```json
"learning": {
  "level": "core",
  "domains": ["maths.multiplication"],
  "what": { "fr": "Ce que l'enfant apprend.", "en": "…" },
  "how":  { "fr": "Par quel mécanisme il l'apprend.", "en": "…" }
}
```
- `level` : `core` (apprendre est le but du jeu), `side` (on apprend en passant), `none` (jeu pour le plaisir, et c'est très bien aussi).
- `domains` : vocabulaire commun, voir `spec/domaines.md`. C'est ce qui permettra de suivre la progression d'un jeu à l'autre.

### `session`
```json
"session": { "minutes": [5, 15], "natural_end": true, "total_hours": 3 }
```
- `minutes` : durée typique d'une partie.
- `natural_end` : la partie a une fin claire (course, salle, niveau) où l'enfant peut s'arrêter sans rien perdre.
- `total_hours` : durée de vie estimée du contenu.

### `screenshots`
```json
"screenshots": [
  { "src": "img/pluie-de-cochons-1.webp", "alt": { "fr": "Les cochons remplissent la grange", "en": "Pigs fill up the barn" } }
],
"screens": "landscape"
```
- De vraies images du jeu en train d'être joué, toutes dans le même sens (`screens`), pas d'affiche ni de montage.
- `src` : dans la copie du catalogue, `img/<id>-N.webp` (fichier dans `docs/jeux/img/`, N de 1 à 9) ; sinon une adresse https. Dans le `ludi.json` d'un créateur, mettre des adresses https : le catalogue en garde une copie à la validation.
- `alt` : ce que montre l'image, en une courte phrase (fr, en). C'est aussi la légende.
- WebP de préférence, environ 960 × 540 (paysage) ou 720 × 1280 (portrait).

### `activity`
```json
"activity": {
  "title": { "fr": "Le chapeau de chevalier", "en": "The knight's hat" },
  "need": { "fr": "Une grande feuille (une page de journal) et des feutres.", "en": "A big sheet of paper (a newspaper page) and felt pens." },
  "steps": [
    { "img": "img/activites/chapeau-chevalier-1.svg", "text": { "fr": "Plie la feuille en deux.", "en": "Fold the sheet in half." } }
  ]
}
```
- Décidé par Julien le 23 novembre 2026 : l'idée hors écran devient une petite fiche d'activité dans l'appli, pour tous les jeux. Elle ne compte pas comme du temps d'écran : on fait quelque chose en dehors de la tablette, avec la tablette.
- Sur « C'est fini pour aujourd'hui », l'idée `after` porte alors un bouton « Comment faire ? » qui ouvre l'activité en plein écran : ce qu'il faut, puis les étapes une par une, un grand schéma et une phrase courte (140 signes au plus) que l'enfant peut entendre en appuyant dessus.
- 2 à 10 étapes. `img` : un schéma exact, dessiné (SVG de préférence, fichier dans `docs/jeux/img/activites/`), ou une adresse https. Pas d'image de générateur pour un pliage : il se trompe sur les plis.
- Une activité accessible à un enfant de 6 ans, avec ce qu'on a à la maison.

## Exemple complet
Voir `docs/jeux/pluie-de-cochons.json`.

## Validation
`node tools/valider.js` vérifie toutes les fiches du catalogue. Les tests le lancent aussi.

## Proposer un jeu
1. Le créateur publie son jeu (GitHub Pages de préférence) avec `ludi.json` à la racine. `LUDIWORLD.md` explique tout à son IA.
2. Il ouvre une issue avec le formulaire « Proposer un jeu » et colle l'adresse du site.
3. Le workflow `.github/workflows/proposer-un-jeu.yml` lance `tools/importer.js` : il lit la fiche, la vérifie (format, charte, jeu sur le même site, identifiant libre, jeu et icône qui répondent, cadre autorisé ou non) et répond sur l'issue.
4. Si tout va bien, il ouvre une demande d'ajout (pull request) avec la copie de la fiche. Julien joue au jeu, relit, et fusionne : le jeu apparaît dans Ludiworld. La fusion ferme l'issue.
5. Pour mettre à jour une fiche : republier `ludi.json`, puis modifier l'issue ou en ouvrir une nouvelle avec la même adresse.

À la main : `node tools/importer.js https://<nom>.github.io/<jeu>/`.
