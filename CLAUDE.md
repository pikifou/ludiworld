# Ludiworld

Un launcher, puis une plateforme, pour des petits jeux faits maison par des parents (souvent en vibe coding) : des jeux qui font apprendre, sans dark patterns, décrits par une fiche honnête que les parents lisent, valident et notent.

Porteur : Julien (pikifou). Les premiers jeux sont ceux qu'il a faits pour son fils.

## Lire d'abord
- `spec/feuille-de-route.md` : où on en est (v0 / v1 / v2) et la suite.
- `spec/fiche.md` : le format `ludi.json`.
- `spec/charte.md` : ce qu'un jeu sain s'engage à ne pas faire.
- `spec/kit.md` : l'API de `ludi.js` et le dialogue launcher ↔ jeu.
- `spec/donnees.md` : règles sur les données d'enfants.
- `spec/domaines.md` : vocabulaire commun des notions apprises.

## Organisation
- `docs/` : le site publié (GitHub Pages, branche `main`, dossier `/docs`). Pas de build : on édite directement.
  - `docs/index.html` + `docs/app.js` + `docs/style.css` : le launcher.
  - `docs/kit/ludi.js` : le kit, chargé par les jeux.
  - `docs/jeux/index.json` : la liste des fiches ; `docs/jeux/<id>.json` : une fiche par jeu.
  - `docs/sw.js` : service worker (incrémenter `VERSION` à chaque publication).
- `tools/valider.js` : valide les fiches. `tools/importer.js <adresse>` : importe la fiche d'un jeu publié ailleurs.
- `LUDIWORLD.md` : guide qu'un créateur donne à son IA pour rendre son jeu compatible et le proposer.
- `.github/ISSUE_TEMPLATE/proposer-un-jeu.yml` + `.github/workflows/proposer-un-jeu.yml` : soumission par issue, vérification automatique, pull request à valider (voir `spec/fiche.md`, « Proposer un jeu »).
- `tests/` : `node --test tests/*.test.js` (kit et fiches) ; `python3 tests/captures.py <sortie> [<dossier des clones des jeux>]` (navigateur sans réseau : captures téléphone et ordinateur, retour Android, dialogue avec un faux jeu qui utilise le kit).

## Principe : Ludiworld n'héberge pas les jeux
Chaque créateur héberge son jeu (GitHub Pages de préférence) avec `ludi.json` à la racine. Le catalogue garde une copie validée de chaque fiche ; le jeu se charge depuis le site du créateur. Ne jamais copier le code d'un jeu dans ce dépôt.

## Les jeux de Julien (dépôts séparés)
- La Tour aux Aimants : https://github.com/pikifou/tour-aimants
- Chasseur de Dragons : https://github.com/pikifou/chasseur-dragons
- Du Feu à la Fusée : https://github.com/pikifou/du-feu-a-la-fusee
- Pluie de Cochons : https://github.com/pikifou/pluie-de-cochons
- Simon : dépôt à retrouver

Chaque jeu se construit avec `python3 build.py --pwa docs` dans son dépôt. Intégrer le kit = l'ajouter au build du jeu et appeler `Ludi.init` + quelques `Ludi.score/progress/skill` ; ne rien changer au comportement du jeu quand il est ouvert seul.

## Règles
- Tout texte affiché est bilingue FR / EN (langue du téléphone par défaut, choix mémorisé).
- Les fiches disent la vérité, même quand c'est moins flatteur (jeu qui apprend peu, police chargée chez Google…).
- Le kit n'envoie jamais rien sur le réseau et ne poste qu'à des origines autorisées, jamais `*`.
- Rester simple : HTML, CSS et JS vanilla, aucune dépendance, aucun build pour le launcher.
- Textes écrits pour Julien : pas de tiret long (« — »).
