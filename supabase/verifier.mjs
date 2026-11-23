// Vérifie les migrations et les droits d'accès sur un vrai Postgres, sans serveur ni compte (PGlite).
//   npm i --prefix <dossier> @electric-sql/pglite
//   node supabase/verifier.mjs <dossier>
// PGlite reste hors du dépôt : Ludiworld n'a pas de dépendance. Un petit schéma `auth` imite celui de Supabase.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

process.on('uncaughtException', (e) => { console.error('ERREUR : ' + e.message); process.exit(1); });
const dossier = process.argv[2];
if (!dossier) { console.error('Usage : node supabase/verifier.mjs <dossier où PGlite est installé>'); process.exit(2); }
const entree = createRequire(path.join(path.resolve(dossier), 'x.js')).resolve('@electric-sql/pglite');
const { PGlite } = await import(pathToFileURL(entree).href);

const ICI = path.dirname(fileURLToPath(import.meta.url));
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz,
    last_sign_in_at timestamptz, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  -- Comme Supabase : par défaut, les rôles publics ont tous les droits sur ce qui est créé dans public.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);
for (const f of readdirSync(path.join(ICI, 'migrations')).sort()) await db.exec(readFileSync(path.join(ICI, 'migrations', f), 'utf8'));

// Exécute une requête sous un rôle et une identité, sans garder le rôle ensuite.
async function en(role, uid, sql, params) {
  await db.exec(`set role ${role}; select set_config('request.uid', '${uid || ''}', false);`);
  try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role;'); }
}
let ok = 0, ko = 0;
function check(nom, cond, detail) {
  if (cond) { ok++; console.log('  ok  ' + nom); } else { ko++; console.log('  KO  ' + nom + (detail ? ' : ' + JSON.stringify(detail) : '')); }
}
async function refuse(nom, role, uid, sql, params) {
  try { const r = await en(role, uid, sql, params); check(nom, false, r); }
  catch (e) { check(nom, true); }
}
async function vide(nom, role, uid, sql, params) { const r = await en(role, uid, sql, params); check(nom, r.length === 0, r); }

const ID = { a: '00000000-0000-4000-8000-00000000000a', b: '00000000-0000-4000-8000-00000000000b', adm: '00000000-0000-4000-8000-00000000000c', faux: '00000000-0000-4000-8000-00000000000d' };
const ENV = { a: '10000000-0000-4000-8000-00000000000a', b: '10000000-0000-4000-8000-00000000000b', l: '10000000-0000-4000-8000-00000000000c' };

console.log('Questionnaire, sans compte');
await en('anon', null, `select public.enregistrer_envie($1, 'fr', array['aider','jouer'], array['parent','enseignant'], array['6-8'], array['apprendre'], 'jamais', 'Un jeu sur les volcans', true)`, [ENV.a]);
await en('anon', null, `select public.enregistrer_envie($1, 'en', array['creer'])`, [ENV.b]);
await en('anon', null, `select public.enregistrer_envie($1, 'fr', array['curieux'])`, [ENV.l]);
check('la réponse est enregistrée', (await db.query('select count(*)::int n from public.envies')).rows[0].n === 3);
await refuse('une valeur inconnue est refusée', 'anon', null, `select public.enregistrer_envie(gen_random_uuid(), 'fr', array['pirater'])`);
await refuse('un profil inconnu est refusé', 'anon', null, `select public.enregistrer_envie(gen_random_uuid(), 'fr', '{}', array['parent','pirate'])`);
await refuse('un message trop long est refusé', 'anon', null, `select public.enregistrer_envie(gen_random_uuid(), 'fr', '{}', '{}', '{}', '{}', null, repeat('x', 501))`);
await refuse('anon n\'appelle pas le bureau', 'anon', null, 'select * from public.bureau_envies()');
await refuse('anon ne lit pas les réponses', 'anon', null, 'select * from public.envies');
await refuse('anon n\'écrit pas la table directement', 'anon', null, `insert into public.envies (id) values (gen_random_uuid())`);

