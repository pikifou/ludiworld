/* Ludiworld : l'appli (côté enfant, carnet parent, jeux en plein cadre). Tout reste sur l'appareil, sauf si le parent active la synchro. */
(function () {
  'use strict';

  var STORE = 'ludiworld.v1';
  var LANG_KEY = 'ludiworld.lang';
  var T = window.LudiTextes;
  var Temps = window.LudiTemps;
  var MIN = Temps.MIN;
  var LIMITES_JEU = [null, 10, 15, 20, 30, 45, 60];
  var AGES = [4, 5, 6, 7, 8, 9, 10, 11, 12];

  // ---------- Langue ----------
  var lang = (function () {
    try { var l = localStorage.getItem(LANG_KEY); if (l === 'fr' || l === 'en') return l; } catch (e) { /* rien */ }
    return /^fr/i.test(navigator.language || 'fr') ? 'fr' : 'en';
  })();
  function t(key, vars) {
    var s = key.split('.').reduce(function (o, k) { return o && o[k]; }, T[lang]);
    if (s === undefined) s = key;
    if (vars && typeof s === 'string') Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  // Textes des fiches : en français, espace insécable avant « ? ! : ; » pour qu'ils ne partent pas seuls à la ligne.
  function pick(bi) {
    var s = bi ? (bi[lang] || bi.fr || bi.en || '') : '';
    return lang === 'fr' ? s.replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ') : s;
  }
  function setLang(l) {
    lang = l;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* rien */ }
    document.documentElement.lang = lang;
    render();
  }

  // ---------- Petits outils ----------
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'style') n.setAttribute('style', v);
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  var ICONS = {
    sun: '<circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/>',
    hourglass: '<path d="M6 2h12M6 22h12M7 2c0 5 5 6 5 10s-5 5-5 10M17 2c0 5-5 6-5 10s5 5 5 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    lock: '<rect x="4" y="10.5" width="16" height="11" rx="2.5" fill="currentColor"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" fill="none" stroke="currentColor" stroke-width="2.4"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
    check: '<path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    cross: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5l5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    warn: '<path d="M12 3l10 18H2z" fill="currentColor"/><path d="M12 10v5M12 18v.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
    book: '<path d="M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4zM20 4.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    minus: '<path d="M5 12h14" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
    plus: '<path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>'
  };
  function icon(name, cls) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'ico' + (cls ? ' ' + cls : ''));
    s.innerHTML = ICONS[name];
    return s;
  }
  function duration(ms) {
    var min = Math.round(ms / MIN);
    if (min < 1) return lang === 'fr' ? 'moins d’une minute' : 'under a minute';
    if (min < 60) return min + '\u00a0min';
    var h = Math.floor(min / 60), m = min % 60;
    return h + '\u00a0h' + (m ? '\u00a0' + (m < 10 ? '0' : '') + m : '');
  }
  function minutesLeft(ms) { return duration(Math.max(ms, 30000)); } // « moins d'une minute » plutôt que « 0 min »
  function lastDays(n) { var out = [], d = new Date(); for (var i = 0; i < n; i++) { out.push(Temps.cleJour(d)); d.setDate(d.getDate() - 1); } return out; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  // Hachage simple du code parent (il reste sur l'appareil ; on évite juste de le garder en clair).
  function hash(s) { var h = 2166136261; s = 'ludiworld:' + s; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }

  // ---------- Ce que Ludiworld retient (sur l'appareil) ----------
  var store = (function () {
    try { return JSON.parse(localStorage.getItem(STORE)) || { games: {} }; } catch (e) { return { games: {} }; }
  })();
  if (!store.games) store.games = {};
  migrer();
  function saveStore() { try { localStorage.setItem(STORE, JSON.stringify(store)); } catch (e) { /* rien */ } }
  // Le foyer : le code parent et les enfants. Chaque enfant a son pseudo, ses jeux, ses règles et ses statistiques.
  function foyer() { return store.famille && store.famille.enfants ? store.famille : null; }
  // L'enfant actif (celui qui joue, ou celui que le parent règle dans le carnet).
  function fam() {
    var h = foyer();
    if (!h || !h.enfants.length) return null;
    return h.enfants.filter(function (e) { return e.id === h.actif; })[0] || h.enfants[0];
  }
  function S() { var e = fam(); return e ? (e.games || (e.games = {})) : store.games; }
  // Ancien format (un seul enfant) : on le range dans le foyer, sans rien perdre.
  function migrer() {
    var old = store.famille;
    if (!old || old.enfants) return;
    store.famille = {
      v: 2, cree: old.cree || Date.now(), pin: old.pin, reset: old.reset || null, codeChange: old.codeChange || null, protege: true,
      enfants: [{ id: 'e1', enfant: old.enfant, jeux: old.jeux || {}, regles: old.regles, games: store.games || {} }], actif: 'e1'
    };
    store.games = {};
  }
  function nouvelEnfant(nom, age, jeux, regles) {
    var h = foyer(), id = 'e' + Date.now().toString(36);
    var e = { id: id, enfant: { nom: nom, age: age }, jeux: jeux, regles: regles, games: {} };
    h.enfants.push(e);
    return e;
  }
  function regles() { return Temps.regles(fam() && fam().regles); }
  function gameStats(id) {
    var g = S()[id];
    if (!g) g = S()[id] = { ms: 0, sessions: 0, days: {}, scores: {}, progress: {}, kit: false };
    if (!g.skills) g.skills = {};
    if (!g.skillDays) g.skillDays = {};
    return g;
  }
  var unsaved = 0;
  function addTime(id, ms) {
    if (!(ms > 0)) return;
    var g = gameStats(id), k = Temps.cleJour();
    g.ms += ms; g.days[k] = (g.days[k] || 0) + ms;
    unsaved += ms;
    if (unsaved >= 5000) flushStore();
  }
  function flushStore() {
    unsaved = 0;
    var keep = lastDays(60);
    Object.keys(S()).forEach(function (id) {
      var g = S()[id];
      Object.keys(g.days || {}).forEach(function (d) { if (keep.indexOf(d) === -1) delete g.days[d]; });
      Object.keys(g.skillDays || {}).forEach(function (d) { if (keep.indexOf(d) === -1) delete g.skillDays[d]; });
    });
    saveStore();
  }
  function dayMs(id, key) {
    key = key || Temps.cleJour();
    var ids = id ? [id] : Object.keys(S());
    return ids.reduce(function (s, gid) { var g = S()[gid]; return s + (g && g.days && g.days[key] || 0); }, 0);
  }
  function weekMs(id) { return lastDays(7).reduce(function (s, d) { return s + dayMs(id, d); }, 0); }
  function choix(id) { var f = fam(); return f && f.jeux && f.jeux[id] || null; }
  function resteJeu(id) {
    var c = choix(id), r = regles();
    var limite = c ? c.max : null;
    if (c && (c.fini === Temps.cleJour() || (c.libres && !Temps.jourLibre(r)))) limite = 0;
    var out = Temps.reste({ regles: r, limiteJeu: limite, joueTotal: dayMs(), joueJeu: dayMs(id) });
    if (limite === 0) { out.jeu = Math.min(out.jeu, 0); out.reste = Math.min(out.reste, 0); out.cause = 'jeu'; }
    if (codeEnAttente()) { out.reste = 0; out.total = 0; }
    return out;
  }
  // « Code oublié » : on attend 30 min avant de pouvoir en choisir un nouveau, et l'enfant ne joue pas pendant ce temps
  // (un enfant n'a donc aucun intérêt à le demander).
  var ATTENTE_CODE = 30 * MIN;
  function codeEnAttente() { var f = foyer(); return !!(f && f.reset && Date.now() - f.reset < ATTENTE_CODE); }
  function codePret() { var f = foyer(); return !!(f && f.reset && Date.now() - f.reset >= ATTENTE_CODE); }
  // Ce qui reste aujourd'hui, tous jeux confondus (limite du jour et heures de jeu).
  function resteDuJour() {
    var out = Temps.reste({ regles: regles(), limiteJeu: null, joueTotal: dayMs(), joueJeu: 0 });
    if (codeEnAttente()) { out.total = 0; out.reste = 0; }
    return out;
  }
  // Part du jour qui reste, pour placer le soleil (1 : plein jour, 0 : couché).
  function partDuJour() {
    var tot = Temps.minutesDuJour(regles());
    var rt = resteDuJour().total;
    if (rt === Infinity) return 1;
    var ref = tot !== null ? tot * MIN : 60 * MIN;
    return ref > 0 ? clamp(rt / ref, 0, 1) : 0;
  }
  function heure(hhmm) { return lang === 'fr' ? hhmm.replace(':', '\u00a0h\u00a0') : hhmm; }

  // ---------- Catalogue ----------
  var games = [];
  var byId = {};
  var catalogueOk = null;
  function loadCatalogue() {
    return fetch('jeux/index.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (index) {
        return Promise.all(index.games.map(function (file) {
          return fetch('jeux/' + file, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
        }));
      })
      .then(function (list) {
        games = list.filter(function (g) { return g && g.id && g.url; });
        byId = {}; games.forEach(function (g) { byId[g.id] = g; });
        catalogueOk = true;
      })
      .catch(function () { catalogueOk = false; });
  }
  // Icône d'un jeu ; si elle ne charge pas (hors ligne), l'initiale du jeu sur sa couleur.
  function gameIcon(g, attrs) {
    var a = { src: g.icon, alt: '', loading: 'lazy', decoding: 'async' };
    Object.keys(attrs || {}).forEach(function (k) { a[k] = attrs[k]; });
    var img = el('img', a);
    img.addEventListener('error', function () {
      var s = el('span', { class: 'initiale ' + (a['class'] || ''), 'aria-hidden': 'true', style: '--game:' + (g.color || '#1d2b4f'), text: (pick(g.title) || '?').charAt(0) });
      if (img.parentNode) img.parentNode.replaceChild(s, img);
    });
    return img;
  }
  // Une couleur vive par jeu pour les jauges du carnet (les couleurs des fiches sont souvent très sombres).
  var PAL = ['#f26b4f', '#3f8f5a', '#e0a400', '#4f8fd1', '#c98b4f', '#16204a'];
  function couleur(g) { return PAL[Math.max(0, games.indexOf(g)) % PAL.length]; }
  function choisis() { return games.filter(function (g) { return !!choix(g.id); }); }
  function pourAge(g, age) { return age >= g.age.min && age <= g.age.max; }

  // ---------- Vues ----------
  var vues = { accueil: document.getElementById('v-accueil'), enfant: document.getElementById('v-enfant'), parent: document.getElementById('v-parent') };
  var vue = null;
  function show(v) {
    if (v !== vue) document.getElementById('e-jeux').classList.remove('calme');
    vue = v;
    Object.keys(vues).forEach(function (k) { vues[k].hidden = k !== v; });
    document.body.setAttribute('data-vue', v);
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    document.documentElement.lang = lang;
    document.getElementById('player-back').textContent = t('back');
    if (vue === 'accueil') renderAccueil();
    else if (vue === 'enfant') renderEnfant();
    else if (vue === 'parent') renderParent();
  }

  // =====================================================================
  // Accueil : première ouverture, le parent prépare Ludiworld (5 étapes)
  // =====================================================================
  var acc = { step: 0, nom: '', age: 7, jeux: null, ecole: 30, libre: 60, fin: 'douce', pin1: null };

  function langSwitch() {
    return el('div', { class: 'langs', role: 'group', 'aria-label': 'Langue / Language' }, ['fr', 'en'].map(function (l) {
      return el('button', { type: 'button', lang: l, 'aria-pressed': String(lang === l), text: l.toUpperCase(), onclick: function () { setLang(l); } });
    }));
  }
  function chips(values, current, label, onPick, cls) {
    return el('div', { class: 'choix ' + (cls || ''), role: 'radiogroup' }, values.map(function (v) {
      var on = v === current;
      return el('button', {
        type: 'button', role: 'radio', 'aria-checked': String(on), class: on ? 'on' : '',
        onclick: function () { onPick(v); }
      }, [on ? icon('check') : null, label(v)]);
    }));
  }

  function renderAccueil() {
    var root = vues.accueil;
    root.textContent = '';
    var N = 5;
    function nav(canNext, onNext) {
      return el('div', { class: 'a-nav' }, [
        el('button', { type: 'button', class: 'btn-ghost', text: t('hello.prev'), onclick: function () { acc.step--; renderAccueil(); } }),
        el('button', { type: 'button', class: 'btn-sun', disabled: !canNext, onclick: onNext || function () { acc.step++; renderAccueil(); } }, [t('hello.next')])
      ]);
    }
    function frame(img, kids) {
      return el('div', { class: 'a-cadre' }, [
        el('div', { class: 'a-illu', 'aria-hidden': 'true' }, [el('img', { src: img, alt: '' })]),
        el('div', { class: 'a-contenu' }, [el('p', { class: 'a-etape', text: t('hello.step', { i: acc.step, n: N }) })].concat(kids))
      ]);
    }

    if (acc.step === 0) {
      root.appendChild(el('div', { class: 'a-bienvenue' }, [
        el('div', { class: 'a-ciel', 'aria-hidden': 'true' }, [
          el('img', { class: 'a-soleil', src: 'img/soleil.webp', alt: '' }),
          el('img', { class: 'a-nuage', src: 'img/nuage-2.webp', alt: '' }),
          el('img', { class: 'a-ile', src: 'img/ile-jour.webp', alt: '' }),
          el('img', { class: 'a-marmotte', src: 'img/marmotte-salut.webp', alt: '' })
        ]),
        el('div', { class: 'a-texte' }, [
          langSwitch(),
          el('p', { class: 'a-kicker', text: t('hello.kicker') }),
          el('h1', { class: 'wordmark', text: 'Ludiworld' }),
          el('p', { class: 'a-titre', text: t('hello.title') }),
          el('p', { class: 'a-lead', text: t('hello.text') }),
          el('button', { type: 'button', class: 'btn-sun big', onclick: function () { acc.step = 1; renderAccueil(); } }, [t('hello.start')]),
          el('p', { class: 'a-hint', text: t('hello.startHint') }),
          window.innerWidth < 600 ? el('div', { class: 'note a-tel' }, [icon('warn'), el('span', null, [
            t('hello.phone') + ' ',
            el('b', { text: location.href.split('#')[0] }),
            navigator.share ? el('button', { type: 'button', class: 'lien', text: t('hello.share'), onclick: function () { navigator.share({ title: 'Ludiworld', url: location.href.split('#')[0] }).catch(function () {}); } }) : null
          ])]) : null,
          el('p', null, [el('a', { href: 'decouvrir/', class: 'lien', text: t('hello.discover') })])
        ])
      ]));
      return;
    }

    if (acc.step === 1) {
      var input = el('input', { id: 'a-nom', type: 'text', maxlength: '24', autocomplete: 'off', placeholder: t('hello.kidNamePh'), value: acc.nom });
      var next = nav(acc.nom.trim().length > 0);
      input.addEventListener('input', function () { acc.nom = input.value; next.lastChild.disabled = !acc.nom.trim(); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && acc.nom.trim()) { acc.step++; renderAccueil(); } });
      root.appendChild(frame('img/marmotte-carnet.webp', [
        el('h2', { text: t('hello.kidTitle') }),
        el('p', { class: 'a-lead', text: t('hello.kidText') }),
        el('label', { for: 'a-nom', class: 'champ-label', text: t('hello.kidName') }),
        input,
        el('p', { class: 'champ-label', text: t('hello.kidAge') }),
        chips(AGES, acc.age, function (a) { return String(a); }, function (a) { acc.age = a; acc.jeux = null; renderAccueil(); }, 'ages'),
        next
      ]));
      setTimeout(function () { try { input.focus(); } catch (e) { /* rien */ } }, 50);
      return;
    }

    if (acc.step === 2) {
      if (!acc.jeux) { acc.jeux = {}; games.forEach(function (g) { if (pourAge(g, acc.age)) acc.jeux[g.id] = true; }); }
      var list = el('div', { class: 'a-jeux' }, games.map(function (g) {
        var on = !!acc.jeux[g.id];
        return el('button', {
          type: 'button', role: 'checkbox', 'aria-checked': String(on), class: 'a-jeu' + (on ? ' on' : ''),
          style: '--game:' + (g.color || ''),
          onclick: function () { acc.jeux[g.id] = !acc.jeux[g.id]; renderAccueil(); }
        }, [
          gameIcon(g),
          el('span', { class: 'a-jeu-txt' }, [
            el('b', { text: pick(g.title) }),
            el('span', { text: t('ages', { a: g.age.min, b: g.age.max }) + ' · ' + t('levelShort.' + g.learning.level) }),
            el('span', { class: 'a-jeu-pitch', text: pick(g.pitch) })
          ]),
          el('span', { class: 'coche' }, [icon(on ? 'check' : 'cross')])
        ]);
      }));
      root.appendChild(frame('img/marmotte-salut.webp', [
        el('h2', { text: t('hello.gamesTitle') }),
        el('p', { class: 'a-lead', text: t('hello.gamesText', { n: acc.age }) }),
        catalogueOk === false ? el('p', { class: 'erreur', text: t('loadError') }) : list,
        nav(Object.keys(acc.jeux).some(function (k) { return acc.jeux[k]; }))
      ]));
      return;
    }

    if (acc.step === 3) {
      var mins = function (m) { return t('min', { n: m }); };
      root.appendChild(frame('img/marmotte-baille.webp', [
        el('h2', { text: t('hello.timeTitle') }),
        el('p', { class: 'a-lead', text: t('hello.timeText') }),
        el('p', { class: 'champ-label', text: t('parent.school') }),
        chips([15, 20, 30, 45, 60], acc.ecole, mins, function (v) { acc.ecole = v; renderAccueil(); }),
        el('p', { class: 'champ-label', text: t('parent.free') }),
        chips([30, 45, 60, 90, 120], acc.libre, mins, function (v) { acc.libre = v; renderAccueil(); }),
        el('p', { class: 'champ-label', text: t('parent.endTitle') }),
        finCards(acc.fin, Temps.REGLES_DEFAUT.grace, function (v) { acc.fin = v; renderAccueil(); }),
        nav(true)
      ]));
      return;
    }

    if (acc.step === 4) {
      var msg = el('p', { class: 'a-lead', role: 'status', text: acc.pin1 ? t('hello.pinAgain') : t('hello.pinText') });
      root.appendChild(frame('img/marmotte-carnet.webp', [
        el('h2', { text: t('hello.pinTitle') }),
        msg,
        pinPad(function (code, reset) {
          if (!acc.pin1) { acc.pin1 = code; msg.textContent = t('hello.pinAgain'); reset(); return; }
          if (code !== acc.pin1) { acc.pin1 = null; msg.textContent = t('hello.pinMismatch'); reset(true); return; }
          var jeux = {};
          Object.keys(acc.jeux || {}).forEach(function (id) { if (acc.jeux[id]) jeux[id] = { max: null }; });
          store.famille = { v: 2, cree: Date.now(), maj: Date.now(), pin: hash(code), protege: true, enfants: [], actif: null };
          var e = nouvelEnfant(acc.nom.trim().slice(0, 24), acc.age, jeux,
            Temps.regles({ ecole: acc.ecole, libre: acc.libre, fin: acc.fin, joursLibres: lang === 'fr' ? [0, 3, 6] : [0, 6] }));
          e.games = store.games; store.games = {};
          store.famille.actif = e.id;
          e.maj = Date.now();
          saveStore();
          planifierSynchro();
          acc.step = 5; renderAccueil();
        }),
        el('div', { class: 'a-nav' }, [el('button', { type: 'button', class: 'btn-ghost', text: t('hello.prev'), onclick: function () { acc.pin1 = null; acc.step--; renderAccueil(); } })])
      ]));
      return;
    }

    var nom = fam() ? fam().enfant.nom : acc.nom;
    root.appendChild(el('div', { class: 'a-cadre a-fin' }, [
      el('div', { class: 'a-illu', 'aria-hidden': 'true' }, [el('img', { src: 'img/marmotte-salut.webp', alt: '' })]),
      el('div', { class: 'a-contenu' }, [
        el('h2', { text: t('hello.doneTitle') }),
        el('p', { class: 'a-lead', text: t('hello.doneText', { n: nom }) }),
        el('p', { class: 'note' }, [icon('lock'), t('hello.doneLock', { n: nom })]),
        el('button', { type: 'button', class: 'btn-sun big', onclick: function () { show('enfant'); } }, [t('hello.doneGo')])
      ])
    ]));
  }

  // Les deux façons de s'arrêter, illustrées (accueil et carnet).
  function finCards(current, grace, onPick) {
    return el('div', { class: 'fins', role: 'radiogroup' }, [
      ['douce', 'img/marmotte-baille.webp', t('parent.soft'), t('parent.softText', { g: grace })],
      ['nette', 'img/marmotte-dodo.webp', t('parent.hard'), t('parent.hardText')]
    ].map(function (o) {
      var on = current === o[0];
      return el('button', { type: 'button', role: 'radio', 'aria-checked': String(on), class: 'fin' + (on ? ' on' : ''), onclick: function () { onPick(o[0]); } }, [
        el('img', { src: o[1], alt: '' }),
        el('span', { class: 'fin-txt' }, [el('b', null, [on ? icon('check') : null, o[2]]), el('span', { text: o[3] })])
      ]);
    }));
  }

  // Pavé numérique pour le code parent. done(code, reset) ; reset(true) secoue le pavé.
  function pinPad(done) {
    var code = '';
    var dots = el('div', { class: 'pin-dots', 'aria-hidden': 'true' }, [0, 1, 2, 3].map(function () { return el('span'); }));
    var live = el('span', { class: 'sr', 'aria-live': 'polite' });
    var pad = el('div', { class: 'pin' }, [dots, live]);
    function paint() { Array.prototype.forEach.call(dots.children, function (d, i) { d.className = i < code.length ? 'on' : ''; }); live.textContent = code.length + '/4'; }
    function reset(shake) {
      code = ''; paint();
      if (shake) { pad.classList.remove('shake'); void pad.offsetWidth; pad.classList.add('shake'); }
    }
    function press(k) {
      if (k === 'del') { code = code.slice(0, -1); paint(); return; }
      if (code.length >= 4) return;
      code += k; paint();
      if (code.length === 4) { var c = code; setTimeout(function () { done(c, reset); }, 120); }
    }
    var keys = el('div', { class: 'pin-keys' });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].forEach(function (k) {
      if (!k) { keys.appendChild(el('span')); return; }
      keys.appendChild(el('button', { type: 'button', class: k === 'del' ? 'del' : '', 'aria-label': k === 'del' ? t('gate.erase') : k, text: k === 'del' ? '⌫' : k, onclick: function () { press(k); } }));
    });
    pad.appendChild(keys);
    pad.addEventListener('keydown', function (e) {
      if (/^[0-9]$/.test(e.key)) { press(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { press('del'); e.preventDefault(); }
    });
    paint();
    return pad;
  }

  // =====================================================================
  // Côté enfant : l'île, le soleil, les jeux choisis
  // =====================================================================
  var SKY = [ // part du jour qui reste → couleurs du ciel (haut, bas)
    [1.0, '#7cc6f2', '#dff3fc'],
    [0.5, '#8ccbec', '#f6efd6'],
    [0.22, '#f3a46c', '#ffdca3'],
    [0.0, '#d9626b', '#ffb07a']
  ];
  function mix(a, b, k) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = [16, 8, 0].map(function (s) { var x = (pa >> s) & 255, y = (pb >> s) & 255; return Math.round(x + (y - x) * k); });
    return '#' + ((1 << 24) + (r[0] << 16) + (r[1] << 8) + r[2]).toString(16).slice(1);
  }
  function skyAt(f) {
    for (var i = 0; i < SKY.length - 1; i++) {
      var a = SKY[i], b = SKY[i + 1];
      if (f <= a[0] && f >= b[0]) { var k = (a[0] - f) / (a[0] - b[0]); return [mix(a[1], b[1], k), mix(a[2], b[2], k)]; }
    }
    return [SKY[SKY.length - 1][1], SKY[SKY.length - 1][2]];
  }

  // Le ciel et le soleil suivent le temps qui reste.
  function partSoleil() {
    var root = vues.enfant;
    var nuit = resteDuJour().total <= 0;
    var part = partDuJour();
    var sky = skyAt(part);
    var p = 1 - part;
    root.style.setProperty('--ciel-haut', nuit ? '#0f1840' : sky[0]);
    root.style.setProperty('--ciel-bas', nuit ? '#2b3772' : sky[1]);
    root.style.setProperty('--p', p.toFixed(3));
    root.style.setProperty('--p2', (p * p).toFixed(3));
    root.setAttribute('data-moment', nuit ? 'nuit' : part < 0.22 ? 'soir' : 'jour');
    return { nuit: nuit, part: part };
  }

  function renderEnfant() {
    var f = fam();
    if (!f) { show('accueil'); return; }
    var ciel = partSoleil();
    var nuit = ciel.nuit, part = ciel.part;

    document.getElementById('e-salut').textContent = t('kid.hi', { n: f.enfant.nom });
    var qui = document.getElementById('e-qui');
    qui.hidden = foyer().enfants.length < 2;
    qui.lastChild.textContent = t('kid.notYou');
    document.querySelector('.e-parents-txt').textContent = t('kid.parents');
    document.querySelector('.e-parents-hint').textContent = '· ' + t('kid.holdHint');
    pillEnfant();
    document.getElementById('e-marmotte').src = nuit ? 'img/marmotte-dodo.webp' : part < 0.22 ? 'img/marmotte-baille.webp' : 'img/marmotte-salut.webp';

    var list = document.getElementById('e-jeux');
    if (list.childNodes.length) list.classList.add('calme'); // les tuiles ne retombent qu'à l'arrivée
    list.textContent = '';
    var dodo = document.getElementById('e-dodo');
    dodo.hidden = !nuit;
    list.hidden = nuit;
    if (nuit) { renderDodo(dodo, f); return; }
    var jouables = choisis().filter(function (g) { return resteJeu(g.id).jeu > 0; });
    if (choisis().length && !jouables.length) {
      // Il reste du temps, mais plus aucun jeu ouvert aujourd'hui : on le dit plutôt que d'afficher des tuiles éteintes.
      list.hidden = true; dodo.hidden = false;
      dodo.textContent = '';
      dodo.appendChild(el('h2', { text: t('kid.allDoneTitle') }));
      dodo.appendChild(el('p', { text: t('kid.allDoneText', { n: f.enfant.nom }) }));
      return;
    }
    if (catalogueOk === false) { list.appendChild(el('p', { class: 'e-vide', text: t('loadError') })); return; }
    var mine = choisis();
    if (!mine.length) { list.appendChild(el('p', { class: 'e-vide', text: t('kid.noGames') })); return; }
    mine.forEach(function (g, i) {
      var rj = resteJeu(g.id);
      var fini = rj.jeu <= 0;
      var c = choix(g.id);
      var tag = null;
      if (fini && c && c.libres && !Temps.jourLibre(regles())) tag = el('span', { class: 'tuile-tag fini' }, [icon('moon'), t('kid.freeDaysOnly')]);
      else if (fini) tag = el('span', { class: 'tuile-tag fini' }, [icon('moon'), t('kid.gameDone')]);
      else if (c && c.max) tag = el('span', { class: 'tuile-tag' }, [icon('hourglass'), t('kid.gameLeft', { t: minutesLeft(rj.jeu) })]);
      list.appendChild(el('button', {
        type: 'button', class: 'tuile' + (fini ? ' fini' : ''), style: '--game:' + (g.color || '#1d2b4f') + ';--i:' + i,
        disabled: fini, 'aria-label': pick(g.title) + (fini ? ', ' + t('kid.gameDone') : ''),
        onclick: function () { play(g); }
      }, [
        el('span', { class: 'tuile-img' }, [gameIcon(g)]),
        el('b', { class: 'tuile-nom', text: pick(g.title) }),
        tag
      ]));
    });
  }

  // La pastille « Encore 25 min » : mise à jour chaque seconde sans tout redessiner.
  var lastPill = '';
  function pillEnfant() {
    var r = regles(), rt = resteDuJour().total, hors = Temps.horsPlage(r), nuit = rt <= 0;
    var txt = hors === 'avant' ? t('kid.opensAt', { h: heure(r.heures.debut) }) : nuit ? t('kid.gameDone') : rt === Infinity ? t('kid.leftNoLimit') : t('kid.left', { t: minutesLeft(rt) });
    if (txt === lastPill) return;
    lastPill = txt;
    var tps = document.getElementById('e-temps');
    tps.textContent = '';
    tps.appendChild(icon(nuit ? 'moon' : 'sun'));
    tps.appendChild(document.createTextNode(txt));
  }

  function renderDodo(box, f) {
    box.textContent = '';
    var key = Temps.cleJour();
    var played = games.filter(function (g) { return dayMs(g.id) >= 30000; });
    var bits = played.map(function (g) {
      var sd = (S()[g.id] && S()[g.id].skillDays || {})[key];
      var line = pick(g.title) + ' · ' + duration(dayMs(g.id));
      return el('li', null, [gameIcon(g), el('span', { text: line }),
        sd && sd.ok ? el('span', { class: 'dodo-ok' }, [icon('check'), t('kid.sleepLearned', { k: sd.ok, d: (t('domains')[g.learning.domains[0]] || '').toLowerCase() })]) : null]);
    });
    var r = regles();
    if (codeEnAttente()) {
      box.appendChild(el('h2', { text: t('kid.waitTitle') }));
      box.appendChild(el('p', { text: t('kid.waitText') }));
      return;
    }
    if (Temps.horsPlage(r) === 'avant') {
      box.appendChild(el('h2', { text: t('kid.wakeTitle') }));
      box.appendChild(el('p', { text: t('kid.wakeText', { h: heure(r.heures.debut) }) }));
      return;
    }
    box.appendChild(el('h2', { text: t('kid.sleepTitle') }));
    box.appendChild(el('p', { text: bits.length ? t('kid.sleepText', { n: f.enfant.nom }) : t('kid.sleepTextNone') }));
    if (bits.length) { box.appendChild(el('p', { class: 'dodo-titre', text: t('kid.sleepToday') })); box.appendChild(el('ul', { class: 'dodo-liste' }, bits)); }
  }

  // Bouton « Parents » : appui long, puis code.
  (function () {
    var btn = document.getElementById('e-parents');
    var timer = null;
    function cancel() { if (timer) { clearTimeout(timer); timer = null; } btn.classList.remove('hold'); }
    btn.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      btn.classList.add('hold');
      timer = setTimeout(function () { cancel(); openGate(ouvrirCarnet); }, 1200);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      btn.addEventListener(ev, function () {
        if (timer) { btn.classList.add('hint'); setTimeout(function () { btn.classList.remove('hint'); }, 1600); }
        cancel();
      });
    });
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // Au clavier (pas d'appui long possible) : on ouvre directement le code.
    btn.addEventListener('click', function (e) { if (e.detail === 0) openGate(ouvrirCarnet); });
  })();
  // Le carnet est un onglet du site : le code donné, le parent peut lire les autres pages sans le redonner.
  function ouvrirCarnet() { LudiBarre.ouvrirParent(); show('parent'); }
  function fermerCarnet() { LudiBarre.fermerParent(); show('enfant'); }

  // « Qui joue ? » : les enfants du foyer, chacun avec son initiale sur sa couleur.
  var quiDlg = document.getElementById('qui');
  function ouvrirQui() {
    var h = foyer();
    quiDlg.textContent = '';
    quiDlg.appendChild(el('div', { class: 'qui-inner' }, [
      el('h2', { text: t('kid.whoPlays') }),
      el('div', { class: 'qui-liste' }, h.enfants.map(function (e, i) {
        return el('button', { type: 'button', class: 'qui-enfant' + (e.id === h.actif ? ' on' : ''), onclick: function () {
          h.actif = e.id; saveStore(); if (quiDlg.close) quiDlg.close(); else quiDlg.removeAttribute('open');
          document.getElementById('e-jeux').classList.remove('calme'); renderEnfant();
        } }, [el('span', { class: 'avatar', style: '--c:' + PAL[i % PAL.length], text: e.enfant.nom.charAt(0).toUpperCase() }), el('b', { text: e.enfant.nom })]);
      }))
    ]));
    if (!quiDlg.open) { if (quiDlg.showModal) quiDlg.showModal(); else quiDlg.setAttribute('open', ''); }
  }
  quiDlg.addEventListener('click', function (e) { if (e.target === quiDlg && quiDlg.close) quiDlg.close(); });
  document.getElementById('e-qui').addEventListener('click', function () {
    if (foyer().protege !== false) openGate(ouvrirQui); else ouvrirQui();
  });

  // =====================================================================
  // Portail parent : code à 4 chiffres (ou calcul d'adulte si oublié)
  // =====================================================================
  var gate = document.getElementById('gate');
  var gateFails = 0, gateLock = 0;
  function closeGate() { if (gate.open) { if (gate.close) gate.close(); else gate.removeAttribute('open'); } }
  function openGate(onOk, mode) {
    gate.textContent = '';
    var inner = el('div', { class: 'gate-inner' });
    var msg = el('p', { class: 'gate-msg', role: 'status' });
    inner.appendChild(el('button', { type: 'button', class: 'gate-close', 'aria-label': t('gate.cancel'), onclick: closeGate }, [icon('cross')]));
    if (mode === 'forgot') {
      inner.appendChild(el('h2', { text: t('gate.forgotTitle') }));
      inner.appendChild(el('p', { text: t('gate.forgotText') }));
      inner.appendChild(el('button', { type: 'button', class: 'btn-sun', text: t('gate.forgotGo'), onclick: function () {
        foyer().reset = Date.now(); foyer().maj = Date.now(); saveStore(); planifierSynchro(); closeGate(); render();
      } }));
      inner.appendChild(el('button', { type: 'button', class: 'lien', text: t('gate.cancel'), onclick: closeGate }));
    } else if (mode === 'wait') {
      var left = ATTENTE_CODE - (Date.now() - foyer().reset);
      inner.appendChild(el('img', { class: 'gate-img', src: 'img/marmotte-baille.webp', alt: '' }));
      inner.appendChild(el('h2', { text: t('gate.forgotTitle') }));
      inner.appendChild(el('p', { text: t('gate.waitText', { t: minutesLeft(left) }) }));
      inner.appendChild(msg);
      inner.appendChild(pinPad(function (code, reset) {
        if (hash(code) === foyer().pin) { foyer().reset = null; foyer().maj = Date.now(); saveStore(); planifierSynchro(); closeGate(); onOk(); return; }
        msg.textContent = t('gate.wrong'); reset(true);
      }));
    } else if (mode === 'set') {
      var first = null;
      inner.appendChild(el('h2', { text: t('gate.forgotTitle') }));
      msg.textContent = t('hello.pinText');
      inner.appendChild(msg);
      inner.appendChild(pinPad(function (code, reset) {
        if (!first) { first = code; msg.textContent = t('hello.pinAgain'); reset(); return; }
        if (code !== first) { first = null; msg.textContent = t('hello.pinMismatch'); reset(true); return; }
        var f = foyer();
        if (f.reset) { f.reset = null; f.codeChange = Date.now(); }
        f.pin = hash(code); f.maj = Date.now(); saveStore(); planifierSynchro(); closeGate(); onOk();
      }));
    } else {
      if (codePret()) { openGate(onOk, 'set'); return; }
      if (codeEnAttente()) { openGate(onOk, 'wait'); return; }
      inner.appendChild(el('img', { class: 'gate-img', src: 'img/marmotte-carnet.webp', alt: '' }));
      inner.appendChild(el('h2', { text: t('gate.title') }));
      inner.appendChild(msg);
      var padEl = pinPad(function (code, reset) {
        if (Date.now() < gateLock) { reset(true); return; }
        if (hash(code) === foyer().pin) { gateFails = 0; closeGate(); onOk(); return; }
        gateFails++;
        reset(true);
        if (gateFails >= 3) {
          gateFails = 0; gateLock = Date.now() + 30000;
          padEl.classList.add('bloque');
          var tick = setInterval(function () {
            var s = Math.ceil((gateLock - Date.now()) / 1000);
            if (s <= 0 || !gate.open) { clearInterval(tick); padEl.classList.remove('bloque'); msg.textContent = ''; return; }
            msg.textContent = t('gate.locked', { s: s });
          }, 250);
        } else msg.textContent = t('gate.wrong');
      });
      inner.appendChild(padEl);
      inner.appendChild(el('button', { type: 'button', class: 'lien', text: t('gate.forgot'), onclick: function () { openGate(onOk, 'forgot'); } }));
    }
    gate.appendChild(inner);
    if (!gate.open) { if (gate.showModal) gate.showModal(); else gate.setAttribute('open', ''); }
    var pad = gate.querySelector('.pin');
    if (pad) { pad.setAttribute('tabindex', '-1'); setTimeout(function () { pad.focus(); }, 30); }
  }
  gate.addEventListener('cancel', function (e) { e.preventDefault(); closeGate(); });
  gate.addEventListener('click', function (e) { if (e.target === gate) closeGate(); });

  // =====================================================================
  // Le carnet parent
  // =====================================================================
  var tab = 'today';
  var filtres = { q: '', age: true, core: false, noRead: false, chosen: false, domains: [] };
  var toastTimer = null;
  function toast(msg) {
    var n = document.getElementById('toast');
    n.textContent = msg; n.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { n.hidden = true; }, 1800);
  }
  function saveFam(msg) { marquer(); saveStore(); planifierSynchro(); if (msg !== false) toast(msg || t('parent.saved')); }
  // Le dernier réglage fait foi d'un appareil à l'autre : on note quand il a changé.
  function marquer() { var h = foyer(), f = fam(); if (h) h.maj = Date.now(); if (f) f.maj = Date.now(); }

  // ---------- Synchro (seulement si le parent l'a activée dans son compte) ----------
  // Jamais pendant une partie. Dans le carnet, on envoie sans remplacer ce que le parent a sous les yeux :
  // l'autre appareil et le prochain retour ici refusionneront de toute façon.
  var Nuage = window.LudiNuage;
  var minuteurSynchro = null;
  function synchroVoulue() { return !!(Nuage && Nuage.actif() && Nuage.connecte() && Nuage.synchroLocale()); }
  function synchroniser() {
    if (!synchroVoulue() || playing || !foyer()) return;
    return Nuage.synchroniser(foyer()).then(function (m) {
      if (!m || playing || vue === 'parent') return;
      store.famille = LudiSynchro.fusionner(store.famille, m);
      saveStore();
      if (vue === 'enfant') render();
    }).catch(function () { /* hors ligne : on réessaiera, l'appareil garde tout */ });
  }
  function planifierSynchro() {
    if (!synchroVoulue()) return;
    clearTimeout(minuteurSynchro);
    minuteurSynchro = setTimeout(synchroniser, 1500);
  }

  function renderParent() {
    var f = fam();
    if (!f) { show('accueil'); return; }
    document.getElementById('c-titre').textContent = t('parent.title');
    document.getElementById('c-de').textContent = t('parent.of', { n: f.enfant.nom });
    document.getElementById('c-exit').lastChild.textContent = t('parent.exit');
    LudiBarre.rendre(document.getElementById('c-barre'), { base: '', actif: 'moi', lang: lang, onLang: setLang, action: false });
    var nav = document.getElementById('c-nav');
    nav.textContent = '';
    ['today', 'games', 'time', 'settings'].forEach(function (k) {
      nav.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === k), class: tab === k ? 'on' : '', text: t('parent.tabs.' + k), onclick: function () { tab = k; renderParent(); document.getElementById('c-page').scrollTop = 0; } }));
    });
    var page = document.getElementById('c-page');
    page.textContent = '';
    var h = foyer();
    if (h.enfants.length > 1) {
      page.appendChild(el('div', { class: 'c-enfants', role: 'group', 'aria-label': t('parent.kids') }, h.enfants.map(function (e, i) {
        var on = e.id === f.id;
        return el('button', { type: 'button', 'aria-pressed': String(on), class: on ? 'on' : '', onclick: function () { h.actif = e.id; saveStore(); renderParent(); } }, [
          el('span', { class: 'avatar', style: '--c:' + PAL[i % PAL.length], text: e.enfant.nom.charAt(0).toUpperCase() }), e.enfant.nom
        ]);
      })));
    }
    if (tab === 'today') page.appendChild(pageToday(f));
    else if (tab === 'games') page.appendChild(pageGames(f));
    else if (tab === 'time') page.appendChild(pageTime(f));
    else page.appendChild(pageSettings(f));
  }
  document.getElementById('c-exit').addEventListener('click', fermerCarnet);

  function section(title, kids, cls) { return el('section', { class: 'c-sec ' + (cls || '') }, [title ? el('h3', { text: title }) : null].concat(kids)); }

  function pageToday(f) {
    var r = regles();
    var tot = Temps.minutesDuJour(r);
    var today = dayMs();
    var libre = Temps.jourLibre(r);
    var out = el('div', { class: 'c-today' });
    var h = foyer();
    if (h.codeChange && Date.now() - h.codeChange < 7 * 24 * 3600 * 1000) {
      out.appendChild(el('p', { class: 'alerte' }, [icon('warn'), t('parent.codeChanged', { d: new Date(h.codeChange).toLocaleString(lang, { weekday: 'long', hour: '2-digit', minute: '2-digit' }) })]));
    }
    out.appendChild(el('h2', { class: 'c-h', text: today >= 30000 ? t('parent.todayTitle', { n: f.enfant.nom, t: duration(today) }) : t('parent.todayNone', { n: f.enfant.nom }) }));

    // La jauge du jour : une bande de papier découpée par jeu.
    var jauge = el('div', { class: 'jauge', role: 'img' });
    var totalMs = tot === null ? Math.max(today, 1) : Math.max(tot * MIN, today, 1);
    games.forEach(function (g) {
      var ms = dayMs(g.id);
      if (ms < 1000) return;
      jauge.appendChild(el('span', { class: 'jauge-part', style: 'width:' + (ms / totalMs * 100).toFixed(2) + '%;--c:' + couleur(g), title: pick(g.title) + ' · ' + duration(ms) }));
    });
    var label = tot === null ? t('parent.todayNoLimit') : today >= tot * MIN ? t('parent.todayOver') : t('parent.todayLeft', { t: duration(tot * MIN - today) });
    jauge.setAttribute('aria-label', label);
    var bonus = r.bonus && r.bonus.jour === Temps.cleJour() ? r.bonus.min : 0;
    var finiAuj = r.fini === Temps.cleJour();
    out.appendChild(el('div', { class: 'c-jour' }, [
      el('p', { class: 'c-jour-meta' }, [
        el('span', { class: 'pastille ' + (libre ? 'libre' : 'ecole'), text: libre ? t('parent.freeDay') : t('parent.schoolDay') }),
        tot !== null ? el('span', { text: t('parent.todayOf', { t: duration(today), m: duration(tot * MIN) }) }) : null
      ]),
      jauge,
      el('p', { class: 'c-jour-reste' }, [icon(tot !== null && today >= tot * MIN ? 'moon' : 'sun'), label]),
      bonus || finiAuj ? el('p', { class: 'c-note', text: finiAuj ? t('parent.todayOver') : t('parent.bonusOn', { s: (bonus > 0 ? '+' : '') + bonus }) }) : null,
      r.heures ? el('p', { class: 'c-note' }, [icon('moon'), t('parent.todayHours', { a: heure(r.heures.debut), b: heure(r.heures.fin) })]) : null,
      el('div', { class: 'c-actions' }, [
        el('button', { type: 'button', class: 'btn-ink', onclick: function () {
          var k = Temps.cleJour(); var rr = f.regles;
          if (rr.fini === k) rr.fini = null;
          Object.keys(f.jeux).forEach(function (id) { if (f.jeux[id].fini === k) f.jeux[id].fini = null; });
          rr.bonus = { jour: k, min: (rr.bonus && rr.bonus.jour === k ? rr.bonus.min : 0) + 10 };
          saveFam(); renderParent();
        } }, [icon('plus'), t('parent.plus10')]),
        el('button', { type: 'button', class: 'btn-ghost', onclick: function () { f.regles.fini = Temps.cleJour(); saveFam(); renderParent(); } }, [icon('moon'), t('parent.stopToday')]),
        bonus || finiAuj ? el('button', { type: 'button', class: 'lien', text: t('parent.resetToday'), onclick: function () { f.regles.bonus = null; f.regles.fini = null; saveFam(); renderParent(); } }) : null
      ])
    ]));

    // Par jeu
    var rows = choisis().map(function (g) {
      var c = choix(g.id);
      return el('li', { style: '--c:' + couleur(g) }, [
        gameIcon(g),
        el('span', { class: 'pj-nom', text: pick(g.title) }),
        el('span', { class: 'pj-val' + (dayMs(g.id) < 30000 ? ' rien' : ''), text: (dayMs(g.id) < 30000 ? t('parent.notPlayed') : duration(dayMs(g.id))) + (c.max ? ' / ' + t('min', { n: c.max }) : '') }),
        el('span', { class: 'pj-sem', text: weekMs(g.id) >= 30000 ? t('parent.weekTotal', { t: duration(weekMs(g.id)) }) : '' })
      ]);
    });
    out.appendChild(section(t('parent.perGame'), [el('ul', { class: 'par-jeu' }, rows)]));

    // Les 7 derniers jours
    var days = lastDays(7).reverse();
    var dates = []; var d0 = new Date(); for (var i = 6; i >= 0; i--) { var d = new Date(d0); d.setDate(d0.getDate() - i); dates.push(d); }
    var base = Temps.regles(Object.assign({}, r, { bonus: null, fini: null }));
    var limites = dates.map(function (d) { return Temps.minutesDuJour(base, d); });
    var maxDay = Math.max.apply(null, days.map(function (k) { return dayMs(null, k); }).concat(limites.map(function (m) { return (m || 0) * MIN; }), [MIN]));
    var bars = el('div', { class: 'semaine' }, days.map(function (k, j) {
      var ms = dayMs(null, k);
      var lim = limites[j];
      return el('div', { class: 'jour' + (j === 6 ? ' auj' : '') + (lim !== null && ms > lim * MIN ? ' depasse' : '') }, [
        el('span', { class: 'barre-zone' }, [
          lim !== null ? el('span', { class: 'limite', style: 'bottom:' + (lim * MIN / (maxDay * 1.2) * 100).toFixed(1) + '%' }) : null,
          el('span', { class: 'barre', style: 'height:' + (ms / (maxDay * 1.2) * 100).toFixed(1) + '%' })
        ]),
        el('span', { class: 'jour-val', text: ms >= 30000 ? Math.round(ms / MIN) + '' : '·' }),
        el('span', { class: 'jour-nom', text: t('days')[dates[j].getDay()] })
      ]);
    }));
    out.appendChild(section(t('parent.week'), [bars, el('p', { class: 'c-note legende' }, [el('span', { class: 'leg-limite', 'aria-hidden': 'true' }), t('parent.weekLegend'), ' · ', t('parent.weekTotal', { t: duration(weekMs()) })])]));

    // Ce qu'il travaille (notions remontées par le kit)
    var skillBits = [];
    games.forEach(function (g) {
      var st = S()[g.id];
      if (!st || !st.skills || !Object.keys(st.skills).length) return;
      var byDomain = {};
      Object.keys(st.skills).forEach(function (k) {
        var dom = k.split('/')[0], item = k.slice(dom.length + 1);
        (byDomain[dom] = byDomain[dom] || []).push({ item: item, s: st.skills[k] });
      });
      Object.keys(byDomain).forEach(function (dom) {
        var items = byDomain[dom];
        var ok = 0, n = 0;
        items.forEach(function (x) { ok += x.s.ok; n += x.s.ok + x.s.ko; });
        var known = items.filter(function (x) { return x.s.streak >= 3; }).map(function (x) { return x.item; });
        var review = items.filter(function (x) { return x.s.streak < 0; }).map(function (x) { return x.item; });
        skillBits.push(el('div', { class: 'notion' }, [
          el('p', { class: 'notion-titre' }, [el('b', { text: t('domains')[dom] || dom }), el('span', { text: ' · ' + pick(g.title) })]),
          el('p', { class: 'notion-val', text: t('parent.skillLine', { n: n, p: n ? Math.round(ok / n * 100) : 0 }) }),
          known.length ? el('div', { class: 'notion-items' }, [el('span', { class: 'ni-label' }, [icon('check'), t('parent.known')]), el('ul', { class: 'items ok' }, known.slice(0, 30).map(function (x) { return el('li', { text: x.replace('x', '×') }); }))]) : null,
          review.length ? el('div', { class: 'notion-items' }, [el('span', { class: 'ni-label' }, [icon('warn'), t('parent.review')]), el('ul', { class: 'items ko' }, review.slice(0, 30).map(function (x) { return el('li', { text: x.replace('x', '×') }); }))]) : null
        ]));
      });
    });
    out.appendChild(section(t('parent.skills'), skillBits.length ? skillBits : [el('p', { class: 'c-note', text: t('parent.skillsNone') })]));

    // Records
    var recs = [];
    games.forEach(function (g) {
      var st = S()[g.id];
      if (!st || !st.scores) return;
      Object.keys(st.scores).forEach(function (k) { recs.push(el('li', null, [el('span', { text: pick(g.title) + ' · ' + k.replace(/-/g, ' ') }), el('b', { text: Number(st.scores[k].value).toLocaleString(lang) })])); });
    });
    out.appendChild(section(t('parent.records'), [recs.length ? el('ul', { class: 'records' }, recs) : el('p', { class: 'c-note', text: t('parent.noRecords') })]));
    return out;
  }

  function pageGames(f) {
    var out = el('div', { class: 'c-games' });
    out.appendChild(el('h2', { class: 'c-h', text: t('parent.gamesTitle', { n: f.enfant.nom }) }));
    out.appendChild(el('p', { class: 'c-lead', text: t('parent.gamesText', { n: f.enfant.nom }) }));
    var q = el('input', { type: 'search', class: 'recherche', placeholder: t('parent.search'), value: filtres.q, 'aria-label': t('parent.search') });
    var results = el('div', { class: 'resultats', 'aria-live': 'polite' });
    function toggle(key, label) {
      return el('button', { type: 'button', class: 'filtre' + (filtres[key] ? ' on' : ''), 'aria-pressed': String(filtres[key]), onclick: function () { filtres[key] = !filtres[key]; renderParent(); } }, [filtres[key] ? icon('check') : null, label]);
    }
    var allDomains = [];
    games.forEach(function (g) { g.learning.domains.forEach(function (d) { if (allDomains.indexOf(d) === -1) allDomains.push(d); }); });
    out.appendChild(el('div', { class: 'recherche-zone' }, [icon('search'), q]));
    out.appendChild(el('div', { class: 'filtres' }, [
      toggle('age', t('parent.fAge', { n: f.enfant.age })), toggle('core', t('parent.fCore')), toggle('noRead', t('parent.fNoRead')), toggle('chosen', t('parent.fChosen'))
    ]));
    out.appendChild(el('div', { class: 'filtres domaines' }, allDomains.map(function (d) {
      var on = filtres.domains.indexOf(d) !== -1;
      return el('button', { type: 'button', class: 'filtre dom' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick: function () {
        if (on) filtres.domains = filtres.domains.filter(function (x) { return x !== d; }); else filtres.domains.push(d);
        renderParent();
      } }, [on ? icon('check') : null, t('domains')[d] || d]);
    })));
    out.appendChild(results);

    function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function paint() {
      var words = norm(filtres.q).split(/\s+/).filter(Boolean);
      var list = games.filter(function (g) {
        if (filtres.age && !pourAge(g, f.enfant.age)) return false;
        if (filtres.core && g.learning.level !== 'core') return false;
        if (filtres.noRead && g.reading !== 'none') return false;
        if (filtres.chosen && !choix(g.id)) return false;
        if (filtres.domains.length && !g.learning.domains.some(function (d) { return filtres.domains.indexOf(d) !== -1; })) return false;
        if (words.length) {
          var hay = norm([pick(g.title), pick(g.pitch), pick(g.learning.what), g.author.name].concat(g.learning.domains.map(function (d) { return t('domains')[d] || d; })).join(' '));
          if (!words.every(function (w) { return hay.indexOf(w) !== -1; })) return false;
        }
        return true;
      });
      results.textContent = '';
      results.appendChild(el('p', { class: 'compte', text: t('parent.count', { n: list.length }) }));
      if (!list.length) { results.appendChild(el('p', { class: 'c-note', text: t('parent.none') })); return; }
      list.forEach(function (g) { results.appendChild(gameRow(f, g)); });
    }
    q.addEventListener('input', function () { filtres.q = q.value; paint(); });
    paint();
    return out;
  }

  function gameRow(f, g) {
    var c = choix(g.id);
    var on = !!c;
    var ageOk = pourAge(g, f.enfant.age);
    var sw = el('button', { type: 'button', role: 'switch', 'aria-checked': String(on), class: 'interrupteur' + (on ? ' on' : ''), onclick: function () {
      if (on) delete f.jeux[g.id]; else f.jeux[g.id] = { max: null };
      saveFam(); renderParent();
    } }, [el('span', { class: 'int-rail' }, [el('span', { class: 'int-bouton' }, [icon(on ? 'check' : 'cross')])]), el('span', { class: 'int-txt', text: on ? t('parent.chosen') : t('parent.notChosen') })]);
    var limit = null;
    if (on) {
      var sel = el('select', { 'aria-label': t('parent.perDay') + ' · ' + pick(g.title) }, LIMITES_JEU.map(function (m) {
        return el('option', { value: m === null ? '' : String(m), selected: c.max === m, text: m === null ? t('noLimit') : t('min', { n: m }) });
      }));
      sel.addEventListener('change', function () { c.max = sel.value ? Number(sel.value) : null; saveFam(); });
      limit = el('div', { class: 'limite-jeu' }, [
        el('label', { class: 'lj-par-jour' }, [icon('hourglass'), el('span', { text: t('parent.perDay') }), sel]),
        el('label', { class: 'step-libre' }, [
          el('input', { type: 'checkbox', checked: !!c.libres, onchange: function (e) { c.libres = e.target.checked; saveFam(); } }),
          el('span', { text: t('parent.freeOnly') })
        ])
      ]);
    }
    return el('article', { class: 'fiche-jeu' + (on ? ' on' : ''), style: '--game:' + (g.color || '#1d2b4f') }, [
      gameIcon(g, { class: 'fj-img' }),
      el('div', { class: 'fj-corps' }, [
        el('h4', { text: pick(g.title) }),
        el('p', { class: 'fj-meta', text: t('ages', { a: g.age.min, b: g.age.max }) + ' · ' + t('parent.session', { a: g.session.minutes[0], b: g.session.minutes[1] }) + ' · ' + t('read.' + g.reading) }),
        !ageOk ? el('p', { class: 'fj-alerte' }, [icon('warn'), t('parent.notForAge', { a: g.age.min, b: g.age.max })]) : null,
        el('p', { class: 'fj-pitch', text: pick(g.pitch) }),
        el('ul', { class: 'fj-tags' }, [el('li', { class: 'niveau ' + g.learning.level, text: t('levelShort.' + g.learning.level) })].concat(g.learning.domains.map(function (d) { return el('li', { text: t('domains')[d] || d }); }))),
        el('button', { type: 'button', class: 'lien', text: t('parent.sheet'), onclick: function () { openSheet(g); } })
      ]),
      el('div', { class: 'fj-reglage' }, [sw, limit])
    ]);
  }

  function stepper(value, step, minV, maxV, onChange) {
    var noLimit = value === null;
    var val = el('output', { class: 'step-val', text: noLimit ? '∞' : t('min', { n: value }) });
    function set(v) { onChange(v); }
    return el('div', { class: 'stepper' + (noLimit ? ' off' : '') }, [
      el('button', { type: 'button', 'aria-label': '−', disabled: noLimit || value <= minV, onclick: function () { set(clamp(value - step, minV, maxV)); } }, [icon('minus')]),
      val,
      el('button', { type: 'button', 'aria-label': '+', disabled: noLimit || value >= maxV, onclick: function () { set(clamp(value + step, minV, maxV)); } }, [icon('plus')]),
      el('label', { class: 'step-libre' }, [
        el('input', { type: 'checkbox', checked: noLimit, onchange: function (e) { set(e.target.checked ? null : 30); } }),
        el('span', { text: t('noLimit') })
      ])
    ]);
  }

  function pageTime(f) {
    var r = f.regles;
    var out = el('div', { class: 'c-time' });
    out.appendChild(el('h2', { class: 'c-h', text: t('parent.timeTitle') }));
    out.appendChild(el('p', { class: 'c-lead', text: t('parent.timeText') }));
    out.appendChild(el('div', { class: 'deux' }, [
      section(t('parent.school'), [stepper(r.ecole, 5, 5, 180, function (v) { r.ecole = v; saveFam(); renderParent(); })], 'carte-temps ecole'),
      section(t('parent.free'), [stepper(r.libre, 5, 5, 240, function (v) { r.libre = v; saveFam(); renderParent(); })], 'carte-temps libre')
    ]));
    var vac = el('input', { type: 'date', value: r.vacances || '', min: Temps.iso(new Date()), 'aria-label': t('parent.holidaysUntil') });
    vac.addEventListener('change', function () { r.vacances = vac.value || null; saveFam(); renderParent(); });
    var enVacances = r.vacances && r.vacances >= Temps.iso(new Date());
    var jl = r.joursLibres || [];
    out.appendChild(section(t('parent.holidays'), [
      el('div', { class: 'plage' }, [el('span', { class: 'plage-champs' }, [el('span', { text: t('parent.holidaysUntil') }), vac]),
        r.vacances ? el('button', { type: 'button', class: 'lien', text: t('parent.holidaysEnd'), onclick: function () { r.vacances = null; saveFam(); renderParent(); } }) : null]),
      el('p', { class: 'c-note' }, [icon('sun'), enVacances ? t('parent.holidaysOn') : t('parent.holidaysText')])
    ]));
    out.appendChild(section(t('parent.freeDays'), [el('div', { class: 'jours' }, [1, 2, 3, 4, 5, 6, 0].map(function (d) {
      var on = jl.indexOf(d) !== -1;
      return el('button', { type: 'button', 'aria-pressed': String(on), class: on ? 'on' : '', 'aria-label': t('daysLong')[d], onclick: function () {
        r.joursLibres = on ? jl.filter(function (x) { return x !== d; }) : jl.concat([d]);
        saveFam(); renderParent();
      } }, [t('days')[d]]);
    }))]));
    var plage = r.heures;
    var debut = el('input', { type: 'time', value: plage ? plage.debut : '08:00', 'aria-label': t('parent.hoursFrom'), disabled: !plage });
    var fin = el('input', { type: 'time', value: plage ? plage.fin : '19:30', 'aria-label': t('parent.hoursTo'), disabled: !plage });
    function majPlage() { if (debut.value && fin.value && debut.value < fin.value) { r.heures = { debut: debut.value, fin: fin.value }; saveFam(); } }
    debut.addEventListener('change', majPlage); fin.addEventListener('change', majPlage);
    out.appendChild(section(t('parent.hours'), [
      el('div', { class: 'plage' + (plage ? '' : ' off') }, [
        el('label', { class: 'step-libre' }, [
          el('input', { type: 'checkbox', checked: !plage, onchange: function (e) { r.heures = e.target.checked ? null : { debut: '08:00', fin: '19:30' }; saveFam(); renderParent(); } }),
          el('span', { text: t('parent.hoursAny') })
        ]),
        el('span', { class: 'plage-champs' }, [el('span', { text: t('parent.hoursFrom') }), debut, el('span', { text: t('parent.hoursTo') }), fin])
      ]),
      el('p', { class: 'c-note' }, [icon('moon'), t('parent.hoursText')])
    ]));
    out.appendChild(section(t('parent.endTitle'), [
      finCards(r.fin, r.grace, function (v) { r.fin = v; saveFam(); renderParent(); }),
      r.fin === 'douce' ? el('div', { class: 'grace' }, [el('span', { text: t('parent.grace') }), chips([5, 10, 15], r.grace, function (m) { return '+' + t('min', { n: m }); }, function (v) { r.grace = v; saveFam(); renderParent(); })]) : null,
      el('p', { class: 'c-note' }, [icon('sun'), t('parent.warn')])
    ]));
    return out;
  }

  var installEvt = null;
  function pageSettings(f) {
    var out = el('div', { class: 'c-settings' });
    out.appendChild(el('h2', { class: 'c-h', text: t('parent.settingsTitle') }));
    var nom = el('input', { type: 'text', maxlength: '24', value: f.enfant.nom, id: 's-nom' });
    nom.addEventListener('change', function () { var v = nom.value.trim(); if (v) { f.enfant.nom = v.slice(0, 24); saveFam(); renderParent(); } });
    out.appendChild(section(t('parent.kid'), [
      el('label', { for: 's-nom', class: 'champ-label', text: t('parent.kidName') }), nom,
      el('p', { class: 'c-note', text: t('hello.kidText') }),
      el('p', { class: 'champ-label', text: t('parent.kidAge') }),
      chips(AGES, f.enfant.age, function (a) { return String(a); }, function (a) { f.enfant.age = a; saveFam(); renderParent(); }, 'ages')
    ]));
    var h = foyer();
    out.appendChild(section(t('parent.kids'), [
      el('p', { class: 'c-note', text: t('parent.kidsText') }),
      el('div', { class: 'c-actions' }, [
        el('button', { type: 'button', class: 'btn-ink', onclick: function () {
          var jeux = {};
          games.forEach(function (g) { if (pourAge(g, 7)) jeux[g.id] = { max: null }; });
          var e = nouvelEnfant(t('parent.newKid', { n: h.enfants.length + 1 }), 7, jeux, JSON.parse(JSON.stringify(Temps.regles(Object.assign({}, f.regles, { bonus: null, fini: null })))));
          h.actif = e.id; saveFam(); tab = 'settings'; renderParent();
          var inp = document.getElementById('s-nom'); if (inp) { inp.focus(); inp.select(); }
        } }, [icon('plus'), t('parent.addKid')]),
        h.enfants.length > 1 ? el('button', { type: 'button', class: 'btn-ghost', onclick: function () {
          if (!window.confirm(t('parent.removeKidConfirm', { n: f.enfant.nom }))) return;
          (h.retires || (h.retires = {}))[f.id] = Date.now();
          h.enfants = h.enfants.filter(function (e) { return e.id !== f.id; });
          h.actif = h.enfants[0].id; saveFam(); renderParent();
        } }, [icon('cross'), t('parent.removeKid', { n: f.enfant.nom })]) : null
      ]),
      h.enfants.length > 1 ? el('label', { class: 'step-libre' }, [
        el('input', { type: 'checkbox', checked: h.protege !== false, onchange: function (e) { h.protege = e.target.checked; saveFam(); } }),
        el('span', { text: t('parent.protect') })
      ]) : null
    ]));
    out.appendChild(section(t('parent.lock'), [
      el('p', { text: t('parent.lockText') }),
      el('ul', { class: 'etapes' }, [el('li', { text: t('parent.lockAndroid') }), el('li', { text: t('parent.lockIos') })]),
      installEvt ? el('button', { type: 'button', class: 'btn-ink', text: t('parent.install'), onclick: function () {
        installEvt.prompt(); installEvt.userChoice.finally(function () { installEvt = null; renderParent(); });
      } }) : null
    ], 'encadre'));
    out.appendChild(section(t('parent.fullscreen'), [
      el('label', { class: 'step-libre' }, [
        el('input', { type: 'checkbox', checked: pleinEcranVoulu(), onchange: function (e) {
          foyer().pleinEcran = e.target.checked; saveFam();
          if (!e.target.checked && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
        } }),
        el('span', { text: t('parent.fullscreenOn') })
      ]),
      el('p', { class: 'c-note', text: t('parent.fullscreenText') })
    ]));
    out.appendChild(section(t('parent.pin'), [el('button', { type: 'button', class: 'btn-ghost', text: t('parent.pinChange'), onclick: function () {
      openGate(function () { toast(t('parent.pinChanged')); }, 'set');
    } })]));
    out.appendChild(section(t('parent.lang'), [langSwitch()]));
    if (Nuage && Nuage.actif()) out.appendChild(section(t('parent.account'), [
      el('p', { text: Nuage.connecte() ? t('parent.accountOn', { e: Nuage.email() || '' }) : t('parent.accountOff') }),
      el('a', { class: 'lien', href: 'compte/' + (Nuage.connecte() ? '#espace' : '#creer'), text: Nuage.connecte() ? t('parent.accountOpen') : t('parent.accountCreate') })
    ]));
    out.appendChild(section(t('parent.data'), [
      el('p', { text: synchroVoulue() ? t('parent.dataTextSync') : t('parent.dataText') }),
      el('button', { type: 'button', class: 'btn-danger', onclick: function () {
        if (!window.confirm(t('parent.eraseConfirm'))) return;
        try { localStorage.removeItem(STORE); localStorage.removeItem('ludiworld.envie'); } catch (e) { /* rien */ }
        if (Nuage) Nuage.oublier(); // une tablette vidée ne reste liée à personne : elle peut changer de famille
        store = { games: {} }; acc = { step: 0, nom: '', age: 7, jeux: null, ecole: 30, libre: 60, fin: 'douce', pin1: null };
        show('accueil');
      } }, [icon('warn'), t('parent.erase')])
    ]));
    return out;
  }

  // =====================================================================
  // Fiche d'un jeu (côté parent)
  // =====================================================================
  var sheet = document.getElementById('sheet');
  var current = null;
  function fact(label, value) { return el('div', null, [el('dt', { text: label }), el('dd', { text: value })]); }
  function openSheet(g, fromHistory) {
    current = g;
    var stats = S()[g.id];
    var learnBits = [el('p', { class: 'level ' + g.learning.level, text: t('level.' + g.learning.level) })];
    if (g.learning.domains.length) learnBits.push(el('ul', { class: 'chips' }, g.learning.domains.map(function (d) { return el('li', { text: t('domains')[d] || d }); })));
    if (g.learning.what) learnBits.push(el('p', { text: pick(g.learning.what) }));
    if (g.learning.how) learnBits.push(el('p', null, [el('strong', { text: t('sheet.learnHow') + ' : ' }), pick(g.learning.how)]));
    var promises = Object.keys(T[lang].healthy).filter(function (k) { return g.healthy && g.healthy[k] === true; });
    var ours = [];
    if (!stats || !stats.ms) ours.push(el('p', { text: t('sheet.oursNone') }));
    else {
      ours.push(el('p', { text: t('sheet.oursWeek', { t: duration(weekMs(g.id)) }) }));
      ours.push(el('p', { text: t('sheet.oursTotal', { t: duration(stats.ms), n: stats.sessions }) }));
    }
    var inner = el('div', { class: 'sheet-inner', style: '--game:' + (g.color || '') }, [
      el('button', { type: 'button', class: 'sheet-close', 'aria-label': t('close'), onclick: function () { closeSheet(); } }, [icon('cross')]),
      el('div', { class: 'sheet-head' }, [
        gameIcon(g),
        el('div', null, [el('h2', { id: 'sheet-title', text: pick(g.title) }), el('p', { text: t('sheet.by', { n: g.author.name }) })])
      ]),
      el('p', { class: 'pitch', text: pick(g.pitch) }),
      el('button', { type: 'button', class: 'btn-sun play', onclick: function () { play(g, { essai: true }); } }, [icon('play'), t('sheet.try')]),
      g.embed === false ? el('p', { class: 'newtab', text: t('sheet.newTab') }) : null,
      el('dl', { class: 'facts' }, [
        fact(t('sheet.age'), t('ages', { a: g.age.min, b: g.age.max })),
        fact(t('sheet.reading'), t('read.' + g.reading)),
        fact(t('sheet.session'), t('sheet.sessionVal', { a: g.session.minutes[0], b: g.session.minutes[1] })),
        fact(t('sheet.languages'), g.languages.map(function (l) { return T[lang].lang[l] || l; }).join(', ')),
        fact(t('sheet.devices'), g.devices.map(function (d) { return T[lang].dev[d] || d; }).join(', ')),
        fact(t('sheet.offline'), g.offline ? t('sheet.yes') : t('sheet.no'))
      ]),
      el('section', null, [el('h3', { text: t('sheet.learnTitle') })].concat(learnBits)),
      el('section', null, [el('h3', { text: t('sheet.contentTitle') }), el('p', { text: pick(g.content) })]),
      el('section', null, [
        el('h3', { text: t('sheet.promisesTitle') }),
        el('ul', { class: 'promises' }, promises.map(function (k) { return el('li', null, [icon('check'), T[lang].healthy[k]]); })),
        el('p', { class: 'third', text: g.third_parties.length ? t('sheet.third', { l: g.third_parties.join(', ') }) : t('sheet.thirdNone') })
      ]),
      el('section', { class: 'ours' }, [el('h3', { text: t('sheet.oursTitle') })].concat(ours)),
      el('div', { class: 'meta' }, [
        el('p', { text: (stats && stats.kit) || g.kit ? t('sheet.kitOn') : t('sheet.kitOff') }),
        g.status === 'draft' ? el('p', { text: t('sheet.draft') }) : null,
        g.source && g.source.imported ? el('p', { text: t('sheet.source', { d: new Date(g.source.imported).toLocaleDateString(lang) }) }) : null,
        g.author.url ? el('p', null, [el('a', { href: g.author.url, target: '_blank', rel: 'noopener', text: t('sheet.code') })]) : null
      ])
    ]);
    sheet.textContent = '';
    sheet.appendChild(inner);
    if (!sheet.open) {
      if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
      if (!fromHistory) history.pushState({ ludi: 'sheet', id: g.id }, '');
    }
    sheet.scrollTop = 0;
  }
  function closeSheet(fromHistory) {
    if (!sheet.open) return;
    if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open');
    if (!fromHistory && history.state && history.state.ludi === 'sheet') { ignorePop++; history.back(); }
  }
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
  sheet.addEventListener('cancel', function (e) { e.preventDefault(); closeSheet(); });

  // =====================================================================
  // Jouer : le jeu en plein cadre, le temps compté, la fin douce ou nette
  // =====================================================================
  var player = document.getElementById('player');
  var bandeau = document.getElementById('p-bandeau');
  var pastille = document.getElementById('p-reste');
  var rideau = document.getElementById('p-rideau');
  var frame = null;
  var playing = null; // { game, origin, kit, essai, last, phase, avertie, sheet }
  var ignorePop = 0;

  function play(g, o) {
    o = o || {};
    if (playing) return;
    if (!o.essai && resteJeu(g.id).reste <= 0) { renderEnfant(); return; }
    var stats = gameStats(g.id);
    if (!o.essai) { stats.sessions += 1; saveStore(); }
    if (g.embed === false) { window.open(g.url, '_blank', 'noopener'); return; }
    playing = { game: g, origin: new URL(g.url, location.href).origin, kit: false, essai: !!o.essai, last: Date.now(), phase: 'jouer', avertie: false, sheet: sheet.open };
    if (sheet.open) { if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open'); }
    frame = el('iframe', { title: pick(g.title), src: g.url, allow: 'autoplay; screen-wake-lock; gamepad' }); // pas de plein écran pour le jeu : c'est Ludiworld qui décide
    player.insertBefore(frame, player.firstChild);
    player.hidden = false;
    bandeau.hidden = true; pastille.hidden = true; rideau.hidden = true;
    document.body.style.overflow = 'hidden';
    history.pushState({ ludi: 'play', id: g.id }, '');
    try { frame.focus(); } catch (e) { /* rien */ }
    boucle();
  }

  function stop(fromHistory) {
    if (!playing) return;
    compter();
    flushStore();
    setTimeout(planifierSynchro, 0); // la partie est finie : le temps de jeu peut partir
    var wasEssai = playing.essai, backToSheet = playing.sheet;
    playing = null;
    if (frame) { frame.remove(); frame = null; }
    player.hidden = true;
    bandeau.hidden = true; pastille.hidden = true; rideau.hidden = true;
    clearTimeout(bandeauTimer);
    document.body.style.overflow = '';
    if (!fromHistory && history.state && history.state.ludi === 'play') { ignorePop++; history.back(); }
    if (aRecharger) { location.reload(); return; }
    if (wasEssai && current && backToSheet) openSheet(current, true);
    render();
  }
  document.getElementById('player-back').addEventListener('click', function () { stop(); });

  // Le temps est mesuré par Ludiworld lui-même (page visible), que le jeu ait le kit ou non.
  function compter() {
    if (!playing) return;
    var now = Date.now();
    var ms = Math.min(now - playing.last, 5000); // un onglet endormi ne compte pas des heures d'un coup
    playing.last = now;
    if (playing.essai || playing.phase === 'arrete' || document.visibilityState === 'hidden') return;
    addTime(playing.game.id, ms);
  }

  var bandeauTimer = null;
  function montrerBandeau(img, titre, texte, reste) {
    bandeau.textContent = '';
    bandeau.appendChild(el('img', { src: img, alt: '' }));
    bandeau.appendChild(el('div', null, [el('b', { text: titre }), el('span', { text: texte })]));
    bandeau.hidden = false;
    bandeau.classList.remove('entre'); void bandeau.offsetWidth; bandeau.classList.add('entre');
    clearTimeout(bandeauTimer);
    if (!reste) bandeauTimer = setTimeout(function () { bandeau.hidden = true; }, 8000);
  }

  function pastilleTexte(ico, texte, derniere) {
    pastille.hidden = false;
    pastille.classList.toggle('derniere', !!derniere);
    pastille.textContent = '';
    pastille.appendChild(icon(ico));
    pastille.appendChild(document.createTextNode(texte));
  }

  function postToGame(msg) {
    if (!playing || !frame || !playing.kit) return;
    msg.game = playing.game.id;
    try { frame.contentWindow.postMessage(msg, playing.origin); } catch (e) { /* rien */ }
  }

  function evaluer(pointArret) {
    if (!playing || playing.essai || playing.phase === 'arrete') return;
    var r = resteJeu(playing.game.id);
    var regle = regles();
    var d = Temps.decision({ reste: r.reste, fin: regle.fin, kit: playing.kit, grace: regle.grace, pointArret: !!pointArret });
    var douce = regle.fin !== 'nette';
    // La pastille du soleil : visible dans les 5 dernières minutes.
    if (r.reste <= Temps.AVERTIR && r.reste > 0) pastilleTexte('sun', Math.ceil(r.reste / MIN) + '\u00a0min', false);
    else if (r.reste > Temps.AVERTIR) pastille.hidden = true;

    if (d === 'jouer') { if (playing.phase !== 'jouer') { playing.phase = 'jouer'; playing.avertie = false; bandeau.hidden = true; } return; }
    if (d === 'bientot') {
      if (!playing.avertie) {
        playing.avertie = true;
        montrerBandeau('img/marmotte-baille.webp', r.cause === 'jeu' ? t('kid.soonGameTitle') : t('kid.soonTitle'), douce ? t('kid.soonSoft', { t: minutesLeft(r.reste) }) : t('kid.soonText', { t: minutesLeft(r.reste) }));
        postToGame({ type: 'ludi:wrapup', minutes: Math.ceil(r.reste / MIN) });
      }
      return;
    }
    if (d === 'finir') {
      var grace = Temps.GRACE_SANS_KIT * MIN + r.reste; // ms qu'il reste à un jeu sans kit
      if (playing.phase !== 'finir') {
        playing.phase = 'finir';
        postToGame({ type: 'ludi:wrapup', minutes: 0 });
        montrerBandeau('img/marmotte-baille.webp', t('kid.finishTitle'), playing.kit ? t('kid.finishText') : t('kid.finishNoKit', { t: minutesLeft(grace) }));
      }
      // Ensuite, une simple pastille pour ne pas cacher le jeu.
      pastilleTexte('hourglass', playing.kit ? t('kid.lastRound') : Math.ceil(grace / MIN) + '\u00a0min', true);
      return;
    }
    // Arrêt en douceur à une fin de manche, juste avant la fin : les minutes qui restent ne servent plus aujourd'hui.
    if (r.reste > 0) {
      var f = fam(), k = Temps.cleJour();
      if (r.cause === 'jeu' && f.jeux[playing.game.id]) f.jeux[playing.game.id].fini = k;
      else f.regles.fini = k;
      saveStore();
    }
    arreter(r.cause);
  }

  function arreter(cause) {
    playing.phase = 'arrete';
    pastille.hidden = true; bandeau.hidden = true;
    postToGame({ type: 'ludi:pause', reason: 'temps' });
    var f = fam();
    var toutFini = cause !== 'jeu';
    rideau.textContent = '';
    rideau.appendChild(el('div', { class: 'rideau-carte' }, [
      el('img', { src: toutFini ? 'img/marmotte-dodo.webp' : 'img/marmotte-baille.webp', alt: '' }),
      el('h2', { text: toutFini ? t('kid.stopTitle') : t('kid.stopTitleGame') }),
      el('p', { text: !toutFini ? t('kid.stopTextGame') : t(cause === 'heure' ? 'kid.stopTextHour' : 'kid.stopText', { n: f ? f.enfant.nom : '' }) }),
      el('button', { type: 'button', class: 'btn-sun big', text: t('kid.stopOk'), onclick: function () { stop(); } })
    ]));
    rideau.setAttribute('data-moment', toutFini ? 'nuit' : 'soir');
    rideau.hidden = false;
    var b = rideau.querySelector('button'); if (b) setTimeout(function () { b.focus(); }, 300);
  }

  function boucle() { compter(); evaluer(false); }
  var CARNET_INACTIF = 90000;
  var derniereActivite = Date.now();
  ['pointerdown', 'keydown', 'input', 'scroll'].forEach(function (ev) {
    document.addEventListener(ev, function () { derniereActivite = Date.now(); if (vue === 'parent') LudiBarre.ouvrirParent(); }, true);
  });
  setInterval(function () {
    if (playing) boucle();
    else if (vue === 'enfant') renderEnfantSiChange();
    else if (vue === 'parent' && Date.now() - derniereActivite > CARNET_INACTIF) {
      // Carnet laissé ouvert : on revient côté enfant (le parent a sans doute rendu la tablette).
      closeSheet(); closeGate(); fermerCarnet();
    }
  }, 1000);
  window.addEventListener('storage', function (e) {
    if (e.key !== STORE || playing) return;
    try { store = JSON.parse(e.newValue) || { games: {} }; } catch (err) { return; }
    if (!store.games) store.games = {};
    migrer();
    render();
  });
  // Côté enfant sans jeu ouvert : on ne redessine que si l'affichage change (minuit, réglage, minute).
  var lastEnfantKey = '';
  function renderEnfantSiChange() {
    var r = regles();
    var k = (fam() ? fam().id : '') + '|' + Temps.cleJour() + '|' + Math.round(dayMs() / MIN) + '|' + JSON.stringify(fam() && fam().regles) + '|' + Temps.horsPlage(r) + '|' + lang;
    if (k !== lastEnfantKey) { lastEnfantKey = k; renderEnfant(); }
    else { pillEnfant(); partSoleil(); }
  }
  document.addEventListener('visibilitychange', function () { if (playing) playing.last = Date.now(); });
  window.addEventListener('pagehide', function () { compter(); flushStore(); });

  // Dialogue avec le kit ludi.js (spec/kit.md)
  window.addEventListener('message', function (e) {
    if (!playing || !frame || e.source !== frame.contentWindow || e.origin !== playing.origin) return;
    var m = e.data;
    if (!m || typeof m !== 'object' || m.game !== playing.game.id) return;
    var g = gameStats(playing.game.id);
    if (m.type === 'ludi:hello') {
      playing.kit = true; g.kit = true; saveStore();
      var f = fam();
      frame.contentWindow.postMessage({ type: 'ludi:welcome', player: f && !playing.essai ? { name: f.enfant.nom } : null }, playing.origin);
      // Un jeu qui arrive alors que l'enfant a déjà été prévenu l'apprend aussi.
      if (playing.avertie) { var r = resteJeu(playing.game.id); postToGame({ type: 'ludi:wrapup', minutes: Math.max(0, Math.ceil(r.reste / MIN)) }); }
    } else if (m.type === 'ludi:event' && m.event) {
      var ev = m.event;
      if (playing.essai) return; // l'essai du parent ne compte pas dans les stats de l'enfant
      if (ev.kind === 'score' && ev.record) { g.scores[ev.key] = { value: ev.value, better: ev.better }; saveStore(); }
      else if (ev.kind === 'progress') { g.progress[ev.key] = ev.value; saveStore(); }
      else if (ev.kind === 'skill' && ev.domain) {
        var id = String(ev.domain) + (ev.item !== null && ev.item !== undefined ? '/' + ev.item : '');
        var s = g.skills[id] || { ok: 0, ko: 0, streak: 0 };
        if (ev.success) { s.ok++; s.streak = Math.max(1, s.streak + 1); } else { s.ko++; s.streak = Math.min(-1, s.streak - 1); }
        g.skills[id] = s;
        var k = Temps.cleJour();
        var sd = g.skillDays[k] || (g.skillDays[k] = { ok: 0, ko: 0 });
        if (ev.success) sd.ok++; else sd.ko++;
        saveStore();
      } else if (ev.kind === 'checkpoint') { compter(); evaluer(true); }
      // Les tranches de temps (« session ») envoyées par le kit sont ignorées : Ludiworld compte lui-même.
    }
  });

  // Bouton retour (Android) : ferme le jeu, puis la fiche.
  window.addEventListener('popstate', function () {
    if (ignorePop) { ignorePop--; return; }
    if (playing) { stop(true); return; }
    if (sheet.open) closeSheet(true);
  });

  // ---------- Plein écran ----------
  // Réglage du foyer (oui par défaut). Le navigateur n'accepte le plein écran qu'après un geste :
  // on le demande donc au premier toucher côté enfant (y compris en touchant une tuile pour jouer).
  // Au doigt seulement : à la souris (ordinateur), le plein écran à chaque clic gêne plus qu'il n'aide.
  function pleinEcranVoulu() { var h = foyer(); return !!(h && h.pleinEcran !== false); }
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' || vue !== 'enfant' || !pleinEcranVoulu() || document.fullscreenElement) return;
    var d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen;
    if (!f) return;
    try { var p = f.call(d, { navigationUI: 'hide' }); if (p && p.catch) p.catch(function () {}); } catch (e) { /* refusé : tant pis */ }
  }, true);

  // ---------- Installation ----------
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; if (vue === 'parent' && tab === 'settings') renderParent(); });
  // Nouvelle version publiée : le nouveau service worker prend la main, on recharge pour l'afficher.
  // Pas au tout premier passage (rien en cache), et jamais en pleine partie : on attend la fin du jeu.
  var aRecharger = false;
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    var dejaServi = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!dejaServi) { dejaServi = true; return; }
      if (playing) aRecharger = true; else location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  // ---------- Démarrage ----------
  // Rien de préparé sur cet appareil : on arrive sur le site, sauf si l'on vient y préparer la tablette (#demarrer).
  // Préparé : côté enfant ; #carnet (onglet « Mon Ludiworld » du site) ouvre le carnet, avec le code s'il le faut.
  document.documentElement.lang = lang;
  var arrivee = location.hash;
  var prepare = !!(fam() && foyer().pin);
  if (!prepare && arrivee !== '#demarrer') { location.replace('decouvrir/'); return; }
  if (arrivee === '#carnet' || arrivee === '#enfant' || (prepare && arrivee === '#demarrer')) history.replaceState(history.state, '', location.pathname + location.search);
  loadCatalogue().then(function () {
    // Un jeu choisi qui a disparu du catalogue n'est plus proposé (on garde son choix au cas où il revient).
    if (!prepare) { show('accueil'); return; }
    synchroniser();
    if (arrivee === '#carnet' && LudiBarre.parentOuvert()) { show('parent'); return; }
    LudiBarre.fermerParent();
    show('enfant');
    if (arrivee === '#carnet') openGate(ouvrirCarnet);
  });
  // Retour sur l'appli (« +10 min » donné depuis le téléphone, par exemple) : on regarde s'il y a du neuf.
  document.addEventListener('visibilitychange', function () { if (!document.hidden && vue === 'enfant') synchroniser(); });
  // « Mon Ludiworld » cliqué sans quitter la page (onglet du carnet, adresse tapée) : même règle.
  window.addEventListener('hashchange', function () {
    if (location.hash !== '#carnet' || !prepare) return;
    history.replaceState(history.state, '', location.pathname + location.search);
    if (vue === 'parent' || playing) return;
    if (LudiBarre.parentOuvert()) show('parent'); else openGate(ouvrirCarnet);
  });

  // Pour les tests et la démo : avancer le temps de jeu d'aujourd'hui sans attendre (console).
  window.ludiDemo = {
    ajouter: function (id, minutes) { addTime(id, minutes * MIN); flushStore(); render(); },
    etat: function () { return JSON.parse(JSON.stringify(store)); }
  };
})();
