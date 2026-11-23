# Les comptes

Le compte appartient au parent. Il est facultatif : Ludiworld continue de marcher sans compte, et tout reste alors sur l'appareil. Tant que l'adresse et la clé de `docs/site/barre.js` sont vides, aucune trace de compte n'apparaît sur le site.

## Le parcours
- Le site est à la racine (`ludiworld.app/`), l'appli sous `app/` (`ludiworld.app/app/` ; Julien, 2026-11-18, comme Calm : l'adresse ouvre le site, « Se connecter » fait entrer dans l'appli).
- Barre du site : « Se connecter » et « Essayer », pour qui n'a rien de préparé. « Essayer » mène à la préparation (`app/#demarrer`). Sur un appareil préparé, le bouton de droite reste « Côté parent » (`app/#carnet`).
- `#connexion` : une fois connecté, on entre dans l'appli : le côté parent sur un appareil préparé (ou que la copie en ligne vient de préparer), derrière le code de la famille s'il le faut ; sinon la préparation. Venu des Réglages du côté parent, on y retourne.
- `docs/compte/#essayer` : quelques questions, une par écran, toutes facultatives. Aux quatre premières, on coche autant de réponses qu'on veut. Les réponses partent sans identité au fil de l'eau (table `envies`).
- `#creer` : adresse, mot de passe, « je suis un adulte ». Les messages de Ludiworld sont décochés d'avance. « Plus tard » mène à la préparation sans compte.

## L'appli installée et le Play Store
- `docs/manifest.webmanifest` : `start_url` et `scope` valent `app/`. Une appli installée (web app, ou l'appli Android du Play Store) démarre donc sur `https://ludiworld.app/app/`. C'est l'adresse à donner à l'outil qui fabrique l'appli Android (Bubblewrap, PWABuilder) : « start URL » `/app/`, hôte `ludiworld.app`.
- Le manifeste n'a pas d'`id` : l'identité d'une appli installée vient de `start_url`. Une web app installée avant le 2026-11-18 (départ à la racine) garde son ancienne adresse de départ : `docs/site/aiguillage.js` la renvoie dans l'appli (ouverte seule, `display-mode: standalone`, sans venir d'une page de Ludiworld). Hors ligne aussi : la racine et l'aiguillage sont dans le cache du service worker.
- Les pages du site (y compris `compte/`) sont hors de la portée de l'appli : ouvertes depuis l'appli installée (le logo du côté parent, « Mon compte »), elles s'affichent avec la petite barre du navigateur, puis on revient dans l'appli par son bouton.
- Le service worker (`docs/sw.js`) reste à la racine du site : sa portée couvre l'appli et le site, ce qu'il faut pour qu'une appli Android de confiance (TWA) s'ouvre sur `app/`. Les données de l'appareil (`localStorage`, clé `ludiworld.v1`) ne bougent pas : même origine.
- `#verifier` : le lien reçu par e-mail ramène sur la page, le jeton quitte aussitôt l'adresse.
- `#espace` : l'appareil, la copie en ligne, la formule, les données. Sur une tablette préparée, il demande d'abord le code parent.
- `docs/bureau/` : réservé aux adresses de la table `admins`, confirmées. Page publique, données non : tout passe par des fonctions `bureau_*`.

## Les données
Voir `spec/donnees.md`. La base est décrite par `supabase/migrations/`.

| Table | Contenu | Qui lit |
|---|---|---|
| `comptes` | langue, copie en ligne, accepte nos messages | le parent, le bureau |
| `abonnements` | la formule du compte | le parent, le bureau ; écriture hors navigateur |
| `formules` | les formules et leurs droits | tout le monde |
| `envies` | les réponses aux questions | le parent une fois rattachées, le bureau |
| `foyers` | la copie en ligne du foyer | **le parent seul, jamais le bureau** |
| `admins` | les adresses du bureau | personne depuis un navigateur |
| `usage_evenements` | les statistiques d'usage, sans nom (voir `spec/donnees.md`) | écriture seule par `noter_usage`, sans compte ; le bureau des totaux par `bureau_usage` ; personne ne relit les lignes |
| `avis` | l'avis d'un parent sur un jeu (1 à 5 étoiles, « le jeu marche bien chez vous ? », un mot libre) | le parent le sien ; le public des totaux et des moyennes à partir de 5 avis et les mots acceptés ; le bureau tout, sans adresse |

## La synchro
Le bouton « Créer mon compte » active la copie en ligne (la page le dit juste au-dessus) à l'inscription (`synchro: true` dans les métadonnées, migration `20261109120000_synchro_inscription.sql`). Les comptes existants gardent leur choix. Le parent peut la couper dans son espace : la copie en ligne est effacée et les nouvelles parties restent sur l'appareil utilisé. Ce que les enfants jouent sur un appareil ne se voit alors plus depuis les autres ; les anciennes données locales ne sont pas effacées.

