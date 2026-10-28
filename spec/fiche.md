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
| `embed` | non | Ajouté à l'import : `false` si le site du jeu interdit l'affichage dans un cadre (le launcher ouvre alors un nouvel onglet). |
| `source` | non | Ajouté à l'import : `{ "card": "<adresse de la fiche>", "imported": "AAAA-MM-JJ" }`. |
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

## Proposer un jeu
1. Le créateur publie son jeu (GitHub Pages de préférence) avec `ludi.json` à la racine. `LUDIWORLD.md` explique tout à son IA.
2. Il ouvre une issue avec le formulaire « Proposer un jeu » et colle l'adresse du site.
3. Le workflow `.github/workflows/proposer-un-jeu.yml` lance `tools/importer.js` : il lit la fiche, la vérifie (format, charte, jeu sur le même site, identifiant libre, jeu et icône qui répondent, cadre autorisé ou non) et répond sur l'issue.
4. Si tout va bien, il ouvre une demande d'ajout (pull request) avec la copie de la fiche. Julien joue au jeu, relit, et fusionne : le jeu apparaît dans Ludiworld. La fusion ferme l'issue.
5. Pour mettre à jour une fiche : republier `ludi.json`, puis modifier l'issue ou en ouvrir une nouvelle avec la même adresse.

À la main : `node tools/importer.js https://<nom>.github.io/<jeu>/`.
