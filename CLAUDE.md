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
  - `docs/index.html` + `docs/app.js` + `docs/style.css` : l'appli (accueil du parent, côté enfant, carnet parent, jeu en plein cadre).
  - `docs/textes.js` : tous les textes FR / EN. `docs/temps.js` : les règles du temps de jeu (limites, heures, fin douce / nette), sans DOM, testées.
  - `docs/img/` : la direction artistique « Le soleil de Ludiworld » (île en papier découpé jour / nuit, soleil, lune, nuages, marmotte). Générées avec Arcads, détourées, en WebP.
  - `docs/decouvrir/` : la vitrine pour les parents qui découvrent Ludiworld (lien depuis l'appli).
  - `docs/kit/ludi.js` : le kit, chargé par les jeux.
  - `docs/jeux/index.json` : la liste des fiches ; `docs/jeux/<id>.json` : une fiche par jeu.
  - `docs/sw.js` : service worker (incrémenter `VERSION` à chaque publication).
- `tools/valider.js` : valide les fiches. `tools/importer.js <adresse>` : importe la fiche d'un jeu publié ailleurs. `tools/dev.py` : version de dev locale (launcher + jeux clonés à côté, port 7357, jamais 8000).
- `LUDIWORLD.md` : guide qu'un créateur donne à son IA pour rendre son jeu compatible et le proposer.
- `.github/ISSUE_TEMPLATE/proposer-un-jeu.yml` + `.github/workflows/proposer-un-jeu.yml` : soumission par issue, vérification automatique, pull request à valider (voir `spec/fiche.md`, « Proposer un jeu »).
- `tests/` : `node --test tests/*.test.js` (kit, fiches, règles du temps) ; `python3 tests/captures.py <sortie> [<dossier des clones des jeux>]` (navigateur sans réseau : préparation par le parent, code, recherche, retour Android, fin douce et nette, limite par jeu, heures de jeu, dialogue avec un faux jeu qui utilise le kit).

## Principe : Ludiworld n'héberge pas les jeux
Chaque créateur héberge son jeu (GitHub Pages de préférence) avec `ludi.json` à la racine. Le catalogue garde une copie validée de chaque fiche ; le jeu se charge depuis le site du créateur. Ne jamais copier le code d'un jeu dans ce dépôt.

## Les jeux de Julien (dépôts séparés)
- La Tour aux Aimants : https://github.com/pikifou/tour-aimants
- Chasseur de Dragons : https://github.com/pikifou/chasseur-dragons
- Du Feu à la Fusée : https://github.com/pikifou/du-feu-a-la-fusee
- Pluie de Cochons : https://github.com/pikifou/pluie-de-cochons
- Simon : dépôt à retrouver

Chaque jeu se construit avec `python3 build.py --pwa docs` dans son dépôt. Intégrer le kit = l'ajouter au build du jeu et appeler `Ludi.init` + quelques `Ludi.score/progress/skill` ; ne rien changer au comportement du jeu quand il est ouvert seul.

## L'appli en bref
- Première ouverture : le parent prépare Ludiworld (pseudo et âge de l'enfant, jeux, temps par jour, fin douce ou nette, code à 4 chiffres).
- Côté enfant : seuls les jeux choisis ; le soleil descend avec le temps du jour ; la marmotte prévient 5 min avant ; la nuit tombe quand c'est fini.
- Carnet parent : appui long sur « Parents » puis le code. Aujourd'hui (temps, +10 min, fini pour aujourd'hui, semaine, notions, records), Jeux (recherche, filtres, limite par jeu), Temps (jours d'école / sans école, heures de jeu, fin douce / nette), Réglages.
- Le temps est mesuré par l'appli elle-même. La fin douce attend `Ludi.checkpoint` du jeu (au plus le délai choisi) ; un jeu sans kit a 3 min.
- Tout reste sur l'appareil (`localStorage`, clé `ludiworld.v1`). Pour la démo et les tests : `ludiDemo.ajouter('<jeu>', minutes)` dans la console.

## Règles
- Tout texte affiché est bilingue FR / EN (langue du téléphone par défaut, choix mémorisé).
- Les fiches disent la vérité, même quand c'est moins flatteur (jeu qui apprend peu, police chargée chez Google…).
- Le kit n'envoie jamais rien sur le réseau et ne poste qu'à des origines autorisées, jamais `*`.
- Rester simple : HTML, CSS et JS vanilla, aucune dépendance, aucun build pour le launcher.
- Textes écrits pour Julien : pas de tiret long (« — »).
