const test = require('node:test');
const assert = require('node:assert');
const { creer } = require('../docs/site/nuage.js');

const URL_ = 'https://faux.supabase.test';

function memoire() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m };
}
// Un faux serveur : une liste de réponses à servir dans l'ordre ; garde les appels pour les vérifier.
function serveur(reponses) {
  const appels = [];
  const f = async (url, o) => {
    appels.push({ url, methode: (o && o.method) || 'GET', corps: o && o.body ? JSON.parse(o.body) : null, entetes: (o && o.headers) || {} });
    const r = reponses.shift();
    if (r instanceof Error) throw r;
    if (!r) throw new Error('appel inattendu : ' + url);
    return { ok: r.status < 300, status: r.status, text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)) };
  };
  f.appels = appels;
  return f;
}
function client(reponses, extra) {
  const fetch = serveur(reponses), stockage = memoire();
  return Object.assign({ n: creer(Object.assign({ url: URL_, cle: 'cle-publique', fetch, stockage, maintenant: () => 1000000 }, extra)), fetch, stockage });
}
const SESSION = { access_token: 'jeton', refresh_token: 'renouveau', expires_in: 3600, user: { id: 'u1', email: 'a@exemple.test' } };

test('sans adresse configurée, le nuage est inactif et refuse sans appeler le réseau', async () => {
  const c = client([], { url: '', cle: '' });
  assert.strictEqual(c.n.actif(), false);
  await assert.rejects(c.n.connecter('a@b.c', 'motdepasse'), (e) => e.code === 'inactif');
  assert.strictEqual(c.fetch.appels.length, 0);
});

test('connexion : la session est gardée, la clé publique et le jeton partent dans les en-têtes', async () => {
  const c = client([{ status: 200, body: SESSION }, { status: 200, body: { ok: true } }]);
  await c.n.connecter('a@exemple.test', 'motdepasse');
  assert.strictEqual(c.fetch.appels[0].url, URL_ + '/auth/v1/token?grant_type=password');
  assert.strictEqual(c.fetch.appels[0].entetes.apikey, 'cle-publique');
  assert.strictEqual(c.fetch.appels[0].entetes.Authorization, undefined, 'la clé publique ne sert pas de jeton');
  assert.strictEqual(c.n.connecte(), true);
  assert.strictEqual(c.n.email(), 'a@exemple.test');
  await c.n.rpc('est_admin');
  assert.strictEqual(c.fetch.appels[1].entetes.Authorization, 'Bearer jeton');
  assert.strictEqual(c.fetch.appels[1].url, URL_ + '/rest/v1/rpc/est_admin');
});

test('les erreurs de connexion deviennent des codes qu\'on peut traduire', async () => {
  const cas = [
    [{ status: 400, body: { error_code: 'invalid_credentials', msg: 'x' } }, 'identifiants'],
    [{ status: 400, body: { error: 'invalid_grant', error_description: 'x' } }, 'identifiants'],
    [{ status: 400, body: { error_code: 'email_not_confirmed' } }, 'non_confirme'],
    [{ status: 422, body: { error_code: 'weak_password' } }, 'mot_de_passe_faible'],
    [{ status: 429, body: { error_code: 'over_email_send_rate_limit' } }, 'trop_de_demandes'],
    [{ status: 500, body: {} }, 'inconnu'],
    [new TypeError('Failed to fetch'), 'reseau']
  ];
  for (const [rep, code] of cas) {
    const c = client([rep]);
    await assert.rejects(c.n.connecter('a@b.c', 'motdepasse'), (e) => e.code === code, code);
    assert.strictEqual(c.n.connecte(), false);
  }
});

test('inscription : préférences et réponse au questionnaire passent par les métadonnées, et le retour par redirect_to', async () => {
  const c = client([{ status: 200, body: { id: 'u1', email: 'a@exemple.test' } }]);
  const r = await c.n.inscrire({ email: 'a@exemple.test', motDePasse: 'motdepasse', langue: 'fr', nouvelles: true, envieId: 'e-1', retour: 'https://site/compte/' });
  const appel = c.fetch.appels[0];
  assert.strictEqual(appel.url, URL_ + '/auth/v1/signup?redirect_to=' + encodeURIComponent('https://site/compte/'));
  assert.deepStrictEqual(appel.corps.data, { langue: 'fr', synchro: true, nouvelles: 'true', envie_id: 'e-1' });
  assert.strictEqual(r.aConfirmer, true, 'aucune session : il faut confirmer l\'adresse');
  assert.strictEqual(c.n.connecte(), false);
});

