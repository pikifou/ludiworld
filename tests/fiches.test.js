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
