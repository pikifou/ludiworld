# Make a game Ludiworld-ready

**FR** · Ce fichier est fait pour être lu par une IA de code (Claude, Cursor, Copilot…). Donnez-lui cette consigne :
> Lis https://raw.githubusercontent.com/pikifou/ludiworld/main/LUDIWORLD.md et rends mon jeu compatible Ludiworld, puis aide-moi à le publier sur GitHub Pages.

Ensuite, proposez le jeu ici : https://github.com/pikifou/ludiworld/issues/new?template=proposer-un-jeu.yml

**EN** · This file is written for a coding AI. Give it this instruction:
> Read https://raw.githubusercontent.com/pikifou/ludiworld/main/LUDIWORLD.md and make my game Ludiworld-ready, then help me publish it on GitHub Pages.

Then submit the game here: https://github.com/pikifou/ludiworld/issues/new?template=proposer-un-jeu.yml

---

## For the AI: what Ludiworld is

Ludiworld (https://pikifou.github.io/ludiworld/) is a launcher of small home-made games for children, mostly made by parents with AI. Ludiworld does not host games. Each creator hosts their own game (GitHub Pages recommended) and publishes a card, `ludi.json`, next to it. Ludiworld keeps a list of validated cards and opens the games from the creator's site.

Your job, in order:
1. Check the game respects the charter. If it doesn't, tell the user what must change and stop until it does.
2. Make the game work well inside the launcher.
3. Write `ludi.json` at the root of the published site.
4. Optionally add the kit (`ludi.js`) for scores and progress.
5. Publish on GitHub Pages and give the user the two links to submit.

Be honest everywhere. The card is read by parents deciding whether their child may play. Do not oversell: a game that teaches little says so, and that's fine.

## 1. The charter (all must be true)

| Key | Meaning |
|---|---|
| `no_ads` | No advertising, in or around the game. |
| `no_purchases` | Nothing to buy: no in-app purchase, paid currency or "full version". |
| `no_subscription` | No subscription. |
| `no_loot_boxes` | No randomised reward obtained by playing or paying. |
| `no_daily_pressure` | No daily reward, streak, refilling chest, "come back tomorrow". |
| `no_notifications` | Never sends notifications to bring the child back. |
| `no_strangers` | No contact with strangers (chat, messages, real profiles). Fictional rivals are fine. |
| `no_tracking` | No data about the child leaves the device (no analytics, no pixels). |
| `natural_stops` | Sessions have clear moments to stop without losing anything. |

Search the code for analytics, ad SDKs, `fetch`/`XMLHttpRequest` to other domains, notification APIs and daily-reward logic. List every external domain the game contacts (fonts, CDNs…) in `third_parties`. Prefer bundling fonts and libraries inside the game so the list is empty.

## 2. Works well inside the launcher

The launcher opens the game full screen in an iframe on `https://pikifou.github.io`.
- Serve over HTTPS (GitHub Pages does).
- Use relative paths for assets (`./img/x.png`, not `/img/x.png`), because a project site lives under `/<repo>/`.
- Don't block framing: no `X-Frame-Options`, no `frame-ancestors` restriction, no "break out of frame" script. If the host forbids framing, the launcher opens the game in a new tab instead.
- Must be playable by touch on a phone, in portrait or with a clear "rotate your phone" screen.
- Keep saves in `localStorage` or IndexedDB on the game's own site. Never ask for the child's real name, photo or birth date.
- The launcher shows a small "← Ludiworld" button in the top-left corner: keep that corner free of essential controls.
- Text: French and English are welcome; say which languages the game supports in the card. Default to the device language if the game has both.

## 3. The card: `ludi.json`

Put it at the root of the published site, so that it is reachable at `https://<user>.github.io/<repo>/ludi.json`. The game itself (`url`) must be on the same site.

```json
{
  "ludi": 1,
  "id": "raining-pigs",
  "status": "published",
  "title": { "fr": "Pluie de Cochons", "en": "Raining Pigs" },
  "pitch": { "fr": "Ce que fait l'enfant, en une ou deux phrases.", "en": "What the child does, in one or two sentences." },
  "url": "https://user.github.io/raining-pigs/",
  "icon": "https://user.github.io/raining-pigs/icon-512.png",
  "color": "#070a24",
  "author": { "name": "First name or pseudonym", "url": "https://github.com/user/raining-pigs" },
  "languages": ["fr", "en"],
  "age": { "min": 6, "max": 10 },
  "reading": "some",
  "learning": {
    "level": "core",
    "domains": ["maths.multiplication"],
    "what": { "fr": "Ce que l'enfant apprend.", "en": "What the child learns." },
    "how": { "fr": "Par quel mécanisme.", "en": "Through which mechanism." }
  },
  "session": { "minutes": [3, 10], "natural_end": true, "total_hours": 6 },
  "content": { "fr": "Combat, peur, compétition : ce qu'un parent voudrait savoir.", "en": "Fighting, fear, competition: what a parent would want to know." },
  "devices": ["phone", "tablet", "computer"],
  "offline": true,
  "healthy": {
    "no_ads": true, "no_purchases": true, "no_subscription": true, "no_loot_boxes": true,
    "no_daily_pressure": true, "no_notifications": true, "no_strangers": true, "no_tracking": true,
    "natural_stops": true
  },
  "third_parties": [],
  "kit": false
}
```

Rules:
- `id`: lowercase letters, digits and dashes, unique and stable.
- Every human text has both `fr` and `en`. Translate if the user wrote only one.
- `icon`: square PNG, 512×512, readable when small, no text.
- `reading`: `none` (playable without reading: voice, pictures), `some` (a few words), `fluent`.
- `learning.level`: `core` (learning is the point), `side` (learned along the way), `none` (just for fun; then `what` and `how` may be omitted and `domains` is `[]`).
- `learning.domains`: use the shared vocabulary in https://github.com/pikifou/ludiworld/blob/main/spec/domaines.md. If nothing fits, propose a new `family.topic` in the same style; it will be reviewed.
- `session.minutes`: a realistic range for one sitting. `total_hours`: how long the content lasts.
- `offline`: `true` only if the game works without network once loaded (service worker).
- `kit`: `true` only if you add `ludi.js` (step 4).

Full reference: https://github.com/pikifou/ludiworld/blob/main/spec/fiche.md

## 4. Optional: the kit

The kit lets the launcher show records and what the child practised. It sends nothing over the network and only talks to the Ludiworld launcher. The game must behave exactly the same when opened on its own.

Copy https://pikifou.github.io/ludiworld/kit/ludi.js into the game (so it works offline) and load it before your code:

```html
<script src="ludi.js"></script>
<script>Ludi.init({ game: "raining-pigs" }); // same id as the card</script>
```

Then call, where it makes sense:
```js
Ludi.score("table-7", 38.4, { better: "lower" }); // a best score (time: lower is better)
Ludi.progress("level", 5);                         // how far the child got
Ludi.skill("maths.multiplication", "7x8", true);   // one right/wrong answer on a topic
Ludi.onPause(() => pauseGame());                   // the launcher may ask for a pause
```

Full reference: https://github.com/pikifou/ludiworld/blob/main/spec/kit.md

## 5. Publish and submit

1. Put the game in a public GitHub repository, with the playable files either at the root or in `/docs`, `ludi.json` next to `index.html`.
2. Settings → Pages → Deploy from a branch → `main`, folder `/` (root) or `/docs`.
3. Wait a minute, open `https://<user>.github.io/<repo>/` and `https://<user>.github.io/<repo>/ludi.json` to check both load.
4. Submit: https://github.com/pikifou/ludiworld/issues/new?template=proposer-un-jeu.yml with the address of the site. A bot checks the card and answers on the issue; a person then plays the game and validates it.

To update a published card later, change `ludi.json`, publish, and submit the same address again.
