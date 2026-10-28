# Ludiworld

**FR** · Des petits jeux faits maison par des parents, qui font apprendre, sans pub, sans achat, sans pièges. Chaque jeu a une fiche honnête : ce qu'on y apprend et comment, l'âge conseillé, la durée d'une partie, et ses engagements. Le parent choisit, l'enfant joue.

**EN** · Small home-made games by parents that help kids learn, with no ads, no purchases and no dark patterns. Every game comes with an honest card: what it teaches and how, recommended age, session length, and its commitments. Parents choose, kids play.

- Launcher : https://pikifou.github.io/ludiworld/
- Ajouter un jeu / Add a game : écrire sa fiche (`spec/fiche.md`) et, si on veut, utiliser le kit (`spec/kit.md`).

```html
<script src="https://pikifou.github.io/ludiworld/kit/ludi.js"></script>
<script>Ludi.init({ game: "my-game" });</script>
```

## Développement
- `docs/` est le site (GitHub Pages, branche `main`, dossier `/docs`), sans build.
- `node --test tests/*.test.js` lance les tests du kit et valide les fiches.
- Feuille de route : `spec/feuille-de-route.md`.
