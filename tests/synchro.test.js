const test = require('node:test');
const assert = require('node:assert');
const { fusionner } = require('../docs/synchro.js');

function foyer(o) { return Object.assign({ v: 2, cree: 1, pin: 'abc', maj: 100, actif: 'e1', enfants: [] }, o); }
function enfant(id, o) { return Object.assign({ id: id, maj: 100, enfant: { nom: id, age: 8 }, jeux: {}, regles: { ecole: 30 }, games: {} }, o); }

test('sans copie en ligne, le foyer local ; sans foyer local, la copie en ligne', () => {
  const f = foyer({ enfants: [enfant('e1')] });
  assert.deepStrictEqual(fusionner(f, null), f);
  assert.deepStrictEqual(fusionner(null, f), f);
  assert.strictEqual(fusionner(null, null), null);
});

test('le réglage le plus récent gagne, enfant par enfant', () => {
  const local = foyer({ enfants: [enfant('e1', { maj: 200, regles: { ecole: 45 } }), enfant('e2', { maj: 100, regles: { ecole: 10 } })] });
  const distant = foyer({ enfants: [enfant('e1', { maj: 100, regles: { ecole: 20 } }), enfant('e2', { maj: 300, regles: { ecole: 90 } })] });
  const m = fusionner(local, distant);
  assert.strictEqual(m.enfants.find(e => e.id === 'e1').regles.ecole, 45);
  assert.strictEqual(m.enfants.find(e => e.id === 'e2').regles.ecole, 90);
});

test('« +10 min » donné depuis le téléphone arrive sur la tablette', () => {
  const tablette = foyer({ enfants: [enfant('e1', { maj: 100 })] });
  const tel = foyer({ enfants: [enfant('e1', { maj: 500, regles: { ecole: 30, bonus: { jour: '2026-11-4', min: 10 } } })] });
  assert.strictEqual(fusionner(tablette, tel).enfants[0].regles.bonus.min, 10);
});

test('un enfant ajouté sur un autre appareil apparaît', () => {
  const m = fusionner(foyer({ enfants: [enfant('e1')] }), foyer({ enfants: [enfant('e1'), enfant('e9')] }));
  assert.deepStrictEqual(m.enfants.map(e => e.id), ['e1', 'e9']);
});

test('un enfant retiré ne revient pas par l\'autre appareil', () => {
  const local = foyer({ enfants: [enfant('e1')], retires: { e9: 200 } });
  const distant = foyer({ enfants: [enfant('e1'), enfant('e9', { maj: 100 })] });
  assert.deepStrictEqual(fusionner(local, distant).enfants.map(e => e.id), ['e1']);
  assert.deepStrictEqual(fusionner(distant, local).enfants.map(e => e.id), ['e1'], 'dans les deux sens');
  assert.strictEqual(fusionner(distant, local).retires.e9, 200);
});

test('l\'enfant actif reste celui de cet appareil', () => {
  const local = foyer({ actif: 'e1', maj: 1, enfants: [enfant('e1'), enfant('e2')] });
  const distant = foyer({ actif: 'e2', maj: 9, enfants: [enfant('e1'), enfant('e2')] });
  assert.strictEqual(fusionner(local, distant).actif, 'e1');
});

test('l\'enfant actif retiré ailleurs : on retombe sur un enfant qui existe', () => {
  const local = foyer({ actif: 'e2', enfants: [enfant('e1'), enfant('e2')] });
  const distant = foyer({ retires: { e2: 900 }, enfants: [enfant('e1')] });
  assert.strictEqual(fusionner(local, distant).actif, 'e1');
});

test('le code du parent : le plus récent gagne', () => {
  const m = fusionner(foyer({ pin: 'ancien', maj: 100 }), foyer({ pin: 'nouveau', maj: 200 }));
  assert.strictEqual(m.pin, 'nouveau');
});

