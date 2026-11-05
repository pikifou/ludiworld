# Les données des enfants

Ludiworld manipule des données d'enfants. On applique le principe le plus simple : **en garder le moins possible, au plus près de la famille**.

## v0 (aujourd'hui)
- Tout reste dans le navigateur de l'appareil (`localStorage`). Aucun serveur.
- Le launcher garde le temps de jeu, les records et la progression par jeu. Il n'y a pas encore de profil : l'appareil est l'enfant.

## v1 et après (comptes)
Le fonctionnement est décrit dans `spec/comptes.md`, et ce qui est dit au public dans `docs/confidentialite/`.
- Le compte appartient au parent et reste facultatif. L'enfant n'a qu'un pseudo, sans nom de famille, sans photo, sans date de naissance (l'âge suffit).
- En France, le traitement des données d'un enfant de moins de 15 ans demande le consentement du parent. Le parent crée le compte, active lui-même la copie en ligne (coupée par défaut) et peut tout effacer d'un geste.
- Ce qui est su d'un enfant ne sort de l'appareil que par cette copie, lisible par le parent seul : le bureau de Ludiworld n'y a pas accès.
- Les réponses aux questions d'essai parlent du visiteur (ce qu'il cherche), sans nom ni adresse tant qu'il n'a pas créé de compte. Elles servent à décider quoi construire. Le champ libre demande de ne pas nommer d'enfant.
- Les jeux ne reçoivent jamais l'identité de l'enfant, seulement le pseudo (voir `spec/kit.md`).
- Pas de revente, pas de publicité, pas de profilage : les données servent uniquement à montrer au parent ce que son enfant a fait et appris.
- Hébergement : Supabase (région UE), avec règles d'accès par famille, vérifiées par `supabase/verifier.mjs`.
