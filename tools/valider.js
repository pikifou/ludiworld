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
  else if (f.author.url !== undefined) url('author.url', f.author.url);
  if (f.embed !== undefined && typeof f.embed !== 'boolean') err.push('embed : true ou false');
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

// « Ludiworld aime bien » : séries, films et applis (docs/aime-bien/fiches.json, spec/aime-bien.md).
// Une fiche peut être partielle (incomplete) : seuls l'identité, le type, le statut, le titre et le pitch sont requis.
const RECO_TYPES = ['serie', 'film', 'appli'];
const RECO_STATUS = ['valide', 'propose'];
const RECO_TEXTES = ['format', 'learn', 'why', 'watch_out', 'where'];
const AIME_BIEN = path.join(ROOT, 'docs/aime-bien/fiches.json');

function validateRecos(doc) {
  const err = [];
  const bi = (k, v) => {
    if (!v || typeof v.fr !== 'string' || !v.fr.trim() || typeof v.en !== 'string' || !v.en.trim()) err.push(`${k} : texte fr et en requis`);
  };
  if (!doc || doc.ludi !== 1 || !Array.isArray(doc.items)) return ['fiches.json : { "ludi": 1, "items": [...] } attendu'];
  const ids = new Set();
  doc.items.forEach((r, i) => {
    const at = `items[${i}]${r && r.id ? ` (${r.id})` : ''}`;
    if (!r || typeof r !== 'object') { err.push(`${at} : fiche illisible`); return; }
    if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(r.id || '')) err.push(`${at} id : minuscules, chiffres et tirets`);
    else if (ids.has(r.id)) err.push(`${at} id : déjà pris`);
    ids.add(r.id);
    if (!RECO_TYPES.includes(r.type)) err.push(`${at} type : ${RECO_TYPES.join(', ')}`);
    if (!RECO_STATUS.includes(r.status)) err.push(`${at} status : ${RECO_STATUS.join(' ou ')}`);
    if (!r.by || typeof r.by !== 'string') err.push(`${at} by : qui recommande (prénom ou pseudo)`);
    bi(`${at} title`, r.title); bi(`${at} pitch`, r.pitch);
    RECO_TEXTES.forEach((k) => { if (r[k] !== undefined) bi(`${at} ${k}`, r[k]); });
    if (r.age !== undefined && !(Number.isInteger(r.age.min) && Number.isInteger(r.age.max) && r.age.min >= 0 && r.age.min <= r.age.max && r.age.max <= 18)) err.push(`${at} age : min et max entiers, 0 ≤ min ≤ max ≤ 18`);
    if (r.languages !== undefined && (!Array.isArray(r.languages) || !r.languages.length)) err.push(`${at} languages : liste non vide`);
    if (r.incomplete !== undefined && typeof r.incomplete !== 'boolean') err.push(`${at} incomplete : true ou false`);
    // Une fiche recommandée sans « à savoir » ni « où » doit le dire : elle est partielle.
    if (r.status === 'valide' && !r.incomplete && RECO_TEXTES.some((k) => r[k] === undefined)) err.push(`${at} : fiche recommandée incomplète, compléter ${RECO_TEXTES.filter((k) => r[k] === undefined).join(', ')} ou mettre "incomplete": true`);
  });
  return err;
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
  if (process.argv.length <= 2) {
    let errors;
    try { errors = validateRecos(JSON.parse(fs.readFileSync(AIME_BIEN, 'utf8'))); } catch (e) { errors = [`JSON invalide : ${e.message}`]; }
    if (errors.length) { bad++; console.log('✗ aime-bien/fiches.json'); errors.forEach((e) => console.log(`   - ${e}`)); }
    else console.log('✓ aime-bien/fiches.json');
  }
  process.exit(bad ? 1 : 0);
}

module.exports = { validate, catalogue, knownDomains, validateRecos, AIME_BIEN };