test('inscription quand la confirmation est coupée : déjà connecté', async () => {
  const c = client([{ status: 200, body: SESSION }]);
  const r = await c.n.inscrire({ email: 'a@exemple.test', motDePasse: 'motdepasse', langue: 'fr', retour: 'x' });
  assert.strictEqual(r.aConfirmer, false);
  assert.strictEqual(c.n.connecte(), true);
});

test('jeton expiré : on le renouvelle avant l\'appel', async () => {
  let t = 1000000;
  const fetch = serveur([
    { status: 200, body: SESSION },
    { status: 200, body: Object.assign({}, SESSION, { access_token: 'jeton2', refresh_token: 'renouveau2' }) },
    { status: 200, body: true }
  ]);
  const n = creer({ url: URL_, cle: 'k', fetch, stockage: memoire(), maintenant: () => t });
  await n.connecter('a@exemple.test', 'x');
  t += 3600 * 1000;
  await n.rpc('est_admin');
  assert.strictEqual(fetch.appels[1].url, URL_ + '/auth/v1/token?grant_type=refresh_token');
  assert.strictEqual(fetch.appels[1].corps.refresh_token, 'renouveau');
  assert.strictEqual(fetch.appels[2].entetes.Authorization, 'Bearer jeton2');
});

test('renouvellement refusé : session effacée ; sans réseau : session gardée', async () => {
  let t = 1000000;
  const refuse = serveur([{ status: 200, body: SESSION }, { status: 400, body: { error_code: 'refresh_token_not_found' } }]);
  const a = creer({ url: URL_, cle: 'k', fetch: refuse, stockage: memoire(), maintenant: () => t });
  await a.connecter('a@exemple.test', 'x');
  t += 3600 * 1000;
  await assert.rejects(a.rpc('est_admin'), (e) => e.code === 'session');
  assert.strictEqual(a.connecte(), false);

  t = 1000000;
  const coupe = serveur([{ status: 200, body: SESSION }, new TypeError('Failed to fetch')]);
  const b = creer({ url: URL_, cle: 'k', fetch: coupe, stockage: memoire(), maintenant: () => t });
  await b.connecter('a@exemple.test', 'x');
  t += 3600 * 1000;
  await assert.rejects(b.rpc('est_admin'), (e) => e.code === 'reseau');
  assert.strictEqual(b.connecte(), true);
});

test('retour d\'un e-mail : le jeton de l\'adresse devient une session', () => {
  const c = client([]);
  const jwt = 'x.' + Buffer.from(JSON.stringify({ sub: 'u1', email: 'a@exemple.test' })).toString('base64url') + '.y';
  const r = c.n.lireRetour('#access_token=' + jwt + '&refresh_token=rr&expires_in=3600&type=signup');
  assert.deepStrictEqual(r, { type: 'signup' });
  assert.strictEqual(c.n.connecte(), true);
  assert.strictEqual(c.n.email(), 'a@exemple.test');
  assert.deepStrictEqual(c.n.lireRetour('#type=recovery&access_token=' + jwt + '&refresh_token=rr&expires_in=3600'), { type: 'recovery' });
});

test('retour d\'un e-mail : lien périmé, ou adresse qui n\'en est pas un', () => {
  const c = client([]);
  assert.deepStrictEqual(c.n.lireRetour('#error=access_denied&error_code=otp_expired&error_description=x'), { erreur: 'otp_expired' });
  assert.strictEqual(c.n.connecte(), false);
  assert.strictEqual(c.n.lireRetour('#essayer'), null);
  assert.strictEqual(c.n.lireRetour(''), null);
});

test('un lien reçu ne remplace jamais le compte déjà ouvert', async () => {
  const c = client([{ status: 200, body: SESSION }]);
  await c.n.connecter('a@exemple.test', 'x');
  const jwtAutre = 'x.' + Buffer.from(JSON.stringify({ sub: 'attaquant', email: 'pirate@exemple.test' })).toString('base64url') + '.y';
  assert.deepStrictEqual(c.n.lireRetour('#access_token=' + jwtAutre + '&refresh_token=rr&expires_in=3600&type=signup'), { erreur: 'autre_compte' });
  assert.strictEqual(c.n.email(), 'a@exemple.test');
  const jwtMoi = 'x.' + Buffer.from(JSON.stringify({ sub: 'u1', email: 'a@exemple.test' })).toString('base64url') + '.y';
  assert.deepStrictEqual(c.n.lireRetour('#access_token=' + jwtMoi + '&refresh_token=rr&expires_in=3600&type=recovery'), { type: 'recovery' });
});

