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