Un appareil n'envoie un foyer que s'il est relié au compte ouvert (`ludiworld.synchro`, qui porte l'identifiant du compte). L'inscription faite ici ou la connexion par mot de passe autorise la liaison automatique (`ludiworld.liaison`, liée à l'identifiant du compte). Sur une tablette préparée, elle attend le code parent. Un lien reçu par e-mail seul ne relie rien : il peut venir de quelqu'un d'autre et ne remplace jamais un compte déjà ouvert. L'autorisation d'une inscription faite ici ne vaut que pour le même compte lors de la confirmation. Chaque synchronisation vérifie le choix du compte pour respecter une désactivation depuis un autre appareil. Se déconnecter ou « Tout effacer » délie l'appareil.

Un appareil déjà autorisé garde sa liaison quand la synchronisation est désactivée (`active: false`), sans envoyer de foyer. Il peut ainsi reprendre automatiquement si le parent la réactive depuis un autre appareil.

`docs/synchro.js` fusionne deux foyers : le réglage le plus récent gagne, enfant par enfant ; la sauvegarde d'un jeu (`Ludi.save`, voir `spec/kit.md`) est la plus récente, d'un bloc, jamais mélangée ; les statistiques gardent le plus grand, jamais une somme, pour pouvoir refusionner sans compter deux fois. Un enfant joué sur deux appareils le même jour voit donc son temps compté au plus grand des deux, pas à leur total : c'est une limite connue. Un enfant retiré laisse une trace dans `retires` pour ne pas revenir par un autre appareil. Un jeu rangé (`jeux[id].range`) et la case qui coupe le bouton de l'enfant (`regarderTout`) sont des réglages comme les autres. Les demandes de l'enfant (`demandes`) ne sont pas des réglages : elles se fusionnent jeu par jeu, et une demande traitée par un parent est notée dans `demandesVues` pour ne pas revenir (voir `spec/donnees.md`).

`pousser_foyer` n'écrit que si la version n'a pas bougé ; sinon, on relit et on refusionne. L'appli synchronise à l'ouverture, au retour sur l'appli, au retour du réseau, après un réglage et après une partie, jamais pendant une partie active. L'écran d'arrêt après la limite synchronise sans attendre un bouton. Le carnet ouvert sur Aujourd'hui reçoit les résultats à l'ouverture de l'onglet et toutes les 30 secondes ; une réception ne remplace pas les formulaires des autres onglets en cours de modification. Hors ligne, rien ne change pour l'enfant.

## Plusieurs adultes, plusieurs maisons (plan 3, étape 1)
Deux appareils connectés au même compte partagent le foyer : mêmes enfants, mêmes jeux, mêmes parties (pour les jeux qui utilisent la sauvegarde du kit), mêmes règles, même code parent. C'est vrai pour deux parents de la même maison comme pour deux maisons. Il faut se partager l'adresse et le mot de passe du compte.
- Aucun texte ne l'explique à l'écran : c'est ce qu'on attend d'un compte (Julien, 2026-11-18, la ligne de Réglages a été retirée).
- L'étape 2 (inviter un adulte avec son propre compte, un foyer partagé par plusieurs comptes) attend la décision de Julien.

## Le code parent oublié
- Appareil connecté à un compte : « Code oublié ? » demande le mot de passe du compte (`LudiNuage.verifierMotDePasse`), vérifié par Supabase par le même appel que la connexion (`/auth/v1/token?grant_type=password`, adresse du compte ouvert ici). Le compte doit être celui de l'appareil ; la session que la vérification ouvre est refermée aussitôt (`logout?scope=local`) ; la session et la liaison de l'appareil ne changent pas. Le mot de passe n'est gardé nulle part : le champ est vidé dès l'envoi, rien n'est écrit dans `localStorage` ni `sessionStorage`.
- Juste : on choisit un nouveau code tout de suite ; `codeChange` est posé comme après l'attente, et l'autre appareil le voit dans Mes jeux après la synchro (le code fait partie du foyer). Faux : « Ce n'est pas le bon mot de passe. », rien d'autre ne change.
- Sans le mot de passe (Claude, 2026-11-18, conception déléguée par Julien) : sous le champ, « Je ne connais pas le mot de passe » envoie un code à 6 chiffres à l'adresse du compte (`LudiNuage.envoyerCodeEmail`, `/auth/v1/otp` avec `create_user: false`), montrée masquée (« p•••@gmail.com »). Le code tapé est vérifié par `/auth/v1/verify` (`type: 'email'`, `LudiNuage.verifierCodeEmail`), la session ainsi ouverte est refermée aussitôt comme pour le mot de passe. Bon code : un nouveau code parent tout de suite. Mauvais ou périmé : « Ce code ne marche pas. », on retape ou on renvoie (« Renvoyer » attend 60 s). Trop d'envois (429) : on le dit. Le code n'est gardé nulle part.
- **À faire par Julien, dans le tableau de bord Supabase** (Authentication, Emails, modèle « Magic Link ») : l'e-mail doit contenir `{{ .Token }}`, sinon les 6 chiffres n'arrivent pas (seulement un lien). À régler avec les autres e-mails.
- Hors ligne (ou vérification impossible, ou trop d'essais) : on le dit, et « Attendre 30 minutes à la place » mène à l'attente habituelle. Pendant cette attente, « Taper plutôt le mot de passe du compte » reste possible.
- Appareil sans compte : comme avant, 30 minutes sans jeu, puis un nouveau code.

## Les avis de parents (plan 5, Julien, 2026-11-18, refaits le même jour)
Migrations `20261118120000_avis.sql` (la table et les droits), puis `20261118180000_avis_etoiles.sql` (Julien, décision 9 du 2026-11-18 : le premier bloc, trois questions fermées, était trop contraignant). Une note en étoiles, et « Le jeu marche bien chez vous ? » pour savoir si une mauvaise note vient d'un bug (« une étoile, le jeu crashe chez moi ») ou d'autre chose. Retirées : « La fiche dit vrai ? » (utile seulement quand d'autres que Julien écriront des fiches) et « Votre enfant y retourne de lui-même ? ». Rien sur ce que l'enfant aurait appris.
- Où : dans la fiche d'un jeu côté parent, sous « L'avis des parents », un bloc « Votre avis » (`.pa-avis`). Pour tout parent connecté, sur la fiche de n'importe quel jeu, qu'un enfant y ait joué ou non (Julien, 2026-11-18 : la condition des 30 minutes de jeu est retirée).
- Le bloc : cinq grandes étoiles (`etoiles`, 1 à 5 ; des boutons radio, flèches du clavier, « 3 étoiles » pour un lecteur d'écran, 54 px), « Le jeu marche bien chez vous ? » Oui / Pas toujours / Non (`marche` : `oui`, `pas-toujours`, `non`), un mot libre facultatif (`mot`, 400 caractères), « Lu par Julien avant d'être montré, sans votre nom ». Un seul bouton d'envoi ; les deux réponses sont obligatoires, le mot non.
- Un avis par compte et par jeu, modifiable (`donner_avis(p_jeu, p_etoiles, p_marche, p_mot, p_langue)`, seule voie d'écriture : la base pose `mot_etat`). Un mot changé repart à relire (`a-relire`), un mot inchangé garde sa relecture. Le parent relit le sien (`lireAvis`) et peut le retirer (`retirerAvis`). Garde-fou : 50 jeux au plus par compte. Effacer le compte efface ses avis.
- Ce que voient les familles, dans la fiche (site et appli, `site/catalogue.js`, section `.cat-avis`), à partir de 5 avis : les étoiles moyennes dessinées et le chiffre (« 4,3 »), le nombre d'avis (« 12 avis ») ; puis, si des parents disent que le jeu ne marche pas bien chez eux (« pas toujours » ou « non »), une ligne à part : « 2 parents disent que le jeu ne marche pas bien chez eux. Sans eux : 4,7. » (la moyenne chez ceux pour qui il marche bien ; sans elle si personne) ; puis trois mots acceptés au plus, dans la langue de la fiche, sans nom. Rien sous 5 avis : `avis_publics` rend `null`, pas même le nombre. Sinon il rend `total`, `etoiles` (répartition), `moyenne`, `marche` (répartition), `moyenne_marche_bien`, `mots`. Lu sans jeton (`LudiNuage.avisPublics`).
- Le bureau, rubrique « Les avis » : les mots à relire, avec les étoiles et « marche » de l'avis (Accepter : le montrer / Refuser : ne pas le montrer, `bureau_relire_mot`, qui ne change rien si le parent a modifié son mot entre-temps), par jeu (nombre, moyenne, « marche », moyenne là où il marche bien, montré ou pas), tous les avis avec leurs étoiles. Pas d'adresse e-mail (`bureau_avis`). L'aperçu compte les mots à relire.
- Limite : un même parent peut créer plusieurs comptes. La confirmation de l'adresse est exigée, rien de plus.

## Les formules
Un droit est une clé de `formules.droits` (aujourd'hui `synchro`). `a_droit('synchro')` protège l'écriture côté base, `mes_droits()` renseigne l'écran. Une formule échue retombe sur `gratuit`. Lire et effacer ses données restent possibles quelle que soit la formule : les règles de lecture et d'effacement de `foyers` ne regardent pas les droits.

Ajouter une formule ou déplacer un droit : une ligne dans `formules`, sans changer le code. Personne ne peut écrire `abonnements` depuis un navigateur : c'est là qu'un futur paiement écrira, côté serveur.

## Tester
- `node supabase/verifier.mjs <dossier avec PGlite>` : les migrations et les règles d'accès sur un vrai Postgres (voir `supabase/LISEZ-MOI.md`).
- `node --test tests/*.test.js` : la fusion (`synchro.test.js`) et le client (`nuage.test.js`).
- `python tests/captures.py` : les parcours dans le navigateur, contre un faux Supabase.
