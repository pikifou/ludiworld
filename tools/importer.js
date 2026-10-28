#!/usr/bin/env node
// Importe la fiche d'un jeu publié ailleurs (GitHub Pages de préférence) dans le catalogue.
//
//   node tools/importer.js https://user.github.io/mon-jeu/          (adresse du site ou de ludi.json)
//   ISSUE_BODY="…" node tools/importer.js --issue                     (texte d'une issue « Proposer un jeu »)
//
// Écrit docs/jeux/<id>.json, l'ajoute à docs/jeux/index.json, et produit un compte rendu
// (rapport.md) pour l'issue. Code de sortie : 0 importé, 1 refusé.
// Le catalogue garde une copie de la fiche : un site qui tombe ne casse pas Ludiworld, et une
// fiche modifiée après validation doit être proposée à nouveau.
'use strict';
const fs = require('fs');
const path = require('path');
const { validate, knownDomains } = require('./valider.js');

const ROOT = path.join(__dirname, '..');
const JEUX = path.join(ROOT, 'docs/jeux');
const MAX_BYTES = 200 * 1024;
const TIMEOUT_MS = 15000;

function urlFromIssue(body) {
  const m = String(body || '').match(/https:\/\/[^\s<>)"'`\]]+/);
  return m ? m[0].replace(/[.,;]+$/, '') : null;
}

function cardUrlOf(input) {
  const u = new URL(input);
  if (u.protocol !== 'https:') throw new Error('L’adresse doit commencer par https://');
  if (/\.json$/i.test(u.pathname)) return u.href;
  if (/\.html?$/i.test(u.pathname)) u.pathname = u.pathname.replace(/[^/]*$/, '');
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  u.search = ''; u.hash = '';
  return new URL('ludi.json', u).href;
}

async function get(url, fetchImpl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'ludiworld-importer' } });
    return res;
  } finally { clearTimeout(timer); }
}

// Un hébergeur peut interdire l'affichage dans un cadre : on ouvrira alors le jeu dans un onglet.
function framable(headers) {
  const xfo = (headers.get('x-frame-options') || '').toLowerCase();
  if (xfo.includes('deny') || xfo.includes('sameorigin')) return false;
  const csp = (headers.get('content-security-policy') || '').toLowerCase();
  const fa = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('frame-ancestors'));
  if (fa && !/(\*|https:\/\/pikifou\.github\.io|https:)(\s|$)/.test(fa.slice('frame-ancestors'.length) + ' ')) return false;
  return true;
}

