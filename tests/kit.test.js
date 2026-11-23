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

test('le launcher est reconnu sur ludiworld.app', () => {
  const w = fakeWindow({ embedded: true, parentOrigin: 'https://ludiworld.app' });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'tour-aimants' });
  assert.strictEqual(L.inLauncher(), true);
  assert.ok(w.sent.every((s) => s.origin === 'https://ludiworld.app'));
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

test('checkpoint : moment où s\'arrêter, transmis au launcher', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  L.checkpoint('fin-de-course');
  const last = w.sent[w.sent.length - 1].msg;
  assert.strictEqual(last.type, 'ludi:event');
  assert.strictEqual(last.event.kind, 'checkpoint');
  assert.strictEqual(last.event.label, 'fin-de-course');
});

test('checkpoint ouvert seul : rien n\'est posté', () => {
  const w = fakeWindow();
  createLudi(w.win, { now: clock() }).init({ game: 'jeu' }).checkpoint();
  assert.strictEqual(w.sent.length, 0);
});

test('fin de temps annoncée par le launcher (wrapup)', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  let got = 'rien';
  L.onWrapUp((min) => { got = min; });
  w.message({ type: 'ludi:wrapup', minutes: 5 }, 'https://evil.example');
  assert.strictEqual(got, 'rien');
  w.message({ type: 'ludi:wrapup', minutes: 5 });
  assert.strictEqual(got, 5);
});

// ---------- Sauvegarde du jeu (Ludi.save / Ludi.onRestore) ----------
const sauvegardes = (w) => w.sent.filter((s) => s.msg.type === 'ludi:event' && s.msg.event.kind === 'save').map((s) => s.msg.event);

test('save : gardée en local, envoyée au launcher, jamais dans les événements', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  assert.strictEqual(L.save({ etage: 5 }), true);
  assert.deepStrictEqual(JSON.parse(w.storage.get('ludi.v1.jeu')).save.data, { etage: 5 });
  assert.deepStrictEqual(sauvegardes(w).map((e) => e.data), [{ etage: 5 }]);
  assert.strictEqual(L.data().events.filter((e) => e.kind === 'save').length, 0);
});

test('save : refuse le vide et le trop gros', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  assert.strictEqual(L.save(null), false);
  assert.strictEqual(L.save({ gros: 'x'.repeat(260000) }), false);
  assert.strictEqual(sauvegardes(w).length, 0);
});

test('onRestore : la sauvegarde plus récente du launcher revient au jeu, une fois', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock(5000) }).init({ game: 'jeu' });
  const recu = [];
  L.onRestore((d) => recu.push(d));
  w.message({ type: 'ludi:welcome', player: { name: 'Léo' }, save: { data: { etage: 9 }, at: 9000 } });
  assert.deepStrictEqual(recu, [{ etage: 9 }]);
  assert.deepStrictEqual(JSON.parse(w.storage.get('ludi.v1.jeu')).save, { data: { etage: 9 }, at: 9000 });
  assert.strictEqual(sauvegardes(w).length, 0, 'rien à renvoyer : le launcher a déjà celle-ci');
});

test('onRestore : appelée aussi quand le jeu s\'abonne après l\'arrivée de la sauvegarde', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  w.message({ type: 'ludi:welcome', player: null, save: { data: { a: 1 }, at: 7 } });
  const recu = [];
  L.onRestore((d) => recu.push(d));
  L.onRestore((d) => recu.push('deuxieme'));
  assert.deepStrictEqual(recu, [{ a: 1 }]);
});

test('sauvegarde de cet appareil plus récente : on ne la remplace pas, on la rend au launcher', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock(50000) }).init({ game: 'jeu' });
  L.save({ etage: 12 });
  const recu = [];
  L.onRestore((d) => recu.push(d));
  w.sent.length = 0;
  w.message({ type: 'ludi:welcome', player: null, save: { data: { etage: 3 }, at: 1000 } });
  assert.deepStrictEqual(recu, []);
  assert.deepStrictEqual(sauvegardes(w).map((e) => e.data), [{ etage: 12 }]);
});

test('launcher sans sauvegarde : celle de l\'appareil lui est confiée', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  L.save({ etage: 4 });
  w.sent.length = 0;
  w.message({ type: 'ludi:welcome', player: null, save: null });
  assert.deepStrictEqual(sauvegardes(w).map((e) => e.data), [{ etage: 4 }]);
});

