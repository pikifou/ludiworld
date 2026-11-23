// Les statistiques d'usage (docs/usage.js) : ce qui est noté, ce qui part, le refus du parent, le numéro de l'appareil.
const test = require('node:test');
const assert = require('node:assert');
const U = require('../docs/usage.js');

function stockage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
let graine = 1;
function aleatoire(n) { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (graine * 31 + i * 7) & 255; graine++; return b; }
function monter(o = {}) {
  const s = o.stockage || stockage();
  const etat = { t: o.t || Date.UTC(2026, 10, 23, 18), permis: o.permis !== false, envois: [], echec: false };
  const u = U.creer({
    stockage: s, aleatoire, maintenant: () => etat.t, permis: () => etat.permis,
    contexte: () => ({ age: 7, format: 'tablette', langue: 'fr', version: '0.10.0' }),
    envoyer: (lot) => { etat.envois.push(lot); return etat.echec ? Promise.reject(new Error('réseau')) : Promise.resolve(lot.length); }
  });
  return { u, s, etat };
}

test('un événement porte le jour, un numéro d\'appareil, la tranche d\'âge, jamais un prénom', () => {
  const { u, s } = monter();
  assert.ok(u.noter('jeu_lance', 'chasseur-dragons'));
  const e = JSON.parse(s.getItem(U.CLE_FILE))[0];
  assert.match(e.appareil, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(e.jour, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepStrictEqual({ evt: e.evt, jeu: e.jeu, age: e.age, format: e.format, langue: e.langue }, { evt: 'jeu_lance', jeu: 'chasseur-dragons', age: '6-7', format: 'tablette', langue: 'fr' });
  assert.deepStrictEqual(Object.keys(e).sort(), ['age', 'appareil', 'evt', 'format', 'jeu', 'jour', 'langue', 'version']);
});

test('les tranches d\'âge', () => {
  assert.deepStrictEqual([4, 5, 6, 7, 8, 10, 11, 12, null].map(U.trancheAge), ['4-5', '4-5', '6-7', '6-7', '8-10', '8-10', '11-12', '11-12', null]);
});

test('un mot mal formé n\'est pas noté', () => {
  const { u } = monter();
  assert.strictEqual(u.noter('Jeu Lancé'), false);
  assert.strictEqual(u.enAttente(), 0);
});

test('le même numéro d\'un jour à l\'autre, un nouveau après un an', () => {
  const { u, s, etat } = monter();
  u.noter('vue');
  etat.t += 30 * 24 * 3600e3; u.noter('vue');
  etat.t += 340 * 24 * 3600e3; u.noter('vue');
  const f = JSON.parse(s.getItem(U.CLE_FILE));
  assert.strictEqual(f[0].appareil, f[1].appareil);
  assert.notStrictEqual(f[1].appareil, f[2].appareil);
});

test('envoyer vide la file ; une erreur garde tout pour la prochaine fois', async () => {
  const { u, etat } = monter();
  u.noter('jeu_lance', 'a'); u.noter('jeu_fini', 'a', { minutes: 3, raison: 'sortie' });
  etat.echec = true;
  assert.strictEqual(await u.envoyer(), 0);
  assert.strictEqual(u.enAttente(), 2);
  etat.echec = false;
  assert.strictEqual(await u.envoyer(), 2);
  assert.strictEqual(u.enAttente(), 0);
  assert.deepStrictEqual(etat.envois[1][1].details, { minutes: 3, raison: 'sortie' });
});

test('par lots de 200, et la file ne grossit pas sans fin', async () => {
  const { u, etat } = monter();
  for (let i = 0; i < 350; i++) u.noter('vue');
  assert.strictEqual(u.enAttente(), 300);
  await u.envoyer();
  assert.strictEqual(etat.envois[0].length, 200);
  assert.strictEqual(u.enAttente(), 100);
});

test('ce qui arrive pendant un envoi reste pour le suivant', async () => {
  const { u, etat } = monter();
  u.noter('vue');
  const p = u.envoyer();
  u.noter('jeu_lance', 'b');
  await p;
  assert.strictEqual(etat.envois[0].length, 1);
  assert.strictEqual(u.enAttente(), 1);
});

test('le parent refuse : rien n\'est noté, ce qui attendait et le numéro s\'effacent', async () => {
  const { u, s, etat } = monter();
  u.noter('vue');
  etat.permis = false;
  assert.strictEqual(u.noter('jeu_lance', 'a'), false);
  assert.strictEqual(await u.envoyer(), 0);
  assert.strictEqual(etat.envois.length, 0);
  assert.strictEqual(s.getItem(U.CLE_FILE), null);
  assert.strictEqual(s.getItem(U.CLE_APPAREIL), null);
});

test('le choix du parent part une fois, avec un numéro neuf, jamais celui de l\'appareil', async () => {
  const { u, s, etat } = monter();
  u.noter('vue');
  const numero = JSON.parse(s.getItem(U.CLE_APPAREIL)).id;
  etat.permis = false;
  u.oublier();
  await u.signalerChoix('statistiques_refusees');
  assert.strictEqual(etat.envois.length, 1);
  const e = etat.envois[0][0];
  assert.strictEqual(e.evt, 'statistiques_refusees');
  assert.notStrictEqual(e.appareil, numero);
  assert.deepStrictEqual({ age: e.age, format: e.format }, { age: '6-7', format: 'tablette' });
  assert.strictEqual(s.getItem(U.CLE_APPAREIL), null, 'le numéro de l\'appareil ne revient pas');
  assert.strictEqual(s.getItem(U.CLE_CHOIX), null, 'parti : rien ne reste');
});

test('sans réseau, seul le dernier choix attend, et part au prochain envoi même refusé', async () => {
  const { u, s, etat } = monter();
  etat.echec = true;
  await u.signalerChoix('statistiques_refusees');
  await u.signalerChoix('statistiques_reprises');
  await u.signalerChoix('statistiques_refusees');
  assert.strictEqual(JSON.parse(s.getItem(U.CLE_CHOIX)).length, 1);
  etat.echec = false; etat.permis = false;
  await u.envoyer();
  await new Promise((r) => setTimeout(r, 0));
  assert.strictEqual(etat.envois.at(-1)[0].evt, 'statistiques_refusees');
  assert.strictEqual(s.getItem(U.CLE_CHOIX), null);
});
