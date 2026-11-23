# Les données des enfants

Ludiworld manipule des données d'enfants. On applique le principe le plus simple : **en garder le moins possible, au plus près de la famille**.

## v0 (aujourd'hui)
- Tout reste dans le navigateur de l'appareil (`localStorage`). Aucun serveur.
- Le launcher garde le temps de jeu, les records et la progression par jeu. Il n'y a pas encore de profil : l'appareil est l'enfant.

## v1 et après (comptes)
Le fonctionnement est décrit dans `spec/comptes.md`, et ce qui est dit au public dans `docs/confidentialite/`.
- Le compte appartient au parent et reste facultatif. L'enfant n'a qu'un pseudo, sans nom de famille, sans photo, sans date de naissance (l'âge suffit).
- Le parent choisit « Créer mon compte » : le parcours annonce l'envoi des réglages et des résultats pour les retrouver sur ses autres appareils. Sans compte, tout reste local. Le parent peut désactiver la copie en ligne dans son compte, et effacer ses données. Les comptes existants conservent leur choix.
- La sauvegarde de chaque jeu (étage atteint, village, leçons faites : ce que le jeu choisit de confier à `Ludi.save`, 250 000 caractères au plus par jeu) suit l'enfant dans cette copie. Elle ne contient jamais l'identité de l'enfant : le jeu ne la connaît pas.
- Avec ses réglages, chaque enfant garde ses jeux et ce que le parent en a fait : `jeux[id]` (limite, jours, et `range`, l'heure du rangement en millisecondes : le jeu reste installé, il quitte « Les jeux de … » côté parent et va dans « Finis » côté enfant, rien n'est effacé), `jeuxRetires` (les réglages d'un jeu retiré, pour le réinstaller tel quel), `regarderTout: false` si le parent a coupé le bouton pour regarder tous les jeux. Ce sont des réglages : le plus récent gagne, enfant par enfant.
- Les demandes de l'enfant : `demandes` (`{ id: heure de la demande }`), faites côté enfant en regardant tous les jeux ; rien ne s'installe. Une demande traitée par un parent (« Installer » ou « Pas maintenant ») passe dans `demandesVues` (`{ id: heure de la demande traitée }`) pour ne pas revenir d'un autre appareil. Les deux suivent la copie en ligne et se fusionnent jeu par jeu, pas « le plus récent gagne » : une demande faite sur la tablette arrive sur le téléphone du parent même si ses réglages y sont plus récents (`docs/synchro.js`, testé). On ne garde pas pourquoi l'enfant demande ni combien de temps il a regardé : il n'y a rien à en déduire.
- Sur l'appareil seulement, hors du foyer (jamais dans la copie en ligne) : `apresVu` (`{ id de l'enfant: jour }`), le jour où l'idée hors écran de l'écran de fin a déjà été montrée, pour ne la montrer qu'une fois par jour.
- Ce qui est su d'un enfant ne sort de l'appareil que par cette copie, lisible par le parent seul : le bureau de Ludiworld n'y a pas accès.
- Les réponses aux questions d'essai parlent du visiteur (ce qu'il cherche), sans nom ni adresse tant qu'il n'a pas créé de compte. Elles servent à décider quoi construire. Le champ libre demande de ne pas nommer d'enfant.
- Les avis de parents (table `avis`, voir `spec/comptes.md`) parlent du jeu, pas de l'enfant : une note de 1 à 5 étoiles, « Le jeu marche bien chez vous ? », un mot libre facultatif, la langue et la date. Pas de question sur ce que l'enfant a appris. Le public ne lit que des totaux et des moyennes à partir de 5 avis et les mots acceptés par Julien, sans nom ; le bureau ne reçoit pas l'adresse du parent. Le champ libre demande de ne pas nommer d'enfant. Tout parent connecté peut donner un avis, sans condition de temps de jeu : rien du temps de jeu n'est lu ni envoyé avec l'avis.
- Les jeux ne reçoivent jamais l'identité de l'enfant, seulement le pseudo (voir `spec/kit.md`).
- Pas de revente, pas de publicité, pas de profilage : les données servent uniquement à montrer au parent ce que son enfant a fait et appris.
- Hébergement : Supabase (région UE), avec règles d'accès par famille, vérifiées par `supabase/verifier.mjs`.
