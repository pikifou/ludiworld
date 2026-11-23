const test = require('node:test');
const assert = require('node:assert');
const D = require('../docs/site/demenager.js');

function memoire(init) {
  const m = Object.assign({}, init || {});
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m };
}
const ANCIEN = (chemin, hash) => ({ hostname: 'pikifou.github.io', pathname: chemin, search: '', hash: hash || '' });
const FOYER = { famille: { pin: '2580', enfants: [{ id: 'e1', enfant: { nom: 'Élodie' } }] } };

test('emballer et déballer gardent tout, accents compris', () => {
  const o = { v: 1, foyer: FOYER, langue: 'fr' };
  const e = D.emballer(o);
  assert.match(e, /^[A-Za-z0-9_-]+$/, 'rien qui casse une adresse');
  assert.deepStrictEqual(D.deballer(e), o);
});

test('ancienne adresse sans réglages : la même page à ludiworld.app', () => {
  assert.strictEqual(D.cible(ANCIEN('/ludiworld/les-jeux/', '#x'), memoire(), true), 'https://ludiworld.app/les-jeux/#x');
  assert.strictEqual(D.cible(ANCIEN('/ludiworld/'), memoire(), true), 'https://ludiworld.app/');
});

test('ancienne adresse d\'un appareil préparé : l\'appli de ludiworld.app, avec ses réglages et sa langue', () => {
  const s = memoire({ 'ludiworld.v1': JSON.stringify(FOYER), 'ludiworld.lang': 'en' });
  const c = D.cible(ANCIEN('/ludiworld/app/', '#carnet'), s, true);
  assert.ok(c.startsWith('https://ludiworld.app/app/#reprendre='), c);
  assert.deepStrictEqual(D.deballer(c.split('#reprendre=')[1]), { v: 1, foyer: FOYER, langue: 'en' });
});

test('on reste : hors ligne, une autre adresse, un autre jeu du même domaine', () => {
  const s = memoire({ 'ludiworld.v1': JSON.stringify(FOYER) });
  assert.strictEqual(D.cible(ANCIEN('/ludiworld/app/'), s, false), null, 'hors ligne : l\'appli marche ici');
  assert.strictEqual(D.cible({ hostname: 'ludiworld.app', pathname: '/app/', search: '', hash: '' }, s, true), null);
  assert.strictEqual(D.cible(ANCIEN('/tour-aimants/'), s, true), null, 'les jeux restent où ils sont');
});

test('nouvelle adresse : reprend seulement depuis l\'ancienne, et jamais par-dessus un foyer', () => {
  const h = '#reprendre=' + D.emballer({ v: 1, foyer: FOYER, langue: 'en' });
  const neuf = memoire();
  assert.strictEqual(D.reprendre(h, 'https://pikifou.github.io/', neuf), 'repris');
  assert.deepStrictEqual(JSON.parse(neuf.m['ludiworld.v1']), FOYER);
  assert.strictEqual(neuf.m['ludiworld.lang'], 'en');
  const deja = memoire({ 'ludiworld.v1': '{"famille":{"pin":"1111"}}' });
  assert.strictEqual(D.reprendre(h, 'https://pikifou.github.io/', deja), 'garde');
  assert.strictEqual(JSON.parse(deja.m['ludiworld.v1']).famille.pin, '1111');
  const vide = memoire();
  assert.strictEqual(D.reprendre(h, 'https://ailleurs.example/', vide), 'refuse', 'un lien venu d\'ailleurs ne prépare pas un appareil');
  assert.strictEqual(D.reprendre(h, '', vide), 'refuse');
  assert.strictEqual(D.reprendre('#reprendre=pas-du-json', 'https://pikifou.github.io/', vide), 'refuse');
  assert.strictEqual(D.reprendre('#reprendre=' + D.emballer({ v: 1, foyer: [] }), 'https://pikifou.github.io/', vide), 'refuse');
  assert.deepStrictEqual(vide.m, {});
  assert.strictEqual(D.reprendre('#carnet', 'https://pikifou.github.io/', vide), null);
});
