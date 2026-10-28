#!/usr/bin/env node
// Valide les fiches ludi.json (spec/fiche.md). Usage : node tools/valider.js [fiche.json …]
// Sans argument : valide tout le catalogue docs/jeux/index.json.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HEALTHY = ['no_ads', 'no_purchases', 'no_subscription', 'no_loot_boxes', 'no_daily_pressure',
  'no_notifications', 'no_strangers', 'no_tracking', 'natural_stops'];
const DEVICES = ['phone', 'tablet', 'computer'];

function knownDomains() {
  const md = fs.readFileSync(path.join(ROOT, 'spec/domaines.md'), 'utf8');
  return new Set([...md.matchAll(/^\| `([a-z0-9-]+\.[a-z0-9-]+)` \|/gm)].map((m) => m[1]));
}

function validate(f, domains = knownDomains()) {
  const err = [];
  const bi = (k, v) => {
    if (!v || typeof v.fr !== 'string' || !v.fr.trim() || typeof v.en !== 'string' || !v.en.trim()) err.push(`${k} : texte fr et en requis`);
  };
  const url = (k, v) => { try { if (!/^https:\/\//.test(new URL(v).href)) throw 0; } catch (e) { err.push(`${k} : adresse https requise`); } };

  if (!f || typeof f !== 'object') return ['fiche illisible'];
  if (f.ludi !== 1) err.push('ludi : doit valoir 1');
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(f.id || '')) err.push('id : minuscules, chiffres et tirets');
  if (!['draft', 'published'].includes(f.status)) err.push('status : draft ou published');
  bi('title', f.title); bi('pitch', f.pitch); bi('content', f.content);
  url('url', f.url); url('icon', f.icon);
  if (f.color !== undefined && !/^#[0-9a-f]{6}$/i.test(f.color)) err.push('color : #rrggbb');
  if (!f.author || !f.author.name) err.push('author.name requis');
  if (!Array.isArray(f.languages) || !f.languages.length) err.push('languages : au moins une langue');
  const a = f.age || {};
  if (!(Number.isInteger(a.min) && Number.isInteger(a.max) && a.min >= 2 && a.min <= a.max && a.max <= 18)) err.push('age : min et max entiers, 2 ≤ min ≤ max ≤ 18');
  if (!['none', 'some', 'fluent'].includes(f.reading)) err.push('reading : none, some ou fluent');

  const l = f.learning || {};
  if (!['core', 'side', 'none'].includes(l.level)) err.push('learning.level : core, side ou none');
  if (!Array.isArray(l.domains)) err.push('learning.domains : liste requise');
  else l.domains.forEach((d) => { if (!domains.has(d)) err.push(`learning.domains : « ${d} » absent de spec/domaines.md`); });
  if (l.level !== 'none') { bi('learning.what', l.what); bi('learning.how', l.how); }

  const s = f.session || {};
  if (!(Array.isArray(s.minutes) && s.minutes.length === 2 && s.minutes[0] > 0 && s.minutes[0] <= s.minutes[1])) err.push('session.minutes : [min, max] en minutes');
  if (typeof s.natural_end !== 'boolean') err.push('session.natural_end : true ou false');
  if (s.total_hours !== undefined && !(s.total_hours > 0)) err.push('session.total_hours : nombre positif');

  if (!Array.isArray(f.devices) || !f.devices.length || f.devices.some((d) => !DEVICES.includes(d))) err.push(`devices : parmi ${DEVICES.join(', ')}`);
  if (typeof f.offline !== 'boolean') err.push('offline : true ou false');
  const h = f.healthy || {};
  HEALTHY.forEach((k) => { if (h[k] !== true) err.push(`healthy.${k} : doit être true pour entrer dans Ludiworld`); });
  if (!Array.isArray(f.third_parties)) err.push('third_parties : liste (vide si aucun)');
  if (typeof f.kit !== 'boolean') err.push('kit : true ou false');
  return err;
}

function catalogue() {
  const dir = path.join(ROOT, 'docs/jeux');
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  return index.games.map((g) => path.join(dir, g));
}

if (require.main === module) {
  const files = process.argv.length > 2 ? process.argv.slice(2) : catalogue();
  const domains = knownDomains();
  let bad = 0;
  for (const file of files) {
    let errors;
    try { errors = validate(JSON.parse(fs.readFileSync(file, 'utf8')), domains); } catch (e) { errors = [`JSON invalide : ${e.message}`]; }
    if (errors.length) { bad++; console.log(`✗ ${path.basename(file)}`); errors.forEach((e) => console.log(`   - ${e}`)); }
    else console.log(`✓ ${path.basename(file)}`);
  }
  process.exit(bad ? 1 : 0);
}

module.exports = { validate, catalogue, knownDomains };
