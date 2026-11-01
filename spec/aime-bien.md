# « Ludiworld aime bien »

Des séries, des films et des applis qui rendent les enfants curieux, recommandés par des parents. C'est une annexe : le cœur de Ludiworld reste les jeux. Le cadre, ce sont les écrans (pas les livres, les activités ou les abonnements à la maison), pour que le temps d'écran ait du sens même quand ce n'est pas l'heure de jouer.

Comme pour les jeux, **la fiche dit la vérité** : la pub sur YouTube, l'abonnement, la lecture automatique, les scènes qui peuvent faire peur vont dans « À savoir ».

## Deux statuts
- `valide` (affiché « Recommandé ») : un parent l'a regardé ou utilisé avec son enfant, et la fiche a été relue.
- `propose` (affiché « Proposé, en attente ») : quelqu'un l'a signalé ; la fiche peut être partielle. Plus tard, les votes des parents la feront passer en `valide` (v2). Aujourd'hui, Julien valide.

## Où
`docs/aime-bien/fiches.json` : `{ "ludi": 1, "items": [ … ] }`. Validé par `node tools/valider.js` et les tests.

On propose une fiche par l'issue « Recommander une série, un film ou une appli » (`.github/ISSUE_TEMPLATE/recommander.yml`), ajoutée à la main.

## Champs

Les textes sont bilingues : `{ "fr": "…", "en": "…" }`.

| Champ | Obligatoire | Contenu |
|---|---|---|
| `id` | oui | Minuscules et tirets, unique. Sert d'ancre : `aime-bien/#<id>`. |
| `type` | oui | `serie`, `film` ou `appli`. |
| `status` | oui | `valide` ou `propose`. |
| `by` | oui | Qui recommande (prénom ou pseudo). |
| `title`, `pitch` | oui | Le titre, et en une ou deux phrases ce que c'est. |
| `age` | non | `{ "min": 4, "max": 8 }`. |
| `format` | non | Durée des épisodes, du film ou des activités. |
| `learn` | non | Ce qu'on y apprend. |
| `why` | non | Pourquoi on aime. |
| `watch_out` | non | À savoir : pub, achat, abonnement, lecture automatique, scènes qui peuvent impressionner. |
| `where` | non | Où regarder ou trouver l'appli. Les catalogues changent : dire « selon les pays » plutôt qu'inventer. |
| `languages` | non | `["fr", "en"]`. |
| `incomplete` | non | `true` si la fiche est partielle : le site invite à la compléter. |

Une fiche `valide` à laquelle il manque `format`, `learn`, `why`, `watch_out` ou `where` doit porter `"incomplete": true`.