console.log('Création de comptes');
await db.exec(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('${ID.a}', 'a@exemple.test', now(), '{"langue": "en", "nouvelles": "true", "envie_id": "${ENV.a}", "formule": "royale", "est_admin": true}'),
  ('${ID.b}', 'b@exemple.test', now(), '{"envie_id": "pas-un-uuid", "nouvelles": "oui"}'),
  ('${ID.adm}', 'patron@exemple.test', now(), '{"synchro": true}')`);
const compteA = (await db.query('select * from public.comptes where id = $1', [ID.a])).rows[0];
check('compte créé avec langue et nouvelles', compteA.langue === 'en' && compteA.nouvelles === true, compteA);
check('une inscription qui annonce la synchro l\'active', (await db.query('select synchro from public.comptes where id = $1', [ID.adm])).rows[0].synchro === true);
check('sans ce choix à l\'inscription, la synchro reste coupée', compteA.synchro === false);
const compteB = (await db.query('select * from public.comptes where id = $1', [ID.b])).rows[0];
check('des métadonnées invalides ne cassent pas l\'inscription', compteB && compteB.nouvelles === false && compteB.langue === 'fr', compteB);
check('toujours gratuit à la création, quoi qu\'on envoie', (await db.query('select formule_id f from public.abonnements where compte_id = $1', [ID.a])).rows[0].f === 'gratuit');
check('la réponse est rattachée au compte', (await db.query('select compte_id c from public.envies where id = $1', [ENV.a])).rows[0].c === ID.a);

console.log('Une réponse rattachée reste à son compte');
await en('anon', null, `select public.enregistrer_envie($1, 'fr', array['curieux'])`, [ENV.a]);
check('anon ne peut plus la modifier', (await db.query('select envie from public.envies where id = $1', [ENV.a])).rows[0].envie.includes('aider'));
await en('authenticated', ID.b, `select public.enregistrer_envie($1, 'fr', array['curieux'])`, [ENV.a]);
check('un autre compte non plus', (await db.query('select envie from public.envies where id = $1', [ENV.a])).rows[0].envie.includes('aider'));
await en('authenticated', ID.b, 'select public.rattacher_envie($1)', [ENV.a]);
check('un autre compte ne peut pas se la rattacher', (await db.query('select compte_id c from public.envies where id = $1', [ENV.a])).rows[0].c === ID.a);
await en('authenticated', ID.b, 'select public.rattacher_envie($1)', [ENV.b]);
check('connexion après le questionnaire : rattachée', (await db.query('select compte_id c from public.envies where id = $1', [ENV.b])).rows[0].c === ID.b);
await en('anon', null, 'select public.rattacher_envie($1)', [ENV.l]).catch(() => {});
check('anon ne rattache rien', (await db.query('select compte_id c from public.envies where id = $1', [ENV.l])).rows[0].c === null);

const ENV_CO = '10000000-0000-4000-8000-00000000000d';
await en('authenticated', ID.b, `select public.enregistrer_envie($1, 'fr', array['aider'])`, [ENV_CO]);
check('quelqu\'un de connecté répond en son nom', (await db.query('select compte_id c from public.envies where id = $1', [ENV_CO])).rows[0].c === ID.b);

console.log('Chacun chez soi');
check('je lis mon compte', (await en('authenticated', ID.a, 'select * from public.comptes')).length === 1);
check('je ne lis que mes réponses', (await en('authenticated', ID.b, 'select * from public.envies')).every(r => r.compte_id === ID.b));
await en('authenticated', ID.a, `update public.comptes set langue = 'fr', nouvelles = false where id = $1`, [ID.a]);
check('je change mes préférences', (await db.query('select nouvelles from public.comptes where id = $1', [ID.a])).rows[0].nouvelles === false);
await en('authenticated', ID.b, `update public.comptes set langue = 'en' where id = $1`, [ID.a]);
check('je ne change pas celles d\'un autre', (await db.query('select langue from public.comptes where id = $1', [ID.a])).rows[0].langue === 'fr');

console.log('Personne ne se donne une formule ni le bureau');
await refuse('écrire sa formule', 'authenticated', ID.a, `update public.abonnements set formule_id = 'gratuit', fin_le = null where compte_id = $1`, [ID.a]);
await refuse('activer la synchro sans passer par la fonction', 'authenticated', ID.a, `update public.comptes set synchro = true where id = $1`, [ID.a]);
await refuse('créer une formule', 'authenticated', ID.a, `insert into public.formules (id, nom) values ('moi', '{}')`);
await refuse('s\'ajouter au bureau', 'authenticated', ID.a, `insert into public.admins values ('a@exemple.test')`);
await refuse('lire le bureau', 'authenticated', ID.a, 'select * from public.admins');

console.log('Droits des formules');
check('droits lus', (await en('authenticated', ID.a, 'select public.mes_droits() d'))[0].d.droits.synchro === true);
await db.query(`insert into public.formules (id, nom, droits) values ('soutien', '{"fr":"Soutien","en":"Support"}', '{"synchro": true, "extra": true}')`);
await db.query(`update public.abonnements set formule_id = 'soutien', source = 'paiement', fin_le = now() + interval '1 day' where compte_id = $1`, [ID.a]);
check('une formule payante donne ses droits', (await en('authenticated', ID.a, `select public.a_droit('extra') x`))[0].x === true);
await db.query(`update public.abonnements set fin_le = now() - interval '1 day' where compte_id = $1`, [ID.a]);
check('échue : retour au gratuit', (await en('authenticated', ID.a, 'select public.mes_droits() d'))[0].d.formule === 'gratuit');
check('échue : le droit payant disparaît', (await en('authenticated', ID.a, `select public.a_droit('extra') x`))[0].x === false);
await db.query(`update public.abonnements set formule_id = 'gratuit', source = 'offert', fin_le = null where compte_id = $1`, [ID.a]);
check('sans compte : aucun droit', (await en('authenticated', ID.faux, `select public.a_droit('synchro') x`))[0].x === false);

console.log('Le foyer synchronisé');
await refuse('synchro coupée : on n\'écrit pas', 'authenticated', ID.a, `select public.pousser_foyer('{"pin":"x"}', 0)`);
await en('authenticated', ID.a, 'select public.poser_synchro(true)');
const v1 = (await en('authenticated', ID.a, `select public.pousser_foyer('{"pin":"x","enfants":[{"id":"e1"}]}', 0) v`))[0].v;
check('première écriture : version 1', Number(v1) === 1, v1);
check('deuxième écriture depuis une version périmée : refusée', (await en('authenticated', ID.a, `select public.pousser_foyer('{"pin":"y"}', 0) v`))[0].v === null);
check('écriture à jour : version 2', Number((await en('authenticated', ID.a, `select public.pousser_foyer('{"pin":"z"}', 1) v`))[0].v) === 2);
check('conflit de version : rien n\'est écrit', (await en('authenticated', ID.a, `select public.pousser_foyer('{"pin":"w"}', 1) v`))[0].v === null);
check('je relis mon foyer', (await en('authenticated', ID.a, 'select etat from public.foyers'))[0].etat.pin === 'z');
await vide('un autre parent ne le voit pas', 'authenticated', ID.b, 'select * from public.foyers');
await refuse('anon ne le voit pas', 'anon', null, 'select * from public.foyers');
await en('authenticated', ID.b, 'select public.poser_synchro(true)');
await refuse('écrire pour un autre compte', 'authenticated', ID.b, `insert into public.foyers (compte_id, etat) values ($1, '{}')`, [ID.a]);
await en('authenticated', ID.b, `update public.foyers set etat = '{"pin":"pirate"}' where compte_id = $1`, [ID.a]);
check('modifier le foyer d\'un autre : sans effet', (await db.query('select etat from public.foyers where compte_id = $1', [ID.a])).rows[0].etat.pin === 'z');
await en('authenticated', ID.b, `delete from public.foyers where compte_id = $1`, [ID.a]);
check('effacer le foyer d\'un autre : sans effet', (await db.query('select count(*)::int n from public.foyers where compte_id = $1', [ID.a])).rows[0].n === 1);
await db.query(`update public.formules set droits = '{}' where id = 'gratuit'`);
await refuse('droit retiré à la formule : on n\'écrit plus', 'authenticated', ID.a, `select public.pousser_foyer('{"pin":"q"}', 2)`);
check('droit retiré : le parent relit toujours ses données', (await en('authenticated', ID.a, 'select etat from public.foyers'))[0].etat.pin === 'z');
await db.query(`update public.formules set droits = '{"synchro": true}' where id = 'gratuit'`);
await en('authenticated', ID.a, 'select public.poser_synchro(false)');
check('couper la synchro efface la copie en ligne', (await db.query('select count(*)::int n from public.foyers where compte_id = $1', [ID.a])).rows[0].n === 0);

console.log('Le bureau');
await db.exec(`insert into public.admins values ('patron@exemple.test')`);
check('un parent n\'est pas admin', (await en('authenticated', ID.a, 'select public.est_admin() x'))[0].x === false);
await refuse('un parent n\'ouvre pas les chiffres', 'authenticated', ID.a, 'select public.bureau_apercu()');
await refuse('un parent ne liste pas les comptes', 'authenticated', ID.a, 'select * from public.bureau_comptes()');
await refuse('un parent ne liste pas les réponses', 'authenticated', ID.a, 'select * from public.bureau_envies()');
await refuse('anon n\'ouvre pas les chiffres', 'anon', null, 'select public.bureau_apercu()');
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${ID.faux}', 'imposteur@exemple.test', null); insert into public.admins values ('imposteur@exemple.test');`);
check('adresse d\'admin non confirmée : pas admin', (await en('authenticated', ID.faux, 'select public.est_admin() x'))[0].x === false);
check('adresse confirmée : admin', (await en('authenticated', ID.adm, 'select public.est_admin() x'))[0].x === true);
const ap = (await en('authenticated', ID.adm, 'select public.bureau_apercu() a'))[0].a;
check('aperçu : le parcours', ap.parcours.commences === 4 && ap.parcours.comptes === 4 && ap.parcours.rattaches === 3, ap.parcours);
check('aperçu : les réponses', ap.reponses.envie.creer === 1 && ap.reponses.envie.aider === 2 && ap.reponses.profils.parent === 1 && ap.reponses.profils.enseignant === 1, ap.reponses);
check('aperçu : 12 semaines', ap.semaines.length === 12);
check('aperçu : les formules', ap.formules.some(f => f.id === 'gratuit' && f.comptes === 4), ap.formules);
await en('authenticated', ID.b, 'select public.pousser_foyer($1, 0)', [JSON.stringify({ enfants: [{ enfant: { nom: 'SECRET-PSEUDO' } }] })]);
await vide('le bureau ne voit aucun foyer', 'authenticated', ID.adm, 'select * from public.foyers');
const toutBureau = JSON.stringify([ap, await en('authenticated', ID.adm, 'select * from public.bureau_comptes()'), await en('authenticated', ID.adm, 'select * from public.bureau_envies()')]);
check('rien du foyer dans ce que le bureau reçoit', !toutBureau.includes('SECRET-PSEUDO'));
const cherche = await en('authenticated', ID.adm, `select email from public.bureau_comptes('b@ex')`);
check('recherche par adresse', cherche.length === 1 && cherche[0].email === 'b@exemple.test', cherche);
check('la recherche prend % au pied de la lettre', (await en('authenticated', ID.adm, `select email from public.bureau_comptes('%')`)).length === 0);

