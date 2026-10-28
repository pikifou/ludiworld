# La fiche `ludi.json`

Chaque jeu Ludiworld est décrit par une fiche. C'est elle que le parent lit avant de dire oui, et c'est elle qui fait apparaître le jeu dans le catalogue.

Règle d'or : **la fiche dit la vérité, y compris quand elle est moins flatteuse**. Un jeu d'action qui apprend peu le dit ; un jeu qui charge une police chez Google le dit. La confiance des parents vient de là.

## Où elle vit
- v0 : dans ce dépôt, `docs/jeux/<id>.json`, listées dans `docs/jeux/index.json`.
- Plus tard : à la racine du jeu (`https://…/mon-jeu/ludi.json`). Le catalogue ne garde que l'adresse.

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
| `status` | oui | `draft` (fiche pas encore relue par l'auteur) ou `published`. |

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

## Exemple complet
Voir `docs/jeux/pluie-de-cochons.json`.

## Validation
`node tools/valider.js` vérifie toutes les fiches du catalogue. Les tests le lancent aussi.
