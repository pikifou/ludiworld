# Les comptes

Le compte appartient au parent. Il est facultatif : Ludiworld continue de marcher sans compte, et tout reste alors sur l'appareil. Tant que l'adresse et la clé de `docs/site/barre.js` sont vides, aucune trace de compte n'apparaît sur le site.

## Le parcours
- Barre du site : « Se connecter » et « Essayer », pour qui n'a rien de préparé.
- `docs/compte/#essayer` : quelques questions, une par écran, toutes facultatives. Aux quatre premières, on coche autant de réponses qu'on veut. Les réponses partent sans identité au fil de l'eau (table `envies`).
- `#creer` : adresse, mot de passe, « je suis un adulte ». Les messages de Ludiworld sont décochés d'avance. « Plus tard » mène à la préparation sans compte.
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

## La synchro
Coupée par défaut. Le parent l'active dans son espace, ce qui appelle `poser_synchro(true)` ; la couper efface la copie en ligne.

Un appareil n'envoie un foyer que s'il est relié au compte ouvert (`ludiworld.synchro`, qui porte l'identifiant du compte). Ce lien se pose en cochant la case, ou en se connectant avec son mot de passe sur un appareil vide pour y retrouver sa copie. Un lien reçu par e-mail ouvre le compte et rien d'autre : il peut venir de quelqu'un d'autre, et il ne remplace jamais un compte déjà ouvert. Se déconnecter ou « Tout effacer » délie l'appareil.

`docs/synchro.js` fusionne deux foyers : le réglage le plus récent gagne, enfant par enfant ; les statistiques gardent le plus grand, jamais une somme, pour pouvoir refusionner sans compter deux fois. Un enfant joué sur deux appareils le même jour voit donc son temps compté au plus grand des deux, pas à leur total : c'est une limite connue. Un enfant retiré laisse une trace dans `retires` pour ne pas revenir par un autre appareil.

`pousser_foyer` n'écrit que si la version n'a pas bougé ; sinon, on relit et on refusionne. L'appli synchronise à l'ouverture, au retour sur l'appli, après un réglage et après une partie, jamais pendant une partie. Hors ligne, rien ne change pour l'enfant.

## Les formules
Un droit est une clé de `formules.droits` (aujourd'hui `synchro`). `a_droit('synchro')` protège l'écriture côté base, `mes_droits()` renseigne l'écran. Une formule échue retombe sur `gratuit`. Lire et effacer ses données restent possibles quelle que soit la formule : les règles de lecture et d'effacement de `foyers` ne regardent pas les droits.

Ajouter une formule ou déplacer un droit : une ligne dans `formules`, sans changer le code. Personne ne peut écrire `abonnements` depuis un navigateur : c'est là qu'un futur paiement écrira, côté serveur.

## Tester
- `node supabase/verifier.mjs <dossier avec PGlite>` : les migrations et les règles d'accès sur un vrai Postgres (voir `supabase/LISEZ-MOI.md`).
- `node --test tests/*.test.js` : la fusion (`synchro.test.js`) et le client (`nuage.test.js`).
- `python tests/captures.py` : les parcours dans le navigateur, contre un faux Supabase.