console.log('Les avis de parents (deux migrations à la suite : la première, puis les étoiles)');
const colonnes = (await db.query(`select column_name c from information_schema.columns where table_schema = 'public' and table_name = 'avis'`)).rows.map(r => r.c);
check('les colonnes retirées n\'existent plus', !colonnes.some(c => ['fiche', 'fiche_quoi', 'retourne'].includes(c)), colonnes);
check('la colonne des étoiles existe', colonnes.includes('etoiles'), colonnes);
const signatures = (await db.query(`select p.oid::regprocedure::text s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('donner_avis', 'avis_publics', 'bureau_avis', 'bureau_relire_mot') order by 1`)).rows.map(r => r.s);
check('l\'ancienne donner_avis est supprimée, une seule version de chaque', JSON.stringify(signatures) === JSON.stringify([
  'avis_publics(text,text)', 'bureau_avis(integer,integer)', 'bureau_relire_mot(uuid,text,text,boolean)', 'donner_avis(text,integer,text,text,text)']), signatures);
const reglages = (await db.query(`select p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('donner_avis', 'avis_publics', 'bureau_avis')`)).rows;
check('security definer et search_path vide', reglages.length === 3 && reglages.every(r => r.prosecdef && (r.proconfig || []).length === 1 && /^search_path=(""|)$/.test(r.proconfig[0])), reglages);
const droit = async (role, f) => (await db.query(`select has_function_privilege($1, $2, 'execute') x`, [role, f])).rows[0].x;
check('anon : avis_publics oui, donner_avis et bureau_avis non',
  await droit('anon', 'public.avis_publics(text,text)') && !(await droit('anon', 'public.donner_avis(text,int,text,text,text)')) && !(await droit('anon', 'public.bureau_avis(int,int)')));
