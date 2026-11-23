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

### `Ludi.save(data)` et `Ludi.onRestore(fn)` (recommandés pour tout jeu qui garde une partie)
Pour que l'enfant reprenne sur un autre appareil (ou après une réinstallation), le jeu confie sa sauvegarde à Ludiworld. Ludiworld la garde **avec l'enfant** : elle part donc dans la copie en ligne du parent, si elle est active, et nulle part ailleurs.

- `Ludi.save(data)` : à appeler à chaque fois que le jeu enregistre sa propre sauvegarde. `data` est ce que le jeu veut (tout ce qui passe par JSON : étage, village, leçons faites), **250 000 caractères au plus**. Ludiworld garde la dernière. Renvoie `true` si elle est gardée.
- `Ludi.onRestore(fn)` : `fn(data)` est appelée **au plus une fois par ouverture**, quand Ludiworld a une sauvegarde plus récente que celle de l'appareil (venue d'un autre appareil). Le jeu la range comme la sienne, puis se redessine ou recharge sa page. Elle arrive peu après le démarrage : le jeu se lance d'abord avec sa propre sauvegarde. Ce qui est propre à l'appareil (volume du son, plein écran) ne doit pas être écrasé.
- Une partie commencée avant l'ajout du kit : `Ludi.save(data, { existante: true })` à l'ouverture. Elle est réputée très ancienne : si Ludiworld en a déjà une, c'est la sienne qui revient ; sinon il garde celle-ci.

```js
function sauver() { localStorage.setItem(CLE, JSON.stringify(sv)); Ludi.save(sv); }
Ludi.onRestore(function (d) { sv = d; localStorage.setItem(CLE, JSON.stringify(sv)); redessiner(); });
```
Limite connue : sur une tablette partagée entre plusieurs enfants, la mémoire du jeu reste commune (voir la feuille de route). Hors Ludiworld, rien ne change : `save` garde la sauvegarde dans le navigateur, `onRestore` ne sera jamais appelée.

### `Ludi.fini()` et `Ludi.complet(x)` (pour tout jeu qui peut se terminer)
- `Ludi.fini()` : le parcours principal est terminé (histoire finie, dernier boss battu). Ça ne s'enlève jamais. Ludiworld range alors le jeu dans la rangée « Finis » de l'enfant et affiche la marque « Fini ».
- `Ludi.complet(x)`, `x` de 0 à 1 : ce qui reste en option une fois le jeu fini (mode difficile, médailles, étoiles). Ludiworld l'affiche en pourcentage à côté de « Fini ». La valeur ne redescend jamais ; sans option, ne pas l'appeler.
- Le jeu les appelle au moment où ça arrive **et** au démarrage si son état le dit déjà (après une restauration), puis les montre lui-même sur son écran principal, avec une forme et pas seulement une couleur. Ludiworld ne décide de rien : il lit.
- Exemple (Chasseur de Dragons) : fini dès qu'un mode est gagné, `complet(modes gagnés / 3)`.

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

### `Ludi.son()`, `Ludi.onSon(fn)` et `Ludi.reglerSon(o)` (pour tout jeu qui a du son)
Le son se règle pour toute la maison, dans Ludiworld (Julien, 2026-11-23) : côté parent (Réglages) et par le haut-parleur de l'enfant. Trois réglages séparés, des booléens : `musique`, `bruitages`, `voix` (la voix qui lit les textes). **Tous allumés au départ : un jeu ne démarre jamais muet.**
- `Ludi.son()` : le réglage actuel, `{ musique, bruitages, voix }`.
- `Ludi.onSon(fn)` : `fn(son)` est appelée **tout de suite** avec le réglage actuel, puis à chaque changement (le réglage de Ludiworld qui arrive, ou le bouton du jeu). Le jeu y coupe ou rallume sa musique, ses bruitages et sa voix.
- `Ludi.reglerSon(o)` : le bouton du son du jeu, par exemple `Ludi.reglerSon({ musique: false })`. Dans Ludiworld, il change le réglage de **toute la maison**, pour tous les jeux. Ouvert seul, il change celui de cet appareil.
- Le jeu garde son propre bouton (ou ses boutons) ; il n'a plus besoin de garder le son dans sa sauvegarde. Ouvert seul, le réglage reste dans le navigateur (`ludi.v1.son`, commun aux jeux de la même adresse).
```js
Ludi.onSon(function (s) { musique.muted = !s.musique; bruitagesOn = s.bruitages; voixOn = s.voix; });
boutonMusique.onclick = function () { Ludi.reglerSon({ musique: !Ludi.son().musique }); };
```

### `Ludi.inLauncher()`
`true` quand le jeu est ouvert depuis Ludiworld. Le jeu cache alors ce qui ferait sortir l'enfant du cadre choisi par le parent (bouton ou conseil « installer l'appli », liens vers d'autres sites), cache son bouton plein écran et n'appelle jamais `requestFullscreen` (dans Ludiworld, c'est Ludiworld qui décide du plein écran ; le cadre du jeu ne l'autorise pas) et laisse libre le coin en haut à gauche (bouton retour de Ludiworld, environ 120 × 44 px).

## Dialogue avec le launcher

Messages `postMessage`, toujours avec une origine cible précise (jamais `*`).

Le kit ne regarde que l'origine du launcher, jamais son chemin : l'appli sous `app/` (`https://ludiworld.app/app/`, `https://pikifou.github.io/ludiworld/app/`) a les mêmes origines autorisées qu'avant.

| Sens | `type` | Contenu |
|---|---|---|
| jeu → launcher | `ludi:hello` | `{ game, kit }` (version du kit) |
| launcher → jeu | `ludi:welcome` | `{ player: { name }, save, son }` (`save` : `{ data, at }` ou `null`, la sauvegarde que Ludiworld garde pour cet enfant ; `son` : `{ musique, bruitages, voix }`, le réglage de la maison, depuis le kit 0.5) |
| launcher → jeu | `ludi:son` | `{ son }` : le réglage de la maison a changé |
| jeu → launcher | `ludi:son` | `{ game, son }` : le bouton du jeu a changé le son ; Ludiworld le garde pour toute la maison |
| jeu → launcher | `ludi:event` | `{ game, event }`, où `event` est `{ kind, at, … }` avec `kind` parmi `session`, `score`, `progress`, `skill`, `checkpoint`, `save` (`{ kind: "save", data, at }`) |
| launcher → jeu | `ludi:wrapup` | `{ minutes }` (temps qui reste, 0 : finir la partie en cours) |
| launcher → jeu | `ludi:pause` | `{ reason }` |

Le launcher mesure lui-même le temps passé dans le jeu (c'est ce qui fait foi pour la limite du jour) ; les tranches `session` servent au jeu ouvert seul.

Les sessions sont envoyées par tranches (au plus toutes les 30 s et quand la page se cache), pour que le launcher ait un temps juste même si le jeu est fermé brutalement.

## Stockage local
Clé `ludi.v1.<game>` dans `localStorage`. Les événements ne sont pas gardés indéfiniment : les 300 derniers au plus, plus les meilleurs scores, la progression et le bilan par notion.
