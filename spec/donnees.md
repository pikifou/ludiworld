# Les données des enfants

Ludiworld manipule des données d'enfants. On applique le principe le plus simple : **en garder le moins possible, au plus près de la famille**.

## v0 (aujourd'hui)
- Tout reste dans le navigateur de l'appareil (`localStorage`). Aucun serveur.
- Le launcher garde le temps de jeu, les records et la progression par jeu. Il n'y a pas encore de profil : l'appareil est l'enfant.

## v1 et après (comptes)
- Le compte appartient au parent. L'enfant n'a qu'un pseudo, sans nom de famille, sans photo, sans date de naissance (une tranche d'âge suffit).
- En France, le traitement des données d'un enfant de moins de 15 ans demande le consentement du parent. Le parent crée le compte, choisit ce qui est synchronisé et peut tout effacer d'un geste.
- Les jeux ne reçoivent jamais l'identité de l'enfant, seulement le pseudo (voir `spec/kit.md`).
- Pas de revente, pas de publicité, pas de profilage : les données servent uniquement à montrer au parent ce que son enfant a fait et appris.
- Hébergement envisagé : Supabase (région UE), avec règles d'accès par famille.
