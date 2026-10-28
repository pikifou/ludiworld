const test = require('node:test');
const assert = require('node:assert');
const { createLudi } = require('../docs/kit/ludi.js');

// Fausse fenêtre de navigateur, juste ce qu'il faut au kit.
function fakeWindow({ embedded = false, parentOrigin = 'https://pikifou.github.io', storage = new Map() } = {}) {
  const listeners = {};
  const docListeners = {};
  const sent = [];
  const win = {
    console: { warn() {} },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
    },
    location: { ancestorOrigins: embedded ? [parentOrigin] : [] },
    document: {
      visibilityState: 'visible',
      referrer: '',
      addEventListener: (t, f) => { docListeners[t] = f; },
    },
    addEventListener: (t, f) => { listeners[t] = f; },
    setInterval: () => 1,
  };
  win.parent = embedded ? { postMessage: (msg, origin) => sent.push({ msg, origin }) } : win;
  return {
    win, sent, storage,
    message: (data, origin = parentOrigin) => listeners.message({ data, origin, source: win.parent }),
    hide: () => { win.document.visibilityState = 'hidden'; docListeners.visibilitychange(); },
    show: () => { win.document.visibilityState = 'visible'; docListeners.visibilitychange(); },
  };
}

function clock(start = 1_000_000) {
  let t = start;
  const f = () => t;
  f.advance = (ms) => { t += ms; };
  return f;
}

test('ouvert seul : tout reste en local, rien n\'est posté', () => {
  const w = fakeWindow();
  const L = createLudi(w.win, { now: clock() }).init({ game: 'pluie-de-cochons' });
  L.score('table-7', 42, { better: 'lower' });
  assert.strictEqual(L.inLauncher(), false);
  assert.strictEqual(w.sent.length, 0);
  const saved = JSON.parse(w.storage.get('ludi.v1.pluie-de-cochons'));
  assert.strictEqual(saved.scores['table-7'].value, 42);
  assert.strictEqual(saved.sessions, 1);
});

test('score : garde le meilleur selon le sens', () => {
  const w = fakeWindow();
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  assert.deepStrictEqual(L.score('chrono', 40, { better: 'lower' }), { best: 40, record: true });
  assert.deepStrictEqual(L.score('chrono', 45, { better: 'lower' }), { best: 40, record: false });
  assert.deepStrictEqual(L.score('chrono', 35, { better: 'lower' }), { best: 35, record: true });
  assert.deepStrictEqual(L.score('points', 10), { best: 10, record: true });
  assert.deepStrictEqual(L.score('points', 5), { best: 10, record: false });
  assert.strictEqual(L.score('points', 'abc'), null);
});

test('temps de jeu : ne compte que quand la page est visible', () => {
  const w = fakeWindow();
  const now = clock();
  const L = createLudi(w.win, { now }).init({ game: 'jeu' });
  now.advance(10_000);
  w.hide();
  now.advance(60_000); // caché : ne compte pas
  w.show();
  now.advance(5_000);
  const d = L.data();
  assert.strictEqual(d.playMs, 15_000);
  // Les tranches d'une même session sont fusionnées en un seul événement.
  assert.strictEqual(d.events.filter((e) => e.kind === 'session').length, 1);
});

test('dans le launcher : hello, welcome et événements postés à l\'origine exacte', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'tour-aimants' });
  assert.strictEqual(L.inLauncher(), true);
  assert.strictEqual(w.sent[0].msg.type, 'ludi:hello');
  assert.ok(w.sent.every((s) => s.origin === 'https://pikifou.github.io'));
  w.message({ type: 'ludi:welcome', player: { name: 'Joshua' } });
  assert.deepStrictEqual(L.player(), { name: 'Joshua' });
  L.progress('etage', 5);
  const last = w.sent[w.sent.length - 1].msg;
  assert.strictEqual(last.type, 'ludi:event');
  assert.strictEqual(last.event.kind, 'progress');
  assert.strictEqual(last.event.value, 5);
});

test('page parente non autorisée : le kit reste muet', () => {
  const w = fakeWindow({ embedded: true, parentOrigin: 'https://site-inconnu.example' });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  L.score('x', 1);
  assert.strictEqual(L.inLauncher(), false);
  assert.strictEqual(w.sent.length, 0);
});

test('message venant d\'une autre origine : ignoré', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  w.message({ type: 'ludi:welcome', player: { name: 'Intrus' } }, 'https://autre.example');
  assert.strictEqual(L.player(), null);
});

test('pause demandée par le launcher', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  let raison = null;
  L.onPause((r) => { raison = r; });
  w.message({ type: 'ludi:pause', reason: 'temps' });
  assert.strictEqual(raison, 'temps');
});

test('skill : bilan par notion', () => {
  const w = fakeWindow();
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  L.skill('maths.multiplication', '7x8', false);
  L.skill('maths.multiplication', '7x8', true);
  L.skill('maths.multiplication', '7x8', true);
  const s = L.data().skills['maths.multiplication/7x8'];
  assert.strictEqual(s.ok, 2);
  assert.strictEqual(s.ko, 1);
  assert.strictEqual(s.streak, 2);
});

test('les données survivent à une nouvelle ouverture', () => {
  const storage = new Map();
  createLudi(fakeWindow({ storage }).win, { now: clock() }).init({ game: 'jeu' }).score('s', 3);
  const L2 = createLudi(fakeWindow({ storage }).win, { now: clock() }).init({ game: 'jeu' });
  const d = L2.data();
  assert.strictEqual(d.sessions, 2);
  assert.strictEqual(d.scores.s.value, 3);
});

test('id de jeu invalide : refusé sans planter', () => {
  const w = fakeWindow();
  const L = createLudi(w.win, { now: clock() }).init({ game: 'Mon Jeu!' });
  assert.strictEqual(L.data(), null);
  assert.strictEqual(L.score('x', 1), null);
});

test('le nombre d\'événements gardés est plafonné', () => {
  const w = fakeWindow();
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  for (let i = 0; i < 400; i++) L.skill('maths.calcul-mental', i, true);
  assert.strictEqual(L.data().events.length, 300);
});
