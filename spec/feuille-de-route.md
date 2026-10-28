# Feuille de route

Avancer petit, publier, en parler, laisser venir.

## v0 : le launcher de la maison (en cours)
- [x] Spec : fiche, charte, kit, données, domaines.
- [x] Kit `ludi.js` (mode local + dialogue avec le launcher), testé.
- [x] Fiches des jeux de Julien (brouillons à relire).
- [x] Launcher : catalogue, fiche parent, jeu en plein cadre, temps de jeu et records, FR/EN, installable.
- [ ] Fiche du Simon (lien à récupérer).
- [ ] Traduire en anglais la Tour aux Aimants, Du Feu à la Fusée et Pluie de Cochons (seul Chasseur de Dragons est bilingue aujourd'hui).
- [ ] Polices de la Tour et de Du Feu : les intégrer au jeu au lieu de Google Fonts (`third_parties` redevient vide).
- [ ] Julien relit les fiches (âges, durées, ce qu'on apprend) et les passe en `published`.
- [ ] Intégrer `ludi.js` dans chaque jeu (une ligne + quelques appels ; Pluie de Cochons en premier, il a déjà une grille de maîtrise).
- [ ] Mettre `ludi.json` à la racine de chaque jeu.

## v1 : la famille
- Espace parent (code ou geste simple pour y entrer).
- Profils enfants (pseudo, tranche d'âge), plusieurs enfants par appareil.
- Sélection de la semaine : le parent choisit les jeux visibles.
- Temps de jeu par jour, décidé par le parent, appliqué par le launcher (`ludi:pause`).
- Tableau de suivi : temps, records, notions vues et sues.
- Comptes et synchro entre appareils (Supabase, UE).

## v2 : les autres parents
- Un créateur soumet son jeu en donnant l'adresse de sa fiche.
- Vérifications automatiques (fiche valide, domaines tiers déclarés).
- Les parents notent : est-ce que ça marche, est-ce que c'est sain, est-ce que l'enfant a accroché, a-t-il appris.
- Un jeu validé par assez de parents est mis en avant.