test('un lien reçu ne relie pas l\'appareil, même si le compte a une copie en ligne', () => {
  const c = client([]);
  const jwt = 'x.' + Buffer.from(JSON.stringify({ sub: 'u1', email: 'a@exemple.test' })).toString('base64url') + '.y';
  c.n.lireRetour('#access_token=' + jwt + '&refresh_token=rr&expires_in=3600&type=signup');
  assert.strictEqual(c.n.synchroLocale(), false);
});

test('serveur en panne ou en pause : la session reste', async () => {
  for (const status of [500, 503, 540, 429]) {
    let t = 1000000;
    const f = serveur([{ status: 200, body: SESSION }, { status, body: {} }]);
    const n = creer({ url: URL_, cle: 'k', fetch: f, stockage: memoire(), maintenant: () => t });
    await n.connecter('a@exemple.test', 'x');
    t += 3600 * 1000;
    await assert.rejects(n.rpc('est_admin'));
    assert.strictEqual(n.connecte(), true, String(status));
  }
});

test('déconnexion : seulement sur cet appareil', async () => {
  const c = client([{ status: 200, body: SESSION }, { status: 204 }]);
  await c.n.connecter('a@exemple.test', 'x');
  await c.n.deconnecter();
  assert.strictEqual(c.fetch.appels[1].url, URL_ + '/auth/v1/logout?scope=local');
});

test('déconnexion : la session part, même sans réseau', async () => {
  const c = client([{ status: 200, body: SESSION }, new TypeError('Failed to fetch')]);
  await c.n.connecter('a@exemple.test', 'x');
  await c.n.deconnecter();
  assert.strictEqual(c.n.connecte(), false);
});

const f = (o) => Object.assign({ pin: 'p', maj: 1, actif: 'e1', enfants: [] }, o);

test('mot de passe : la liaison automatique attend le contrôle parent, puis retrouve le foyer', async () => {
  const etat = f({ pin: 'parent' });
  const c = client([{ status: 200, body: SESSION }, { status: 200, body: [{ synchro: true }] }, { status: 200, body: [{ etat, version: 1 }] }]);
  await c.n.connecter('a@exemple.test', 'x');
  assert.strictEqual(c.n.liaisonDemandee(), true);
  assert.strictEqual(c.n.synchroLocale(), false);
  assert.strictEqual(c.fetch.appels.length, 1, 'la connexion seule ne fait partir aucun foyer');
  assert.deepStrictEqual(await c.n.lierAppareil(null), etat);
  assert.strictEqual(c.n.synchroLocale(), true);
  assert.strictEqual(c.n.liaisonDemandee(), false);
});

test('une désactivation du compte est respectée sur un nouvel appareil et sur un appareil déjà relié', async () => {
  const c = client([{ status: 200, body: SESSION }, { status: 200, body: [{ synchro: false }] }, { status: 200, body: [{ synchro: false }] }]);
  await c.n.connecter('a@exemple.test', 'x');
  assert.strictEqual(await c.n.lierAppareil(f()), null);
  assert.strictEqual(c.n.synchroLocale(), false);
  c.n.poserSynchroLocale(true);
  assert.strictEqual(await c.n.lierAppareil(f()), null);
  assert.strictEqual(c.n.synchroLocale(), false);
  assert.strictEqual(c.fetch.appels.length, 3, 'aucune lecture ni écriture du foyer');
});

test('confirmation : seule une inscription faite ici peut autoriser la liaison du même compte', async () => {
  const c = client([{ status: 200, body: { id: 'u1' } }]);
  await c.n.inscrire({ email: 'a@exemple.test', motDePasse: 'x' });
  const jwt = id => 'x.' + Buffer.from(JSON.stringify({ sub: id })).toString('base64url') + '.y';
  c.n.lireRetour('#access_token=' + jwt('autre') + '&expires_in=3600&type=signup');
  assert.strictEqual(c.n.liaisonDemandee(), false);
  assert.strictEqual(await c.n.lierAppareil(f()), null);
  assert.strictEqual(c.fetch.appels.length, 1, 'un lien d\'un autre compte ne fait rien partir');
  c.stockage.removeItem('ludiworld.session');
  c.n.lireRetour('#access_token=' + jwt('u1') + '&expires_in=3600&type=signup');
  assert.strictEqual(c.n.liaisonDemandee(), true);
});

