# Ludiworld

**FR** · Des petits jeux faits maison par des parents, qui font apprendre, sans pub, sans achat, sans pièges. Chaque jeu a une fiche honnête : ce qu'on y apprend et comment, l'âge conseillé, la durée d'une partie, et ses engagements. Le parent choisit, l'enfant joue.

**EN** · Small home-made games by parents that help kids learn, with no ads, no purchases and no dark patterns. Every game comes with an honest card: what it teaches and how, recommended age, session length, and its commitments. Parents choose, kids play.

- Launcher : https://pikifou.github.io/ludiworld/
- Ludiworld n'héberge pas les jeux : chaque créateur publie le sien (GitHub Pages de préférence) avec une fiche `ludi.json`. / Ludiworld doesn't host games: each creator publishes their own with a `ludi.json` card.
- Ajouter un jeu / Add a game : donner [`LUDIWORLD.md`](LUDIWORLD.md) à son IA, puis [proposer le jeu](https://github.com/pikifou/ludiworld/issues/new?template=proposer-un-jeu.yml).

```html
<script src="https://pikifou.github.io/ludiworld/kit/ludi.js"></script>
<script>Ludi.init({ game: "my-game" });</script>
```

## Développement
- `docs/` est le site (GitHub Pages, branche `main`, dossier `/docs`), sans build.
- `node --test tests/*.test.js` lance les tests du kit et valide les fiches.
- Feuille de route : `spec/feuille-de-route.md`.