async function importCard(input, { fetchImpl = fetch, write = true, today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [];
  const warnings = [];
  const r = { ok: false, errors, warnings, card: null, cardUrl: null, id: null, isUpdate: false };

  try { r.cardUrl = cardUrlOf(input); } catch (e) { errors.push(e.message.startsWith('L’') ? e.message : 'Adresse illisible : ' + input); return r; }

  // 1. La fiche
  let res;
  try { res = await get(r.cardUrl, fetchImpl); } catch (e) { errors.push(`Impossible de joindre ${r.cardUrl} (${e.name === 'AbortError' ? 'trop long' : e.message}).`); return r; }
  if (!res.ok) { errors.push(`La fiche n’est pas trouvée à ${r.cardUrl} (code ${res.status}). Elle doit être à la racine du site publié, à côté de index.html.`); return r; }
  const text = await res.text();
  if (text.length > MAX_BYTES) { errors.push('La fiche est trop grosse (200 Ko au plus).'); return r; }
  let card;
  try { card = JSON.parse(text); } catch (e) { errors.push('La fiche n’est pas un JSON valide : ' + e.message); return r; }
  r.card = card;
  r.id = card && card.id;

  // 2. Le format (un domaine d'apprentissage inconnu n'est qu'un avertissement : on en discute dans la PR)
  for (const e of validate(card, knownDomains())) {
    if (/absent de spec\/domaines\.md/.test(e)) warnings.push(`Domaine nouveau, à valider : ${e.replace(/^learning\.domains : /, '')}`);
    else errors.push(e);
  }
  if (errors.length) return r;

  // 3. Le jeu doit être sur le même site que sa fiche (preuve que le créateur contrôle le jeu)
  const cardOrigin = new URL(r.cardUrl).origin;
  if (new URL(card.url).origin !== cardOrigin) errors.push(`Le jeu (${card.url}) doit être publié sur le même site que sa fiche (${cardOrigin}).`);

  // 4. Identifiant libre, ou mise à jour de la même fiche
  const target = path.join(JEUX, `${card.id}.json`);
  if (fs.existsSync(target)) {
    const prev = JSON.parse(fs.readFileSync(target, 'utf8'));
    const prevSite = prev.source && prev.source.card ? new URL(prev.source.card).origin : new URL(prev.url).origin;
    if (prevSite !== cardOrigin) errors.push(`L’identifiant « ${card.id} » est déjà pris par un autre jeu. Choisissez-en un autre dans ludi.json.`);
    else r.isUpdate = true;
  }
  if (errors.length) return r;

  // 5. Le jeu et l'icône répondent
  let embed = true;
  try {
    const g = await get(card.url, fetchImpl);
    if (!g.ok) errors.push(`Le jeu ne répond pas à ${card.url} (code ${g.status}).`);
    else embed = framable(g.headers);
    if (g.body && g.body.cancel) g.body.cancel().catch(() => {});
  } catch (e) { errors.push(`Impossible d’ouvrir le jeu à ${card.url}.`); }
  try {
    const i = await get(card.icon, fetchImpl);
    if (!i.ok) warnings.push(`L’icône ne répond pas (${card.icon}).`);
    if (i.body && i.body.cancel) i.body.cancel().catch(() => {});
  } catch (e) { warnings.push(`L’icône ne répond pas (${card.icon}).`); }
  if (!embed) warnings.push('Ce site interdit l’affichage dans un cadre : le launcher ouvrira le jeu dans un nouvel onglet (temps de jeu non mesuré).');
  if (card.third_parties.length) warnings.push(`Contacte d’autres sites : ${card.third_parties.join(', ')}.`);
  if (card.status === 'draft') warnings.push('La fiche est en « draft » : elle sera affichée comme en cours de relecture.');
  if (errors.length) return r;

  // 6. Écriture
  const saved = Object.assign({}, card, { embed, source: { card: r.cardUrl, imported: today } });
  r.card = saved;
  r.ok = true;
  if (write) {
    fs.writeFileSync(target, JSON.stringify(saved, null, 2) + '\n');
    const idxFile = path.join(JEUX, 'index.json');
    const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
    if (!idx.games.includes(`${card.id}.json`)) {
      idx.games.push(`${card.id}.json`);
      fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
    }
  }
  return r;
}

function rapport(r) {
  const L = [];
  const title = r.card && r.card.title ? (r.card.title.fr || r.card.title.en) : null;
  if (r.ok) {
    L.push(`✅ **${title}** est prêt à entrer dans Ludiworld${r.isUpdate ? ' (mise à jour de la fiche existante)' : ''}.`);
    L.push('');
    L.push(`- Fiche : ${r.cardUrl}`);
    L.push(`- Jeu : ${r.card.url}`);
    L.push(`- Âge : ${r.card.age.min} à ${r.card.age.max} ans · Une partie : ${r.card.session.minutes[0]} à ${r.card.session.minutes[1]} min`);
    L.push(`- Apprentissage : ${r.card.learning.level}${r.card.learning.domains.length ? ' (' + r.card.learning.domains.join(', ') + ')' : ''}`);
    L.push('');
    L.push('Prochaine étape : quelqu’un joue au jeu, vérifie la fiche, puis valide la demande d’ajout.');
  } else {
    L.push(`❌ La fiche n’a pas pu être importée${title ? ` (**${title}**)` : ''}.`);
    L.push('');
    r.errors.forEach((e) => L.push(`- ${e}`));
    L.push('');
    L.push('Corrigez puis modifiez cette issue (ou recréez-la) : la vérification se relance toute seule. Guide : https://github.com/pikifou/ludiworld/blob/main/LUDIWORLD.md');
  }
  if (r.warnings.length) {
    L.push('');
    L.push('À noter :');
    r.warnings.forEach((w) => L.push(`- ${w}`));
  }
  return L.join('\n') + '\n';
}

if (require.main === module) {
  (async () => {
    const arg = process.argv[2];
    const input = arg === '--issue' ? urlFromIssue(process.env.ISSUE_BODY) : arg;
    let r;
    if (!input) r = { ok: false, errors: ['Aucune adresse https:// trouvée. Indiquez l’adresse du jeu sur GitHub Pages.'], warnings: [] };
    else r = await importCard(input);
    const md = rapport(r);
    fs.writeFileSync(path.join(process.cwd(), 'rapport.md'), md);
    process.stdout.write(md);
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `ok=${r.ok}\nid=${r.ok ? r.card.id : ''}\ntitle=${r.ok ? (r.card.title.fr || r.card.title.en).replace(/[\r\n]/g, ' ') : ''}\nupdate=${!!r.isUpdate}\n`);
    }
    process.exit(r.ok ? 0 : 1);
  })();
}

module.exports = { importCard, cardUrlOf, urlFromIssue, framable, rapport };