test('une liaison hors ligne reste en attente pour la prochaine tentative', async () => {
  const c = client([{ status: 200, body: SESSION }, new TypeError('Failed to fetch'), { status: 200, body: [{ synchro: true }] }, { status: 200, body: [] }, { status: 200, body: 1 }]);
  await c.n.connecter('a@exemple.test', 'x');
  await assert.rejects(c.n.lierAppareil(f()));
  assert.strictEqual(c.n.liaisonDemandee(), true);
  assert.strictEqual(c.n.synchroLocale(), false);
  await c.n.lierAppareil(f());
  assert.strictEqual(c.n.synchroLocale(), true);
});

test('réactiver depuis un autre appareil reprend la synchro sans refaire la liaison', async () => {
  const c = client([{ status: 200, body: SESSION }, { status: 200, body: [{ synchro: false }] }, { status: 200, body: [{ synchro: true }] }, { status: 200, body: [] }, { status: 200, body: 1 }]);
  await c.n.connecter('a@exemple.test', 'x');
  await c.n.lierAppareil(f());
  assert.strictEqual(c.n.synchroLocale(), false);
  assert.strictEqual(c.n.appareilAutorise(), true, 'le choix du compte ne fait pas oublier cet appareil');
  await c.n.lierAppareil(f());
  assert.strictEqual(c.n.synchroLocale(), true);
});

test('synchro : rien en ligne, on envoie le foyer (version 0) et on retient la version', async () => {
  const c = client([{ status: 200, body: SESSION }, { status: 200, body: [] }, { status: 200, body: 1 }]);
  await c.n.connecter('a@exemple.test', 'x');
  const m = await c.n.synchroniser(f({ pin: 'local' }));
  assert.strictEqual(m.pin, 'local');
  const envoi = c.fetch.appels[2];
  assert.strictEqual(envoi.url, URL_ + '/rest/v1/rpc/pousser_foyer');
  assert.strictEqual(envoi.corps.p_version, 0);
  assert.strictEqual(envoi.corps.p_etat.pin, 'local');
});

test('synchro : déjà à jour, on n\'écrit pas', async () => {
  const etat = f({ pin: 'pareil' });
  const c = client([{ status: 200, body: SESSION }, { status: 200, body: [{ etat, version: 4 }] }]);
  await c.n.connecter('a@exemple.test', 'x');
  await c.n.synchroniser(JSON.parse(JSON.stringify(etat)));
  assert.strictEqual(c.fetch.appels.length, 2);
});

test('synchro : un autre appareil a écrit entre-temps, on relit et on refusionne', async () => {
  const c = client([
    { status: 200, body: SESSION },
    { status: 200, body: [{ etat: f({ maj: 1, enfants: [{ id: 'e1', maj: 1, games: {} }] }), version: 4 }] },
    { status: 200, body: null },
    { status: 200, body: [{ etat: f({ maj: 1, enfants: [{ id: 'e1', maj: 1, games: {} }, { id: 'e2', maj: 1, games: {} }] }), version: 5 }] },
    { status: 200, body: 6 }
  ]);
  await c.n.connecter('a@exemple.test', 'x');
  const m = await c.n.synchroniser(f({ maj: 9, pin: 'neuf', enfants: [{ id: 'e1', maj: 1, games: {} }] }));
  assert.deepStrictEqual(m.enfants.map(e => e.id), ['e1', 'e2']);
  assert.strictEqual(c.fetch.appels[4].corps.p_version, 5);
  assert.strictEqual(c.fetch.appels[4].corps.p_etat.pin, 'neuf');
});

test('synchro : le lien de l\'appareil porte le nom du compte', async () => {
  const autre = Object.assign({}, SESSION, { user: { id: 'u2', email: 'b@exemple.test' } });
  const c = client([{ status: 200, body: SESSION }, new TypeError('Failed to fetch'), { status: 200, body: autre }]);
  await c.n.connecter('a@exemple.test', 'x');
  c.n.poserSynchroLocale(true);
  assert.strictEqual(c.n.synchroLocale(), true);
  await c.n.deconnecter();
  assert.strictEqual(c.n.synchroLocale(), false);
  await c.n.connecter('b@exemple.test', 'x');
  assert.strictEqual(c.n.synchroLocale(), false, 'un autre compte n\'hérite pas du lien');
});

