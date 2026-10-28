# La charte : des jeux sains

Un jeu Ludiworld respecte l'enfant et le temps de sa famille. La fiche le déclare dans `healthy`, les parents le vérifient en jouant et en notant.

## Les engagements (champ `healthy`, tout doit être à `true`)

| Clé | Ce que ça veut dire |
|---|---|
| `no_ads` | Aucune publicité, ni dans le jeu ni autour. |
| `no_purchases` | Rien à acheter : pas d'achat intégré, pas de monnaie payante, pas de « version complète ». |
| `no_subscription` | Pas d'abonnement. |
| `no_loot_boxes` | Pas de récompense tirée au hasard qu'on obtient en jouant ou en payant. |
| `no_daily_pressure` | Pas de récompense quotidienne, de série à ne pas casser, de coffre qui se recharge, de « reviens demain ». |
| `no_notifications` | Le jeu n'envoie jamais de notification pour faire revenir l'enfant. |
| `no_strangers` | Aucun échange avec des inconnus (chat, messages, profils réels). Des rivaux fictifs, oui. |
| `no_tracking` | Aucune donnée sur l'enfant n'est envoyée ailleurs (pas de mesure d'audience, pas de pixel). |
| `natural_stops` | La partie offre des moments où s'arrêter sans rien perdre. |

`third_parties` liste à part les domaines contactés pour des raisons techniques (une police chez Google Fonts, par exemple). Ce n'est pas interdit, mais c'est dit.

## Ce qu'on regarde aussi, sans en faire une règle
- La difficulté : l'enfant peut-il progresser sans frustration inutile ?
- Le temps : la durée d'une partie annoncée est-elle vraie ?
- L'apprentissage : ce que la fiche promet, l'enfant l'apprend-il vraiment ?

Ce sont les questions posées aux parents quand ils notent un jeu (v2).

## Ce que ça veut dire pour le kit
`ludi.js` lui-même suit la charte : il n'envoie rien sur le réseau, il ne parle qu'au launcher Ludiworld qui a ouvert le jeu, et il ne connaît de l'enfant qu'un pseudo. Voir `spec/donnees.md`.
