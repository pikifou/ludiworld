const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { importCard, cardUrlOf, urlFromIssue, framable } = require('../tools/importer.js');

const SITE = 'https://parent.github.io/jeu-des-planetes/';

function card(over = {}) {
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/jeux/pluie-de-cochons.json'), 'utf8'));
  delete base.source; delete base.embed;
  return Object.assign(base, {
    id: 'jeu-des-planetes', status: 'published',
    url: SITE, icon: SITE + 'icon-512.png',
    learning: { level: 'core', domains: ['sciences.physique'], what: { fr: 'a', en: 'a' }, how: { fr: 'b', en: 'b' } },
  }, over);
}

// Faux réseau : une table adresse -> { status, body, headers }
function net(routes) {
  return async (url) => {
    const r = routes[url];
    if (!r) return { ok: false, status: 404, headers: new Map(), text: async () => '' };
    const headers = new Map(Object.entries(r.headers || {}));
    return { ok: (r.status || 200) < 400, status: r.status || 200, headers: { get: (k) => headers.get(k) || null }, text: async () => r.body || '' };
  };
}
const okSite = (c, extra = {}) => net(Object.assign({
  [SITE + 'ludi.json']: { body: JSON.stringify(c) },
  [SITE]: { body: '<html>' },
  [SITE + 'icon-512.png']: { body: 'png' },
}, extra));

test('adresse du site, de la page ou de la fiche : même fiche', () => {
  assert.strictEqual(cardUrlOf('https://a.github.io/jeu'), 'https://a.github.io/jeu/ludi.json');
  assert.strictEqual(cardUrlOf('https://a.github.io/jeu/'), 'https://a.github.io/jeu/ludi.json');
  assert.strictEqual(cardUrlOf('https://a.github.io/jeu/index.html?x=1'), 'https://a.github.io/jeu/ludi.json');
  assert.strictEqual(cardUrlOf('https://a.github.io/jeu/ludi.json'), 'https://a.github.io/jeu/ludi.json');
  assert.throws(() => cardUrlOf('http://a.github.io/jeu'));
});

test('lit l\'adresse dans le texte d\'une issue', () => {
  const body = '### Adresse du jeu\n\nhttps://parent.github.io/jeu-des-planetes/.\n\n### Autre\n\n_No response_';
  assert.strictEqual(urlFromIssue(body), 'https://parent.github.io/jeu-des-planetes/');
  assert.strictEqual(urlFromIssue('rien ici'), null);
});

test('un jeu correct est importé, avec sa source', async () => {
  const r = await importCard(SITE, { fetchImpl: okSite(card()), write: false, today: '2026-10-29' });
  assert.deepStrictEqual(r.errors, []);
  assert.ok(r.ok);
  assert.strictEqual(r.card.embed, true);
  assert.deepStrictEqual(r.card.source, { card: SITE + 'ludi.json', imported: '2026-10-29' });
});

test('fiche absente : message qui dit où la mettre', async () => {
  const r = await importCard(SITE, { fetchImpl: net({}), write: false });
  assert.ok(!r.ok);
  assert.match(r.errors[0], /racine du site publié/);
});

test('un jeu qui ne respecte pas la charte est refusé', async () => {
  const c = card(); c.healthy.no_ads = false;
  const r = await importCard(SITE, { fetchImpl: okSite(c), write: false });
  assert.ok(!r.ok);
  assert.ok(r.errors.some((e) => e.startsWith('healthy.no_ads')));
});

test('le jeu doit être sur le même site que sa fiche', async () => {
  const r = await importCard(SITE, { fetchImpl: okSite(card({ url: 'https://ailleurs.example/jeu/' })), write: false });
  assert.ok(!r.ok);
  assert.ok(r.errors.some((e) => /même site/.test(e)));
});

test('un identifiant déjà pris par un autre jeu est refusé', async () => {
  const r = await importCard(SITE, { fetchImpl: okSite(card({ id: 'pluie-de-cochons' })), write: false });
  assert.ok(!r.ok);
  assert.ok(r.errors.some((e) => /déjà pris/.test(e)));
});

test('domaine inconnu : simple avertissement', async () => {
  const c = card(); c.learning.domains = ['mythologie.grecque'];
  const r = await importCard(SITE, { fetchImpl: okSite(c), write: false });
  assert.ok(r.ok, r.errors.join(' | '));
  assert.ok(r.warnings.some((w) => /mythologie\.grecque/.test(w)));
});

test('site qui interdit les cadres : jeu ouvert dans un onglet', async () => {
  const r = await importCard(SITE, { fetchImpl: okSite(card(), { [SITE]: { body: '<html>', headers: { 'x-frame-options': 'DENY' } } }), write: false });
  assert.ok(r.ok);
  assert.strictEqual(r.card.embed, false);
});

test('détection des en-têtes de cadre', () => {
  const h = (o) => ({ get: (k) => o[k] || null });
  assert.strictEqual(framable(h({})), true);
  assert.strictEqual(framable(h({ 'x-frame-options': 'SAMEORIGIN' })), false);
  assert.strictEqual(framable(h({ 'content-security-policy': "default-src 'self'; frame-ancestors 'self'" })), false);
  assert.strictEqual(framable(h({ 'content-security-policy': 'frame-ancestors https://pikifou.github.io' })), true);
});
