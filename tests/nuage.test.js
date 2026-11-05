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
  assert.deepStrictEqual(appel.corps.data, { langue: 'fr', nouvelles: 'true', envie_id: 'e-1' });
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