test('code oublié : le mot de passe du compte ouvert est vérifié par l\'appel de la connexion, rien d\'autre ne change', async () => {
  const autre = Object.assign({}, SESSION, { access_token: 'jeton-verif', user: { id: 'u1', email: 'a@exemple.test' } });
  const c = client([{ status: 200, body: SESSION }, { status: 200, body: autre }, { status: 204 }]);
  await c.n.connecter('a@exemple.test', 'x');
  const avant = JSON.stringify(c.stockage.m);
  assert.strictEqual(await c.n.verifierMotDePasse('bon'), true);
  assert.strictEqual(c.fetch.appels[1].url, URL_ + '/auth/v1/token?grant_type=password');
  assert.deepStrictEqual(c.fetch.appels[1].corps, { email: 'a@exemple.test', password: 'bon' });
  assert.strictEqual(c.fetch.appels[2].url, URL_ + '/auth/v1/logout?scope=local', 'la session de la vérification est refermée');
  assert.strictEqual(c.fetch.appels[2].entetes.Authorization, 'Bearer jeton-verif');
  assert.strictEqual(JSON.stringify(c.stockage.m), avant, 'rien n\'est écrit sur l\'appareil');
  assert.ok(!JSON.stringify(c.stockage.m).includes('bon'), 'le mot de passe n\'est gardé nulle part');
});

test('code oublié : mauvais mot de passe, hors ligne, sans compte', async () => {
  const c = client([{ status: 200, body: SESSION }, { status: 400, body: { error_code: 'invalid_credentials' } }, new TypeError('Failed to fetch')]);
  await c.n.connecter('a@exemple.test', 'x');
  const avant = JSON.stringify(c.stockage.m);
  await assert.rejects(c.n.verifierMotDePasse('faux'), (e) => e.code === 'identifiants');
  await assert.rejects(c.n.verifierMotDePasse('bon'), (e) => e.code === 'reseau');
  assert.strictEqual(JSON.stringify(c.stockage.m), avant);
  assert.strictEqual(c.n.connecte(), true, 'la session de l\'appareil reste');
  const d = client([]);
  await assert.rejects(d.n.verifierMotDePasse('x'), (e) => e.code === 'session');
  assert.strictEqual(d.fetch.appels.length, 0);
});

test('code oublié par e-mail : envoi à l\'adresse du compte ouvert, sans créer de compte', async () => {
  const c = client([{ status: 200, body: SESSION }, { status: 200, body: {} }]);
  await c.n.connecter('a@exemple.test', 'x');
  const avant = JSON.stringify(c.stockage.m);
  assert.strictEqual(await c.n.envoyerCodeEmail(), true);
  assert.strictEqual(c.fetch.appels[1].url, URL_ + '/auth/v1/otp');
  assert.strictEqual(c.fetch.appels[1].methode, 'POST');
  assert.deepStrictEqual(c.fetch.appels[1].corps, { email: 'a@exemple.test', create_user: false });
  assert.strictEqual(c.fetch.appels[1].entetes.Authorization, undefined);
  assert.strictEqual(JSON.stringify(c.stockage.m), avant, 'rien n\'est écrit sur l\'appareil');
  assert.strictEqual(c.n.emailMasque(), 'a•••@exemple.test');
});

test('code oublié par e-mail : bon code, la session de la vérification est refermée, rien d\'autre ne change', async () => {
  const verif = Object.assign({}, SESSION, { access_token: 'jeton-otp', user: { id: 'u1', email: 'a@exemple.test' } });
  const c = client([{ status: 200, body: SESSION }, { status: 200, body: verif }, { status: 204 }]);
  await c.n.connecter('a@exemple.test', 'x');
  const avant = JSON.stringify(c.stockage.m);
  assert.strictEqual(await c.n.verifierCodeEmail(' 123 456 '), true);
  assert.strictEqual(c.fetch.appels[1].url, URL_ + '/auth/v1/verify');
  assert.deepStrictEqual(c.fetch.appels[1].corps, { type: 'email', email: 'a@exemple.test', token: '123456' });
  assert.strictEqual(c.fetch.appels[2].url, URL_ + '/auth/v1/logout?scope=local');
  assert.strictEqual(c.fetch.appels[2].entetes.Authorization, 'Bearer jeton-otp');
  assert.strictEqual(JSON.stringify(c.stockage.m), avant, 'la session de l\'appareil ne change pas');
  assert.ok(!JSON.stringify(c.stockage.m).includes('123456'), 'le code n\'est gardé nulle part');
  assert.strictEqual(c.n.connecte(), true);
});

