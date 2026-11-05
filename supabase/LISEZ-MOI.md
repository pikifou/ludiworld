# La base de Ludiworld

Le schéma, les règles d'accès et de quoi les vérifier. Le fonctionnement est décrit dans `spec/comptes.md`.

## Vérifier sans serveur
```
npm i --prefix <dossier hors du dépôt> @electric-sql/pglite
node supabase/verifier.mjs <ce dossier>
```

## Mettre en service
1. Créer un projet Supabase en région UE et appliquer `migrations/`.
2. Créer soi-même le compte du bureau et confirmer son adresse, **puis seulement** la déclarer (cette ligne ne va pas dans le dépôt) : `insert into public.admins values ('adresse@en-minuscules');`. Dans l'autre sens, quelqu'un qui s'inscrit le premier avec cette adresse pourrait garder son mot de passe après la confirmation.
3. Reporter l'adresse du projet et sa clé publique (`sb_publishable_…`) dans `docs/site/barre.js`. Jamais la clé `service_role`.
4. Dans le tableau de bord de Supabase, Authentication :
   - URL Configuration : Site URL `https://ludiworld.app/compte/`, et ajouter aux Redirect URLs cette adresse et `http://localhost:7357/ludiworld/compte/`.
   - Sign In / Providers : garder « Confirm email » et « Secure email change » activés, activer « Secure password change », mot de passe de 8 caractères au moins.
   - SMTP Settings : brancher un service d'envoi. Sans lui, Supabase n'écrit qu'aux membres de l'organisation, quelques messages par heure : le public ne recevrait rien.
   - Email Templates : écrire les messages en français et en anglais.
5. Vérifier les avis de sécurité du projet (Advisors), puis faire le parcours en vrai avec une adresse de test.
