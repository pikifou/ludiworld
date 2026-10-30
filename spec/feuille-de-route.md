# Feuille de route

Avancer petit, publier, en parler, laisser venir.

## v0 : le launcher de la maison (en cours)
- [x] Spec : fiche, charte, kit, données, domaines.
- [x] Kit `ludi.js` (mode local + dialogue avec le launcher), testé.
- [x] Fiches des jeux de Julien (brouillons à relire).
- [x] Launcher : catalogue, fiche parent, jeu en plein cadre, temps de jeu et records, FR/EN, installable.
- [x] Fiche du Simon des Monstres, kit intégré.
- [ ] Traduire en anglais la Tour aux Aimants, Du Feu à la Fusée et Pluie de Cochons (seul Chasseur de Dragons est bilingue aujourd'hui).
- [ ] Polices de la Tour et de Du Feu : les intégrer au jeu au lieu de Google Fonts (`third_parties` redevient vide).
- [ ] Julien relit les fiches (âges, durées, ce qu'on apprend) et les passe en `published`.
- [ ] Intégrer `ludi.js` dans chaque jeu (une ligne + quelques appels ; Pluie de Cochons en premier, il a déjà une grille de maîtrise).
- [ ] Mettre `ludi.json` à la racine de chaque jeu.

## v1 : la famille (première version le 30 octobre 2026, à éprouver)
- [x] Direction artistique « Le soleil de Ludiworld » : île en papier découpé, soleil qui descend avec le temps de jeu, marmotte qui s'endort.
- [x] Première ouverture : le parent prépare Ludiworld (pseudo, âge, jeux, temps, code).
- [x] Carnet parent derrière un code (appui long sur « Parents ») : aujourd'hui, jeux (recherche, filtres âge / notion / lecture), temps, réglages.
- [x] Temps par jour (jours d'école et sans école), limite par jeu, +10 min ou « fini pour aujourd'hui ».
- [x] Fin douce (attend `Ludi.checkpoint`, délai max) ou fin nette ; prévenir 5 min avant (`ludi:wrapup`).
- [x] Tableau de suivi : temps du jour et de la semaine, notions acquises et à revoir, records.
- [x] Vitrine `docs/decouvrir/` : ce qu'est Ludiworld, pour les parents qui découvrent.
- [x] Plusieurs enfants par appareil : chacun ses jeux, son temps, son suivi ; « Pas toi ? » (code parent par défaut).
- [x] Heures de jeu (pas de jeu avant / après), vacances scolaires, jeu réservé aux jours sans école.
- [x] Code parent : 3 erreurs = 30 s de pause ; « code oublié » = 30 min d'attente pendant lesquelles on ne joue pas.
- [x] Kit 0.2.0 (`checkpoint`, `onWrapUp`) dans les cinq jeux de Julien (clones à côté, non publiés).
- [x] Plein écran décidé par Ludiworld (réglage du carnet) ; les jeux n'y ont pas droit dans l'appli et cachent leur bouton.
- [ ] Le suivi des jeux eux-mêmes (`ludi.v1.<jeu>`) est partagé entre les enfants d'une même tablette : à traiter si les profils servent.
- Comptes et synchro entre appareils (Supabase, UE) : le parent règle depuis son téléphone.

## Ouverture aux autres créateurs (avancé dès la v0)
- [x] `LUDIWORLD.md` : guide à donner à son IA (charte, cadre, fiche, kit, GitHub Pages, soumission).
- [x] Soumission par issue GitHub, vérification automatique, pull request à valider.
- [x] Jeux dont le site interdit les cadres : ouverts dans un nouvel onglet.
- [ ] Mettre `ludi.json` à la racine de chacun des jeux de Julien et les repasser par l'import (exemple vivant pour les autres).

## v2 : les autres parents
- Page « Ajouter un jeu » dans le launcher, pour ceux qui ne connaissent pas GitHub.
- Les parents notent : est-ce que ça marche, est-ce que c'est sain, est-ce que l'enfant a accroché, a-t-il appris.
- Un jeu validé par assez de parents est mis en avant.