test('le temps de jeu : on garde le plus grand par jour, sans additionner deux fois', () => {
  const a = { ms: 100, sessions: 2, days: { '2026-11-3': 60, '2026-11-4': 40 }, scores: {}, progress: {}, skills: {}, skillDays: {}, kit: false };
  const b = { ms: 90, sessions: 3, days: { '2026-11-3': 50, '2026-11-5': 30 }, scores: {}, progress: {}, skills: {}, skillDays: {}, kit: true };
  const m = fusionner(foyer({ enfants: [enfant('e1', { games: { j: a } })] }), foyer({ enfants: [enfant('e1', { games: { j: b } })] }));
  const g = m.enfants[0].games.j;
  assert.deepStrictEqual(g.days, { '2026-11-3': 60, '2026-11-4': 40, '2026-11-5': 30 });
  assert.strictEqual(g.ms, 100);
  assert.strictEqual(g.sessions, 3);
  assert.strictEqual(g.kit, true);
});

test('les records respectent leur sens : plus grand ou plus petit', () => {
  const j = (points, temps) => ({ scores: { points: { value: points, better: 'higher' }, temps: { value: temps, better: 'lower' } } });
  const m = fusionner(foyer({ enfants: [enfant('e1', { games: { j: j(10, 50) } })] }), foyer({ enfants: [enfant('e1', { games: { j: j(20, 30) } })] }));
  assert.deepStrictEqual(m.enfants[0].games.j.scores, { points: { value: 20, better: 'higher' }, temps: { value: 30, better: 'lower' } });
});

test('les notions : on garde ce qui a été le plus travaillé', () => {
  const s = (ok, ko, streak) => ({ skills: { '7x8': { ok, ko, streak } }, skillDays: { '2026-11-4': { ok, ko } } });
  const m = fusionner(foyer({ enfants: [enfant('e1', { games: { j: s(5, 1, 3) } })] }), foyer({ enfants: [enfant('e1', { games: { j: s(2, 4, 1) } })] }));
  assert.deepStrictEqual(m.enfants[0].games.j.skills['7x8'], { ok: 5, ko: 4, streak: 3 });
  assert.deepStrictEqual(m.enfants[0].games.j.skillDays['2026-11-4'], { ok: 5, ko: 4 });
});

test('un jeu qui n\'existe que d\'un côté est gardé', () => {
  const m = fusionner(foyer({ enfants: [enfant('e1', { games: { a: { ms: 1 } } })] }), foyer({ enfants: [enfant('e1', { games: { b: { ms: 2 } } })] }));
  assert.deepStrictEqual(Object.keys(m.enfants[0].games).sort(), ['a', 'b']);
});

test('fusionner deux fois ne change plus rien, dans un sens comme dans l\'autre', () => {
  const a = foyer({ maj: 1, enfants: [enfant('e1', { maj: 3, games: { j: { ms: 5, days: { x: 5 } } } })] });
  const b = foyer({ maj: 2, enfants: [enfant('e1', { maj: 2, games: { j: { ms: 7, days: { x: 2, y: 5 } } } }), enfant('e2')] });
  const m = fusionner(a, b);
  assert.deepStrictEqual(fusionner(m, b), m);
  assert.deepStrictEqual(fusionner(m, m), m);
  const n = fusionner(b, a);
  n.actif = m.actif;
  n.enfants.sort((x, y) => x.id.localeCompare(y.id));
  assert.deepStrictEqual(n.enfants, m.enfants, 'les deux appareils finissent pareil');
});

test('deux appareils retirent chacun un enfant différent : le foyer ne se vide jamais', () => {
  const a = foyer({ enfants: [enfant('e1', { maj: 5 })], retires: { e2: 100 } });
  const b = foyer({ enfants: [enfant('e2', { maj: 6 })], retires: { e1: 100 } });
  const m = fusionner(a, b);
  assert.deepStrictEqual(m.enfants.map(e => e.id), ['e2']);
  assert.strictEqual(m.actif, 'e2');
  assert.deepStrictEqual(m.retires, { e1: 100 });
});

test('ne modifie pas ce qu\'on lui donne', () => {
  const a = foyer({ enfants: [enfant('e1')] }), b = foyer({ maj: 900, enfants: [enfant('e1', { maj: 900 })] });
  const ca = JSON.stringify(a), cb = JSON.stringify(b);
  fusionner(a, b);
  assert.strictEqual(JSON.stringify(a), ca);
  assert.strictEqual(JSON.stringify(b), cb);
});
