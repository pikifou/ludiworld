const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../docs/site/arbre.js');

const DOCS = path.join(__dirname, '..', 'docs');
const index = JSON.parse(fs.readFileSync(path.join(DOCS, 'jeux', 'index.json'), 'utf8'));
const fiches = index.games.map((f) => JSON.parse(fs.readFileSync(path.join(DOCS, 'jeux', f), 'utf8')));

test('chaque case a un identifiant unique et un nom dans les deux langues', () => {
  assert.strictEqual(new Set(A.CASES.map((x) => x.id)).size, A.CASES.length);
  A.CASES.forEach((x) => assert.ok(x.nom.fr && x.nom.en, x.id));
});

test('chaque notion du vocabulaire a sa case, une seule', () => {
  const spec = fs.readFileSync(path.join(__dirname, '..', 'spec', 'domaines.md'), 'utf8');
  const domaines = [...spec.matchAll(/^\| `([a-z-]+\.[a-z-]+)` \|/gm)].map((m) => m[1]);
  assert.ok(domaines.length >= 13);
  domaines.forEach((d) => assert.strictEqual(A.CASES.filter((x) => x.domaine === d).length, 1, d));
});

test('les fiches se relient toutes, et seulement d\'après ce qu\'elles déclarent', () => {
  assert.deepStrictEqual(A.relier(fiches), []);
  fiches.forEach((g) => assert.strictEqual(A.casesDuJeu(g).length, g.learning.domains.length, g.id));
  A.CASES.filter((x) => x.jeux.length).forEach((x) => x.jeux.forEach((g) => assert.ok(g.learning.domains.includes(x.domaine))));
});

test('la recherche trouve par mot voisin, sans accent, et le jeu par sa fiche', () => {
  A.relier(fiches);
  const r = A.chercher('electromagnetisme', 'fr', fiches);
  assert.deepStrictEqual(r.cases.map((x) => x.id).sort(), ['sciences.physique.aimants', 'sciences.physique.electricite']);
  assert.ok(A.chercher('EMPATHIE', 'fr', fiches).cases.some((x) => x.id === 'autres.les-autres.empathie'));
  assert.ok(A.chercher('cochons', 'fr', fiches).jeux.some((g) => g.id === 'pluie-de-cochons'));
  assert.deepStrictEqual(A.chercher('   ', 'fr', fiches), { cases: [], jeux: [] });
  assert.deepStrictEqual(A.chercher('xyzzy', 'fr', fiches), { cases: [], jeux: [] });
});

test('l\'état d\'une case ne dit que ce qui est enregistré', () => {
  A.relier(fiches);
  const mult = A.caseDuDomaine('maths.multiplication');
  const vide = A.caseDe('maths.calcul.fractions');
  assert.strictEqual(A.etat(vide, null), 'vide');
  assert.strictEqual(A.etat(mult, null), 'essayer');
  assert.strictEqual(A.etat(mult, { games: {} }), 'essayer');
  assert.strictEqual(A.etat(mult, { games: { 'pluie-de-cochons': { ms: 0 } } }), 'essayer');
  assert.strictEqual(A.etat(mult, { games: { 'pluie-de-cochons': { ms: 60000 } } }), 'joue');
  assert.strictEqual(A.etat(mult, { games: { 'pluie-de-cochons': { ms: 60000 } }, avis: { [mult.id]: { v: 'adore', t: 1 } } }), 'adore');
  assert.strictEqual(A.etat(mult, { games: { 'pluie-de-cochons': { ms: 60000 } }, avis: { [mult.id]: { v: 'bof', t: 1 } } }), 'joue');
  assert.strictEqual(A.etat(mult, { games: { 'pluie-de-cochons': { ms: 60000 } }, avis: { [mult.id]: { v: 'appris', t: 1 } } }), 'appris');
});

test('les faits d\'une notion viennent des réponses du jeu', () => {
  const st = { skills: { 'maths.multiplication/7x8': { ok: 1, ko: 4, streak: -2 }, 'maths.multiplication/2x3': { ok: 5, ko: 0, streak: 5 }, 'autre.chose/x': { ok: 9, ko: 9, streak: 9 } } };
  assert.deepStrictEqual(A.faits(st, 'maths.multiplication'), { n: 10, ok: 6, reussies: ['2x3'], ratees: ['7x8'] });
  assert.deepStrictEqual(A.faits(null, 'maths.multiplication'), { n: 0, ok: 0, reussies: [], ratees: [] });
});

test('la dernière partie est le jour le plus récent, même avec des clés non triées', () => {
  const d = A.dernierJour({ days: { '2026-9-2': 1, '2026-10-12': 1, '2026-10-3': 1 } });
  assert.strictEqual(d.getMonth(), 9); assert.strictEqual(d.getDate(), 12);
  assert.strictEqual(A.dernierJour({}), null);
});

test('l\'arbre ouvre sur la branche du jeu le plus joué, ou sur la première', () => {
  A.relier(fiches);
  assert.strictEqual(A.brancheDeDepart(fiches, null), 'maths');
  assert.strictEqual(A.brancheDeDepart(fiches, { games: {} }), 'maths');
  assert.strictEqual(A.brancheDeDepart(fiches, { games: { 'pluie-de-cochons': { ms: 5 }, 'monde-a-la-craie': { ms: 50 } } }), 'monde');
});
