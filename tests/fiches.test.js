const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { validate, catalogue } = require('../tools/valider.js');

for (const file of catalogue()) {
  test(`fiche valide : ${path.basename(file)}`, () => {
    const f = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepStrictEqual(validate(f), []);
    assert.strictEqual(`${f.id}.json`, path.basename(file), 'le nom du fichier est l\'id');
  });
}

test('les images du jeu (screenshots) existent dans docs/jeux/img', () => {
  for (const file of catalogue()) {
    const f = JSON.parse(fs.readFileSync(file, 'utf8'));
    (f.screenshots || []).forEach((s) => {
      if (/^img\//.test(s.src)) assert.ok(fs.existsSync(path.join(path.dirname(file), s.src)), `${f.id} : ${s.src} manque`);
    });
  }
});

test('screenshots : facultatif, 1 à 5 images, chemin local ou https, texte bilingue', () => {
  const base = JSON.parse(fs.readFileSync(catalogue()[0], 'utf8'));
  delete base.screenshots; delete base.screens;
  assert.deepStrictEqual(validate(base), [], 'sans images, la fiche reste valide');
  const shot = (src) => ({ src, alt: { fr: 'Une image', en: 'A picture' } });
  const avec = (shots, screens = 'landscape') => Object.assign({}, base, { screenshots: shots, screens });
  assert.deepStrictEqual(validate(avec([shot(`img/${base.id}-1.webp`), shot('https://exemple.org/a.png')])), []);
  assert.ok(validate(avec([])).some((e) => e.startsWith('screenshots')), 'liste vide');
  assert.ok(validate(avec([1, 2, 3, 4, 5, 6].map((n) => shot(`img/${base.id}-${n}.webp`)))).some((e) => e.startsWith('screenshots')), 'plus de 5');
  assert.ok(validate(avec([shot('img/autre-jeu-1.webp')])).some((e) => e.includes('.src')), 'image d\'un autre jeu');
  assert.ok(validate(avec([shot('http://exemple.org/a.png')])).some((e) => e.includes('.src')), 'http');
  assert.ok(validate(avec([shot('../../secret.webp')])).some((e) => e.includes('.src')), 'chemin qui sort');
  assert.ok(validate(avec([{ src: `img/${base.id}-1.webp`, alt: { fr: 'Seul' } }])).some((e) => e.includes('.alt')), 'alt sans anglais');
  assert.ok(validate(avec([shot(`img/${base.id}-1.webp`)], 'carre')).some((e) => e.startsWith('screens')), 'orientation inconnue');
  assert.ok(validate(Object.assign({}, base, { screens: 'portrait' })).some((e) => e.startsWith('screens')), 'screens sans screenshots');
});

test('together : facultatif, true ou false ; Simon des Monstres se joue à deux', () => {
  const base = JSON.parse(fs.readFileSync(catalogue()[0], 'utf8'));
  delete base.together;
  assert.deepStrictEqual(validate(base), [], 'sans together, la fiche reste valide');
  assert.deepStrictEqual(validate(Object.assign({}, base, { together: true })), []);
  assert.deepStrictEqual(validate(Object.assign({}, base, { together: false })), []);
  assert.ok(validate(Object.assign({}, base, { together: 'oui' })).some((e) => e.startsWith('together')), 'pas un booléen');
  const fiches = catalogue().map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
  assert.deepStrictEqual(fiches.filter((f) => f.together === true).map((f) => f.id), ['simon-des-monstres']);
});

test('added : facultatif, une vraie date AAAA-MM-JJ pas dans le futur ; chaque jeu du catalogue en a une', () => {
  const base = JSON.parse(fs.readFileSync(catalogue()[0], 'utf8'));
  delete base.added;
  assert.deepStrictEqual(validate(base), [], 'sans added, la fiche reste valide (une fiche proposée)');
  assert.deepStrictEqual(validate(Object.assign({}, base, { added: '2026-10-28' })), []);
  ['28/10/2026', '2026-02-30', '2026-10-28T10:00', 20261028, ''].forEach((v) => {
    assert.ok(validate(Object.assign({}, base, { added: v })).some((e) => e.startsWith('added')), `refusé : ${v}`);
  });
  assert.ok(validate(Object.assign({}, base, { added: '2999-01-01' })).some((e) => e.startsWith('added')), 'pas dans le futur');
  const fiches = catalogue().map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  assert.deepStrictEqual(fiches.filter((f) => !f.added).map((f) => f.id), []);
});

test('after : facultatif, une phrase fr et en ; les huit jeux du catalogue en ont une', () => {
  const base = JSON.parse(fs.readFileSync(catalogue()[0], 'utf8'));
  delete base.after;
  assert.deepStrictEqual(validate(base), [], 'sans after, la fiche reste valide');
  assert.deepStrictEqual(validate(Object.assign({}, base, { after: { fr: 'Une idée.', en: 'An idea.' } })), []);
  assert.ok(validate(Object.assign({}, base, { after: { fr: 'Une idée.' } })).some((e) => e.startsWith('after')), 'il manque l\'anglais');
  assert.ok(validate(Object.assign({}, base, { after: 'Une idée.' })).some((e) => e.startsWith('after')), 'pas un texte bilingue');
  assert.ok(validate(Object.assign({}, base, { after: { fr: 'x'.repeat(161), en: 'y' } })).some((e) => e.startsWith('after')), 'trop long');
  const fiches = catalogue().map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
  assert.deepStrictEqual(fiches.filter((f) => !f.after).map((f) => f.id), []);
});

test('une fiche qui triche est refusée', () => {
  const f = JSON.parse(fs.readFileSync(catalogue()[0], 'utf8'));
  f.healthy.no_purchases = false;
  f.learning.domains.push('magie.inventee');
  const errors = validate(f);
  assert.ok(errors.some((e) => e.startsWith('healthy.no_purchases')));
  assert.ok(errors.some((e) => e.includes('magie.inventee')));
});

test('fiches « Ludiworld aime bien » valides', () => {
  const { validateRecos, AIME_BIEN } = require('../tools/valider.js');
  assert.deepStrictEqual(validateRecos(JSON.parse(fs.readFileSync(AIME_BIEN, 'utf8'))), []);
});

test('une recommandation sans « à savoir » doit se dire partielle', () => {
  const { validateRecos } = require('../tools/valider.js');
  const r = { id: 'x', type: 'serie', status: 'valide', by: 'A', title: { fr: 'X', en: 'X' }, pitch: { fr: 'X', en: 'X' } };
  assert.ok(validateRecos({ ludi: 1, items: [r] }).some((e) => e.includes('incomplete')));
  assert.deepStrictEqual(validateRecos({ ludi: 1, items: [Object.assign({ incomplete: true }, r)] }), []);
  assert.ok(validateRecos({ ludi: 1, items: [Object.assign({}, r, { type: 'livre' })] }).some((e) => e.includes('type')));
});
