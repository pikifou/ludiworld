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
  ('${ID.adm}', 'patron@exemple.test', now(), '{}')`);
const compteA = (await db.query('select * from public.comptes where id = $1', [ID.a])).rows[0];
check('compte créé avec langue et nouvelles', compteA.langue === 'en' && compteA.nouvelles === true, compteA);
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

console.log('Tout effacer');
await refuse('anon n\'efface rien', 'anon', null, 'select public.effacer_mon_compte()');
await en('authenticated', ID.b, 'select public.effacer_mon_compte()');
const reste = (await db.query(`select
  (select count(*)::int from auth.users where id = $1) u, (select count(*)::int from public.comptes where id = $1) c,
  (select count(*)::int from public.abonnements where compte_id = $1) a, (select count(*)::int from public.foyers where compte_id = $1) f,
  (select count(*)::int from public.envies where compte_id = $1) e`, [ID.b])).rows[0];
check('le compte, le foyer, l\'abonnement et les réponses disparaissent', Object.values(reste).every(n => n === 0), reste);
check('les réponses données une fois connecté partent aussi', (await db.query('select count(*)::int n from public.envies where id = $1', [ENV_CO])).rows[0].n === 0);
check('les autres comptes restent', (await db.query('select count(*)::int n from public.comptes')).rows[0].n === 3);

console.log('Garde-fou');
await db.exec(`insert into public.envies (id, cree_le) select gen_random_uuid(), now() from generate_series(1, 60)`);
await refuse('trop de nouvelles réponses d\'un coup : refusé', 'anon', null, `select public.enregistrer_envie(gen_random_uuid())`);
await en('anon', null, `select public.enregistrer_envie($1, 'fr', array['jouer'])`, [ENV.l]);
check('une réponse en cours continue quand même', (await db.query('select envie from public.envies where id = $1', [ENV.l])).rows[0].envie[0] === 'jouer');

console.log(`\n${ok} vérifications passées, ${ko} en échec.`);
process.exit(ko ? 1 : 0);