check('authenticated : les trois', await droit('authenticated', 'public.avis_publics(text,text)') && await droit('authenticated', 'public.donner_avis(text,int,text,text,text)') && await droit('authenticated', 'public.bureau_avis(int,int)'));
check('aucun droit d\'exécuter pour tout le monde (public)', !(await db.query(`select coalesce(bool_or(a.grantee = 0), false) x from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
  aclexplode(p.proacl) a where n.nspname = 'public' and p.proname in ('donner_avis', 'avis_publics', 'bureau_avis')`)).rows[0].x);

const P = [0, 1, 2, 3, 4, 5, 6].map(i => '20000000-0000-4000-8000-00000000000' + i);
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ${P.map((id, i) => `('${id}', 'p${i}@exemple.test', now())`).join(', ')}`);
const avisDe = async (uid, jeu, etoiles, m, mot, langue) =>
  en('authenticated', uid, 'select public.donner_avis($1, $2, $3, $4, $5)', [jeu, etoiles, m, mot ?? null, langue ?? 'fr']);
const publics = async (jeu, langue, role = 'anon', uid = null) => (await en(role, uid, 'select public.avis_publics($1, $2) p', [jeu, langue || 'fr']))[0].p;
const ligneAvis = async (uid, jeu) => (await db.query('select * from public.avis where compte_id = $1 and jeu = $2', [uid, jeu])).rows[0];

await refuse('anon ne lit pas la table des avis', 'anon', null, 'select * from public.avis');
await refuse('anon ne donne pas d\'avis', 'anon', null, `select public.donner_avis('pluie', 4, 'oui')`);
await refuse('adresse non confirmée : pas d\'avis', 'authenticated', ID.faux, `select public.donner_avis('pluie', 4, 'oui')`);
await refuse('l\'ancienne forme (trois réponses) ne passe plus', 'authenticated', ID.a, `select public.donner_avis('pluie', 'oui', 'oui', 'oui')`);
await refuse('une réponse inconnue est refusée', 'authenticated', ID.a, `select public.donner_avis('pluie', 4, 'super')`);
await refuse('0 étoile est refusé', 'authenticated', ID.a, `select public.donner_avis('pluie', 0, 'oui')`);
await refuse('6 étoiles est refusé', 'authenticated', ID.a, `select public.donner_avis('pluie', 6, 'oui')`);
await refuse('sans étoiles : refusé', 'authenticated', ID.a, `select public.donner_avis('pluie', null, 'oui')`);
await refuse('un nom de jeu qui n\'en est pas un est refusé', 'authenticated', ID.a, `select public.donner_avis('../x', 4, 'oui')`);
await refuse('un mot trop long est refusé', 'authenticated', ID.a, `select public.donner_avis('pluie', 4, 'oui', repeat('x', 401))`);

await avisDe(ID.a, 'pluie', 5, 'oui', '  Mes deux enfants y jouent ensemble.  ');
let la = await ligneAvis(ID.a, 'pluie');
check('l\'avis est enregistré, le mot à relire', la && la.etoiles === 5 && la.marche === 'oui' && la.mot === 'Mes deux enfants y jouent ensemble.' && la.mot_etat === 'a-relire', la);
check('je relis le mien', (await en('authenticated', ID.a, 'select jeu, etoiles, mot_etat from public.avis')).length === 1);
await vide('un compte ne lit pas l\'avis d\'un autre', 'authenticated', ID.b, 'select * from public.avis');
await refuse('écrire dans la table sans passer par la fonction', 'authenticated', ID.a, `insert into public.avis (compte_id, jeu, etoiles, marche, mot, mot_etat) values ($1, 'autre', 5, 'oui', 'x', 'accepte')`, [ID.a]);
await refuse('écrire un avis pour un autre compte', 'authenticated', ID.b, `insert into public.avis (compte_id, jeu, etoiles, marche) values ($1, 'autre', 1, 'non')`, [ID.a]);
await refuse('accepter soi-même son mot', 'authenticated', ID.a, `update public.avis set mot_etat = 'accepte' where compte_id = $1`, [ID.a]);
await refuse('changer ses étoiles sans passer par la fonction', 'authenticated', ID.a, `update public.avis set etoiles = 1 where compte_id = $1`, [ID.a]);
await en('authenticated', ID.b, 'delete from public.avis where compte_id = $1', [ID.a]);
check('retirer l\'avis d\'un autre : sans effet', !!(await ligneAvis(ID.a, 'pluie')));
await refuse('un parent ne lit pas tous les avis', 'authenticated', ID.a, 'select * from public.bureau_avis()');
await refuse('anon ne lit pas tous les avis', 'anon', null, 'select * from public.bureau_avis()');
await refuse('un parent n\'accepte pas un mot', 'authenticated', ID.a, 'select public.bureau_relire_mot($1, $2, $3, true)', [ID.a, 'pluie', la.mot]);
await refuse('anon n\'accepte pas un mot', 'anon', null, 'select public.bureau_relire_mot($1, $2, $3, true)', [ID.a, 'pluie', la.mot]);

// Pluie : A 5 oui, B 1 non (« le jeu crashe »), P0 4 oui, P1 4 pas-toujours, P2 3 oui (en anglais).
await avisDe(ID.b, 'pluie', 1, 'non', 'Avis de B');
await avisDe(P[0], 'pluie', 4, 'oui');
await avisDe(P[1], 'pluie', 4, 'pas-toujours');
check('4 avis : le public ne lit rien, pas même le nombre', (await publics('pluie')) === null);
check('4 avis : un parent connecté non plus', (await publics('pluie', 'fr', 'authenticated', ID.a)) === null);
await avisDe(P[2], 'pluie', 3, 'oui', 'A thoughtful game.', 'en');
let pub = await publics('pluie');
check('5 avis : le total et la répartition des étoiles', pub && pub.total === 5 && JSON.stringify(pub.etoiles) === JSON.stringify({ 1: 1, 3: 1, 4: 2, 5: 1 }), pub);
check('5 avis : la moyenne, un chiffre après la virgule (17 / 5 = 3,4)', Number(pub.moyenne) === 3.4, pub.moyenne);
check('5 avis : la répartition de « marche »', pub.marche.oui === 3 && pub.marche['pas-toujours'] === 1 && pub.marche.non === 1, pub.marche);
check('la moyenne chez ceux pour qui le jeu marche bien (5, 4, 3 : 4,0)', Number(pub.moyenne_marche_bien) === 4, pub.moyenne_marche_bien);
check('plus rien de l\'ancien avis', !('fiche' in pub) && !('retourne' in pub), Object.keys(pub));
check('aucun mot avant la relecture', pub.mots.length === 0, pub.mots);
check('rien qui désigne un compte', !JSON.stringify(pub).includes(ID.a) && !JSON.stringify(pub).includes('@'));
check('un autre jeu reste sous le seuil', (await publics('tour')) === null);

const tous = await en('authenticated', ID.adm, 'select * from public.bureau_avis()');
check('le bureau lit tous les avis, le mot à relire d\'abord', tous.length === 5 && tous[0].mot_etat === 'a-relire', tous.map(x => x.mot_etat));
check('le bureau lit les étoiles et « marche »', tous.some(x => x.etoiles === 1 && x.marche === 'non') && tous.every(x => x.etoiles >= 1), tous.map(x => [x.etoiles, x.marche]));
check('le bureau ne reçoit pas d\'adresse e-mail', !JSON.stringify(tous).includes('@exemple.test'));
check('un texte qui a changé depuis la lecture : rien n\'est accepté', (await en('authenticated', ID.adm, 'select public.bureau_relire_mot($1, $2, $3, true) x', [ID.a, 'pluie', 'un autre texte']))[0].x === false);
check('accepter le mot de A', (await en('authenticated', ID.adm, 'select public.bureau_relire_mot($1, $2, $3, true) x', [ID.a, 'pluie', la.mot]))[0].x === true);
check('refuser le mot de B', (await en('authenticated', ID.adm, 'select public.bureau_relire_mot($1, $2, $3, false) x', [ID.b, 'pluie', 'Avis de B']))[0].x === true);
await en('authenticated', ID.adm, 'select public.bureau_relire_mot($1, $2, $3, true)', [P[2], 'pluie', 'A thoughtful game.']);
pub = await publics('pluie');
check('le mot accepté est public, le refusé non', pub.mots.length === 1 && pub.mots[0] === 'Mes deux enfants y jouent ensemble.', pub.mots);
check('les mots dans la langue de la fiche', (await publics('pluie', 'en')).mots.join() === 'A thoughtful game.');
await avisDe(ID.a, 'pluie', 2, 'pas-toujours', 'Mes deux enfants y jouent ensemble.');
la = await ligneAvis(ID.a, 'pluie');
check('changer ses étoiles garde la relecture d\'un mot inchangé', la.mot_etat === 'accepte' && la.etoiles === 2 && la.marche === 'pas-toujours', la);
pub = await publics('pluie');
check('un avis par compte et par jeu, les calculs suivent (2,8 ; sans souci 3,5)', pub.total === 5 && pub.marche.oui === 2 && Number(pub.moyenne) === 2.8 && Number(pub.moyenne_marche_bien) === 3.5, pub);
await avisDe(ID.a, 'pluie', 2, 'pas-toujours', 'Un mot changé après la relecture');
la = await ligneAvis(ID.a, 'pluie');
check('un mot changé repart à relire', la.mot_etat === 'a-relire' && la.mot_relu_le === null, la);
check('et quitte la fiche publique', (await publics('pluie')).mots.length === 0);
await avisDe(ID.a, 'pluie', 2, 'pas-toujours', '   ');
la = await ligneAvis(ID.a, 'pluie');
check('un mot vidé : plus de mot, plus d\'état', la.mot === null && la.mot_etat === null, la);

// Personne pour qui le jeu marche bien : pas de moyenne « sans eux ».
for (let i = 0; i < 5; i++) await avisDe(P[i], 'crash', 1, i % 2 ? 'non' : 'pas-toujours');
pub = await publics('crash');
check('personne pour qui le jeu marche bien : pas de moyenne à part', pub.total === 5 && Number(pub.moyenne) === 1 && pub.moyenne_marche_bien === null && !pub.marche.oui, pub);

await en('authenticated', P[1], 'delete from public.avis where jeu = $1', ['pluie']);
check('retirer son avis', !(await ligneAvis(P[1], 'pluie')) && (await publics('pluie')) === null);
await db.exec(`insert into public.avis (compte_id, jeu, etoiles, marche) select '${P[6]}', 'jeu-' || i, 5, 'oui' from generate_series(1, 50) i`);
await refuse('garde-fou : pas plus de 50 jeux par compte', 'authenticated', P[6], `select public.donner_avis('jeu-51', 5, 'oui')`);
await avisDe(P[6], 'jeu-1', 3, 'non');
la = await ligneAvis(P[6], 'jeu-1');
check('changer un avis existant reste possible', la.marche === 'non' && la.etoiles === 3, la);
await db.exec(`delete from auth.users where id in (${P.map(id => `'${id}'`).join(', ')})`);
check('un compte effacé emporte ses avis', (await db.query('select count(*)::int n from public.avis where compte_id = any($1)', [P])).rows[0].n === 0);

console.log('Tout effacer');
await refuse('anon n\'efface rien', 'anon', null, 'select public.effacer_mon_compte()');
await en('authenticated', ID.b, 'select public.effacer_mon_compte()');
const reste = (await db.query(`select
  (select count(*)::int from auth.users where id = $1) u, (select count(*)::int from public.comptes where id = $1) c,
  (select count(*)::int from public.abonnements where compte_id = $1) a, (select count(*)::int from public.foyers where compte_id = $1) f,
  (select count(*)::int from public.envies where compte_id = $1) e`, [ID.b])).rows[0];
check('le compte, le foyer, l\'abonnement et les réponses disparaissent', Object.values(reste).every(n => n === 0), reste);
check('ses avis partent aussi', (await db.query('select count(*)::int n from public.avis where compte_id = $1', [ID.b])).rows[0].n === 0);
check('les réponses données une fois connecté partent aussi',(await db.query('select count(*)::int n from public.envies where id = $1', [ENV_CO])).rows[0].n === 0);
check('les autres comptes restent', (await db.query('select count(*)::int n from public.comptes')).rows[0].n === 3);

console.log('Garde-fou');
await db.exec(`insert into public.envies (id, cree_le) select gen_random_uuid(), now() from generate_series(1, 60)`);
await refuse('trop de nouvelles réponses d\'un coup : refusé', 'anon', null, `select public.enregistrer_envie(gen_random_uuid())`);
await en('anon', null, `select public.enregistrer_envie($1, 'fr', array['jouer'])`, [ENV.l]);
check('une réponse en cours continue quand même', (await db.query('select envie from public.envies where id = $1', [ENV.l])).rows[0].envie[0] === 'jouer');

console.log(`\n${ok} vérifications passées, ${ko} en échec.`);
process.exit(ko ? 1 : 0);