test('code oublié par e-mail : mauvais code ou périmé, trop d\'envois, hors ligne, sans compte', async () => {
  const c = client([
    { status: 200, body: SESSION },
    { status: 403, body: { error_code: 'otp_expired', msg: 'Token has expired or is invalid' } },
    { status: 400, body: { error_code: 'validation_failed' } },
    { status: 429, body: { error_code: 'over_email_send_rate_limit' } },
    new TypeError('Failed to fetch'),
    new TypeError('Failed to fetch'),
    { status: 429, body: { error_code: 'over_request_rate_limit' } }
  ]);
  await c.n.connecter('a@exemple.test', 'x');
  const avant = JSON.stringify(c.stockage.m);
  await assert.rejects(c.n.verifierCodeEmail('111111'), (e) => e.code === 'code');
  await assert.rejects(c.n.verifierCodeEmail('222222'), (e) => e.code === 'code');
  await assert.rejects(c.n.envoyerCodeEmail(), (e) => e.code === 'trop_de_demandes');
  await assert.rejects(c.n.envoyerCodeEmail(), (e) => e.code === 'reseau');
  await assert.rejects(c.n.verifierCodeEmail('333333'), (e) => e.code === 'reseau');
  await assert.rejects(c.n.verifierCodeEmail('444444'), (e) => e.code === 'trop_de_demandes');
  const n = c.fetch.appels.length;
  await assert.rejects(c.n.verifierCodeEmail('12a456'), (e) => e.code === 'code');
  await assert.rejects(c.n.verifierCodeEmail('12345'), (e) => e.code === 'code');
  assert.strictEqual(c.fetch.appels.length, n, 'un code qui n\'a pas 6 chiffres ne part pas');
  assert.ok(!c.fetch.appels.some((a) => a.url.includes('logout')), 'aucune session ouverte, rien à refermer');
  assert.strictEqual(JSON.stringify(c.stockage.m), avant);
  assert.strictEqual(c.n.connecte(), true, 'la session de l\'appareil reste');
  const d = client([]);
  await assert.rejects(d.n.envoyerCodeEmail(), (e) => e.code === 'session');
  await assert.rejects(d.n.verifierCodeEmail('123456'), (e) => e.code === 'session');
  assert.strictEqual(d.n.emailMasque(), null);
  assert.strictEqual(d.fetch.appels.length, 0);
});

test('code oublié par e-mail : une session d\'un autre compte est refermée et refusée', async () => {
  const autre = Object.assign({}, SESSION, { access_token: 'jeton-autre', user: { id: 'u2', email: 'a@exemple.test' } });
  const c = client([{ status: 200, body: SESSION }, { status: 200, body: autre }, { status: 204 }]);
  await c.n.connecter('a@exemple.test', 'x');
  await assert.rejects(c.n.verifierCodeEmail('123456'), (e) => e.code === 'code');
  assert.strictEqual(c.fetch.appels[2].entetes.Authorization, 'Bearer jeton-autre');
});

test('avis publics : lus sans compte ni jeton, rien sous 5 avis', async () => {
  const pub = { total: 12, etoiles: { 5: 7, 4: 3, 1: 2 }, moyenne: 4.2, marche: { oui: 10, non: 2 }, moyenne_marche_bien: 4.6, mots: ['Bien.'] };
  const c = client([{ status: 200, body: pub }, { status: 200, body: null }, { status: 200, body: { total: 3 } }]);
  assert.deepStrictEqual(await c.n.avisPublics('pluie-de-cochons', 'en'), pub);
  const a = c.fetch.appels[0];
  assert.strictEqual(a.url, URL_ + '/rest/v1/rpc/avis_publics');
  assert.strictEqual(a.methode, 'POST');
  assert.deepStrictEqual(a.corps, { p_jeu: 'pluie-de-cochons', p_langue: 'en' });
  assert.strictEqual(a.entetes.Authorization, undefined, 'lecture publique : pas de jeton');
  assert.strictEqual(await c.n.avisPublics('pluie-de-cochons', 'fr'), null, 'la base ne rend rien sous 5 avis');
  assert.strictEqual(await c.n.avisPublics('pluie-de-cochons', 'xx'), null, 'et le client ne montre rien sous 5, quoi qu\'il reçoive');
  assert.strictEqual(c.fetch.appels[2].corps.p_langue, 'fr');
});