test('save { existante } : une partie d\'avant le kit ne bat jamais une sauvegarde venue d\'ailleurs', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock(80000) }).init({ game: 'jeu' });
  const recu = [];
  L.onRestore((d) => recu.push(d));
  L.save({ etage: 2 }, { existante: true });
  w.message({ type: 'ludi:welcome', player: null, save: { data: { etage: 8 }, at: 60000 } });
  assert.deepStrictEqual(recu, [{ etage: 8 }]);
  // et il ne remplace pas une sauvegarde déjà faite
  assert.strictEqual(L.save({ etage: 1 }, { existante: true }), false);
});

test('une sauvegarde venue d\'un faux launcher est ignorée', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  const recu = [];
  L.onRestore((d) => recu.push(d));
  w.message({ type: 'ludi:welcome', player: null, save: { data: { etage: 99 }, at: 5 } }, 'https://pirate.example');
  assert.deepStrictEqual(recu, []);
});

test('fini et complet : posté au launcher, gardé, ne redescend jamais', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  L.complet(0.4); L.complet(0.2); L.complet(5); L.fini(); L.fini();
  const etats = w.sent.filter(p => p.msg.event && p.msg.event.kind === 'etat').map(p => p.msg.event);
  assert.deepStrictEqual(etats.map(e => [e.fini, e.complet]), [[false, 0.4], [false, 1], [true, 1]]);
  assert.deepStrictEqual(L.data().etat.fini, true);
  assert.strictEqual(L.data().etat.complet, 1);
});

// Le son (Julien, 2026-11-23) : jamais muet au départ, réglé par Ludiworld pour toute la maison, le bouton du jeu change le réglage de la maison.
test('son : tout allumé au départ, onSon appelée tout de suite', () => {
  const w = fakeWindow();
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  assert.deepStrictEqual(L.son(), { musique: true, bruitages: true, voix: true });
  const vus = [];
  L.onSon((s) => vus.push(s));
  assert.deepStrictEqual(vus, [{ musique: true, bruitages: true, voix: true }]);
});

test('son : ouvert seul, le bouton du jeu change le réglage de l\'appareil, gardé, rien de posté', () => {
  const storage = new Map();
  const w = fakeWindow({ storage });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  const vus = [];
  L.onSon((s) => vus.push(s));
  assert.deepStrictEqual(L.reglerSon({ musique: false }), { musique: false, bruitages: true, voix: true });
  assert.strictEqual(vus.length, 2);
  assert.strictEqual(w.sent.length, 0);
  // Un autre jeu de la même adresse le retrouve.
  const L2 = createLudi(fakeWindow({ storage }).win, { now: clock() }).init({ game: 'autre' });
  assert.deepStrictEqual(L2.son(), { musique: false, bruitages: true, voix: true });
});

test('son : le réglage de la maison arrive avec l\'accueil et quand il change', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  const vus = [];
  L.onSon((s) => vus.push(s));
  w.message({ type: 'ludi:welcome', player: null, save: null, son: { musique: false, bruitages: true, voix: false } });
  assert.deepStrictEqual(L.son(), { musique: false, bruitages: true, voix: false });
  w.message({ type: 'ludi:son', son: { musique: true, bruitages: true, voix: false } });
  assert.deepStrictEqual(vus.map((s) => s.musique), [true, false, true]);
  // Le même réglage renvoyé ne rappelle pas le jeu.
  w.message({ type: 'ludi:son', son: { musique: true, bruitages: true, voix: false } });
  assert.strictEqual(vus.length, 3);
  // Un faux launcher est ignoré.
  w.message({ type: 'ludi:son', son: { musique: false } }, 'https://pirate.example');
  assert.strictEqual(L.son().musique, true);
});

test('son : dans Ludiworld, le bouton du jeu prévient le launcher (réglage de toute la maison)', () => {
  const w = fakeWindow({ embedded: true });
  const L = createLudi(w.win, { now: clock() }).init({ game: 'jeu' });
  L.reglerSon({ bruitages: false, autre: 3, voix: 'non' });
  const m = w.sent.map((x) => x.msg).filter((x) => x.type === 'ludi:son');
  assert.strictEqual(m.length, 1);
  assert.deepStrictEqual(m[0].son, { musique: true, bruitages: false, voix: true });
  assert.strictEqual(m[0].game, 'jeu');
  assert.strictEqual(w.sent.filter((x) => x.msg.type === 'ludi:son').every((x) => x.origin === 'https://pikifou.github.io'), true);
});
