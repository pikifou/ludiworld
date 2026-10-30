const test = require('node:test');
const assert = require('node:assert');
const T = require('../docs/temps.js');

const MIN = 60000;
const lundi = new Date(2026, 10, 2);     // 2 novembre 2026, un lundi
const mercredi = new Date(2026, 10, 4);

test('minutes du jour : jours d\'école et jours sans école', () => {
  const r = { ecole: 30, libre: 60, joursLibres: [0, 3, 6] };
  assert.strictEqual(T.minutesDuJour(r, lundi), 30);
  assert.strictEqual(T.minutesDuJour(r, mercredi), 60);
  assert.strictEqual(T.minutesDuJour({ ecole: null }, lundi), null);
});

test('bonus : seulement le jour donné, jamais en dessous de zéro', () => {
  const r = { ecole: 30, bonus: { jour: T.cleJour(lundi), min: 10 } };
  assert.strictEqual(T.minutesDuJour(r, lundi), 40);
  assert.strictEqual(T.minutesDuJour(r, new Date(2026, 10, 3)), 30);
  assert.strictEqual(T.minutesDuJour({ ecole: 30, bonus: { jour: T.cleJour(lundi), min: -999 } }, lundi), 0);
});

test('fini pour aujourd\'hui : zéro, même un jour sans limite, et seulement ce jour-là', () => {
  assert.strictEqual(T.minutesDuJour({ ecole: null, fini: T.cleJour(lundi) }, lundi), 0);
  assert.strictEqual(T.minutesDuJour({ ecole: 30, fini: T.cleJour(lundi) }, new Date(2026, 10, 3)), 30);
});

test('reste : la limite la plus courte gagne', () => {
  const r = { ecole: 30 };
  const a = T.reste({ regles: r, limiteJeu: 20, joueTotal: 5 * MIN, joueJeu: 15 * MIN, date: lundi });
  assert.strictEqual(a.reste, 5 * MIN);
  assert.strictEqual(a.cause, 'jeu');
  const b = T.reste({ regles: r, limiteJeu: null, joueTotal: 28 * MIN, joueJeu: 0, date: lundi });
  assert.strictEqual(b.reste, 2 * MIN);
  assert.strictEqual(b.cause, 'total');
  const c = T.reste({ regles: { ecole: null }, limiteJeu: null, joueTotal: 999 * MIN, date: lundi });
  assert.strictEqual(c.reste, Infinity);
});

test('part du jour : place du soleil', () => {
  assert.strictEqual(T.part({ regles: { ecole: 30 }, joueTotal: 0, date: lundi }), 1);
  assert.strictEqual(T.part({ regles: { ecole: 30 }, joueTotal: 15 * MIN, date: lundi }), 0.5);
  assert.strictEqual(T.part({ regles: { ecole: 30 }, joueTotal: 45 * MIN, date: lundi }), 0);
  assert.strictEqual(T.part({ regles: { ecole: null }, joueTotal: 45 * MIN, date: lundi }), 1);
});

test('décision : on joue, puis on prévient', () => {
  assert.strictEqual(T.decision({ reste: Infinity, fin: 'nette' }), 'jouer');
  assert.strictEqual(T.decision({ reste: 6 * MIN, fin: 'nette' }), 'jouer');
  assert.strictEqual(T.decision({ reste: 4 * MIN, fin: 'nette' }), 'bientot');
  assert.strictEqual(T.decision({ reste: 4 * MIN, fin: 'douce' }), 'bientot');
});

test('fin nette : arrêt à la minute', () => {
  assert.strictEqual(T.decision({ reste: 0, fin: 'nette', kit: true, grace: 10 }), 'arreter');
});

test('fin douce : on attend la fin de la manche, dans la limite du délai', () => {
  const e = { fin: 'douce', kit: true, grace: 10 };
  assert.strictEqual(T.decision({ ...e, reste: 0 }), 'finir');
  assert.strictEqual(T.decision({ ...e, reste: -9 * MIN }), 'finir');
  assert.strictEqual(T.decision({ ...e, reste: -2 * MIN, pointArret: true }), 'arreter');
  assert.strictEqual(T.decision({ ...e, reste: -10 * MIN }), 'arreter');
});

test('fin douce : une manche finie juste avant la fin suffit', () => {
  const e = { fin: 'douce', kit: true, grace: 10, pointArret: true };
  assert.strictEqual(T.decision({ ...e, reste: 2 * MIN }), 'arreter');
  assert.strictEqual(T.decision({ ...e, reste: 4 * MIN }), 'bientot');
});

test('fin douce sans kit : 3 minutes pour finir, pas plus', () => {
  const e = { fin: 'douce', kit: false, grace: 10 };
  assert.strictEqual(T.decision({ ...e, reste: -2 * MIN }), 'finir');
  assert.strictEqual(T.decision({ ...e, reste: -3 * MIN }), 'arreter');
});

test('heures de jeu : la fin de la plage compte comme une limite', () => {
  const r = { ecole: 30, heures: { debut: '08:00', fin: '19:30' } };
  const a = T.reste({ regles: r, joueTotal: 0, date: new Date(2026, 10, 2, 19, 20) });
  assert.strictEqual(a.reste, 10 * MIN);
  assert.strictEqual(a.cause, 'heure');
  const b = T.reste({ regles: r, joueTotal: 0, date: new Date(2026, 10, 2, 15, 0) });
  assert.strictEqual(b.reste, 30 * MIN);
  assert.strictEqual(b.cause, 'total');
});

test('heures de jeu : avant et après, on ne joue pas', () => {
  const r = { ecole: 30, heures: { debut: '08:00', fin: '19:30' } };
  assert.strictEqual(T.reste({ regles: r, joueTotal: 0, date: new Date(2026, 10, 2, 7, 59) }).reste, 0);
  assert.strictEqual(T.horsPlage(r, new Date(2026, 10, 2, 7, 59)), 'avant');
  assert.strictEqual(T.horsPlage(r, new Date(2026, 10, 2, 19, 30)), 'apres');
  assert.strictEqual(T.horsPlage(r, new Date(2026, 10, 2, 12, 0)), null);
  assert.strictEqual(T.horsPlage({ ecole: 30 }, new Date(2026, 10, 2, 23, 0)), null);
});

test('vacances : tous les jours sont sans école jusqu\'à la date, incluse', () => {
  const r = { ecole: 30, libre: 90, joursLibres: [0, 3, 6], vacances: '2026-11-03' };
  assert.strictEqual(T.minutesDuJour(r, lundi), 90);
  assert.strictEqual(T.minutesDuJour(r, new Date(2026, 10, 3)), 90);
  assert.strictEqual(T.minutesDuJour(r, new Date(2026, 10, 5)), 30);
});
