# Le kit `ludi.js`

La petite brique commune à tous les jeux. Un créateur ajoute une ligne, appelle trois ou quatre fonctions, et son jeu sait parler à Ludiworld.

```html
<script src="https://pikifou.github.io/ludiworld/kit/ludi.js"></script>
<script>
  Ludi.init({ game: "pluie-de-cochons" });
</script>
```

Pour un jeu qui doit marcher hors ligne, copier `ludi.js` dans le jeu (ou l'intégrer au build) plutôt que le charger à distance.

## Principes
1. **Le jeu marche pareil avec ou sans Ludiworld.** Ouvert seul, le kit garde tout dans le navigateur. Ouvert depuis le launcher, il envoie aussi tout au launcher.
2. **Le jeu ne sait pas qui est l'enfant.** Il reçoit au mieux un pseudo à afficher. Le compte appartient au launcher (et, plus tard, au parent).
3. **Le kit n'envoie rien sur le réseau.** Il ne parle qu'à la page qui l'a ouvert, et seulement si cette page est un launcher autorisé (`allowedLaunchers`).
4. **Aucune fonction n'est obligatoire à part `init`.** Un jeu peut n'utiliser que le temps de jeu.

## API

### `Ludi.init({ game, launchers? })`
À appeler une fois au démarrage. `game` est l'`id` de la fiche. Démarre la mesure du temps de jeu (le temps ne compte que quand la page est visible). `launchers` permet d'ajouter des origines autorisées (pour tester en local).

### `Ludi.score(key, value, { better: "higher" | "lower" })`
Enregistre un score. Garde le meilleur. Renvoie `{ best, record }` (`record` vaut `true` si c'est un nouveau meilleur).
```js
Ludi.score("table-7", 38.4, { better: "lower" }); // un chrono : plus petit = mieux
```

### `Ludi.progress(key, value)`
Où en est l'enfant : étage atteint, époque, salle. Garde la dernière valeur.
```js
Ludi.progress("etage", 5);
```

### `Ludi.skill(domain, item, success)`
Une réponse juste ou fausse sur une notion. C'est ce qui permet de suivre l'apprentissage d'un jeu à l'autre (vocabulaire dans `spec/domaines.md`).
```js
Ludi.skill("maths.multiplication", "7x8", true);
```

### `Ludi.player()`
Renvoie `{ name }` si le launcher a donné un pseudo, sinon `null`. Le jeu peut s'en servir pour pré-remplir un prénom.

### `Ludi.data()`
Ce que le kit a gardé localement pour ce jeu : temps de jeu, scores, progression, notions.

### `Ludi.checkpoint(label?)` (recommandé)
L'enfant vient d'atteindre un moment où il peut s'arrêter sans rien perdre : fin de niveau, de course, de série. C'est ce qui permet au launcher la **fin douce** : quand le temps du jour est écoulé, il attend le prochain `checkpoint` (au plus le délai choisi par le parent) au lieu de couper au milieu d'une partie. Sans `checkpoint`, le jeu n'a que 3 minutes pour finir.
```js
Ludi.checkpoint("fin-de-course");
```

### `Ludi.onPause(fn)` (facultatif)
Le launcher peut demander une pause (temps de jeu écoulé, parent qui reprend la main). Le jeu qui veut être poli s'y abonne.

### `Ludi.onWrapUp(fn)` (facultatif)
Le launcher prévient que le temps de jeu touche à sa fin : `fn(minutes)` reçoit les minutes qui restent (0 : c'est l'heure, finir la partie en cours). Le jeu peut par exemple ne plus proposer « encore une partie ». Le launcher affiche de toute façon son propre message.

### `Ludi.inLauncher()`
`true` quand le jeu est ouvert depuis Ludiworld. Le jeu cache alors ce qui ferait sortir l'enfant du cadre choisi par le parent (bouton ou conseil « installer l'appli », liens vers d'autres sites) et laisse libre le coin en haut à gauche (bouton retour de Ludiworld, environ 120 × 44 px).

## Dialogue avec le launcher

Messages `postMessage`, toujours avec une origine cible précise (jamais `*`).

| Sens | `type` | Contenu |
|---|---|---|
| jeu → launcher | `ludi:hello` | `{ game, kit }` (version du kit) |
| launcher → jeu | `ludi:welcome` | `{ player: { name } }` |
| jeu → launcher | `ludi:event` | `{ game, event }`, où `event` est `{ kind, at, … }` avec `kind` parmi `session`, `score`, `progress`, `skill`, `checkpoint` |
| launcher → jeu | `ludi:wrapup` | `{ minutes }` (temps qui reste, 0 : finir la partie en cours) |
| launcher → jeu | `ludi:pause` | `{ reason }` |

Le launcher mesure lui-même le temps passé dans le jeu (c'est ce qui fait foi pour la limite du jour) ; les tranches `session` servent au jeu ouvert seul.

Les sessions sont envoyées par tranches (au plus toutes les 30 s et quand la page se cache), pour que le launcher ait un temps juste même si le jeu est fermé brutalement.

## Stockage local
Clé `ludi.v1.<game>` dans `localStorage`. Les événements ne sont pas gardés indéfiniment : les 300 derniers au plus, plus les meilleurs scores, la progression et le bilan par notion.
