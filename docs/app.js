/* Ludiworld : l'appli (préparation, côté enfant, côté parent, jeux en plein cadre). Tout reste sur l'appareil, sauf si le parent active la synchro. */
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
    parle: '<path d="M3.5 9.5h4l5-4.5v14l-5-4.5h-4z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M18.6 6.4a7.6 7.6 0 0 1 0 11.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    hourglass: '<path d="M6 2h12M6 22h12M7 2c0 5 5 6 5 10s-5 5-5 10M17 2c0 5-5 6-5 10s5 5 5 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    lock: '<rect x="4" y="10.5" width="16" height="11" rx="2.5" fill="currentColor"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" fill="none" stroke="currentColor" stroke-width="2.4"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
    check: '<path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    cross: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    warn: '<path d="M12 3l10 18H2z" fill="currentColor"/><path d="M12 10v5M12 18v.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
    book: '<path d="M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4zM20 4.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    minus: '<path d="M5 12h14" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2" fill="currentColor"/><rect x="13.5" y="3.5" width="7" height="7" rx="2.6" fill="currentColor"/><rect x="3.5" y="13.5" width="7" height="7" rx="2.6" fill="currentColor"/><rect x="13.5" y="13.5" width="7" height="7" rx="2" fill="currentColor"/>',
    gear: '<circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    plus: '<path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
    home: '<path d="M12 4.6l-7 6.1V20h4.8v-5.4h4.4V20H19v-9.3z" fill="currentColor"/><path d="M2.8 11.4L12 3.3l9.2 8.1" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="7" y="13" width="4" height="4" rx="1" fill="currentColor"/>',
    chevron: '<path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
    // Une vitrine : un auvent festonné au-dessus d'une devanture (l'onglet « Tous les jeux », et le bouton de l'enfant).
    vitrine: '<path d="M3.6 3.5h16.8L22 9.2a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0z" fill="currentColor"/><path d="M4 12.5v8h16v-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><rect x="7.2" y="14.6" width="9.6" height="3.6" rx="1" fill="currentColor"/>',
    // Une main levée : « Je voudrais ce jeu », et les demandes côté parent.
    main: '<path d="M8.2 12.6V5.4a1.55 1.55 0 0 1 3.1 0v5.4M11.3 10.4V3.9a1.55 1.55 0 0 1 3.1 0v6.6M14.4 10.6V5.4a1.55 1.55 0 0 1 3.1 0v6.4M17.5 11.8V9.3a1.55 1.55 0 0 1 3.1 0v5.2a7.5 7.5 0 0 1-7.5 7.5h-.8a6.2 6.2 0 0 1-5.2-2.8l-3-4.6a1.6 1.6 0 0 1 2.6-1.8l1.5 1.9" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>',
    // Une boîte : ranger un jeu.
    boite: '<path d="M3 4.5h18v4H3zM4.5 8.5h15V20h-15z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9.5 12.5h5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    retour: '<path d="M14.5 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    // Une étoile : la note de « Votre avis » (pleine ou vide, le CSS choisit).
    etoile: '<path d="M12 2.8l2.85 5.95 6.55.85-4.8 4.55 1.2 6.5L12 17.5l-5.8 3.15 1.2-6.5-4.8-4.55 6.55-.85z" stroke-linejoin="round"/>'
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
  // L'enfant dont on parle : côté parent, celui que le parent regarde ; ailleurs, celui qui joue (h.actif).
  // Regarder un enfant côté parent ne lui donne pas l'appareil.
  var regarde = null;
  function fam() {
    var h = foyer();
    if (!h || !h.enfants.length) return null;
    var id = vue === 'parent' && regarde ? regarde : h.actif;
    return h.enfants.filter(function (e) { return e.id === id; })[0] || h.enfants[0];
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
  // \u00ab 17 h \u00bb, \u00ab 17 h 30 \u00bb ; en anglais \u00ab 17:30 \u00bb.
  function heure(hhmm) { return lang === 'fr' ? hhmm.replace(/^0(\d)/, '$1').replace(':00', '\u00a0h').replace(':', '\u00a0h\u00a0') : hhmm; }
  // \u00ab de L\u00e9na \u00bb, \u00ab d\u2019In\u00e8s \u00bb (en anglais, les textes disent \u00ab In\u00e8s\u2019s \u00bb).
  function nomDe(n) { return /^[aeiouyh\u00e0\u00e2\u00e4\u00e9\u00e8\u00ea\u00eb\u00ee\u00ef\u00f4\u00f6\u00f9\u00fb\u00fc\u0153\u00e6]/i.test(n) ? 'd\u2019' + n : 'de ' + n; }
  // Le mot qui va pour l'appareil qu'on tient : t\u00e9l\u00e9phone, tablette ou ordinateur.
  function genreAppareil() {
    var tactile = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
    if (!tactile) return 'ordi';
    return Math.min(screen.width, screen.height) < 600 ? 'telephone' : 'tablette';
  }

  // ---------- Catalogue ----------
  var games = [];
  var byId = {};
  var catalogueOk = null;
  // Les fiches sont lues par le module du catalogue (site/catalogue.js), le même que la page « Les jeux ».
  function loadCatalogue() {
    return LudiCatalogue.charger().then(function (list) {
      games = list.filter(function (g) { return g.url && g.age && g.learning; });
      byId = {}; games.forEach(function (g) { byId[g.id] = g; });
      catalogueOk = true;
    }).catch(function () { catalogueOk = false; });
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
  var PAL = ['#f26b4f', '#3f8f5a', '#e0a400', '#4f8fd1', '#c98b4f', '#16204a']; // la couleur de chaque enfant
  function choisis() { return games.filter(function (g) { return !!choix(g.id); }); }
  // Un jeu rangé (par le parent) : toujours installé, il sort de « Les jeux de … » ; côté enfant, il va dans « Finis ».
  function range(id) { var c = choix(id); return !!(c && c.range); }
  function mesJeux() { return choisis().filter(function (g) { return !range(g.id); }); }
  function ranges() { return choisis().filter(function (g) { return range(g.id); }); }
  // Les demandes de l'enfant ({ id: date }) encore en attente : un jeu du catalogue, pas encore installé. La plus ancienne d'abord.
  function demandes(e) {
    var d = (e && e.demandes) || {};
    return Object.keys(d).filter(function (id) { return byId[id] && !(e.jeux && e.jeux[id]); }).sort(function (a, b) { return d[a] - d[b]; }).map(function (id) { return byId[id]; });
  }
  function demande(e, id) { return !!(e && e.demandes && e.demandes[id] && !(e.jeux && e.jeux[id])); }
  // Une demande traitée (installée ou « Pas maintenant ») : notée dans demandesVues, pour qu'un autre appareil ne la ramène pas.
  function traiterDemande(k, id) {
    if (!k.demandes || !k.demandes[id]) return;
    (k.demandesVues || (k.demandesVues = {}))[id] = k.demandes[id];
    delete k.demandes[id];
    if (!Object.keys(k.demandes).length) delete k.demandes;
  }
  // Le bouton de l'enfant pour regarder tous les jeux : là par défaut, le parent peut le couper (Réglages).
  function peutRegarder(e) { return !!e && e.regarderTout !== false; }
  // Les jeux que l'enfant n'a pas : ceux de son âge d'abord.
  function jeuxPasInstalles(e) {
    var l = games.filter(function (g) { return !(e.jeux && e.jeux[g.id]); });
    return l.filter(function (g) { return pourAge(g, e.enfant.age); }).concat(l.filter(function (g) { return !pourAge(g, e.enfant.age); }));
  }
  function pourAge(g, age) { return age >= g.age.min && age <= g.age.max; }

  // ---------- Vues ----------
  var vues = { accueil: document.getElementById('v-accueil'), enfant: document.getElementById('v-enfant'), parent: document.getElementById('v-parent') };
  var vue = null;
  function show(v) {
    if (v !== vue) { document.getElementById('e-jeux').classList.remove('calme'); noterUsage('vue', null, { cote: v }); }
    if (v !== 'enfant' && vitrine && !vitrine.hidden) fermerVitrine();
    vue = v;
    Object.keys(vues).forEach(function (k) { vues[k].hidden = k !== v; });
    document.body.setAttribute('data-vue', v);
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    document.documentElement.lang = lang;
    var retour = document.getElementById('player-back');
    retour.textContent = ''; retour.appendChild(icon('home'));
    retour.setAttribute('aria-label', t('back')); retour.title = t('back');
    if (vue === 'accueil') renderAccueil();
    else if (vue === 'enfant') renderEnfant();
    else if (vue === 'parent') renderParent();
  }

  // =====================================================================
  // Accueil : première ouverture, le parent prépare Ludiworld (4 étapes)
  // =====================================================================
  function accVide() { return { step: 0, nom: '', age: 7, jeux: {}, ecole: 30, libre: 60, libres: lang === 'fr' ? [0, 3, 6] : [0, 6], fin: 'douce', pin1: null }; }
  var acc = accVide();

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
  // Les jours de la semaine : un jour choisi a une coche, pas seulement une couleur. Lundi d'abord.
  function joursBoutons(choisisJ, onToggle) {
    return el('div', { class: 'jours', role: 'group' }, [1, 2, 3, 4, 5, 6, 0].map(function (d) {
      var on = choisisJ.indexOf(d) !== -1;
      return el('button', { type: 'button', 'aria-pressed': String(on), class: on ? 'on' : '', 'aria-label': t('daysLong')[d], onclick: function () { onToggle(d, on); } }, [on ? icon('check') : null, t('days')[d]]);
    }));
  }
  // « le mercredi, le samedi et le dimanche » / « Wednesday, Saturday and Sunday » : les jours eux-mêmes, lundi d'abord.
  function joursPhrase(choisisJ) {
    var l = [1, 2, 3, 4, 5, 6, 0].filter(function (d) { return (choisisJ || []).indexOf(d) !== -1; })
      .map(function (d) { return (lang === 'fr' ? 'le ' : '') + t('daysLong')[d]; });
    if (l.length < 2) return l.join('');
    return l.slice(0, -1).join(', ') + (lang === 'fr' ? ' et ' : ' and ') + l[l.length - 1];
  }
  function majuscule(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  // Le titre du temps des jours choisis : ces jours, nommés.
  function titreJoursChoisis(choisisJ) {
    var j = joursPhrase(choisisJ);
    return j ? majuscule(t('parent.free', { j: j })) : t('parent.freeNoDay');
  }
  function joursEnMots(choisisJ) {
    var l = [1, 2, 3, 4, 5, 6, 0].filter(function (d) { return choisisJ.indexOf(d) !== -1; }).map(function (d) { return t('daysLong')[d]; });
    return l.length ? t('parent.freeDaysList', { l: l.join(', ') }) : t('parent.freeDaysNone');
  }

  function renderAccueil() {
    var root = vues.accueil;
    root.textContent = '';
    window.scrollTo(0, 0);
    var N = 4;
    function nav(canNext, onNext) {
      return el('div', { class: 'a-nav' }, [
        el('button', { type: 'button', class: 'btn-ghost', text: t('hello.prev'), onclick: function () { acc.step--; renderAccueil(); } }),
        el('button', { type: 'button', class: 'btn-sun', disabled: !canNext, onclick: onNext || function () { acc.step++; renderAccueil(); } }, [t('hello.next')])
      ]);
    }
    function frame(img, kids, cls) {
      return el('div', { class: 'a-cadre ' + (cls || '') }, [
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
          // Après « Vider cet appareil », la copie en ligne attend : on peut se reconnecter d'ici.
          Nuage && Nuage.actif() && !Nuage.connecte() ? el('p', { class: 'a-deja' }, [el('a', { href: 'compte/#connexion', class: 'lien', text: t('hello.haveAccount') })]) : null,
          el('p', null, [el('a', { href: './', class: 'lien', text: t('hello.discover') })]) // la racine du site (adresses relatives à <base>)
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
        chips(AGES, acc.age, function (a) { return String(a); }, function (a) { acc.age = a; renderAccueil(); }, 'ages'),
        next
      ]));
      setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (e) { /* rien */ } }, 50);
      return;
    }

    if (acc.step === 2) {
      // Aucun jeu coché d'office : le parent touche ceux qu'il veut, en voyant leurs images. Ceux de son âge d'abord.
      // Toucher la mini-fiche choisit le jeu ; « Voir la fiche » l'ouvre, et la fiche se referme après « Choisir ».
      var nbChoisis = function () { return Object.keys(acc.jeux).filter(function (k) { return acc.jeux[k]; }).length; };
      var compte = el('p', { class: 'a-compte', 'aria-live': 'polite' });
      var suite = nav(false);
      function maj() {
        compte.textContent = t(nbChoisis() === 1 ? 'hello.gamesCountOne' : 'hello.gamesCount', { k: nbChoisis() });
        suite.lastChild.disabled = !nbChoisis();
      }
      function bouton(g, apres) {
        var on = !!acc.jeux[g.id];
        return el('button', { type: 'button', class: 'a-choisir' + (on ? ' on' : ''), 'aria-pressed': String(on), 'data-choisir': g.id, onclick: function () { basculer(g); if (apres) apres(); } },
          [icon(on ? 'check' : 'plus'), on ? t('hello.gameOn') : t('hello.gameAdd')]);
      }
      function voir(g) {
        return el('button', { type: 'button', class: 'lien a-voir', text: t('hello.seeCard'), onclick: function () {
          LudiCatalogue.ouvrir(g, { lang: lang, actions: [bouton(g, LudiCatalogue.fermer)] });
        } });
      }
      function basculer(g) {
        acc.jeux[g.id] = !acc.jeux[g.id];
        var carte = root.querySelector('.cat-mini[data-jeu="' + g.id + '"]');
        if (carte) {
          carte.classList.toggle('a-pris', !!acc.jeux[g.id]);
          var b = carte.querySelector('.a-choisir');
          b.parentNode.replaceChild(bouton(g), b);
          var nomB = carte.querySelector('.cat-mini-ouvrir');
          if (nomB) nomB.setAttribute('aria-pressed', String(!!acc.jeux[g.id]));
        }
        maj();
      }
      var ordre = games.filter(function (g) { return pourAge(g, acc.age); }).concat(games.filter(function (g) { return !pourAge(g, acc.age); }));
      var grille = el('div', { class: 'a-catalogue' }, ordre.map(function (g) {
        var m = LudiCatalogue.miniFiche(g, { lang: lang, actions: [bouton(g), voir(g)], onOuvrir: basculer });
        if (acc.jeux[g.id]) m.classList.add('a-pris');
        var nomB = m.querySelector('.cat-mini-ouvrir');
        if (nomB) nomB.setAttribute('aria-pressed', String(!!acc.jeux[g.id]));
        return m;
      }));
      maj();
      root.appendChild(frame('img/marmotte-salut.webp', [
        el('h2', { text: t('hello.gamesTitle') }),
        el('p', { class: 'a-lead', text: t('hello.gamesText', { n: acc.nom.trim() }) }),
        catalogueOk === false ? el('p', { class: 'erreur', text: t('loadError') }) : grille,
        el('div', { class: 'a-pied' }, [compte, suite])
      ], 'a-large'));
      return;
    }

    if (acc.step === 3) {
      var mins = function (m) { return t('min', { n: m }); };
      root.appendChild(frame('img/marmotte-baille.webp', [
        el('h2', { text: t('hello.timeTitle') }),
        el('p', { class: 'champ-label', text: titreJoursChoisis(acc.libres) }),
        chips([30, 45, 60, 90, 120], acc.libre, mins, function (v) { acc.libre = v; renderAccueil(); }),
        el('p', { class: 'champ-label', text: t('parent.school') }),
        chips([15, 20, 30, 45, 60], acc.ecole, mins, function (v) { acc.ecole = v; renderAccueil(); }),
        el('p', { class: 'champ-label', text: t('hello.freeDaysText', { n: acc.nom.trim() }) }),
        joursBoutons(acc.libres, function (d, on) { acc.libres = on ? acc.libres.filter(function (x) { return x !== d; }) : acc.libres.concat([d]); renderAccueil(); }),
        el('p', { class: 'a-jours-mots', text: joursEnMots(acc.libres) }),
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
          Object.keys(acc.jeux).forEach(function (id) { if (acc.jeux[id]) jeux[id] = { max: null }; });
          store.famille = { v: 2, cree: Date.now(), maj: Date.now(), pin: hash(code), protege: true, enfants: [], actif: null };
          var e = nouvelEnfant(acc.nom.trim().slice(0, 24), acc.age, jeux,
            Temps.regles({ ecole: acc.ecole, libre: acc.libre, fin: acc.fin, joursLibres: acc.libres }));
          e.games = store.games; store.games = {};
          store.famille.actif = e.id;
          e.maj = Date.now();
          saveStore();
          planifierSynchro();
          noterUsage('preparation_finie', null, { jeux: Object.keys(jeux).length });
          acc.step = 5; renderAccueil();
        }),
        el('div', { class: 'a-nav' }, [el('button', { type: 'button', class: 'btn-ghost', text: t('hello.prev'), onclick: function () { acc.pin1 = null; acc.step--; renderAccueil(); } })])
      ]));
      return;
    }

    var nom = fam() ? fam().enfant.nom : acc.nom;
    var compteEnLigne = Nuage && Nuage.actif() && !Nuage.connecte();
    root.appendChild(el('div', { class: 'a-cadre a-fin' }, [
      el('div', { class: 'a-illu', 'aria-hidden': 'true' }, [el('img', { src: 'img/marmotte-salut.webp', alt: '' })]),
      el('div', { class: 'a-contenu' }, [
        el('h2', { text: t('hello.doneTitle') }),
        el('p', { class: 'a-lead', text: t('hello.doneText', { n: nom }) }),
        el('p', { class: 'note' }, [icon('lock'), t('hello.doneLock', { n: nom })]),
        el('button', { type: 'button', class: 'btn-sun big', onclick: function () { show('enfant'); } }, [t('hello.doneGo')]),
        compteEnLigne ? el('p', { class: 'a-compte-ligne' }, [t('hello.doneAccount') + ' ', el('a', { class: 'lien', href: 'compte/#creer', text: t('hello.doneAccountGo') })]) : null,
        // Les statistiques anonymes, dites dès la préparation (Julien, 2026-11-23 : « ça va avec la transparence des données »)
        el('p', { class: 'a-compte-ligne a-stats-ligne' }, [t('hello.doneStats') + ' ',
          el('button', { type: 'button', class: 'lien', 'data-action': 'stats-reglages', text: t('hello.doneStatsGo'), onclick: function () { versParent('reglages'); } })])
      ])
    ]));
  }

  // Les deux façons de s'arrêter, illustrées (préparation et onglet Temps).
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
      keys.appendChild(el('button', { type: 'button', class: k === 'del' ? 'del' : '', 'aria-label': k === 'del' ? t('gate.erase') : k, text: k === 'del' ? t('gate.erase') : k, onclick: function () { press(k); } }));
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

  // La marque du jeu : « Fini » (coche). Pas de pourcentage côté enfant (il reste côté parent, si le jeu l'envoie).
  function tuileJeu(g, i) {
    var c = choix(g.id), et = (S()[g.id] || {}).etat || {};
    var marques = [];
    if (et.fini) marques.push(el('span', { class: 'marque marque-fini' }, [icon('check'), t('kid.finiBadge')]));
    return el('button', {
      type: 'button', class: 'tuile', style: '--game:' + (g.color || '#1d2b4f') + ';--i:' + i,
      'aria-label': pick(g.title) + (et.fini ? ', ' + t('kid.finiBadge') : ''), onclick: function () { play(g); }
    }, [
      el('span', { class: 'tuile-img' }, [gameIcon(g)]),
      marques.length ? el('span', { class: 'marques' }, marques) : null,
      el('b', { class: 'tuile-nom', text: pick(g.title) }),
      c && c.max ? el('span', { class: 'tuile-tag' }, [icon('hourglass'), t('kid.gameLeft', { t: minutesLeft(resteJeu(g.id).jeu) })]) : null
    ]);
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
    majBoutonVitrine(f, nuit);

    var list = document.getElementById('e-jeux');
    if (list.childNodes.length) list.classList.add('calme'); // les tuiles ne retombent qu'à l'arrivée
    list.textContent = '';
    vues.enfant.classList.remove('beaucoup');
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
    // Les jeux ouverts aujourd'hui d'abord, en grand. Les autres viennent après, petits et pâles, sans pouvoir les toucher :
    // on comprend qu'ils sont là, mais ils ne sont pas mis en avant.
    var repos = { libres: [], fini: [] };
    // Trois rangées : ce qu'on a commencé, ce qu'il reste à découvrir, ce qui est fini (le jeu le dit lui-même).
    var rangees = { cours: [], neuf: [], finis: [] };
    jouables.forEach(function (g) {
      var st = S()[g.id] || {}, et = st.etat || {};
      var commence = (st.ms || 0) > 0 || !!st.save || Object.keys(st.progress || {}).length > 0;
      // Un jeu rangé par le parent va dans « Finis », même s'il n'était pas fini : il reste jouable.
      rangees[et.fini || range(g.id) ? 'finis' : commence ? 'cours' : 'neuf'].push(g);
    });
    var nbRangees = ['cours', 'neuf', 'finis'].filter(function (k) { return rangees[k].length; }).length;
    // Plus de quatre tuiles : sur une tablette en largeur, elles prennent aussi la moitié gauche (l'île se fait petite).
    vues.enfant.classList.toggle('beaucoup', jouables.length > 4);
    var n = 0;
    [['cours', 'kid.rowOn'], ['neuf', 'kid.rowNew'], ['finis', 'kid.rowDone']].forEach(function (x) {
      if (!rangees[x[0]].length) return;
      // Chaque rangée dans son groupe : invisible d'habitude (display: contents), côte à côte quand il y a beaucoup de tuiles.
      list.appendChild(el('div', { class: 'e-rangee-groupe' }, [
        nbRangees > 1 ? el('h2', { class: 'e-rangee e-rangee-' + x[0] }, [icon(x[0] === 'finis' ? 'check' : x[0] === 'neuf' ? 'sun' : 'hourglass'), t(x[1])]) : null,
        el('div', { class: 'e-rangee-tuiles' }, rangees[x[0]].map(function (g) { return tuileJeu(g, n++); }))
      ]));
    });
    mine.forEach(function (g) {
      if (jouables.indexOf(g) !== -1) return;
      var c = choix(g.id);
      repos[c && c.libres && !Temps.jourLibre(regles()) ? 'libres' : 'fini'].push(g);
    });
    // « Pas aujourd'hui », puis pourquoi, en une ligne courte avec une icône : les jours réglés, ou « Encore demain ».
    // Ces jeux restent impossibles à toucher.
    if (!repos.libres.length && !repos.fini.length) return;
    var jours = joursPhrase(regles().joursLibres);
    var groupes = [
      ['libres', 'calendar', jours ? majuscule(t('kid.daysOnly', { j: jours })) : ''],
      ['fini', 'hourglass', t('kid.tomorrow')]
    ].filter(function (x) { return repos[x[0]].length; }).map(function (x) {
      return el('div', { class: 'e-repos-groupe e-repos-' + x[0] }, [
        x[2] ? el('p', { class: 'e-repos-pourquoi' }, [icon(x[1]), x[2]]) : null,
        el('div', { class: 'e-repos-jeux' }, repos[x[0]].map(function (g) {
          return el('span', { class: 'e-repos-jeu', style: '--game:' + (g.color || '#1d2b4f') }, [
            el('span', { class: 'tuile-img' }, [gameIcon(g)]),
            el('span', { class: 'e-repos-nom', text: pick(g.title) })
          ]);
        }))
      ]);
    });
    list.appendChild(el('div', { class: 'e-repos', role: 'group', 'aria-label': t('kid.freeDaysOnly') },
      [el('p', { class: 'e-repos-titre' }, [icon('moon'), t('kid.freeDaysOnly')])].concat(groupes)));
  }

  // La pastille « Encore 25 min » : mise à jour chaque seconde sans tout redessiner.
  var lastPill = '';
  function pillEnfant() {
    var r = regles(), rt = resteDuJour().total, hors = Temps.horsPlage(r), nuit = rt <= 0;
    // Arrêté pour aujourd'hui par un parent : c'est fini, même avant l'heure d'ouverture.
    if (r.fini === Temps.cleJour()) hors = null;
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
        sd && sd.ok ? el('span', { class: 'dodo-ok' }, [icon('check'), t('kid.sleepLearned', { k: sd.ok, d: LudiCatalogue.notion(g.learning.domains[0], lang).toLowerCase() })]) : null]);
    });
    var r = regles();
    if (codeEnAttente()) {
      box.appendChild(el('h2', { text: t('kid.waitTitle') }));
      box.appendChild(el('p', { text: t('kid.waitText') }));
      return;
    }
    if (Temps.horsPlage(r) === 'avant' && r.fini !== Temps.cleJour()) {
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
  // =====================================================================
  // Côté enfant : regarder tous les jeux (la vitrine) et en demander un. Rien ne s'installe ; le temps ne compte pas
  // (il ne compte que dans un jeu). Le bouton est une image, sans mot à lire ; le parent peut le couper dans Réglages.
  // Pas de vitrine la nuit (le jour est fini) ni pendant l'attente d'un nouveau code.
  // =====================================================================
  var vitrine = document.getElementById('vitrine');
  var boutonVitrine = document.getElementById('e-vitrine');
  var vitrineJeu = null; // l'id du jeu montré en grand, ou null pour la liste
  function majBoutonVitrine(f, nuit) {
    var ok = !nuit && !codeEnAttente() && catalogueOk !== false && peutRegarder(f) && jeuxPasInstalles(f).length > 0;
    boutonVitrine.hidden = !ok;
    boutonVitrine.setAttribute('aria-label', t('kid.lookAll'));
    boutonVitrine.title = t('kid.lookAll');
    if (!ok && !vitrine.hidden) fermerVitrine();
  }
  boutonVitrine.addEventListener('click', function () { ouvrirVitrine(); });
  function ouvrirVitrine() {
    if (!vitrine.hidden || !fam()) return;
    vitrineJeu = null;
    try { history.pushState({ ludiVitrine: 'liste' }, ''); } catch (e) { /* rien */ }
    vitrine.hidden = false;
    document.body.style.overflow = 'hidden';
    dessinerVitrine();
  }
  function fermerVitrine() {
    vitrine.hidden = true; vitrineJeu = null;
    vitrine.textContent = '';
    document.body.style.overflow = '';
    if (vue === 'enfant') { try { boutonVitrine.focus({ preventScroll: true }); } catch (e) { /* rien */ } }
  }
  // Revenir : un pas d'historique (le retour du téléphone fait pareil).
  function retourVitrine() { if (history.state && history.state.ludiVitrine) history.back(); else if (vitrineJeu) { vitrineJeu = null; dessinerVitrine(); } else fermerVitrine(); }
  function voirJeuVitrine(g) {
    vitrineJeu = g.id;
    try { history.pushState({ ludiVitrine: 'jeu' }, ''); } catch (e) { /* rien */ }
    dessinerVitrine();
  }
  function demanderJeu(g) {
    var f = fam();
    (f.demandes || (f.demandes = {}))[g.id] = Date.now();
    saveStore();
    noterUsage('jeu_demande', g);
    planifierSynchro();
    dessinerVitrine();
    var m = vitrine.querySelector('.v-demande');
    if (m) m.focus({ preventScroll: true });
  }
  function dessinerVitrine() {
    var f = fam();
    if (!f) { fermerVitrine(); return; }
    var g = vitrineJeu && byId[vitrineJeu];
    if (vitrineJeu && (!g || (f.jeux && f.jeux[g.id]))) { vitrineJeu = null; g = null; }
    vitrine.textContent = '';
    vitrine.setAttribute('data-vue', g ? 'jeu' : 'liste');
    vitrine.appendChild(el('header', { class: 'v-tete' }, [
      el('button', { type: 'button', class: 'v-retour', 'aria-label': t('kid.lookBack'), title: t('kid.lookBack'), onclick: retourVitrine }, [icon(g ? 'retour' : 'home')]),
      el('h1', { class: 'v-titre' }, [icon('vitrine'), el('span', { text: t('kid.lookTitle') })])
    ]));
    if (g) {
      var ims = LudiCatalogue.images(g, lang), dem = demande(f, g.id);
      vitrine.appendChild(el('section', { class: 'v-jeu', style: '--game:' + (g.color || '#1d2b4f'), 'data-jeu': g.id }, [
        el('div', { class: 'v-jeu-tete' }, [LudiCatalogue.icone(g, 84), el('h2', { text: pick(g.title) })]),
        ims.length ? el('div', { class: 'v-images' + (g.screens === 'portrait' ? ' v-portrait' : '') }, ims.slice(0, 3).map(function (im) {
          var img = el('img', { src: im.src, alt: im.alt, decoding: 'async', draggable: 'false' });
          img.addEventListener('error', function () { img.remove(); });
          return img;
        })) : null,
        dem ? el('p', { class: 'v-demande', role: 'status', tabindex: '-1' }, [icon('main'), t('kid.asked')])
          : el('button', { type: 'button', class: 'btn-sun big v-vouloir', onclick: function () { demanderJeu(g); } }, [icon('main'), t('kid.want')])
      ]));
    } else {
      vitrine.appendChild(el('div', { class: 'v-grille' }, jeuxPasInstalles(f).map(function (j, i) {
        var im = LudiCatalogue.images(j, lang)[0], dem = demande(f, j.id);
        return el('button', { type: 'button', class: 'v-tuile', 'data-jeu': j.id, style: '--game:' + (j.color || '#1d2b4f') + ';--i:' + i,
          'aria-label': pick(j.title) + (dem ? ', ' + t('kid.askedBadge') : ''), onclick: function () { voirJeuVitrine(j); } }, [
          el('span', { class: 'v-tuile-img' + (j.screens === 'portrait' ? ' v-portrait' : '') }, [im ? el('img', { src: im.src, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }) : gameIcon(j)]),
          el('span', { class: 'v-tuile-bas' }, [LudiCatalogue.icone(j, 48), el('b', { text: pick(j.title) })]),
          dem ? el('span', { class: 'v-marque' }, [icon('main'), t('kid.askedBadge')]) : null
        ]);
      })));
    }
    vitrine.scrollTop = 0;
    var b = vitrine.querySelector('.v-retour');
    if (b && !vitrine.querySelector('.v-demande:focus')) b.focus({ preventScroll: true });
  }

  // Le côté parent : le code donné, le parent peut aussi lire les pages du site sans le redonner (quelques minutes).
  // On arrive toujours sur l'onglet Jeux (sauf retour du compte : Réglages), sur l'enfant qui jouait.
  function ouvrirCarnet(versOnglet) {
    LudiBarre.ouvrirParent();
    // Le code demandé depuis une page du site (pour installer un jeu) : on y retourne.
    var retour = null;
    try { retour = sessionStorage.getItem('ludiworld.retour'); sessionStorage.removeItem('ludiworld.retour'); } catch (e) { /* rien */ }
    if (retour && /^(les-jeux|explorer)\//.test(retour)) { location.href = new URL(retour, document.baseURI).href; return; }
    regarde = foyer().actif;
    tab = typeof versOnglet === 'string' ? versOnglet : 'jeux';
    regle = null; pileOnglets = [];
    // Chaque onglet laisse une trace dans l'historique : le retour du téléphone revient à l'onglet d'avant.
    try { history.replaceState({ ludiOnglet: tab }, ''); } catch (e) { /* rien */ }
    show('parent');
    synchroniser();
    var msg = null;
    try { msg = sessionStorage.getItem('ludiworld.toast'); sessionStorage.removeItem('ludiworld.toast'); } catch (e) { /* rien */ }
    if (msg === 'signedOut') noter(t('parent.signedOut'));
  }
  function fermerCarnet() {
    LudiBarre.fermerParent();
    LudiCatalogue.fermer();
    fermerQui();
    // L'appareil est rendu : plus rien à annuler d'ici (l'enfant ne doit pas défaire un réglage).
    journal = []; majJournal();
    regarde = null;
    show('enfant');
  }

  // « Qui joue ? » : les enfants du foyer, chacun avec son initiale sur sa couleur.
  // o : { titre, note, choisir(e) }. Sert à l'enfant (« Pas toi ? ») et au parent qui rend l'appareil.
  var quiDlg = document.getElementById('qui');
  function fermerQui() { if (quiDlg.open) { if (quiDlg.close) quiDlg.close(); else quiDlg.removeAttribute('open'); } }
  function ouvrirQui(o) {
    var h = foyer();
    quiDlg.textContent = '';
    quiDlg.appendChild(el('div', { class: 'qui-inner' }, [
      el('button', { type: 'button', class: 'gate-close', onclick: fermerQui }, [icon('cross'), el('span', { text: t('gate.cancel') })]),
      el('h2', { text: o.titre }),
      el('div', { class: 'qui-liste' }, h.enfants.map(function (e, i) {
        return el('button', { type: 'button', class: 'qui-enfant' + (e.id === h.actif ? ' on' : ''), onclick: function () { o.choisir(e); } },
          [el('span', { class: 'avatar', style: '--c:' + PAL[i % PAL.length], text: e.enfant.nom.charAt(0).toUpperCase() }), el('b', { text: e.enfant.nom })]);
      })),
      o.note ? el('p', { class: 'qui-note' }, [icon('lock'), o.note]) : null
    ]));
    if (!quiDlg.open) { if (quiDlg.showModal) quiDlg.showModal(); else quiDlg.setAttribute('open', ''); }
  }
  quiDlg.addEventListener('click', function (e) { if (e.target === quiDlg) fermerQui(); });
  // « Pas toi ? » : d'abord les prénoms ; si changer d'enfant demande le code, on le dit avant de le demander.
  document.getElementById('e-qui').addEventListener('click', function () {
    var h = foyer(), protege = h.protege !== false;
    function passer(e) {
      h.actif = e.id; saveStore();
      document.getElementById('e-jeux').classList.remove('calme'); renderEnfant();
    }
    ouvrirQui({ titre: t('kid.whoPlays'), note: protege ? t('kid.switchNeedsCode') : null, choisir: function (e) {
      fermerQui();
      if (e.id === h.actif) return;
      if (protege) openGate(function () { passer(e); }, null, t('gate.forKid', { n: e.enfant.nom }));
      else passer(e);
    } });
  });

  // =====================================================================
  // Portail parent : code à 4 chiffres (ou calcul d'adulte si oublié)
  // =====================================================================
  var gate = document.getElementById('gate');
  var gateFails = 0, gateLock = 0;
  // L'appareil est connecté à un compte : « Code oublié ? » peut demander son mot de passe (plan 3).
  function compteRelie() { return !!(Nuage && Nuage.actif() && Nuage.connecte() && Nuage.email() && Nuage.verifierMotDePasse); }
  function closeGate() { if (gate.open) { if (gate.close) gate.close(); else gate.removeAttribute('open'); } }
  // note : une phrase sous le titre (« Pour passer à Sacha. »).
  // Sur le serveur de dev de Julien (localhost:7357), le code parent n'est pas demandé (Julien, 2026-11-18).
  // Le banc d'essai remet le code avec window.LUDI_CODE_TOUJOURS.
  var DEV_SANS_CODE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port === '7357' && !window.LUDI_CODE_TOUJOURS;
  function openGate(onOk, mode, note) {
    if (DEV_SANS_CODE && !mode) { onOk(); return; }
    gate.textContent = '';
    var inner = el('div', { class: 'gate-inner' });
    var msg = el('p', { class: 'gate-msg', role: 'status' });
    inner.appendChild(el('button', { type: 'button', class: 'gate-close', onclick: closeGate }, [icon('cross'), el('span', { text: t('gate.cancel') })]));
    if (mode === 'forgot' && compteRelie()) {
      // Appareil relié à un compte (plan 3) : le mot de passe du compte, vérifié par Supabase comme à la connexion.
      // Il ne vit que le temps de l'appel : le champ est vidé aussitôt, rien n'est écrit sur l'appareil.
      // Juste : on choisit un nouveau code tout de suite. Faux : un message, rien d'autre ne change.
      // Pas de réseau, ou vérification impossible : l'attente habituelle de 30 minutes est proposée.
      inner.appendChild(el('h2', { text: t('gate.forgotTitle') }));
      inner.appendChild(el('p', { text: t('gate.pwText', { e: Nuage.email() }) }));
      var champ = el('input', { type: 'password', id: 'gate-mdp', class: 'gate-champ', autocomplete: 'current-password', 'aria-describedby': 'gate-mdp-msg' });
      var verifier = el('button', { type: 'submit', class: 'btn-sun', text: t('gate.pwGo') });
      var attendre = el('button', { type: 'button', class: 'lien gate-attendre', text: t('gate.pwWait'), hidden: true, onclick: function () { openGate(onOk, 'forgotWait'); } });
      msg.id = 'gate-mdp-msg';
      if (navigator.onLine === false) { msg.textContent = t('gate.pwOffline'); attendre.hidden = false; }
      inner.appendChild(el('form', { class: 'gate-mdp', onsubmit: function (e) {
        e.preventDefault();
        var mdp = champ.value;
        champ.value = '';
        if (!mdp) { champ.focus(); return; }
        verifier.disabled = true;
        msg.textContent = t('gate.pwChecking');
        Nuage.verifierMotDePasse(mdp).then(function () {
          if (gate.open) openGate(onOk, 'setPw');
        }, function (err) {
          verifier.disabled = false;
          var c = err && err.code;
          if (c === 'identifiants') { msg.textContent = t('gate.pwWrong'); champ.focus(); return; }
          msg.textContent = t(c === 'reseau' ? 'gate.pwOffline' : c === 'trop_de_demandes' ? 'gate.pwBusy' : 'gate.pwError');
          attendre.hidden = false;
        });
        mdp = null;
      } }, [
        el('input', { type: 'text', autocomplete: 'username', value: Nuage.email(), readonly: true, hidden: true, tabindex: '-1', 'aria-hidden': 'true' }),
        el('label', { for: 'gate-mdp', class: 'gate-label', text: t('gate.pwLabel') }),
        champ, msg, verifier
      ]));
      if (Nuage.envoyerCodeEmail) inner.appendChild(el('button', { type: 'button', class: 'lien gate-email', text: t('gate.mailLink'), onclick: function () { openGate(onOk, 'forgotMail'); } }));
      inner.appendChild(attendre);
      inner.appendChild(el('button', { type: 'button', class: 'lien', text: t('gate.cancel'), onclick: closeGate }));
    } else if (mode === 'forgotMail' && compteRelie()) {
      // Sans le mot de passe : un code à 6 chiffres envoyé à l'adresse du compte (montrée masquée), tapé ici.
      // Bon code : un nouveau code parent tout de suite. Rien n'est gardé sur l'appareil.
      inner.appendChild(el('h2', { text: t('gate.forgotTitle') }));
      var envoi = el('p', { class: 'gate-envoi', role: 'status', text: t('gate.mailSending') });
      inner.appendChild(envoi);
      var champCode = el('input', { type: 'text', id: 'gate-otp', class: 'gate-champ gate-otp', inputmode: 'numeric', autocomplete: 'one-time-code',
        maxlength: '6', pattern: '[0-9]{6}', spellcheck: 'false', 'aria-describedby': 'gate-otp-msg' });
      var verifCode = el('button', { type: 'submit', class: 'btn-sun', text: t('gate.pwGo') });
      var renvoyer = el('button', { type: 'button', class: 'lien gate-renvoyer', text: t('gate.mailResend'), disabled: true });
      var attendreMail = el('button', { type: 'button', class: 'lien gate-attendre', text: t('gate.pwWait'), hidden: true, onclick: function () { openGate(onOk, 'forgotWait'); } });
      msg.id = 'gate-otp-msg';
      var finAttente = 0, minuteur = null;
      function majRenvoyer() {
        var s = Math.ceil((finAttente - Date.now()) / 1000);
        if (s > 0 && gate.open) { renvoyer.disabled = true; renvoyer.textContent = t('gate.mailResendIn', { s: s }); return; }
        clearInterval(minuteur); minuteur = null;
        renvoyer.disabled = false; renvoyer.textContent = t('gate.mailResend');
      }
      var dejaEnvoye = false;
      function erreurMail(err) {
        var c = err && err.code;
        if (c === 'code') { msg.textContent = t('gate.mailWrong'); champCode.focus(); return; }
        msg.textContent = t(c === 'reseau' ? 'gate.mailOffline' : c === 'trop_de_demandes' ? 'gate.mailBusy' : 'gate.mailError');
        attendreMail.hidden = false;
      }
      function envoyer() {
        renvoyer.disabled = true;
        msg.textContent = '';
        envoi.textContent = t('gate.mailSending');
        Nuage.envoyerCodeEmail().then(function () {
          dejaEnvoye = true;
          envoi.textContent = t('gate.mailSent', { e: Nuage.emailMasque() });
          finAttente = Date.now() + 60000;
          if (!minuteur) minuteur = setInterval(majRenvoyer, 500);
          majRenvoyer();
          champCode.focus();
        }, function (err) {
          envoi.textContent = dejaEnvoye ? t('gate.mailSent', { e: Nuage.emailMasque() }) : '';
          erreurMail(err);
          renvoyer.disabled = false;
        });
      }
      renvoyer.onclick = envoyer;
      inner.appendChild(el('form', { class: 'gate-mdp', onsubmit: function (e) {
        e.preventDefault();
        var saisi = champCode.value.replace(/\s/g, '');
        champCode.value = '';
        if (!/^\d{6}$/.test(saisi)) { msg.textContent = saisi ? t('gate.mailWrong') : ''; champCode.focus(); return; }
        verifCode.disabled = true;
        msg.textContent = t('gate.pwChecking');
        Nuage.verifierCodeEmail(saisi).then(function () {
          if (minuteur) clearInterval(minuteur);
          if (gate.open) openGate(onOk, 'setPw');
        }, function (err) { verifCode.disabled = false; erreurMail(err); });
        saisi = null;
      } }, [
        el('label', { for: 'gate-otp', class: 'gate-label', text: t('gate.mailLabel') }),
        champCode, msg, verifCode
      ]));
      inner.appendChild(renvoyer);
      inner.appendChild(attendreMail);
      inner.appendChild(el('button', { type: 'button', class: 'lien', text: t('gate.cancel'), onclick: closeGate }));
      envoyer();
    } else if (mode === 'forgot' || mode === 'forgotWait' || mode === 'forgotMail') {
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
      if (compteRelie()) inner.appendChild(el('button', { type: 'button', class: 'lien', text: t('gate.pwInstead'), onclick: function () { openGate(onOk, 'forgot'); } }));
    } else if (mode === 'set' || mode === 'setPw') {
      var first = null;
      inner.appendChild(el('h2', { text: t('gate.forgotTitle') }));
      msg.textContent = t('hello.pinText');
      inner.appendChild(msg);
      inner.appendChild(pinPad(function (code, reset) {
        if (!first) { first = code; msg.textContent = t('hello.pinAgain'); reset(); return; }
        if (code !== first) { first = null; msg.textContent = t('hello.pinMismatch'); reset(true); return; }
        var f = foyer();
        if (f.reset || mode === 'setPw') { f.reset = null; f.codeChange = Date.now(); }
        f.pin = hash(code); f.maj = Date.now(); saveStore(); planifierSynchro(); closeGate(); onOk();
      }));
    } else {
      if (codePret()) { openGate(onOk, 'set'); return; }
      if (codeEnAttente()) { openGate(onOk, 'wait'); return; }
      inner.appendChild(el('img', { class: 'gate-img', src: 'img/marmotte-carnet.webp', alt: '' }));
      inner.appendChild(el('h2', { text: t('gate.title') }));
      if (note) inner.appendChild(el('p', { class: 'gate-note', text: note }));
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
    var champMdp = gate.querySelector('#gate-mdp') || gate.querySelector('#gate-otp');
    if (champMdp) setTimeout(function () { champMdp.focus(); }, 30);
  }
  gate.addEventListener('cancel', function (e) { e.preventDefault(); closeGate(); });
  gate.addEventListener('click', function (e) { if (e.target === gate) closeGate(); });

  // =====================================================================
  // Côté parent : une barre (enfants, Jeux / Temps / Réglages, rendre l'appareil) et la page de l'onglet
  // =====================================================================
  var tab = 'jeux';
  var ajout = null; // le petit formulaire « Ajouter un enfant » : { nom, age }, ou null s'il est fermé
  var regle = null; // le jeu dont la ligne montre ses réglages (« Régler »), un seul à la fois
  var pileOnglets = []; // les onglets d'avant, pour le retour du téléphone (la fiche ou un jeu ajoutent aussi des pas d'historique)

  // ---------- « Changé : … Annuler » ----------
  // Les trois derniers changements de la visite, chacun avec son « Annuler », 15 secondes chacun.
  // La ligne vit dans la barre (en bas sur téléphone, sous les onglets ailleurs) et dans la fiche d'un jeu ouverte :
  // elle ne se pose jamais sur un bouton. Chaque ligne ne défait que son propre changement.
  var JOURNAL_MAX = 3, JOURNAL_DUREE = 15000, INFO_DUREE = 4000;
  var journal = [];  // { texte, quoi, ops (null : simple message), vu, fin }
  var journalTimer = null;
  function copie(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function estObjet(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function cleChemin(c) { return c.map(function (s) { return typeof s === 'object' ? '#' + s.id : s; }).join('/'); }
  // Ce qu'un changement a touché : la liste des chemins, avec la valeur d'avant et d'après (les enfants repérés par leur id).
  function ecarts(a, b, chemin, out) {
    if (JSON.stringify(a) === JSON.stringify(b)) return out;
    if (chemin[chemin.length - 1] === 'enfants' && Array.isArray(a) && Array.isArray(b)) {
      var ids = [];
      a.concat(b).forEach(function (e) { if (ids.indexOf(e.id) === -1) ids.push(e.id); });
      ids.forEach(function (id) {
        var ea = a.filter(function (e) { return e.id === id; })[0], eb = b.filter(function (e) { return e.id === id; })[0];
        ecarts(ea, eb, chemin.concat([{ id: id, rang: ea ? a.indexOf(ea) : b.indexOf(eb) }]), out);
      });
      return out;
    }
    if (estObjet(a) && estObjet(b)) {
      var cles = Object.keys(a);
      Object.keys(b).forEach(function (k) { if (cles.indexOf(k) === -1) cles.push(k); });
      cles.forEach(function (k) { if (k !== 'maj') ecarts(a[k], b[k], chemin.concat([k]), out); });
      return out;
    }
    out.push({ chemin: chemin, avant: copie(a), apres: copie(b) });
    return out;
  }
  function poserChemin(o, chemin, v) {
    for (var i = 0; i < chemin.length - 1; i++) {
      var s = chemin[i];
      if (typeof s === 'object') { o = o.filter(function (e) { return e.id === s.id; })[0]; if (!o) return; continue; }
      if (o[s] === undefined || o[s] === null) { if (v === undefined) return; o[s] = typeof chemin[i + 1] === 'object' ? [] : {}; }
      o = o[s];
    }
    var d = chemin[chemin.length - 1];
    if (typeof d === 'object') { // un enfant entier, ajouté ou retiré
      var j = -1;
      o.forEach(function (e, k) { if (e.id === d.id) j = k; });
      if (v === undefined) { if (j !== -1) o.splice(j, 1); } else if (j === -1) o.splice(Math.min(d.rang, o.length), 0, copie(v)); else o[j] = copie(v);
      return;
    }
    if (v === undefined) delete o[d]; else o[d] = copie(v);
  }
  // Un nouveau message. ops : ce que le changement a touché (null pour un simple message, sans « Annuler »).
  function noter(texte, ops, o) {
    o = o || {};
    if (ops) {
      // Un réglage déjà changé dans une ligne d'avant : la nouvelle ligne remet l'état d'avant la première, l'ancienne s'efface.
      journal.forEach(function (e) {
        if (!e.ops) return;
        e.ops = e.ops.filter(function (vieux) {
          var meme = ops.filter(function (n) { return cleChemin(n.chemin) === cleChemin(vieux.chemin); })[0];
          if (meme) meme.avant = vieux.avant;
          return !meme;
        });
      });
      journal = journal.filter(function (e) { return !e.ops || e.ops.length; });
      ops = ops.filter(function (n) { return JSON.stringify(n.avant) !== JSON.stringify(n.apres); });
      if (!ops.length) { texte = t('parent.nothingChanged', { c: o.quoi }); ops = null; }
    }
    journal.unshift({ texte: texte, quoi: o.quoi, ops: ops, vu: o.vu, fin: Date.now() + (ops ? JOURNAL_DUREE : INFO_DUREE) });
    journal = journal.slice(0, JOURNAL_MAX);
    majJournal(true);
  }
  function annulerLigne(e) {
    journal = journal.filter(function (x) { return x !== e; });
    var h = store.famille;
    e.ops.slice().reverse().forEach(function (op) { poserChemin(h, op.chemin, op.avant); });
    if (h.enfants.some(function (x) { return x.id === e.vu; })) regarde = e.vu;
    if (!h.enfants.some(function (x) { return x.id === h.actif; })) h.actif = h.enfants[0].id;
    enregistrer();
    noter(t('parent.undone', { c: e.quoi }));
    redessiner();
  }
  function remplirJournal(n) {
    n.textContent = '';
    var lignes = n.hasAttribute('data-une') ? journal.slice(0, 1) : journal; // dans la fiche : la dernière ligne seulement
    lignes.forEach(function (e) {
      n.appendChild(el('p', { class: 'pa-journal-ligne' + (e.ops ? '' : ' info') }, [
        el('span', { text: e.texte }),
        e.ops ? el('button', { type: 'button', class: 'pa-journal-annuler', onclick: function () { annulerLigne(e); } }, [t('parent.undo')]) : null
      ]));
    });
    n.hidden = !journal.length;
    return n;
  }
  // La ligne dans la fiche d'un jeu (la barre est derrière la fiche, on ne pourrait pas la toucher) : la dernière seulement.
  function hoteJournal() { return remplirJournal(el('div', { class: 'pa-journal pa-journal-fiche', role: 'status', 'data-une': true })); }
  var dernierToucher = null;
  document.addEventListener('pointerdown', function (ev) { dernierToucher = ev.clientY; }, true);
  function majJournal(nouveau) {
    var maintenant = Date.now();
    journal = journal.filter(function (e) { return e.fin > maintenant; });
    var bas = document.querySelector('.pa-bas'), avant = bas ? bas.getBoundingClientRect() : null;
    Array.prototype.forEach.call(document.querySelectorAll('.pa-journal'), remplirJournal);
    clearTimeout(journalTimer);
    if (journal.length) journalTimer = setTimeout(majJournal, Math.min.apply(null, journal.map(function (e) { return e.fin; })) - maintenant + 30);
    // Sur téléphone, la barre du bas grandit : ce qu'on vient de toucher ne doit pas passer dessous.
    if (nouveau && bas && vue === 'parent' && dernierToucher !== null && getComputedStyle(bas).position === 'fixed') {
      var haut = bas.getBoundingClientRect().top;
      if (haut < avant.top && dernierToucher > haut - 12) window.scrollBy(0, dernierToucher - haut + 24);
    }
  }
  // Le dernier réglage fait foi d'un appareil à l'autre : on note quand il a changé.
  function marquer() { var h = foyer(), f = fam(); if (h) h.maj = Date.now(); if (f) f.maj = Date.now(); }
  function enregistrer() { marquer(); saveStore(); planifierSynchro(); }
  // Un réglage change : on l'enregistre tout de suite, on redessine, et « Changé : … Annuler » reste 15 secondes.
  // o.nom : l'enfant concerné s'il n'est pas celui qu'on regarde ; o.maison : un réglage de la maison (on ne nomme personne).
  function changer(quoi, fn, o) {
    o = o || {};
    var avant = copie(store.famille), vu = regarde;
    var nom = o.nom || (fam() && fam().enfant.nom);
    fn();
    var ops = ecarts(avant, store.famille, [], []);
    enregistrer();
    var plusieurs = foyer().enfants.length > 1 || avant.enfants.length > 1;
    noter(!o.maison && plusieurs ? t('parent.changedFor', { n: nom, c: quoi }) : t('parent.changed', { c: quoi }), ops, { quoi: quoi, vu: vu });
    redessiner();
  }
  function enfantParId(id) { return foyer().enfants.filter(function (e) { return e.id === id; })[0] || null; }
  function redessiner() {
    if (vue !== 'parent') return;
    var y = window.scrollY;
    renderParent();
    window.scrollTo(0, y);
    var g = LudiCatalogue.ouverte();
    if (g && byId[g.id]) openFiche(byId[g.id]);
  }
  // La place que prend la barre du bas (téléphone), pour que la fin de la page passe au-dessus.
  if (window.ResizeObserver) new ResizeObserver(function (l) {
    document.documentElement.style.setProperty('--pa-bas', Math.round(l[0].target.offsetHeight) + 'px');
  }).observe(document.querySelector('.pa-bas'));

  // ---------- Copie en ligne (seulement si le parent l'a activée dans son compte) ----------
  // Pas d'envoi pendant une partie active. L'écran de fin peut synchroniser sans attendre un bouton.
  var Nuage = window.LudiNuage;
  var minuteurSynchro = null;

  // ---------- Statistiques d'usage (décision de Julien du 2026-11-23 ; docs/usage.js, spec/donnees.md) ----------
  // Sans nom, envoyées hors des parties. Le parent peut refuser dans Réglages (foyer().mesures === false, pour toute la maison).
  function mesuresPermises() { var h = foyer(); return !(h && h.mesures === false); }
  // Le serveur de dev de Julien n'envoie rien à la vraie base (le banc d'essai, lui, pose LUDI_NUAGE).
  var usageEnvoi = !!(Nuage && Nuage.noterUsage) && !(/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !window.LUDI_NUAGE);
  var versionAppli = '';
  try { if (window.caches) caches.keys().then(function (k) { var v = k.filter(function (x) { return /^ludiworld-/.test(x); }).sort().pop(); if (v) versionAppli = v.replace(/^ludiworld-/, ''); }).catch(function () {}); } catch (e) { /* rien */ }
  var Usage = window.LudiUsage ? window.LudiUsage.creer({
    stockage: window.localStorage,
    aleatoire: function (n) { var b = new Uint8Array(n); window.crypto.getRandomValues(b); return b; },
    permis: mesuresPermises,
    contexte: function () { var f = fam(); return { age: f && f.enfant ? f.enfant.age : null, format: genreAppareil(), langue: lang, version: versionAppli }; },
    envoyer: function (lot, o) { if (!usageEnvoi || !Nuage.actif()) return Promise.reject(new Error('pas maintenant')); return Nuage.noterUsage(lot, o); }
  }) : null;
  function noterUsage(evt, g, details) { if (Usage) try { Usage.noter(evt, g ? (typeof g === 'string' ? g : g.id) : null, details); } catch (e) { /* rien */ } }
  // Jamais pendant une partie en cours : l'écran de fin, oui.
  function envoyerUsage(o) { if (Usage && !(playing && playing.phase !== 'arrete')) Usage.envoyer(o); }
  setTimeout(envoyerUsage, 4000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) envoyerUsage({ keepalive: true }); });
  function synchroVoulue() { return !!(Nuage && Nuage.actif() && Nuage.connecte() && (Nuage.appareilAutorise() || (Nuage.liaisonDemandee() && LudiBarre.parentOuvert()))); }
  // Ce qu'on dit au parent : la copie est active seulement si le compte l'a choisie et que cet appareil y est relié.
  function copieActive() { return !!(Nuage && Nuage.actif() && Nuage.connecte() && Nuage.synchroLocale()); }
  var synchroEnCours = null;
  var synchroARelancer = false;
  function saisieEnCours() {
    var a = document.activeElement;
    return !!(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.closest('#pa-page'));
  }
  function synchroniser() {
    if (!synchroVoulue() || (playing && playing.phase !== 'arrete') || !foyer()) return;
    if (synchroEnCours) { synchroARelancer = true; return synchroEnCours; }
    synchroEnCours = Nuage.lierAppareil(foyer()).then(function (m) {
      if (!m || (playing && playing.phase !== 'arrete')) return;
      store.famille = LudiSynchro.fusionner(store.famille, m);
      saveStore();
      if (vue === 'enfant') render();
      else if (vue === 'parent' && !saisieEnCours()) redessiner();
    }).catch(function () { /* hors ligne : on réessaiera, l'appareil garde tout */ }).then(function () {
      synchroEnCours = null;
      if (synchroARelancer) { synchroARelancer = false; planifierSynchro(); }
    });
    return synchroEnCours;
  }
  function planifierSynchro() {
    if (!synchroVoulue()) return;
    clearTimeout(minuteurSynchro);
    minuteurSynchro = setTimeout(synchroniser, 1500);
  }

  // ---------- La barre ----------
  // Quatre onglets à plat (Julien, 2026-11-18) : Mes jeux · Tous les jeux · Temps · Réglages.
  var ONGLETS = [['jeux', 'grid'], ['catalogue', 'vitrine'], ['temps', 'hourglass'], ['reglages', 'gear']];
  function renderParent() {
    var h = foyer();
    if (!h || !h.enfants.length) { show('accueil'); return; }
    if (!h.enfants.some(function (e) { return e.id === regarde; })) regarde = h.actif;
    var f = fam();
    enteteParent();
    var kids = document.getElementById('pa-enfants');
    kids.textContent = '';
    kids.setAttribute('aria-label', t('parent.kidsLabel'));
    kids.hidden = h.enfants.length < 2;
    h.enfants.forEach(function (e, i) {
      var on = e.id === f.id;
      kids.appendChild(el('button', { type: 'button', 'aria-pressed': String(on), class: on ? 'on' : '', onclick: function () { regarde = e.id; ajout = null; regle = null; renderParent(); window.scrollTo(0, 0); } }, [
        el('span', { class: 'avatar', style: '--c:' + PAL[i % PAL.length], text: e.enfant.nom.charAt(0).toUpperCase() }), el('span', { class: 'pa-enfant-nom', text: e.enfant.nom })
      ]));
    });
    var nav = document.getElementById('pa-onglets');
    nav.textContent = '';
    ONGLETS.forEach(function (o) {
      nav.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === o[0]), class: tab === o[0] ? 'on' : '', 'data-onglet': o[0], onclick: function () {
        allerOnglet(o[0]);
      } }, [icon(o[1]), el('span', { text: t('parent.tabs.' + o[0]) })]));
    });
    document.querySelector('#pa-rendre span').textContent = t('parent.giveBack.' + genreAppareil());
    var page = document.getElementById('pa-page');
    page.textContent = '';
    if (tab === 'temps') page.appendChild(pageTemps(f));
    else if (tab === 'reglages') page.appendChild(pageReglages(f));
    else if (tab === 'catalogue') page.appendChild(pageTous(f));
    else page.appendChild(pageJeux(f));
    ajusterBandeau();
  }
  // Une seule ligne si tout y tient ; sinon les onglets passent dessous, dans le même bandeau (pas sur téléphone : ils sont en bas).
  function ajusterBandeau() {
    var barre = document.querySelector('.pa-barre');
    if (!barre || vue !== 'parent') return;
    barre.classList.remove('pa-deux-lignes');
    if (window.innerWidth <= 700) return;
    var tabs = document.querySelectorAll('#pa-onglets button');
    if (!tabs.length) return;
    var fin = tabs[tabs.length - 1].getBoundingClientRect().right;
    var kids = document.getElementById('pa-enfants');
    var qui = document.getElementById('pa-qui');
    var suite = !kids.hidden && kids.children.length ? kids.children[0].getBoundingClientRect().left : qui.children.length ? qui.getBoundingClientRect().left : document.getElementById('pa-rendre').getBoundingClientRect().left;
    var debut = tabs[0].getBoundingClientRect().left, logo = document.getElementById('pa-logo').getBoundingClientRect().right;
    if (fin > suite - 8 || debut < logo || tabs[0].getBoundingClientRect().height > 60) barre.classList.add('pa-deux-lignes');
  }
  window.addEventListener('resize', function () { if (vue === 'parent') ajusterBandeau(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajusterBandeau);
  // Un seul bandeau (Julien, 2026-11-18) : le logo Ludiworld (bouton vers l'accueil du site), à la place de « Parents »
  // la pastille « Connecté » du compte (sans compte : « Parents » et « Se connecter »), puis les onglets, sur une ligne.
  // Pas de FR / EN ici (Julien, 2026-11-18) : la langue se change dans Réglages.
  function enteteParent() {
    var p = LudiBarre.appli({ base: '', lang: lang, onLang: setLang });
    function poser(id, kids) { var n = document.getElementById(id); n.textContent = ''; kids.forEach(function (k) { if (k) n.appendChild(k); }); }
    poser('pa-logo', [p.marque]);
    // À droite, à côté de « Côté enfant », le même bouton que sur le site : la pastille entière, ou « Se connecter » (Julien, 2026-11-18).
    poser('pa-qui', [p.qui || p.connexion]);
  }
  // Changer d'onglet laisse une trace dans l'historique (le retour du téléphone y revient). ancre : un bloc où aller.
  function allerOnglet(o, ancre) {
    if (o !== tab) { pileOnglets.push(tab); try { history.pushState({ ludiOnglet: o }, ''); } catch (e) { /* rien */ } }
    tab = o; ajout = null; regle = null;
    renderParent();
    var cible = ancre && document.getElementById(ancre);
    if (cible) cible.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0);
    synchroniser();
  }
  // Rendre l'appareil : avec plusieurs enfants, on choisit à qui (regarder un enfant ne le fait pas jouer).
  document.getElementById('pa-rendre').addEventListener('click', function () {
    var h = foyer();
    if (h.enfants.length < 2) { fermerCarnet(); return; }
    ouvrirQui({ titre: t('parent.giveWho'), choisir: function (e) { h.actif = e.id; saveStore(); fermerCarnet(); } });
  });

  function bloc(titre, kids, cls) { return el('section', { class: 'pa-bloc ' + (cls || '') }, [titre ? el('h2', { class: 'pa-bloc-titre', text: titre }) : null].concat(kids)); }
  function bouton(cls, texte, ico, onclick, attrs) {
    var a = { type: 'button', class: cls, onclick: onclick };
    Object.keys(attrs || {}).forEach(function (k) { a[k] = attrs[k]; });
    return el('button', a, [ico ? icon(ico) : null, texte]);
  }

  // =====================================================================
  // Onglet Mes jeux : ses demandes, aujourd'hui, ses jeux, puis (replié) ses jeux rangés
  // =====================================================================
  function pageJeux(f) {
    var out = el('div', { class: 'pa-jeux' });
    var h = foyer();
    if (h.codeChange && Date.now() - h.codeChange < 7 * 24 * 3600 * 1000) {
      out.appendChild(el('p', { class: 'alerte' }, [icon('warn'), t('parent.codeChanged', { d: new Date(h.codeChange).toLocaleString(lang, { weekday: 'long', hour: '2-digit', minute: '2-digit' }) })]));
    }
    // En haut, s'il y en a : « Malo voudrait : Pluie de Cochons », Installer ou Pas maintenant. Une ligne par demande.
    var dem = demandes(f);
    if (dem.length) {
      out.appendChild(el('ul', { class: 'pa-demandes' }, dem.map(function (g) {
        return el('li', { class: 'pa-demande', 'data-demande': g.id }, [
          el('button', { type: 'button', class: 'pa-demande-jeu', onclick: function () { openFiche(g); } }, [
            LudiCatalogue.icone(g, 40),
            el('span', { class: 'pa-demande-txt' }, [icon('main'), t('parent.wants', { n: f.enfant.nom, g: pick(g.title) })])
          ]),
          el('span', { class: 'pa-demande-actions' }, [
            bouton('btn-sun pa-installer', t('parent.wantsInstall'), 'plus', function () { installer(f.id, g); }, { 'data-installer': g.id, 'data-enfant': f.id }),
            bouton('btn-ghost pa-pas-maintenant', t('parent.notNow'), null, function () { pasMaintenant(f.id, g); }, { 'data-pas-maintenant': g.id })
          ])
        ]);
      })));
    }
    out.appendChild(carteDuJour(f));

    // Ses jeux : le plus joué sur 7 jours d'abord. Les jeux rangés n'y sont pas (ils sont tout en bas, repliés).
    var mine = mesJeux().sort(function (a, b) { return weekMs(b.id) - weekMs(a.id) || pick(a.title).localeCompare(pick(b.title)); });
    var titre = t('parent.gamesOf', { de: nomDe(f.enfant.nom), n: f.enfant.nom, k: mine.length });
    var kids = [mine.length ? el('ul', { class: 'pa-lignes' }, mine.map(function (g) { return ligneJeu(f, g); })) : el('div', { class: 'pa-vide' }, [
      el('p', { text: t('parent.noGames') }),
      bouton('btn-ink pa-btn pa-voir-tout', t('parent.seeAll'), 'vitrine', function () { allerOnglet('catalogue'); })
    ])];
    var retires = games.filter(function (g) { return !choix(g.id) && weekMs(g.id) >= 30000; });
    if (retires.length) kids.push(el('p', { class: 'pa-note', text: t('parent.removedPlayed', { l: retires.map(function (g) { return pick(g.title) + ' (' + duration(weekMs(g.id)) + ')'; }).join(', ') }) }));
    // Tout en bas, replié : « Rangés (2) », avec « Ressortir » sur chacun. Rien n'a été effacé.
    var rg = ranges();
    if (rg.length) {
      var plie = el('details', { class: 'pa-plie pa-ranges' }, [
        el('summary', { text: t('parent.stored', { k: rg.length }) }),
        el('ul', { class: 'pa-lignes' }, rg.map(function (g) {
          var et = (S()[g.id] || {}).etat || {};
          return el('li', { class: 'pa-ligne pa-ligne-rangee', 'data-jeu': g.id }, [
            el('button', { type: 'button', class: 'pa-ligne-jeu', onclick: function () { openFiche(g); } }, [
              LudiCatalogue.icone(g, 40),
              el('span', { class: 'pa-ligne-nom' }, [el('b', { text: pick(g.title) }), et.fini ? marqueFini() : null])
            ]),
            bouton('btn-ghost pa-ressortir', t('parent.takeOut'), null, function () { ressortir(f.id, g); }, { 'data-ressortir': g.id })
          ]);
        }))
      ]);
      plie.open = rangesOuverts;
      plie.addEventListener('toggle', function () { rangesOuverts = plie.open; });
      kids.push(plie);
    }
    out.appendChild(bloc(titre, kids, 'pa-ses-jeux'));
    if (catalogueOk === false) out.appendChild(el('p', { class: 'erreur', text: t('loadError') }));
    return out;
  }
  var rangesOuverts = false; // « Rangés » reste ouvert tant qu'on ne le referme pas (un réglage redessine la page)

  // =====================================================================
  // Onglet Tous les jeux : tout le catalogue, toujours, même quand tout est installé.
  // Les nouveaux d'abord (le plus récent en tête), puis ceux de l'âge de l'enfant, puis les autres.
  // =====================================================================
  function pageTous(f) {
    var out = el('div', { class: 'pa-tous' });
    var neufs = games.filter(function (g) { return LudiCatalogue.nouveau(g); }).sort(function (a, b) { return a.added < b.added ? 1 : a.added > b.added ? -1 : 0; });
    var reste = games.filter(function (g) { return neufs.indexOf(g) === -1; });
    var ordre = neufs.concat(reste.filter(function (g) { return pourAge(g, f.enfant.age); }), reste.filter(function (g) { return !pourAge(g, f.enfant.age); }));
    out.appendChild(el('h1', { class: 'pa-titre', text: t('parent.allTitle', { k: games.length }) }));
    out.appendChild(el('p', { class: 'pa-note pa-tous-note', text: t('parent.allNote', { n: f.enfant.nom }) }));
    if (catalogueOk === false) { out.appendChild(el('p', { class: 'erreur', text: t('loadError') })); return out; }
    out.appendChild(el('div', { class: 'pa-decouvrir pa-tous-grille' }, ordre.map(function (g) {
      return LudiCatalogue.miniFiche(g, { lang: lang, nouveau: neufs.indexOf(g) !== -1, actions: etatPour(f, g), onOuvrir: openFiche });
    })));
    return out;
  }
  // L'état d'un jeu pour l'enfant regardé, sur sa mini-fiche : « ✓ Installé pour Malo », « Rangé », « Malo le voudrait », ou « Installer pour Malo ».
  function etatPour(f, g) {
    var c = f.jeux && f.jeux[g.id];
    if (c && !c.range) return [el('span', { class: 'pa-etat pa-etat-installe' }, [icon('check'), t('parent.ficheInstalled', { n: f.enfant.nom })])];
    if (c) return [el('span', { class: 'pa-etat pa-etat-range' }, [icon('boite'), t('parent.stStored')]),
      bouton('btn-ghost pa-ressortir', t('parent.takeOut'), null, function () { ressortir(f.id, g); }, { 'data-ressortir': g.id })];
    return [demande(f, g.id) ? el('span', { class: 'pa-etat pa-etat-demande' }, [icon('main'), t('parent.stWants', { n: f.enfant.nom })]) : null, boutonInstaller(f, g)].filter(Boolean);
  }

  // La carte du jour : l'état vrai du moment, calculé comme côté enfant. Un bouton sans effet n'est pas montré.
  function carteDuJour(f) {
    var r = regles(), k = Temps.cleJour(), nom = f.enfant.nom;
    var joue = dayMs();
    var habituel = Temps.minutesDuJour(Temps.regles(Object.assign({}, r, { bonus: null, fini: null })));
    var tot = Temps.minutesDuJour(r);
    var bonus = r.bonus && r.bonus.jour === k ? r.bonus.min : 0;
    var arrete = r.fini === k, hors = arrete ? null : Temps.horsPlage(r), attente = codeEnAttente();
    var rd = resteDuJour();
    var enVac = r.vacances && r.vacances >= Temps.iso(new Date());
    var meta = [t('parent.today'), enVac ? t('parent.holidayDay') : t('daysLong')[new Date().getDay()],
      habituel === null ? t('parent.noLimitDay') : bonus ? t('parent.plannedBonus', { m: duration(habituel * MIN), b: bonus }) : t('parent.planned', { m: duration(habituel * MIN) })].join(' · ');
    var etat, ico = 'sun', notes = [];
    if (attente) { etat = t('parent.waitCode'); ico = 'lock'; }
    else if (arrete) { etat = t('parent.stopped'); ico = 'moon'; }
    else if (hors === 'apres') { etat = t('parent.closedSince', { h: heure(Temps.finPlage(r)) }); ico = 'moon'; }
    else if (hors === 'avant') {
      // Avant l'ouverture, on dit aussi ce qu'il restera : pas de calcul à faire de tête.
      var restera = tot === null ? null : tot * MIN - joue;
      etat = t(restera === null ? 'parent.opensAt' : restera > 0 ? 'parent.opensAtLeft' : 'parent.opensAtNone', { h: heure(r.heures.debut), t: restera > 0 ? minutesLeft(restera) : '' });
      ico = 'moon';
    }
    else if (tot === null) etat = t('parent.leftNoLimit');
    else if (rd.total <= 0) { etat = t('parent.usedUp'); ico = 'moon'; }
    else etat = t('parent.left', { t: minutesLeft(rd.total) });
    var ouvert = !attente && !arrete && hors !== 'apres';
    var lienHeures = null;
    if (r.heures && !attente && !arrete) {
      var finCeSoir = Temps.finPlage(r);
      notes.push(t(finCeSoir !== r.heures.fin ? 'parent.hoursTonight' : 'parent.hoursLine', { a: heure(r.heures.debut), b: heure(r.heures.fin), c: heure(finCeSoir) }));
      if (hors) lienHeures = el('button', { type: 'button', class: 'lien pa-vers-heures', text: t('parent.toHours'), onclick: function () { allerOnglet('temps', 'pa-heures'); } });
    }
    if (ouvert && rd.total > 0 && choisis().length && !choisis().some(function (g) { return resteJeu(g.id).jeu > 0; })) notes.push(t('parent.noGameOpen'));

    var actions = [];
    if (arrete && !attente) actions.push(bouton('btn-ink', t('parent.reopen'), 'sun', function () { f.regles.fini = null; jour(); }));
    // « +10 min » donne vraiment 10 minutes, même après l'heure de fin (pour aujourd'hui seulement : les heures réglées ne changent pas).
    if (!attente && !arrete && (tot !== null || (r.heures && hors !== 'avant'))) actions.push(bouton('btn-ink', t('parent.plus10'), 'plus', function () {
      Object.keys(f.jeux).forEach(function (id) { if (f.jeux[id].fini === k) f.jeux[id].fini = null; });
      f.regles.bonus = Temps.rallonge(f.regles, { joueTotal: dayMs(), minutes: 10 });
      jour();
    }, { 'data-action': 'plus10' }));
    if (ouvert && (tot === null || rd.total > 0 || hors === 'avant')) actions.push(bouton('btn-ghost', t('parent.stopToday'), 'moon', function () { f.regles.fini = k; jour(); }, { 'data-action': 'stop' }));
    if (bonus > 0 && !arrete) actions.push(el('button', { type: 'button', class: 'lien pa-annuler-bonus', text: t('parent.undoBonus', { b: bonus }), onclick: function () { f.regles.bonus = null; jour(); } }));
    // Le changement se lit en gros dans la carte : pas de message en plus.
    function jour() { enregistrer(); redessiner(); }

    var jauge = null;
    if (habituel !== null) {
      var prevu = (habituel + bonus) * MIN, plein = Math.max(prevu, joue, 1);
      jauge = el('div', { class: 'pa-jauge', role: 'img', 'aria-label': duration(joue) + ' / ' + duration(prevu) }, [
        el('span', { class: 'pa-jauge-joue', style: 'width:' + (joue / plein * 100).toFixed(1) + '%' })
      ]);
    }
    return el('section', { class: 'pa-jour' + (ico === 'moon' || ico === 'lock' ? ' ferme' : ''), 'aria-label': t('parent.today') }, [
      el('p', { class: 'pa-jour-meta', text: meta }),
      el('p', { class: 'pa-jour-joue', text: joue >= 30000 ? t('parent.played', { n: nom, t: duration(joue) }) : t('parent.notPlayed', { n: nom }) }),
      el('p', { class: 'pa-jour-etat', role: 'status' }, [icon(ico), etat]),
      jauge
    ].concat(notes.map(function (n, i) { return el('p', { class: 'pa-note' }, [n, i === 0 && lienHeures ? ' ' : null, i === 0 ? lienHeures : null]); }))
      .concat([actions.length ? el('div', { class: 'pa-actions pa-jour-actions' }, actions) : null]));
  }

  // La limite par jour et « certains jours seulement » d'un jeu : sous sa ligne (« Régler ») et dans sa fiche.
  function reglagesJeu(f, g) {
    var c = choix(g.id), nomJeu = pick(g.title), id = 'lim-' + g.id + '-' + Math.random().toString(36).slice(2, 7);
    var sel = el('select', { id: id }, LIMITES_JEU.map(function (m) {
      return el('option', { value: m === null ? '' : String(m), selected: c.max === m, text: m === null ? t('parent.noLimitGame') : t('min', { n: m }) });
    }));
    sel.addEventListener('change', function () {
      var v = sel.value ? Number(sel.value) : null;
      changer(v === null ? t('parent.limitOff', { g: nomJeu }) : t('parent.limitSet', { g: nomJeu, l: t('min', { n: v }) }), function () { choix(g.id).max = v; });
    });
    var cb = el('input', { type: 'checkbox', checked: !!c.libres });
    cb.addEventListener('change', function () {
      var v = cb.checked;
      changer(t(v ? 'parent.freeOnlySet' : 'parent.freeOnlyOff', { g: nomJeu }), function () { choix(g.id).libres = v; });
    });
    return el('div', { class: 'pa-regl' }, [
      el('label', { class: 'pa-limite', for: id }, [t('parent.gameLimit')]), sel,
      el('label', { class: 'pa-case' }, [cb, el('span', { text: certainsJours() })])
    ]);
  }
  // « Certains jours seulement : le mercredi, le samedi et le dimanche » (les jours choisis de l'enfant regardé).
  function certainsJours() {
    var j = joursPhrase(regles().joursLibres);
    return j ? t('parent.freeOnlyDays', { j: j }) : t('parent.freeOnly');
  }
  function marqueFini() { return el('span', { class: 'pa-fini' }, [icon('check'), t('parent.finished')]); }
  // Ce qu'on y apprend, en quelques mots (le module du catalogue le dit ; sinon les deux premières notions de la fiche).
  function sujets(g) {
    if (typeof LudiCatalogue.sujets === 'function') {
      try { var s = LudiCatalogue.sujets(g, lang); if (s) return s; } catch (e) { /* le module dira mieux plus tard */ }
    }
    return ((g.learning && g.learning.domains) || []).slice(0, 2).map(function (d) { return LudiCatalogue.notion(d, lang); }).filter(Boolean).join(', ');
  }
  // Une ligne serrée par jeu : icône, nom, « Fini », ce qu'on y apprend, le temps, et seulement les réglages qui sortent de l'ordinaire.
  // « Régler » déplie la limite et la case sur place (un jeu à la fois).
  function ligneJeu(f, g) {
    var c = choix(g.id), et = (S()[g.id] || {}).etat || {};
    var auj = dayMs(g.id), sem = weekMs(g.id);
    var temps = [auj >= 30000 ? t('parent.todayShort', { t: duration(auj) }) : null, sem >= 30000 ? t('parent.weekShort', { t: duration(sem) }) : t('parent.notPlayed7')].filter(Boolean).join(' · ');
    var ferme = null, fermeLibres = c.libres && !Temps.jourLibre(regles());
    if (fermeLibres) ferme = joursPhrase(regles().joursLibres) ? t('parent.closedFree', { j: joursPhrase(regles().joursLibres) }) : t('parent.freeOnly');
    else if (c.fini === Temps.cleJour() || (c.max && resteJeu(g.id).jeu <= 0)) ferme = t('parent.closedLimit');
    var reglages = [];
    if (c.max) reglages.push(t('parent.perDayWords', { m: t('min', { n: c.max }) }));
    if (c.libres && !fermeLibres) reglages.push(certainsJours());
    var ouverte = regle === g.id, su = sujets(g);
    return el('li', { class: 'pa-ligne' + (ouverte ? ' ouverte' : ''), 'data-jeu': g.id }, [
      el('button', { type: 'button', class: 'pa-ligne-jeu', onclick: function () { openFiche(g); } }, [
        LudiCatalogue.icone(g, 44),
        el('span', { class: 'pa-ligne-txt' }, [
          el('span', { class: 'pa-ligne-haut' }, [
            el('span', { class: 'pa-ligne-nom' }, [el('b', { text: pick(g.title) }), et.fini ? marqueFini() : null]),
            su ? el('span', { class: 'pa-ligne-sujets' }, [icon('book'), su]) : null
          ]),
          el('span', { class: 'pa-ligne-temps' }, [temps, reglages.length ? ' · ' : null, reglages.length ? el('b', { class: 'pa-ligne-regle', text: reglages.join(' · ') }) : null]),
          ferme ? el('span', { class: 'pa-ligne-ferme' }, [icon('moon'), ferme]) : null
        ])
      ]),
      el('button', { type: 'button', class: 'pa-regler', 'aria-expanded': String(ouverte), 'aria-controls': 'regl-' + g.id, onclick: function () {
        regle = ouverte ? null : g.id;
        redessiner();
        var b = document.querySelector('.pa-ligne[data-jeu="' + g.id + '"] .pa-regler');
        if (b) b.focus({ preventScroll: true });
      } }, [t('parent.adjust'), icon('chevron')]),
      ouverte ? el('div', { class: 'pa-ligne-regl', id: 'regl-' + g.id }, [
        reglagesJeu(f, g),
        bouton('btn-ghost pa-ranger', t('parent.putAway'), 'boite', function () { ranger(f.id, g); }, { 'data-ranger': g.id })
      ]) : null
    ]);
  }
  // Installer ou retirer, pour un enfant (pas forcément celui qu'on regarde). Un jeu retiré garde ses réglages
  // avec l'enfant (jeuxRetires, qui suit la copie en ligne) : le réinstaller les retrouve.
  function installer(id, g) {
    var e = enfantParId(id);
    changer(t('parent.installed', { g: pick(g.title), n: e.enfant.nom }), function () {
      var k = enfantParId(id), garde = k.jeuxRetires && k.jeuxRetires[g.id];
      k.jeux[g.id] = garde || { max: null };
      if (garde) { delete k.jeuxRetires[g.id]; delete k.jeux[g.id].range; }
      traiterDemande(k, g.id); // l'enfant l'avait demandé : c'est fait
    }, { nom: e.enfant.nom });
    noterUsage('jeu_installe', g);
  }
  // « Pas maintenant » : la demande s'en va ; l'enfant pourra la refaire.
  function pasMaintenant(id, g) {
    var e = enfantParId(id);
    changer(t('parent.cNotNow', { g: pick(g.title) }), function () { traiterDemande(enfantParId(id), g.id); }, { nom: e.enfant.nom });
  }
  // Ranger : le jeu sort de « Les jeux de … » sans rien effacer ; côté enfant, il va dans « Finis » et reste jouable.
  function ranger(id, g) {
    var e = enfantParId(id);
    regle = null;
    changer(t('parent.cPutAway', { g: pick(g.title) }), function () { var c = enfantParId(id).jeux[g.id]; if (c) c.range = Date.now(); }, { nom: e.enfant.nom });
    noterUsage('jeu_range', g);
  }
  function ressortir(id, g) {
    var e = enfantParId(id);
    changer(t('parent.cTakeOut', { g: pick(g.title) }), function () { var c = enfantParId(id).jeux[g.id]; if (c) delete c.range; }, { nom: e.enfant.nom });
  }
  function retirer(id, g) {
    var e = enfantParId(id);
    changer(t('parent.removed', { g: pick(g.title) }), function () {
      var k = enfantParId(id);
      (k.jeuxRetires || (k.jeuxRetires = {}))[g.id] = k.jeux[g.id];
      delete k.jeux[g.id];
    }, { nom: e.enfant.nom });
    noterUsage('jeu_retire', g);
  }
  function boutonInstaller(e, g) {
    return bouton('btn-sun pa-installer', t('parent.install', { n: e.enfant.nom }), 'plus', function () { installer(e.id, g); }, { 'data-installer': g.id, 'data-enfant': e.id });
  }

  // =====================================================================
  // La fiche d'un jeu (module du catalogue), avec ce qui concerne les enfants, juste après les boutons
  // =====================================================================
  function openFiche(g) {
    var f = fam();
    noterUsage('fiche_ouverte', g);
    var actions = [bouton('btn-ghost', t('parent.tryMe'), 'play', function () { play(g, { essai: true }); })];
    if (g.embed === false) actions.push(el('p', { class: 'pa-note', text: t('parent.newTab') }));
    var o = { lang: lang, actions: actions };
    // o.avant : posé juste après les boutons, avant les images. Un module du catalogue plus ancien ne le connaît pas : sections.
    if (typeof LudiCatalogue.sujets === 'function') o.avant = [sectionEnfant(f, g)]; else o.sections = [sectionEnfant(f, g)];
    // « Votre avis » : juste après l'avis des parents, pour tout parent connecté, sur n'importe quel jeu (Julien, 2026-11-18).
    if (avisPossible()) o.apresAvis = blocAvis(g);
    LudiCatalogue.ouvrir(g, o);
  }

  // =====================================================================
  // Votre avis (plan 5, refait selon Julien le 2026-11-18) : une note de 1 à 5 étoiles et « Le jeu marche bien chez vous ? »,
  // qui sert à mettre à part une mauvaise note due à un bug. Un mot facultatif, lu par Julien dans le bureau avant d'être montré.
  // Seule condition : être connecté (plus de temps de jeu minimum, Julien, 2026-11-18).
  // Le même bloc d'un dessin à l'autre : une synchro ne vide pas ce qu'on écrit.
  // =====================================================================
  var MARCHE_AVIS = ['oui', 'pas-toujours', 'non'];
  var blocsAvis = {};
  function avisPossible() {
    return !!(Nuage && Nuage.actif() && Nuage.connecte() && typeof Nuage.donnerAvis === 'function');
  }
  function blocAvis(g) {
    var cle = g.id + '|' + lang + '|' + (Nuage.email() || '');
    if (blocsAvis[cle]) return blocsAvis[cle];
    var id = 'avis-' + g.id, rep = { etoiles: null, marche: null }, touche = false;
    var statut = el('p', { class: 'pa-avis-statut', role: 'status' });
    var etatMot = el('p', { class: 'pa-avis-etat-mot', hidden: true });
    var mot = el('textarea', { id: id + '-mot', maxlength: '400', rows: '3' });
    var envoyer = el('button', { type: 'submit', class: 'btn-sun pa-avis-envoyer', text: t('parent.avis.envoyer') });
    var retirer = el('button', { type: 'button', class: 'lien pa-avis-retirer', hidden: true, text: t('parent.avis.retirer') });
    var choix = t('parent.avis.choix');
    // Les étoiles : cinq boutons radio (flèches du clavier, lecteur d'écran « 3 étoiles »), dessinés en grandes étoiles.
    // Une étoile choisie et celles d'avant se remplissent ; la note se lit à la forme pleine, pas qu'à la couleur.
    var etoiles = el('div', { class: 'pa-etoiles' }, [1, 2, 3, 4, 5].map(function (n) {
      var r = el('input', { type: 'radio', name: id + '-etoiles', value: String(n), 'aria-label': t('parent.avis.etoile')(n) });
      r.addEventListener('change', function () { rep.etoiles = n; touche = true; statut.textContent = ''; remplirEtoiles(n); });
      return el('label', { class: 'pa-etoile', title: t('parent.avis.etoile')(n) }, [r, icon('etoile')]);
    }));
    function remplirEtoiles(n) {
      etoiles.querySelectorAll('.pa-etoile').forEach(function (l, i) { l.classList.toggle('plein', i < n); });
    }
    var qEtoiles = el('fieldset', { class: 'pa-avis-q', 'data-q': 'etoiles' }, [el('legend', { class: 'sr', text: t('parent.avis.note') }), etoiles]);
    var qMarche = el('fieldset', { class: 'pa-avis-q', 'data-q': 'marche' }, [
      el('legend', { text: t('parent.avis.marche') }),
      el('div', { class: 'pa-avis-choix' }, MARCHE_AVIS.map(function (v) {
        var r = el('input', { type: 'radio', name: id + '-marche', value: v });
        r.addEventListener('change', function () { rep.marche = v; touche = true; statut.textContent = ''; });
        return el('label', { class: 'pa-avis-pastille' }, [r, el('span', { text: choix[v] })]);
      }))
    ]);
    var form = el('form', { class: 'pa-avis', 'data-avis': g.id, novalidate: true }, [
      el('h3', { text: t('parent.avis.titre') }),
      qEtoiles, qMarche,
      el('div', { class: 'pa-avis-champ' }, [el('label', { for: id + '-mot', text: t('parent.avis.mot') }), el('span', { class: 'pa-avis-aide', text: t('parent.avis.motAide') }), mot]),
      etatMot,
      el('div', { class: 'pa-avis-bas' }, [envoyer, retirer]),
      statut
    ]);
    form.addEventListener('input', function () { touche = true; });
    // L'avis déjà donné : les réponses (si l'on n'a encore rien touché), le bouton, et où en est le mot.
    function montrer(d) {
      envoyer.textContent = t(d ? 'parent.avis.enregistrer' : 'parent.avis.envoyer');
      retirer.hidden = !d;
      etatMot.hidden = !(d && d.mot);
      if (d && d.mot) etatMot.textContent = t('parent.avis.' + ({ accepte: 'accepte', refuse: 'refuse' }[d.mot_etat] || 'aRelire'));
      if (touche) return;
      rep.etoiles = d && Number(d.etoiles) >= 1 ? Number(d.etoiles) : null;
      rep.marche = d ? d.marche : null;
      form.querySelectorAll('input[name="' + id + '-etoiles"]').forEach(function (r) { r.checked = Number(r.value) === rep.etoiles; });
      form.querySelectorAll('input[name="' + id + '-marche"]').forEach(function (r) { r.checked = r.value === rep.marche; });
      remplirEtoiles(rep.etoiles || 0);
      mot.value = (d && d.mot) || '';
    }
    function relire() { return Nuage.lireAvis(g.id).then(montrer); }
    relire().catch(function () { /* hors ligne : le formulaire reste vide, on peut quand même répondre */ });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!rep.etoiles || !rep.marche) { statut.textContent = t('parent.avis.manque'); return; }
      envoyer.disabled = true;
      Nuage.donnerAvis(g.id, { etoiles: rep.etoiles, marche: rep.marche, mot: mot.value, langue: lang }).then(function () {
        touche = false;
        statut.textContent = t('parent.avis.merci');
        return relire().catch(function () { /* rien */ });
      }).then(function () { LudiCatalogue.rafraichirAvis(g.id); }, function () {
        statut.textContent = t('parent.avis.erreur');
      }).then(function () { envoyer.disabled = false; });
    });
    retirer.addEventListener('click', function () {
      retirer.disabled = true;
      Nuage.retirerAvis(g.id).then(function () {
        touche = false;
        montrer(null);
        statut.textContent = t('parent.avis.retire');
        LudiCatalogue.rafraichirAvis(g.id);
      }, function () { statut.textContent = t('parent.avis.erreur'); }).then(function () { retirer.disabled = false; });
    });
    blocsAvis[cle] = form;
    return form;
  }
  // D'abord l'état en mots, une ligne par enfant (l'enfant regardé en premier) ; puis ses réglages ; puis ce que le jeu a enregistré.
  function sectionEnfant(f, g) {
    var h = foyer(), plusieurs = h.enfants.length > 1;
    var enfants = [f].concat(h.enfants.filter(function (e) { return e.id !== f.id; }));
    return el('section', { class: 'pa-pour' }, [
      hoteJournal(),
      el('ul', { class: 'pa-pour-enfants' }, enfants.map(function (e) {
        var c = e.jeux && e.jeux[g.id];
        // Installé : Ranger et Retirer (Retirer seulement ici, dans la fiche). Rangé : Ressortir. Pas installé : sa demande, puis Installer.
        return el('li', { class: c ? 'installe' : '', 'data-enfant': e.id }, c ? [
          el('span', { class: 'pa-pour-etat' }, c.range ? [icon('boite'), t('parent.ficheStored', { n: e.enfant.nom })] : [icon('check'), t('parent.ficheInstalled', { n: e.enfant.nom })]),
          el('span', { class: 'pa-pour-boutons' }, [
            c.range ? bouton('btn-ghost pa-ressortir', t('parent.takeOut'), null, function () { ressortir(e.id, g); }, { 'data-ressortir': g.id })
              : bouton('btn-ghost pa-ranger', t('parent.putAway'), 'boite', function () { ranger(e.id, g); }, { 'data-ranger': g.id }),
            bouton('btn-ghost pa-retirer', t('parent.remove'), 'cross', function () { retirer(e.id, g); })
          ])
        ] : [demande(e, g.id) ? el('span', { class: 'pa-pour-etat pa-pour-demande' }, [icon('main'), t('parent.stWants', { n: e.enfant.nom })]) : null, boutonInstaller(e, g)]);
      })),
      choix(g.id) ? el('div', { class: 'pa-pour-regl' }, [plusieurs ? el('h3', { text: t('parent.ficheSettings', { n: f.enfant.nom }) }) : null, reglagesJeu(f, g)]) : null,
      enregistre(f, g)
    ]);
  }
  // Ce que le jeu a vraiment envoyé, dit tel quel : temps, parties, fini, progression, records, notions (sans pourcentage).
  function enregistre(f, g) {
    var st = S()[g.id] || {}, et = st.etat || {};
    var lignes = [];
    function ligne(label, valeur) { lignes.push(el('div', null, [el('dt', { text: label }), el('dd', null, [valeur])])); }
    if (st.ms >= 30000) ligne(t('parent.recTime'), t('parent.recTimeVal', { w: weekMs(g.id) >= 30000 ? duration(weekMs(g.id)) : '0 min', t: duration(st.ms) }));
    if (st.sessions) ligne(t('parent.recSessions'), String(st.sessions));
    if (et.fini) ligne(t('parent.recFini'), t('parent.recFiniVal'));
    Object.keys(st.progress || {}).forEach(function (k) { ligne(t('parent.recProgress') + ' · ' + k.replace(/[-_]/g, ' '), String(st.progress[k])); });
    Object.keys(st.scores || {}).forEach(function (k) { ligne(t('parent.recRecords') + ' · ' + k.replace(/[-_]/g, ' '), Number(st.scores[k].value).toLocaleString(lang)); });
    // Les notions, par domaine : trouvées 3 fois de suite, encore à essayer (la dernière réponse n'était pas juste), déjà vues.
    var parDomaine = {};
    Object.keys(st.skills || {}).forEach(function (k) {
      var dom = k.split('/')[0], item = k.slice(dom.length + 1) || dom;
      (parDomaine[dom] = parDomaine[dom] || []).push({ item: dom === 'maths.multiplication' ? item.replace('x', '×') : item, s: st.skills[k] });
    });
    Object.keys(parDomaine).forEach(function (dom) {
      var items = parDomaine[dom];
      var groupes = [
        [t('parent.skillStreak'), items.filter(function (x) { return x.s.streak >= 3; })],
        [t('parent.skillRetry'), items.filter(function (x) { return x.s.streak < 0; })],
        [t('parent.skillSeen'), items.filter(function (x) { return x.s.streak >= 0 && x.s.streak < 3; })]
      ].filter(function (gr) { return gr[1].length; });
      ligne(LudiCatalogue.notion(dom, lang), el('span', { class: 'pa-notions' }, groupes.map(function (gr) {
        return el('span', null, [el('span', { class: 'pa-notions-lib', text: gr[0] + ' : ' }), gr[1].map(function (x) { return x.item; }).join(', ')]);
      })));
    });
    // Replié : un résumé d'une ligne (temps sur 7 jours, parties, « Fini »), le détail d'un toucher.
    if (!lignes.length) return el('p', { class: 'pa-enregistre pa-note', text: t('parent.recorded', { n: f.enfant.nom }) + ' : ' + t('parent.recNone') });
    var resume = [weekMs(g.id) >= 30000 ? t('parent.weekShort', { t: duration(weekMs(g.id)) }) : t('parent.notPlayed7'),
      st.sessions ? t(st.sessions === 1 ? 'parent.recSessionsOne' : 'parent.recSessionsN', { k: st.sessions }) : null,
      et.fini ? t('parent.finished') : null].filter(Boolean).join(' · ');
    return el('details', { class: 'pa-enregistre pa-plie' }, [
      el('summary', null, [el('span', null, [el('b', { text: t('parent.recorded', { n: f.enfant.nom }) }), el('span', { class: 'pa-resume', text: resume })])]),
      el('dl', null, lignes)
    ]);
  }

  // =====================================================================
  // Onglet Temps
  // =====================================================================
  function stepper(value, step, minV, maxV, onChange, label) {
    var noLimit = value === null;
    return el('div', { class: 'stepper' + (noLimit ? ' off' : '') }, [
      el('button', { type: 'button', 'aria-label': '− 5 min · ' + label, disabled: noLimit || value <= minV, onclick: function () { onChange(clamp(value - step, minV, maxV)); } }, [icon('minus')]),
      el('output', { class: 'step-val', text: noLimit ? '∞' : t('min', { n: value }) }),
      el('button', { type: 'button', 'aria-label': '+ 5 min · ' + label, disabled: noLimit || value >= maxV, onclick: function () { onChange(clamp(value + step, minV, maxV)); } }, [icon('plus')]),
      el('label', { class: 'pa-case' }, [
        el('input', { type: 'checkbox', checked: noLimit, onchange: function (e) { onChange(e.target.checked ? null : 'avant'); } }),
        el('span', { text: t('noLimit') })
      ])
    ]);
  }
  function semaine() {
    var r = regles();
    var days = lastDays(7).reverse();
    var dates = []; var d0 = new Date(); for (var i = 6; i >= 0; i--) { var d = new Date(d0); d.setDate(d0.getDate() - i); dates.push(d); }
    var base = Temps.regles(Object.assign({}, r, { bonus: null, fini: null }));
    var limites = dates.map(function (d) { return Temps.minutesDuJour(base, d); });
    var maxDay = Math.max.apply(null, days.map(function (k) { return dayMs(null, k); }).concat(limites.map(function (m) { return (m || 0) * MIN; }), [MIN]));
    var bars = el('div', { class: 'semaine' }, days.map(function (k, j) {
      var ms = dayMs(null, k), lim = limites[j];
      return el('div', { class: 'jour' + (j === 6 ? ' auj' : '') }, [
        el('span', { class: 'barre-zone' }, [
          lim !== null ? el('span', { class: 'limite', style: 'bottom:' + (lim * MIN / (maxDay * 1.15) * 100).toFixed(1) + '%' }) : null,
          el('span', { class: 'barre', style: 'height:' + (ms / (maxDay * 1.15) * 100).toFixed(1) + '%' })
        ]),
        el('span', { class: 'jour-val', text: t('min', { n: ms >= 30000 ? Math.round(ms / MIN) : 0 }) }),
        el('span', { class: 'jour-nom', text: t('days')[dates[j].getDay()] })
      ]);
    }));
    return bloc(null, [
      el('div', { class: 'pa-semaine-tete' }, [el('h3', { text: t('parent.week') }), el('p', { class: 'pa-total', text: t('parent.weekTotal', { t: weekMs() >= 30000 ? duration(weekMs()) : '0 min' }) })]),
      bars,
      el('p', { class: 'pa-note legende' }, [
        el('span', { class: 'leg-auj', 'aria-hidden': 'true' }), t('parent.legendToday'),
        el('span', { class: 'leg-limite', 'aria-hidden': 'true' }), t('parent.legendPlanned')
      ])
    ], 'pa-semaine');
  }
  function pageTemps(f) {
    var r = f.regles;
    var out = el('div', { class: 'pa-temps' });
    out.appendChild(el('h1', { class: 'pa-titre', text: t('parent.timeTitle', { de: nomDe(f.enfant.nom), n: f.enfant.nom }) }));
    out.appendChild(semaine());
    // « Sans limite » puis décoché : on retrouve la valeur d'avant, pas une valeur par défaut.
    function minutes(cle, quoi) {
      return function (v) {
        if (v === 'avant') v = r[cle + 'Avant'] || 30;
        changer(t(quoi, { m: v === null ? t('noLimit').toLowerCase() : t('min', { n: v }) }), function () {
          if (v === null && r[cle] !== null) r[cle + 'Avant'] = r[cle];
          r[cle] = v;
        });
      };
    }
    out.appendChild(el('div', { class: 'pa-deux' }, [
      bloc(null, [el('h3', { text: titreJoursChoisis(r.joursLibres) }), stepper(r.libre, 5, 5, 240, minutes('libre', 'parent.cFree'), titreJoursChoisis(r.joursLibres))], 'pa-carte-temps libre'),
      bloc(null, [el('h3', { text: t('parent.school') }), stepper(r.ecole, 5, 5, 180, minutes('ecole', 'parent.cSchool'), t('parent.school'))], 'pa-carte-temps')
    ]));
    var jl = r.joursLibres || [];
    var vac = el('input', { type: 'date', value: r.vacances || '', min: Temps.iso(new Date()), 'aria-label': t('parent.holidaysUntil') });
    vac.addEventListener('change', function () { var v = vac.value || null; changer(t('parent.cHolidays'), function () { r.vacances = v; }); });
    var enVacances = r.vacances && r.vacances >= Temps.iso(new Date());
    out.appendChild(bloc(null, [
      el('h3', { text: t('parent.freeDays') }),
      joursBoutons(jl, function (d, on) {
        var jourNom = t('daysLong')[d];
        changer(t(on ? 'parent.cFreeDayOff' : 'parent.cFreeDayOn', { d: jourNom.charAt(0).toUpperCase() + jourNom.slice(1) }), function () { r.joursLibres = on ? jl.filter(function (x) { return x !== d; }) : jl.concat([d]); });
      }),
      el('p', { class: 'pa-note', text: joursEnMots(jl) }),
      el('div', { class: 'plage' }, [
        el('span', { class: 'plage-champs' }, [el('span', { text: t('parent.holidays') + ' · ' + t('parent.holidaysUntil') }), vac]),
        r.vacances ? el('button', { type: 'button', class: 'lien', text: t('parent.holidaysEnd'), onclick: function () { changer(t('parent.cHolidays'), function () { r.vacances = null; }); } }) : null
      ]),
      enVacances ? el('p', { class: 'pa-note' }, [icon('sun'), t('parent.holidaysOn')]) : null
    ]));
    // Heures de jeu. « À toute heure » coché puis décoché : les heures d'avant reviennent.
    var plage = r.heures, garde = r.heuresAvant || { debut: '17:00', fin: '19:00' };
    var debut = el('input', { type: 'time', value: plage ? plage.debut : garde.debut, 'aria-label': t('parent.hoursFrom'), disabled: !plage });
    var fin = el('input', { type: 'time', value: plage ? plage.fin : garde.fin, 'aria-label': t('parent.hoursTo'), disabled: !plage });
    function majPlage() {
      if (debut.value && fin.value && debut.value < fin.value) changer(t('parent.cHours'), function () { r.heures = { debut: debut.value, fin: fin.value }; });
    }
    debut.addEventListener('change', majPlage); fin.addEventListener('change', majPlage);
    var blocHeures = out.appendChild(bloc(null, [
      el('h3', { text: t('parent.hours') }),
      el('div', { class: 'plage' + (plage ? '' : ' off') }, [
        el('label', { class: 'pa-case' }, [
          el('input', { type: 'checkbox', checked: !plage, onchange: function (e) {
            var tout = e.target.checked;
            changer(t('parent.cHours'), function () {
              if (tout) { r.heuresAvant = r.heures; r.heures = null; } else r.heures = r.heuresAvant || { debut: debut.value, fin: fin.value };
            });
          } }),
          el('span', { text: t('parent.hoursAny') })
        ]),
        el('span', { class: 'plage-champs' }, [el('span', { text: t('parent.hoursFrom') }), debut, el('span', { text: t('parent.hoursTo') }), fin])
      ])
    ]));
    blocHeures.id = 'pa-heures';
    out.appendChild(bloc(null, [
      el('h3', { text: t('parent.endTitle') }),
      finCards(r.fin, r.grace, function (v) { changer(t('parent.cEnd'), function () { r.fin = v; }); }),
      r.fin === 'douce' ? el('div', { class: 'grace' }, [el('span', { text: t('parent.grace') }), chips([5, 10, 15], r.grace, function (m) { return '+' + t('min', { n: m }); }, function (v) { changer(t('parent.cEnd'), function () { r.grace = v; }); })]) : null
    ]));
    return out;
  }

  // =====================================================================
  // Onglet Réglages : l'enfant, puis la maison
  // =====================================================================
  var installEvt = null;
  var COPIE_VUE = 'ludiworld.copieVue';
  function rang(label, kids, cls) { return el('div', { class: 'pa-rang ' + (cls || '') }, [el('h3', { text: label }), el('div', { class: 'pa-rang-corps' }, kids)]); }
  function lienCompte(href, texte) {
    return el('a', { class: 'btn-ghost pa-btn', href: href, text: texte, onclick: function () {
      try { sessionStorage.setItem('ludiworld.retourCompte', '../app/#reglages'); } catch (e) { /* rien */ }
    } });
  }
  function pageReglages(f) {
    var h = foyer();
    var out = el('div', { class: 'pa-reglages' });
    out.appendChild(el('h1', { class: 'pa-titre', text: t('parent.settingsTitle') }));

    // L'enfant regardé
    var nom = el('input', { type: 'text', maxlength: '24', value: f.enfant.nom, id: 's-nom', autocomplete: 'off' });
    nom.addEventListener('change', function () { var v = nom.value.trim(); if (v) changer(t('parent.cName'), function () { f.enfant.nom = v.slice(0, 24); }); });
    out.appendChild(bloc(f.enfant.nom, [
      el('label', { for: 's-nom', class: 'champ-label', text: t('parent.kidName') }), nom,
      el('p', { class: 'champ-label', text: t('parent.kidAge') }),
      chips(AGES, f.enfant.age, function (a) { return String(a); }, function (a) { changer(t('parent.cAge', { a: a }), function () { f.enfant.age = a; }); }, 'ages'),
      // Le bouton de l'enfant pour regarder tous les jeux et en demander un : là par défaut ; décoché, il disparaît.
      el('label', { class: 'pa-case pa-regarder' }, [
        el('input', { type: 'checkbox', checked: peutRegarder(f), 'data-reglage': 'regarder', onchange: function (e) {
          var v = e.target.checked;
          changer(t(v ? 'parent.cKidLookOn' : 'parent.cKidLookOff', { n: f.enfant.nom }), function () { if (v) delete f.regarderTout; else f.regarderTout = false; });
        } }),
        el('span', { text: t('parent.kidLook', { n: f.enfant.nom }) })
      ]),
      h.enfants.length > 1 ? bouton('btn-ghost pa-btn', t('parent.removeKid', { n: f.enfant.nom }), 'cross', function () {
        if (!window.confirm(t('parent.removeKidConfirm', { n: f.enfant.nom }))) return;
        changer(t('parent.cKidRemoved', { n: f.enfant.nom }), function () {
          (h.retires || (h.retires = {}))[f.id] = Date.now();
          h.enfants = h.enfants.filter(function (e) { return e.id !== f.id; });
          if (h.actif === f.id) h.actif = h.enfants[0].id;
          regarde = h.actif;
        }, { maison: true });
      }) : null
    ], 'pa-bloc-enfant'));

    // La maison
    var maison = [];
    var enfants = [el('p', { class: 'pa-enfants-liste', text: h.enfants.map(function (e) { return e.enfant.nom; }).join(', ') })];
    if (ajout) {
      var champ = el('input', { type: 'text', maxlength: '24', id: 's-nouveau', autocomplete: 'off', placeholder: t('hello.kidNamePh'), value: ajout.nom });
      var go = bouton('btn-sun pa-btn', t('parent.addKidGo'), 'plus', function () {
        var n = ajout.nom.trim().slice(0, 24); if (!n) return;
        var age = ajout.age, e;
        changer(t('parent.cKidAdded', { n: n }), function () {
          // Pas de jeu d'office : on arrive sur « Tous les jeux », pour lui en installer.
          e = nouvelEnfant(n, age, {}, JSON.parse(JSON.stringify(Temps.regles(Object.assign({}, f.regles, { bonus: null, fini: null })))));
          regarde = e.id; ajout = null; tab = 'catalogue';
        }, { maison: true });
        window.scrollTo(0, 0);
      }, { disabled: !ajout.nom.trim() });
      champ.addEventListener('input', function () { ajout.nom = champ.value; go.disabled = !champ.value.trim(); });
      enfants.push(el('div', { class: 'pa-ajout' }, [
        el('label', { for: 's-nouveau', class: 'champ-label', text: t('parent.kidName') }), champ,
        el('p', { class: 'champ-label', text: t('parent.kidAge') }),
        chips(AGES, ajout.age, function (a) { return String(a); }, function (a) { ajout.age = a; renderParent(); }, 'ages'),
        el('div', { class: 'pa-actions' }, [go, el('button', { type: 'button', class: 'lien', text: t('parent.addKidCancel'), onclick: function () { ajout = null; renderParent(); } })])
      ]));
      setTimeout(function () { var c = document.getElementById('s-nouveau'); if (c && document.activeElement !== c) try { c.focus({ preventScroll: true }); } catch (e) { /* rien */ } }, 30);
    } else enfants.push(bouton('btn-ghost pa-btn', t('parent.addKid'), 'plus', function () { ajout = { nom: '', age: 7 }; renderParent(); }));
    if (h.enfants.length > 1) enfants.push(el('label', { class: 'pa-case' }, [
      el('input', { type: 'checkbox', checked: h.protege !== false, onchange: function (e) { var v = e.target.checked; changer(t('parent.cProtect'), function () { h.protege = v; }, { maison: true }); } }),
      el('span', { text: t('parent.protect') })
    ]));
    maison.push(rang(t('parent.kids'), enfants));
    maison.push(rang(t('parent.pin'), [bouton('btn-ghost pa-btn', t('parent.pinChange'), 'lock', function () { openGate(function () { noter(t('parent.pinChanged')); }, 'set'); })]));
    maison.push(rang(t('parent.lang'), [langSwitch()]));
    maison.push(rang(t('parent.fullscreen'), [el('label', { class: 'pa-case' }, [
      el('input', { type: 'checkbox', checked: pleinEcranVoulu(), onchange: function (e) {
        var v = e.target.checked;
        changer(t('parent.cFullscreen'), function () { foyer().pleinEcran = v; }, { maison: true });
        if (!v && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
      } }),
      el('span', { text: t('parent.fullscreenCase') })
    ])]));
    // Les statistiques d'usage (décision de Julien du 2026-11-23) : cochées par défaut, le parent peut refuser pour toute la maison.
    maison.push(rang(t('parent.stats'), [
      el('label', { class: 'pa-case' }, [
        el('input', { type: 'checkbox', checked: mesuresPermises(), 'data-reglage': 'statistiques', onchange: function (e) {
          var v = e.target.checked;
          changer(t('parent.cStats'), function () { if (v) delete foyer().mesures; else foyer().mesures = false; }, { maison: true });
          // Une seule fois, sans le numéro de l'appareil : pour savoir quelle part des familles refuse (Julien, 2026-11-23)
          if (Usage) { if (!v) Usage.oublier(); Usage.signalerChoix(v ? 'statistiques_reprises' : 'statistiques_refusees'); }
        } }),
        el('span', { text: t('parent.statsCase') })
      ]),
      el('p', { class: 'pa-note', text: t('parent.statsText') })
    ]));
    maison.push(el('details', { class: 'pa-plie' }, [
      el('summary', { text: t('parent.lock') }),
      el('p', { text: t('parent.lockText') }),
      el('ul', { class: 'etapes' }, [el('li', { text: t('parent.lockAndroid') }), el('li', { text: t('parent.lockIos') })]),
      installEvt ? el('button', { type: 'button', class: 'btn-ink', text: t('parent.installApp'), onclick: function () {
        installEvt.prompt(); installEvt.userChoice.finally(function () { installEvt = null; renderParent(); });
      } }) : null
    ]));
    var enLigne = copieActive();
    if (Nuage && Nuage.actif()) {
      var co = Nuage.connecte();
      // Connecté : on retient si la copie en ligne était active, pour le dire vrai après « Se déconnecter » (elle reste en ligne).
      try { if (co) localStorage.setItem(COPIE_VUE, enLigne ? '1' : '0'); } catch (e) { /* rien */ }
      var copieGardee = false;
      try { copieGardee = !co && localStorage.getItem(COPIE_VUE) === '1'; } catch (e) { /* rien */ }
      maison.push(rang(t('parent.account'), [
        el('p', { class: 'pa-etat-compte', text: !co ? t(copieGardee ? 'parent.accNoneCopy' : 'parent.accNone') : t(enLigne ? 'parent.accOn' : 'parent.accOff', { e: Nuage.email() || '' }) }),
        co ? lienCompte('compte/#espace', t('parent.accOpen')) : lienCompte('compte/#connexion', t('parent.accSignIn')),
        el('details', { class: 'pa-plie pa-plie-petit' }, [el('summary', { text: t('parent.onlineList') }), el('p', { text: t('parent.onlineListText') })])
      ]));
    }
    maison.push(rang(t('parent.data'), [
      el('p', { text: enLigne ? t('parent.dataTextSync') : t('parent.dataText') }),
      bouton('btn-danger pa-btn', t(enLigne ? 'parent.eraseSync' : 'parent.erase'), 'warn', function () {
        if (!window.confirm(t(enLigne ? 'parent.eraseConfirmSync' : 'parent.eraseConfirm'))) return;
        try { localStorage.removeItem(STORE); localStorage.removeItem('ludiworld.envie'); localStorage.removeItem(COPIE_VUE); } catch (e) { /* rien */ }
        if (Usage) Usage.oublier(); // les statistiques en attente et le numéro de l'appareil partent aussi
        journal = []; majJournal();
        if (Nuage) Nuage.oublier(); // un appareil vidé ne reste lié à personne : il peut changer de famille
        store = { games: {} }; acc = accVide(); regarde = null;
        LudiBarre.fermerParent();
        show('accueil');
      }, { 'data-action': 'effacer' })
    ]));
    // Les pages du site (Les jeux, Ludiworld aime bien) sont dans la barre du site, en haut ; reste ce que Ludiworld fait des données.
    maison.push(el('p', { class: 'pa-site' }, [el('a', { href: 'confidentialite/', text: t('parent.linkData') })]));
    out.appendChild(bloc(t('parent.house'), maison, 'pa-maison'));
    return out;
  }

  // =====================================================================
  // Jouer : le jeu en plein cadre, le temps compté, la fin douce ou nette
  // =====================================================================
  var player = document.getElementById('player');
  var bandeau = document.getElementById('p-bandeau');
  var pastille = document.getElementById('p-reste');
  var rideau = document.getElementById('p-rideau');
  var frame = null;
  var playing = null; // { game, origin, kit, essai, last, phase, avertie, fiche }
  var ignorePop = 0;
  var ficheApresRetour = null; // la fiche à rouvrir une fois le retour d'historique fait

  function play(g, o) {
    o = o || {};
    if (playing) return;
    if (!o.essai && resteJeu(g.id).reste <= 0) { renderEnfant(); return; }
    var stats = gameStats(g.id);
    if (!o.essai) { stats.sessions += 1; saveStore(); }
    if (g.embed === false) { window.open(g.url, '_blank', 'noopener'); return; }
    // Essayé depuis sa fiche (côté parent) : la fiche se referme pendant le jeu et revient après.
    var fiche = LudiCatalogue.ouverte();
    playing = { game: g, origin: new URL(g.url, document.baseURI).origin, kit: false, essai: !!o.essai, last: Date.now(), phase: 'jouer', avertie: false, fiche: fiche, joue: 0 };
    noterUsage('jeu_lance', g, o.essai ? { essai: true } : null);
    if (fiche) LudiCatalogue.fermer();
    frame = el('iframe', { title: pick(g.title), src: g.url, allow: 'autoplay; screen-wake-lock; gamepad' }); // pas de plein écran pour le jeu : c'est Ludiworld qui décide
    player.insertBefore(frame, player.firstChild);
    player.hidden = false;
    bandeau.hidden = true; cacherPastille(); rideau.hidden = true;
    document.body.style.overflow = 'hidden';
    history.pushState({ ludi: 'play', id: g.id }, '');
    try { frame.focus(); } catch (e) { /* rien */ }
    var act = activiteDe(g);
    if (act) act.steps.forEach(function (s) { var src = imageActivite(s.img); if (src) { var im = new Image(); im.src = src; } });
    boucle();
  }

  // Une partie finie, une seule fois : combien de minutes et pourquoi (l'enfant est sorti, ou le temps : jour, heure, jeu).
  function noterFin(raison) {
    if (!playing || playing.finNotee) return;
    playing.finNotee = true;
    var d = { minutes: Math.round(playing.joue / 6000) / 10, raison: raison };
    if (playing.essai) d.essai = true;
    noterUsage('jeu_fini', playing.game, d);
  }
  function stop(fromHistory) {
    if (!playing) return;
    compter();
    noterFin('sortie');
    flushStore();
    setTimeout(planifierSynchro, 0); // la partie est finie : le temps de jeu peut partir
    setTimeout(envoyerUsage, 0);
    var wasEssai = playing.essai, fiche = playing.fiche, retourDemande = false;
    playing = null;
    if (frame) { frame.remove(); frame = null; }
    player.hidden = true;
    bandeau.hidden = true; cacherPastille(); rideau.hidden = true;
    clearTimeout(bandeauTimer);
    document.body.style.overflow = '';
    if (!fromHistory && history.state && history.state.ludi === 'play') { ignorePop++; history.back(); retourDemande = true; }
    if (aRecharger) { location.reload(); return; }
    render();
    if (wasEssai && fiche && vue === 'parent') { if (retourDemande) ficheApresRetour = fiche; else openFiche(fiche); }
  }
  document.getElementById('player-back').addEventListener('click', function () { stop(); });

  // Le temps est mesuré par Ludiworld lui-même (page visible), que le jeu ait le kit ou non.
  function compter() {
    if (!playing) return;
    var now = Date.now();
    var ms = Math.min(now - playing.last, 5000); // un onglet endormi ne compte pas des heures d'un coup
    playing.last = now;
    if (playing.phase === 'arrete' || document.visibilityState === 'hidden') return;
    playing.joue += ms;
    if (playing.essai) return;
    addTime(playing.game.id, ms);
  }

  var bandeauTimer = null;
  // petit : une ligne en dessous, en petit (les minutes, quand la phrase dit « à la fin de ta partie »).
  function montrerBandeau(img, titre, texte, petit) {
    bandeau.textContent = '';
    bandeau.appendChild(el('img', { src: img, alt: '' }));
    bandeau.appendChild(el('div', null, [el('b', { text: titre }), el('span', { text: texte }), petit ? el('small', { text: petit }) : null]));
    bandeau.hidden = false;
    bandeau.classList.remove('entre'); void bandeau.offsetWidth; bandeau.classList.add('entre');
    clearTimeout(bandeauTimer);
    bandeauTimer = setTimeout(function () { bandeau.hidden = true; }, 8000);
  }

  // La pastille du temps, dans le coin sous le bouton de retour : repliée en un petit soleil, pour ne cacher aucun bouton du jeu.
  // Elle se déplie quelques secondes 5 minutes avant la fin, puis à « Dernière partie », et quand l'enfant la touche.
  var pastilleMoment = '', pastilleTimer = null;
  function pastilleTexte(ico, texte, derniere, moment) {
    pastille.hidden = false;
    pastille.classList.toggle('derniere', !!derniere);
    pastille.textContent = '';
    pastille.appendChild(icon(ico));
    pastille.appendChild(el('span', { class: 'p-reste-txt', text: texte }));
    pastille.setAttribute('aria-label', texte);
    if (moment !== pastilleMoment) {
      pastilleMoment = moment;
      if (moment !== 'calme') deplierPastille(8000);
    }
  }
  function deplierPastille(ms) {
    pastille.classList.add('ouverte');
    clearTimeout(pastilleTimer);
    pastilleTimer = setTimeout(function () { pastille.classList.remove('ouverte'); }, ms);
  }
  function cacherPastille() {
    pastille.hidden = true; pastilleMoment = '';
    clearTimeout(pastilleTimer); pastille.classList.remove('ouverte');
  }
  pastille.addEventListener('click', function () { deplierPastille(4000); });

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
    // La pastille du soleil : un petit soleil replié tant qu'il y a une limite ; dépliée quelques secondes 5 minutes avant la fin.
    var resteTxt = t('kid.timeLeft', { t: Math.ceil(r.reste / MIN) + '\u00a0min' });
    if (r.reste <= Temps.AVERTIR && r.reste > 0) pastilleTexte('sun', resteTxt, false, 'bientot');
    else if (r.reste > Temps.AVERTIR && isFinite(r.reste)) pastilleTexte('sun', resteTxt, false, 'calme');
    else if (r.reste > Temps.AVERTIR) cacherPastille();

    if (d === 'jouer') { if (playing.phase !== 'jouer') { playing.phase = 'jouer'; playing.avertie = false; bandeau.hidden = true; } return; }
    if (d === 'bientot') {
      if (!playing.avertie) {
        playing.avertie = true;
        // Fin douce dans un jeu qui a le kit : la phrase d'abord (« à la fin de ta partie »), les minutes en petit dessous.
        var titreBientot = r.cause === 'jeu' ? t('kid.soonGameTitle') : t('kid.soonTitle');
        if (douce && playing.kit) montrerBandeau('img/marmotte-baille.webp', titreBientot, t('kid.soonSoftKit'), t('kid.soonLeft', { t: minutesLeft(r.reste) }));
        else montrerBandeau('img/marmotte-baille.webp', titreBientot, douce ? t('kid.soonSoft', { t: minutesLeft(r.reste) }) : t('kid.soonText', { t: minutesLeft(r.reste) }));
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
      pastilleTexte('hourglass', playing.kit ? t('kid.lastRound') : Math.ceil(grace / MIN) + '\u00a0min', true, 'derniere');
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
    compter();
    noterFin(cause || 'temps');
    playing.phase = 'arrete';
    flushStore();
    synchroniser();
    cacherPastille(); bandeau.hidden = true;
    postToGame({ type: 'ludi:pause', reason: 'temps' });
    var f = fam();
    var toutFini = cause !== 'jeu';
    rideau.textContent = '';
    rideau.appendChild(el('div', { class: 'rideau-carte' }, [
      el('img', { src: toutFini ? 'img/marmotte-dodo.webp' : 'img/marmotte-baille.webp', alt: '' }),
      el('h2', { text: toutFini ? t('kid.stopTitle') : t('kid.stopTitleGame') }),
      el('p', { text: !toutFini ? t('kid.stopTextGame') : t(cause === 'heure' ? 'kid.stopTextHour' : 'kid.stopText', { n: f ? f.enfant.nom : '' }) }),
      toutFini && !playing.essai ? ideeApres(playing.game, f) : null,
      el('button', { type: 'button', class: 'btn-sun big', text: t('kid.stopOk'), onclick: function () { stop(); } })
    ]));
    rideau.setAttribute('data-moment', toutFini ? 'nuit' : 'soir');
    rideau.hidden = false;
    setTimeout(envoyerUsage, 0);
    var b = rideau.querySelector('button'); if (b) setTimeout(function () { b.focus(); }, 300);
  }

  // L'idée hors écran du dernier jeu joué (champ `after` de sa fiche), sous « Bravo » : une fois par jour et par enfant.
  // Notée dans les données de l'appareil seulement (store.apresVu), hors du foyer : elle ne part pas avec la copie en ligne.
  function ideeApres(g, f) {
    var phrase = g && g.after ? pick(g.after) : '';
    if (!phrase) return null;
    var qui = f ? f.id : '-', k = Temps.cleJour();
    if (!store.apresVu || typeof store.apresVu !== 'object') store.apresVu = {};
    if (store.apresVu[qui] === k) return null;
    store.apresVu[qui] = k;
    saveStore();
    noterUsage('idee_montree', g, activiteDe(g) ? { activite: true } : null);
    return el('div', { class: 'rideau-apres' }, [
      LudiCatalogue.icone(g, 52),
      el('p', { text: phrase.replace(/ ([?!:;»])/g, '\u00a0$1') }),
      activiteDe(g) ? el('button', { type: 'button', class: 'btn-activite', onclick: function () { ouvrirActivite(g); } }, [icon('book'), t('kid.howTo')]) : null
    ]);
  }

  // ---------- L'activité hors écran pas à pas (champ `activity` de la fiche ; décision de Julien du 23 novembre)
  // Elle s'ouvre par-dessus « C'est fini pour aujourd'hui » : le jeu est déjà arrêté, le temps ne compte plus
  // (on fait quelque chose en dehors de la tablette, avec la tablette). Ce qu'il faut, puis une étape à la fois :
  // un grand schéma et une phrase courte, que l'enfant entend en appuyant dessus.
  function activiteDe(g) {
    var a = g && g.activity;
    return a && Array.isArray(a.steps) && a.steps.length >= 2 ? a : null;
  }
  function imageActivite(src) {
    if (/^https:\/\//.test(src)) return src;
    return /^img\/activites\/[a-z0-9-]+\.(svg|webp)$/.test(src) ? 'jeux/' + src : '';
  }
  // La voix de l'appareil, seulement si l'enfant appuie ; seulement une voix installée (le texte ne part pas en ligne).
  function voixLocale() {
    try {
      var s = window.speechSynthesis; if (!s) return null;
      return (s.getVoices() || []).filter(function (x) { return x.localService && x.lang.toLowerCase().indexOf(lang) === 0; })[0] || null;
    } catch (e) { return null; }
  }
  function dire(texte) {
    try {
      var s = window.speechSynthesis, v = voixLocale(); if (!s || !v || !texte) return;
      s.cancel();
      var u = new SpeechSynthesisUtterance(texte); u.voice = v; u.lang = v.lang; u.rate = .9;
      s.speak(u);
    } catch (e) { /* pas de voix : rien */ }
  }
  // Chrome ne charge ses voix qu'à la première demande : on les demande dès le départ de l'appli.
  try { if (window.speechSynthesis) window.speechSynthesis.getVoices(); } catch (e) { /* rien */ }
  function taire() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* rien */ } }
  var activiteOuverte = null; // la fonction qui la ferme, tant qu'elle est ouverte
  function ouvrirActivite(g, etape) {
    var a = activiteDe(g); if (!a) return;
    var n = a.steps.length, i = -1; // -1 : ce qu'il faut
    var plusLoin = 0; // l'étape la plus loin vue (0 : ce qu'il faut), pour les statistiques
    var boite = el('div', { class: 'p-activite', role: 'dialog', 'aria-modal': 'true', 'aria-label': pick(a.title) });
    // un texte qu'on entend en appuyant dessus
    // sans voix sur l'appareil, pas de haut-parleur : il promettrait ce qui ne vient pas (audit des situations, n° 2)
    function phrase(cls, texte) {
      if (!voixLocale()) return el('p', { class: 'act-phrase sans-voix ' + cls }, [el('span', { text: texte })]);
      return el('button', { type: 'button', class: 'act-phrase ' + cls, 'aria-label': t('kid.actListen') + ' : ' + texte, onclick: function () { dire(texte); } },
        [icon('parle'), el('span', { text: texte })]);
    }
    // parRetour : true (retour du téléphone), 'fini' (« J'ai fini »), rien (croix, Échap)
    function fermer(parRetour) {
      taire(); document.removeEventListener('keydown', touche); boite.remove(); activiteOuverte = null;
      noterUsage('activite_fermee', g, { etape: plusLoin, etapes: n, finie: parRetour === 'fini' });
      if (parRetour === 'fini') parRetour = false;
      // fermée par un bouton : on retire le pas d'historique posé à l'ouverture
      if (!parRetour && history.state && history.state.ludiActivite) { ignorePop++; history.back(); }
      var b = rideau.querySelector('.btn-activite'); if (b) b.focus();
    }
    function touche(e) {
      if (e.key === 'Escape') fermer();
      else if (e.key === 'ArrowRight' && i < n - 1) { i++; montrer(); }
      else if (e.key === 'ArrowLeft' && i > -1) { i--; montrer(); }
    }
    function montrer() {
      taire();
      plusLoin = Math.max(plusLoin, i + 1);
      boite.textContent = '';
      boite.appendChild(el('div', { class: 'act-tete' }, [
        LudiCatalogue.icone(g, 40),
        el('h2', { text: pick(a.title) }),
        el('button', { type: 'button', class: 'act-fermer', 'aria-label': t('kid.actClose'), onclick: function () { fermer(); } }, [icon('cross')])
      ]));
      if (i < 0) {
        boite.appendChild(el('div', { class: 'act-corps act-besoin' }, [
          el('p', { class: 'act-kicker', text: t('kid.actNeed') }),
          phrase('act-grande', pick(a.need)),
          el('button', { type: 'button', class: 'btn-sun big act-suivant', onclick: function () { i = 0; montrer(); } }, [t('kid.actStart')])
        ]));
      } else {
        var s = a.steps[i];
        boite.appendChild(el('div', { class: 'act-corps' }, [
          el('img', { class: 'act-schema', src: imageActivite(s.img), alt: '', draggable: 'false' }),
          el('p', { class: 'act-compte' }, [t('kid.actStep', { i: i + 1, n: n })].concat(
            [el('span', { class: 'act-points', 'aria-hidden': 'true' }, a.steps.map(function (x, k) { return el('i', { class: k === i ? 'on' : (k < i ? 'vu' : null) }); }))])),
          phrase('', pick(s.text)),
          el('div', { class: 'act-nav' }, [
            el('button', { type: 'button', class: 'btn-ghost act-retour', onclick: function () { i--; montrer(); } }, [t('kid.actPrev')]),
            i < n - 1
              ? el('button', { type: 'button', class: 'btn-sun big act-suivant', onclick: function () { i++; montrer(); } }, [t('kid.actNext')])
              : el('button', { type: 'button', class: 'btn-sun big act-suivant', onclick: function () { fermer('fini'); } }, [icon('check'), t('kid.actDone')])
          ])
        ]));
      }
      var f = boite.querySelector('.act-suivant'); if (f) f.focus();
    }
    document.addEventListener('keydown', touche);
    // les voix arrivent après l'ouverture : on redessine l'étape pour faire apparaître le haut-parleur
    var synth = window.speechSynthesis;
    if (synth && synth.addEventListener && !voixLocale()) {
      var surVoix = function () { synth.removeEventListener('voiceschanged', surVoix); if (boite.isConnected && voixLocale()) montrer(); };
      synth.addEventListener('voiceschanged', surVoix);
    }
    rideau.appendChild(boite);
    noterUsage('activite_ouverte', g);
    history.pushState({ ludiActivite: 1 }, '');
    activiteOuverte = fermer;
    if (etape) i = Math.max(-1, Math.min(n - 1, etape - 1));
    montrer();
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
      // Côté parent laissé ouvert : on revient côté enfant (le parent a sans doute rendu l'appareil).
      closeGate(); fermerCarnet();
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
    var k = (fam() ? fam().id : '') + '|' + Temps.cleJour() + '|' + Math.round(dayMs() / MIN) + '|' + JSON.stringify(fam() && [fam().regles, fam().jeux, fam().regarderTout]) + '|' + Temps.horsPlage(r) + '|' + lang;
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
      frame.contentWindow.postMessage({ type: 'ludi:welcome', player: f && !playing.essai ? { name: f.enfant.nom } : null, save: !playing.essai && g.save ? g.save : null }, playing.origin);
      // Un jeu qui arrive alors que l'enfant a déjà été prévenu l'apprend aussi.
      if (playing.avertie) { var r = resteJeu(playing.game.id); postToGame({ type: 'ludi:wrapup', minutes: Math.max(0, Math.ceil(r.reste / MIN)) }); }
    } else if (m.type === 'ludi:event' && m.event) {
      var ev = m.event;
      if (playing.essai) return; // l'essai du parent ne compte pas dans les stats de l'enfant
      if (ev.kind === 'score' && ev.record) { g.scores[ev.key] = { value: ev.value, better: ev.better }; saveStore(); }
      else if (ev.kind === 'progress') { g.progress[ev.key] = ev.value; saveStore(); }
      else if (ev.kind === 'save') {
        // La sauvegarde du jeu, gardée avec l'enfant (donc dans la copie en ligne). La plus récente fait foi ; la taille est bornée.
        var sv = ev.data, at = Number(ev.at);
        if (sv !== undefined && sv !== null && isFinite(at) && JSON.stringify(sv).length <= 250000 && (!g.save || at >= g.save.at)) { g.save = { data: sv, at: at }; saveStore(); }
      }
      else if (ev.kind === 'skill' && ev.domain) {
        var id = String(ev.domain) + (ev.item !== null && ev.item !== undefined ? '/' + ev.item : '');
        var s = g.skills[id] || { ok: 0, ko: 0, streak: 0 };
        if (ev.success) { s.ok++; s.streak = Math.max(1, s.streak + 1); } else { s.ko++; s.streak = Math.min(-1, s.streak - 1); }
        g.skills[id] = s;
        var k = Temps.cleJour();
        var sd = g.skillDays[k] || (g.skillDays[k] = { ok: 0, ko: 0 });
        if (ev.success) sd.ok++; else sd.ko++;
        saveStore();
      } else if (ev.kind === 'etat') {
        // Ce que le jeu dit de sa progression : fini ne s'enlève pas, complet ne redescend pas.
        var et = g.etat || (g.etat = { fini: false });
        if (ev.fini) et.fini = true;
        var cp = Number(ev.complet);
        if (ev.complet !== null && ev.complet !== undefined && isFinite(cp) && (et.complet === undefined || cp > et.complet)) et.complet = Math.max(0, Math.min(1, cp));
        saveStore();
      } else if (ev.kind === 'checkpoint') { compter(); evaluer(true); }
      // Les tranches de temps (« session ») envoyées par le kit sont ignorées : Ludiworld compte lui-même.
    }
  });

  // Bouton retour (Android) : ferme le jeu ; côté parent, revient à l'onglet d'avant.
  // La fiche d'un jeu gère elle-même son retour (site/catalogue.js).
  window.addEventListener('popstate', function () {
    if (ignorePop) {
      ignorePop--;
      if (ficheApresRetour) { var g = ficheApresRetour; ficheApresRetour = null; if (vue === 'parent') openFiche(g); }
      return;
    }
    if (activiteOuverte) { activiteOuverte(true); return; } // l'activité pas à pas : le retour revient à l'écran de fin
    if (playing) { stop(true); return; }
    if (!vitrine.hidden) {
      var pas = history.state && history.state.ludiVitrine;
      if (pas === 'liste') { vitrineJeu = null; dessinerVitrine(); }
      else if (!pas) fermerVitrine();
      return;
    }
    if (vue !== 'parent') return;
    var o = history.state && history.state.ludiOnglet;
    var haut = pileOnglets[pileOnglets.length - 1];
    if (!o) o = pileOnglets.pop();          // un pas laissé par la fiche ou un jeu : l'onglet d'avant
    else if (o === haut) pileOnglets.pop();  // retour
    else if (o !== tab) pileOnglets.push(tab); // en avant
    if (o && o !== tab) {
      tab = o; ajout = null; regle = null;
      renderParent();
      window.scrollTo(0, 0);
    }
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
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; if (vue === 'parent' && tab === 'reglages') renderParent(); });
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
  // L'appli vit sous app/ ; le site, à la racine (Julien, 2026-11-18). Rien de préparé sur cet appareil : la préparation
  // (son premier écran propose aussi le compte et le site). Le site y mène par « Essayer » (#demarrer).
  // Préparé : côté enfant ; #carnet (lien « Côté parent » du site) ouvre le côté parent, avec le code s'il le faut ;
  // #reglages fait de même sur l'onglet Réglages (retour du compte).
  document.documentElement.lang = lang;
  var arrivee = location.hash;
  var prepare = !!(fam() && foyer().pin);
  var aJouer = /^#jouer=/.test(arrivee) ? arrivee.slice(7) : null; // « Y jouer » depuis la fiche d'un jeu
  function ongletDe(hash) { return hash === '#carnet' ? 'jeux' : hash === '#reglages' ? 'reglages' : null; }
  if (aJouer) history.replaceState(history.state, '', location.pathname + location.search);
  if (ongletDe(arrivee) || arrivee === '#enfant' || arrivee === '#demarrer') history.replaceState(history.state, '', location.pathname + location.search);
  function versParent(onglet) {
    if (LudiBarre.parentOuvert()) ouvrirCarnet(onglet);
    else openGate(function () { ouvrirCarnet(onglet); });
  }
  loadCatalogue().then(function () {
    // Un jeu choisi qui a disparu du catalogue n'est plus proposé (on garde son choix au cas où il revient).
    if (!prepare) { show('accueil'); finEssai(); return; }
    synchroniser();
    if (ongletDe(arrivee) && LudiBarre.parentOuvert()) { ouvrirCarnet(ongletDe(arrivee)); return; }
    // Retour depuis une page du site ouverte côté parent : le pas d'historique garde l'onglet ; pas de code tant que le parent est là.
    var ongletRetour = history.state && history.state.ludiOnglet;
    if (!ongletDe(arrivee) && !aJouer && LudiBarre.parentOuvert() && ONGLETS.some(function (o) { return o[0] === ongletRetour; })) { ouvrirCarnet(ongletRetour); return; }
    LudiBarre.fermerParent();
    show('enfant');
    if (ongletDe(arrivee)) versParent(ongletDe(arrivee));
    if (aJouer) {
      // Les mêmes règles que sur une tuile : un jeu choisi, et du temps qu'il reste.
      var g = games.filter(function (x) { return x.id === aJouer; })[0];
      if (g && choix(g.id) && resteJeu(g.id).jeu > 0 && document.querySelector('.tuile')) play(g);
    }
    finEssai();
  });
  // Pour essayer l'écran de fin et l'activité sans jouer jusqu'au bout : seulement sur le serveur de dev (localhost:7357).
  function finEssai() {
    if (!(/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port === '7357')) return;
    var q = new URLSearchParams(location.search), g = byId[q.get('fin')];
    if (!g || playing) return;
    var f = fam(), phrase = g.after ? pick(g.after) : '';
    rideau.textContent = '';
    rideau.appendChild(el('div', { class: 'rideau-carte' }, [
      el('img', { src: 'img/marmotte-dodo.webp', alt: '' }),
      el('h2', { text: t('kid.stopTitle') }),
      el('p', { text: t('kid.stopText', { n: f && f.enfant.nom ? f.enfant.nom : 'Petit Loup' }) }),
      phrase ? el('div', { class: 'rideau-apres' }, [
        LudiCatalogue.icone(g, 52), el('p', { text: phrase }),
        activiteDe(g) ? el('button', { type: 'button', class: 'btn-activite', onclick: function () { ouvrirActivite(g); } }, [icon('book'), t('kid.howTo')]) : null
      ]) : null,
      el('button', { type: 'button', class: 'btn-sun big', text: t('kid.stopOk'), onclick: function () { rideau.hidden = true; player.hidden = true; document.body.style.overflow = ''; } })
    ]));
    rideau.setAttribute('data-moment', 'nuit');
    player.hidden = false; document.body.style.overflow = 'hidden'; // l'écran de fin vit dans le cadre du jeu
    rideau.hidden = false;
    var n = parseInt(q.get('etape'), 10);
    if (n >= 0 && activiteDe(g)) ouvrirActivite(g, n);
  }
  // La page revient du cache du navigateur (retour depuis une page du site) : côté parent encore ouvert, on le garde ; sinon côté enfant.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted || vue !== 'parent') return;
    if (LudiBarre.parentOuvert()) { derniereActivite = Date.now(); renderParent(); }
    else { closeGate(); fermerCarnet(); }
  });
  // Retour sur l'appli (« +10 min » donné depuis le téléphone, par exemple) : on regarde s'il y a du neuf.
  document.addEventListener('visibilitychange', function () { if (!document.hidden) synchroniser(); });
  window.addEventListener('online', synchroniser);
  setInterval(function () { if (!document.hidden && vue === 'parent') synchroniser(); }, 30000);
  // « Côté parent » touché sans quitter la page (adresse tapée) : même règle.
  window.addEventListener('hashchange', function () {
    var o = ongletDe(location.hash);
    if (!o || !prepare) return;
    history.replaceState(history.state, '', location.pathname + location.search);
    if (playing) return;
    if (vue === 'parent') { tab = o; renderParent(); return; }
    versParent(o);
  });

  // Pour les tests et la démo : avancer le temps de jeu d'aujourd'hui sans attendre (console).
  window.ludiDemo = {
    ajouter: function (id, minutes) { addTime(id, minutes * MIN); flushStore(); render(); },
    etat: function () { return JSON.parse(JSON.stringify(store)); }
  };
})();