test('avis publics : même connecté, sans jeton, sans renouveler la session', async () => {
  const c = client([{ status: 200, body: Object.assign({}, SESSION, { expires_in: 1 }) }, { status: 200, body: null }]);
  await c.n.connecter('a@exemple.test', 'x');
  assert.strictEqual(await c.n.avisPublics('tour-aimants'), null);
  assert.strictEqual(c.fetch.appels.length, 2, 'aucun renouvellement de jeton pour une lecture publique');
  assert.strictEqual(c.fetch.appels[1].entetes.Authorization, undefined);
});

test('avis : un nom de jeu qui n\'en est pas un ne part pas', async () => {
  const c = client([]);
  for (const f of ['avisPublics', 'lireAvis', 'retirerAvis']) await assert.rejects(c.n[f]('x&select=*'), (e) => e.code === 'jeu', f);
  await assert.rejects(c.n.donnerAvis('../comptes', { etoiles: 4, marche: 'oui' }), (e) => e.code === 'jeu');
  assert.strictEqual(c.fetch.appels.length, 0);
});

test('avis : sans étoiles, ou hors de 1 à 5, rien ne part', async () => {
  const c = client([]);
  for (const e of [undefined, 0, 6, 2.5, 'beaucoup']) await assert.rejects(c.n.donnerAvis('pluie-de-cochons', { etoiles: e, marche: 'oui' }), (x) => x.code === 'etoiles', String(e));
  assert.strictEqual(c.fetch.appels.length, 0);
});

test('mon avis : je le relis, je le donne, je le retire, avec mon jeton', async () => {
  const mien = { etoiles: 4, marche: 'oui', mot: 'Bien.', mot_etat: 'a-relire' };
  const c = client([{ status: 200, body: SESSION }, { status: 200, body: [] }, { status: 200, body: [mien] }, { status: 204 }, { status: 204 }, { status: 204 }]);
  await c.n.connecter('a@exemple.test', 'x');
  assert.strictEqual(await c.n.lireAvis('pluie-de-cochons'), null);
  assert.deepStrictEqual(await c.n.lireAvis('pluie-de-cochons'), mien);
  assert.strictEqual(c.fetch.appels[1].url, URL_ + '/rest/v1/avis?select=etoiles,marche,mot,mot_etat,maj_le&jeu=eq.pluie-de-cochons');
  assert.strictEqual(c.fetch.appels[1].entetes.Authorization, 'Bearer jeton');
  await c.n.donnerAvis('pluie-de-cochons', { etoiles: 1, marche: 'non', mot: 'Le jeu plante', langue: 'en', fiche: 'oui', retourne: 'oui' });
  assert.strictEqual(c.fetch.appels[3].url, URL_ + '/rest/v1/rpc/donner_avis');
  assert.deepStrictEqual(c.fetch.appels[3].corps, { p_jeu: 'pluie-de-cochons', p_etoiles: 1, p_marche: 'non', p_mot: 'Le jeu plante', p_langue: 'en' },
    'seulement les étoiles, « marche », le mot et la langue');
  await c.n.donnerAvis('pluie-de-cochons', { etoiles: '5', marche: 'oui' });
  assert.deepStrictEqual(c.fetch.appels[4].corps, { p_jeu: 'pluie-de-cochons', p_etoiles: 5, p_marche: 'oui', p_mot: null, p_langue: 'fr' });
  assert.ok(!('compte_id' in c.fetch.appels[4].corps), 'le compte vient du jeton, jamais du navigateur');
  await c.n.retirerAvis('pluie-de-cochons');
  assert.strictEqual(c.fetch.appels[5].url, URL_ + '/rest/v1/avis?jeu=eq.pluie-de-cochons');
  assert.strictEqual(c.fetch.appels[5].methode, 'DELETE');
});
