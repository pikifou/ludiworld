/* Ludiworld, le site : langue FR / EN, barre et pied communs, fiches des jeux et de « Ludiworld aime bien ».
   Le français est écrit dans chaque page (data-t) ; l'anglais vient de en.js à côté de la page (LudiSite.en). Aucune dépendance. */
(function () {
  'use strict';

  var LANG_KEY = 'ludiworld.lang';
  var BASE = '../'; // toutes les pages du site sont à un dossier de la racine
  var GH = 'https://github.com/pikifou/ludiworld';

  // Textes communs à toutes les pages.
  var T = {
    fr: {
      foot: 'Fait par Julien (pikifou), d\'abord pour son fils.',
      footPrivacy: 'Ce que Ludiworld fait des données',
      footCode: 'Le code sur GitHub',
      years: function (a, b) { return a + ' à ' + b + ' ans'; },
      mins: function (a, b) { return a === b ? a + ' min' : a + ' à ' + b + ' min'; },
      fAge: 'Âge', fSession: 'Partie', fReading: 'Lecture', fLang: 'Langues', fDevices: 'Sur', fOffline: 'Sans réseau',
      yes: 'oui', no: 'non',
      reading: { none: 'Sans lecture', some: 'Quelques mots', fluent: 'Bien lire' },
      goal: { core: 'Apprendre est le but', side: 'On apprend en passant', none: 'Pour le plaisir' },
      langs: { fr: 'français', en: 'anglais' },
      devices: { phone: 'téléphone', tablet: 'tablette', computer: 'ordinateur' },
      healthy: {
        no_ads: 'Aucune publicité', no_purchases: 'Rien à acheter', no_subscription: 'Pas d\'abonnement',
        no_loot_boxes: 'Pas de récompense au hasard', no_daily_pressure: 'Pas de « reviens demain »',
        no_notifications: 'Aucune notification', no_strangers: 'Aucun inconnu', no_tracking: 'Aucune donnée envoyée',
        natural_stops: 'On peut s\'arrêter sans rien perdre'
      },
      domains: {
        'maths.multiplication': 'Tables de multiplication', 'maths.calcul-mental': 'Calcul mental',
        'sciences.magnetisme': 'Magnétisme', 'sciences.physique': 'Physique', 'geographie.pays': 'Pays du monde',
        'histoire.prehistoire': 'Préhistoire', 'histoire.techniques': 'Histoire des techniques',
        'logique.puzzle': 'Logique', 'memoire.sequences': 'Mémoire', 'gestion.ressources': 'Gestion',
        'motricite.reflexes': 'Réflexes', 'strategie.choix': 'Stratégie', 'emotions.frustration': 'Gérer la frustration'
      },
      gError: 'Les fiches n\'ont pas pu se charger. Réessayez avec du réseau.',
      learnWhat: 'Ce qu\'on y apprend', learnHow: 'Comment', content: 'À savoir', promises: 'Engagements',
      thirdNone: 'Ne contacte aucun autre site.', third: function (l) { return 'Contacte aussi : ' + l + '.'; },
      by: function (n) { return 'par ' + n; },
      draft: 'Fiche écrite, pas encore relue par son auteur.',
      tryGame: 'Essayer le jeu seul', tryNote: 'Hors de Ludiworld, le temps de jeu n\'est pas compté.',
      code: 'Le code du jeu',
      recoType: { serie: 'Série', film: 'Film', appli: 'Appli' },
      recoBy: function (n) { return 'Recommandé par ' + n; },
      recoQueue: function (n) { return 'Proposé par ' + n + ', pas encore validé'; },
      recoMore: 'Lire la fiche',
      recoLearn: 'Ce qu\'on y apprend', recoWhy: 'Pourquoi on aime', recoWatch: 'À savoir', recoWhere: 'Où regarder', recoLang: 'Langues',
      recoWhereApp: 'Où la trouver',
      recoMissing: 'À compléter',
      recoPartial: 'Fiche partielle. Vous connaissez ? Aidez à la compléter.',
      recoNone: 'Rien ici pour l\'instant.',
      recoQueueNone: 'Personne n\'a encore rien proposé. Soyez le premier parent à le faire.',
      copied: 'Copié', copy: 'Copier'
    },
    en: {
      foot: 'Made by Julien (pikifou), first for his son.',
      footPrivacy: 'What Ludiworld does with data',
      footCode: 'The code on GitHub',
      years: function (a, b) { return 'ages ' + a + ' to ' + b; },
      mins: function (a, b) { return a === b ? a + ' min' : a + ' to ' + b + ' min'; },
      fAge: 'Age', fSession: 'Session', fReading: 'Reading', fLang: 'Languages', fDevices: 'On', fOffline: 'Offline',
      yes: 'yes', no: 'no',
      reading: { none: 'No reading', some: 'A few words', fluent: 'Fluent reading' },
      goal: { core: 'Learning is the point', side: 'Some learning on the way', none: 'Just for fun' },
      langs: { fr: 'French', en: 'English' },
      devices: { phone: 'phone', tablet: 'tablet', computer: 'computer' },
      healthy: {
        no_ads: 'No ads', no_purchases: 'Nothing to buy', no_subscription: 'No subscription',
        no_loot_boxes: 'No random rewards', no_daily_pressure: 'No "come back tomorrow"',
        no_notifications: 'No notifications', no_strangers: 'No strangers', no_tracking: 'No data sent',
        natural_stops: 'You can stop without losing anything'
      },
      domains: {
        'maths.multiplication': 'Times tables', 'maths.calcul-mental': 'Mental maths',
        'sciences.magnetisme': 'Magnetism', 'sciences.physique': 'Physics', 'geographie.pays': 'Countries of the world',
        'histoire.prehistoire': 'Prehistory', 'histoire.techniques': 'History of techniques',
        'logique.puzzle': 'Logic', 'memoire.sequences': 'Memory', 'gestion.ressources': 'Resource management',
        'motricite.reflexes': 'Reflexes', 'strategie.choix': 'Strategy', 'emotions.frustration': 'Handling frustration'
      },
      gError: 'The cards could not load. Try again with a connection.',
      learnWhat: 'What it teaches', learnHow: 'How', content: 'Worth knowing', promises: 'Commitments',
      thirdNone: 'Contacts no other site.', third: function (l) { return 'Also contacts: ' + l + '.'; },
      by: function (n) { return 'by ' + n; },
      draft: 'Card written, not yet reviewed by its author.',
      tryGame: 'Try the game on its own', tryNote: 'Outside Ludiworld, play time is not counted.',
      code: 'The game\'s code',
      recoType: { serie: 'Series', film: 'Film', appli: 'App' },
      recoBy: function (n) { return 'Recommended by ' + n; },
      recoQueue: function (n) { return 'Suggested by ' + n + ', not validated yet'; },
      recoMore: 'Read the card',
      recoLearn: 'What it teaches', recoWhy: 'Why we like it', recoWatch: 'Worth knowing', recoWhere: 'Where to watch', recoLang: 'Languages',
      recoWhereApp: 'Where to get it',
      recoMissing: 'To be completed',
      recoPartial: 'Partial card. Know it? Help complete it.',
      recoNone: 'Nothing here yet.',
      recoQueueNone: 'Nobody has suggested anything yet. Be the first parent to do so.',
      copied: 'Copied', copy: 'Copy'
    }
  };
  var FR = {}; // textes de la page, relevés au chargement
  var EN = {}; // textes de la page en anglais (en.js)
  var surLangue = []; // ce qu'une page veut refaire quand la langue change

  var lang = (function () {
    try { var l = localStorage.getItem(LANG_KEY); if (l === 'fr' || l === 'en') return l; } catch (e) { /* rien */ }
    return /^fr/i.test(navigator.language || '') ? 'fr' : 'en';
  })();
  function D(k) { var v = (lang === 'en' ? EN : FR)[k]; return v !== undefined ? v : T[lang][k]; }
  function C() { return T[lang]; }

  // ---------- Petits outils ----------
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.className = v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  // Textes des fiches : en français, espace insécable avant « ? ! : ; » pour qu'ils ne partent pas seuls à la ligne.
  function pick(bi) {
    var s = bi ? (bi[lang] || bi.fr || bi.en || '') : '';
    return lang === 'fr' ? s.replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ') : s;
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svg(inner, cls) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    s.innerHTML = inner;
    return s;
  }
  var ICO = {
    core: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" class="fill"/>',
    side: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" class="fill"/>',
    none: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    serie: '<rect x="3" y="6.5" width="18" height="12.5" rx="2.5"/><path d="M8.5 2.5l3.5 4 3.5-4M9 22h6"/>',
    film: '<rect x="3" y="9.5" width="18" height="11" rx="1.5"/><path d="M3.4 9.5l1.4-5 15.8-1.2.4 3.6zM8.5 4.2l1.6 4.6M14.2 3.8l1.6 4.6"/>',
    appli: '<rect x="5.5" y="2.5" width="13" height="19" rx="2.5"/><path d="M10.5 18h3"/>',
    soleil: '<circle cx="12" cy="12" r="4.5" class="fill"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    attente: '<path d="M6 2h12M6 22h12M7 2c0 5 5 6 5 10s-5 5-5 10M17 2c0 5-5 6-5 10s5 5 5 10"/>'
  };

  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  // ---------- Langue ----------
  function applyLang() {
    document.documentElement.lang = lang;
    var meta = document.querySelector('meta[name="description"]');
    if (meta && D('metaDesc')) meta.setAttribute('content', D('metaDesc'));
    if (D('docTitle')) document.title = D('docTitle');
    document.querySelectorAll('[data-t]').forEach(function (n) {
      var v = D(n.getAttribute('data-t'));
      if (typeof v === 'string') n.innerHTML = v; // textes écrits ici, jamais venus du réseau
    });
    document.querySelectorAll('[data-t-alt]').forEach(function (n) { var v = D(n.getAttribute('data-t-alt')); if (v) n.setAttribute('alt', v); });
    document.querySelectorAll('[data-t-aria]').forEach(function (n) { var v = D(n.getAttribute('data-t-aria')); if (v) n.setAttribute('aria-label', v); });
    barre();
    pied();
    renderAll();
    surLangue.forEach(function (f) { f(); });
  }
  function setLang(l) {
    lang = l;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* rien */ }
    applyLang();
  }

  function barre() {
    var hote = document.getElementById('lw-barre');
    if (hote && window.LudiBarre) LudiBarre.rendre(hote, { base: BASE, actif: document.body.getAttribute('data-page'), lang: lang, onLang: setLang });
    document.querySelectorAll('[data-app]').forEach(function (a) {
      a.setAttribute('href', LudiBarre.lienApp(BASE));
      if (LudiBarre.nouveauVenu()) a.textContent = LudiBarre.libelleEssai(lang);
    });
  }
  function pied() {
    var f = document.getElementById('lw-pied');
    if (!f) return;
    f.textContent = '';
    f.appendChild(el('p', null, [
      el('span', { text: C().foot }), ' ',
      el('a', { href: GH, text: C().footCode }), ' ',
      el('a', { href: BASE + 'confidentialite/', text: C().footPrivacy })
    ]));
  }

  // ---------- Jeux ----------
  var games = null, gamesFailed = false;
  function safeColor(c) { return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#1d2b4f'; }
  function goalBadge(level) {
    if (!ICO[level]) level = 'none';
    return el('p', { class: 'goal goal-' + level }, [svg(ICO[level]), el('span', { text: C().goal[level] })]);
  }
  function gameIco(g) {
    var title = pick(g.title);
    var ico = el('div', { class: 'jeu-ico', 'aria-hidden': 'true', text: (title || '?').charAt(0) });
    if (g.icon && /^https?:\/\//.test(g.icon)) {
      var img = el('img', { src: g.icon, alt: '', loading: 'lazy', width: '64', height: '64' });
      img.addEventListener('error', function () { img.remove(); });
      img.addEventListener('load', function () { if (ico.firstChild && ico.firstChild.nodeType === 3) ico.removeChild(ico.firstChild); });
      ico.appendChild(img);
    }
    return ico;
  }
  function facts(g, full) {
    var c = C();
    var rows = [
      g.age ? [c.fAge, c.years(g.age.min, g.age.max)] : null,
      g.session && g.session.minutes ? [c.fSession, c.mins(g.session.minutes[0], g.session.minutes[1])] : null,
      g.reading ? [c.fReading, c.reading[g.reading] || g.reading] : null
    ];
    if (full) rows = rows.concat([
      g.languages ? [c.fLang, g.languages.map(function (l) { return c.langs[l] || l; }).join(', ')] : null,
      g.devices ? [c.fDevices, g.devices.map(function (d) { return c.devices[d] || d; }).join(', ')] : null,
      [c.fOffline, g.offline ? c.yes : c.no]
    ]);
    return el('dl', { class: 'facts' }, rows.map(function (r) { return r ? el('div', null, [el('dt', { text: r[0] }), el('dd', { text: r[1] })]) : null; }));
  }
  function tags(g) {
    var domains = (g.learning && g.learning.domains) || [];
    return domains.length ? el('ul', { class: 'tags', 'aria-label': C().learnWhat }, domains.map(function (d) { return el('li', { text: C().domains[d] || d.split('.').pop() }); })) : null;
  }
  // Carte courte (accueil).
  function card(g) {
    var a = el('article', { class: 'jeu' }, [
      el('div', { class: 'jeu-top' }, [gameIco(g), el('div', null, [el('h3', null, [el('a', { href: BASE + 'les-jeux/#' + g.id, text: pick(g.title) })]), goalBadge(g.learning && g.learning.level)])]),
      el('p', { class: 'jeu-pitch', text: pick(g.pitch) }),
      facts(g),
      tags(g)
    ]);
    a.style.setProperty('--jc', safeColor(g.color));
    return a;
  }
  // Fiche complète (page des jeux) : tout ce que dit ludi.json, y compris le moins flatteur.
  function fiche(g) {
    var c = C(), l = g.learning || {};
    var promesses = Object.keys(c.healthy).filter(function (k) { return g.healthy && g.healthy[k] === true; });
    var a = el('article', { class: 'fiche', id: g.id }, [
      el('header', { class: 'fiche-tete' }, [
        gameIco(g),
        el('div', null, [
          el('h2', { text: pick(g.title) }),
          el('p', { class: 'fiche-auteur', text: c.by(g.author && g.author.name || '?') }),
          goalBadge(l.level)
        ])
      ]),
      el('p', { class: 'fiche-pitch', text: pick(g.pitch) }),
      facts(g, true),
      el('div', { class: 'fiche-corps' }, [
        el('section', null, [
          el('h3', { text: c.learnWhat }),
          tags(g),
          l.what ? el('p', { text: pick(l.what) }) : null,
          l.how ? el('p', null, [el('strong', { text: c.learnHow + ' : ' }), pick(l.how)]) : null
        ]),
        el('section', null, [el('h3', { text: c.content }), el('p', { text: pick(g.content) })]),
        el('section', { class: 'fiche-promesses' }, [
          el('h3', { text: c.promises }),
          el('ul', null, promesses.map(function (k) { return el('li', null, [svg(ICO.check), c.healthy[k]]); })),
          el('p', { class: 'fiche-tiers', text: g.third_parties && g.third_parties.length ? c.third(g.third_parties.join(', ')) : c.thirdNone })
        ])
      ]),
      el('footer', { class: 'fiche-pied' }, [
        g.status === 'draft' ? el('p', { class: 'fiche-brouillon', text: c.draft }) : null,
        el('p', { class: 'fiche-liens' }, [
          el('a', { class: 'btn btn-paper', href: g.url, target: '_blank', rel: 'noopener', text: c.tryGame }),
          g.author && g.author.url ? el('a', { class: 'lien-encre', href: g.author.url, target: '_blank', rel: 'noopener', text: c.code }) : null
        ]),
        el('p', { class: 'fiche-note', text: c.tryNote })
      ])
    ]);
    a.style.setProperty('--jc', safeColor(g.color));
    return a;
  }
  function renderGames() {
    var list = document.getElementById('jeux-list');
    var full = document.getElementById('fiches-jeux');
    [list, full].forEach(function (box) {
      if (!box) return;
      if (gamesFailed) { box.replaceChildren(el('p', { class: 'jeux-wait', text: C().gError })); return; }
      if (!games) return;
      box.replaceChildren.apply(box, games.map(box === full ? fiche : card));
    });
    // Arrivée sur une fiche précise (les-jeux/#pluie-de-cochons) : les fiches sont dessinées après le chargement.
    if (full && games && location.hash && !renderGames.vu) {
      renderGames.vu = true;
      var cible = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (cible) cible.scrollIntoView();
    }
  }
  function loadGames() {
    if (!document.getElementById('jeux-list') && !document.getElementById('fiches-jeux')) return;
    getJSON(BASE + 'jeux/index.json').then(function (idx) {
      return Promise.all(((idx && idx.games) || []).map(function (f) {
        if (!/^[a-z0-9-]+\.json$/i.test(f)) return null;
        return getJSON(BASE + 'jeux/' + f).catch(function () { return null; });
      }));
    }).then(function (list) {
      games = list.filter(function (g) { return g && g.title; });
      if (!games.length) gamesFailed = true;
      renderGames();
    }).catch(function () { gamesFailed = true; renderGames(); });
  }

  // ---------- Ludiworld aime bien ----------
  var recos = null, recosFailed = false, filtre = 'tout';
  function recoType(r) {
    return el('p', { class: 'reco-type' }, [svg(ICO[r.type] || ICO.serie), el('span', { text: C().recoType[r.type] || r.type })]);
  }
  function manque(v) { return v ? el('dd', { text: pick(v) }) : el('dd', { class: 'manque', text: C().recoMissing }); }
  function recoCard(r) {
    var c = C(), valide = r.status === 'valide';
    var meta = [r.age ? c.years(r.age.min, r.age.max) : null, r.format ? pick(r.format) : null].filter(Boolean).join(' · ');
    var a = el('article', { class: 'reco reco-' + r.type + (valide ? '' : ' en-attente'), id: r.id }, [
      recoType(r),
      el('h3', { text: pick(r.title) }),
      meta ? el('p', { class: 'reco-meta', text: meta }) : null,
      el('p', { class: 'reco-pitch', text: pick(r.pitch) }),
      el('p', { class: 'reco-par' }, [svg(valide ? ICO.soleil : ICO.attente), el('span', { text: valide ? c.recoBy(r.by) : c.recoQueue(r.by) })]),
      el('details', { class: 'reco-plus' }, [
        el('summary', { text: c.recoMore }),
        el('dl', { class: 'reco-fiche' }, [
          el('dt', { text: c.recoLearn }), manque(r.learn),
          el('dt', { text: c.recoWhy }), manque(r.why),
          el('dt', { text: c.recoWatch }), manque(r.watch_out),
          el('dt', { text: r.type === 'appli' ? c.recoWhereApp : c.recoWhere }), manque(r.where),
          r.languages ? el('dt', { text: c.recoLang }) : null,
          r.languages ? el('dd', { text: r.languages.map(function (l) { return c.langs[l] || l; }).join(', ') }) : null
        ]),
        r.incomplete ? el('p', { class: 'reco-partielle' }, [el('a', { href: GH + '/issues/new?template=recommander.yml&title=' + encodeURIComponent('Fiche : ' + pick(r.title)), text: c.recoPartial })]) : null
      ])
    ]);
    return a;
  }
  function renderRecos() {
    // Aperçu (accueil) : quelques recommandations validées, en carnet ligné.
    var apercu = document.getElementById('aime-apercu');
    if (apercu) {
      if (recosFailed) apercu.replaceChildren(el('p', { text: C().gError }));
      else if (recos) apercu.replaceChildren.apply(apercu, recos.filter(function (r) { return r.status === 'valide'; }).slice(0, 8).map(function (r) {
        return el('div', null, [
          el('dt', null, [el('a', { href: BASE + 'aime-bien/#' + r.id, text: pick(r.title) }), el('span', { class: 'carnet-type', text: ' · ' + (C().recoType[r.type] || '') })]),
          el('dd', { text: pick(r.pitch) })
        ]);
      }));
    }
    // Page complète : filtres par type, recommandé d'un côté, proposé de l'autre.
    var val = document.getElementById('ab-valides'), prop = document.getElementById('ab-proposes');
    if (!val || !prop) return;
    if (recosFailed) { val.replaceChildren(el('p', { class: 'jeux-wait', text: C().gError })); return; }
    if (!recos) return;
    var vus = recos.filter(function (r) { return filtre === 'tout' || r.type === filtre; });
    var v = vus.filter(function (r) { return r.status === 'valide'; });
    var p = vus.filter(function (r) { return r.status !== 'valide'; });
    val.replaceChildren.apply(val, v.length ? v.map(recoCard) : [el('p', { class: 'ab-vide', text: C().recoNone })]);
    prop.replaceChildren.apply(prop, p.length ? p.map(recoCard) : [el('p', { class: 'ab-vide', text: C().recoQueueNone })]);
    document.querySelectorAll('[data-filtre]').forEach(function (b) {
      var k = b.getAttribute('data-filtre');
      b.setAttribute('aria-pressed', String(k === filtre));
      var n = recos.filter(function (r) { return k === 'tout' || r.type === k; }).length;
      var compte = b.querySelector('.compte');
      if (compte) compte.textContent = String(n);
    });
  }
  function loadRecos() {
    if (!document.getElementById('aime-apercu') && !document.getElementById('ab-valides')) return;
    document.querySelectorAll('[data-filtre]').forEach(function (b) {
      b.addEventListener('click', function () { filtre = b.getAttribute('data-filtre'); renderRecos(); });
    });
    getJSON(BASE + 'aime-bien/fiches.json').then(function (f) {
      recos = (f && f.items) || [];
      renderRecos();
      var cible = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (cible && cible.classList.contains('reco')) { var d = cible.querySelector('details'); if (d) d.open = true; cible.scrollIntoView(); }
    }).catch(function () { recosFailed = true; renderRecos(); });
  }

  function renderAll() { renderGames(); renderRecos(); }

  // ---------- Bouton « Copier » (consignes à donner à son IA) ----------
  function copiers() {
    document.querySelectorAll('[data-copier]').forEach(function (b) {
      b.addEventListener('click', function () {
        var src = document.getElementById(b.getAttribute('data-copier'));
        if (!src || !navigator.clipboard) return;
        navigator.clipboard.writeText(src.innerText.trim()).then(function () {
          b.textContent = C().copied;
          setTimeout(function () { b.textContent = D(b.getAttribute('data-t')) || C().copy; }, 1600);
        }).catch(function () { /* rien */ });
      });
    });
  }

  // Le parent qui lit le site reste « dans le carnet » tant qu'il est actif (sinon le code sera redemandé).
  ['pointerdown', 'keydown', 'scroll'].forEach(function (ev) {
    document.addEventListener(ev, function () { if (window.LudiBarre && LudiBarre.parentOuvert()) LudiBarre.ouvrirParent(); }, { passive: true, capture: true });
  });

  window.LudiSite = {
    en: function (dict) { Object.keys(dict).forEach(function (k) { EN[k] = dict[k]; }); },
    texte: D, rafraichir: barre, surLangue: function (f) { surLangue.push(f); }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var meta = document.querySelector('meta[name="description"]');
    if (meta) FR.metaDesc = meta.getAttribute('content');
    FR.docTitle = document.title;
    document.querySelectorAll('[data-t]').forEach(function (n) { FR[n.getAttribute('data-t')] = n.innerHTML; });
    document.querySelectorAll('[data-t-alt]').forEach(function (n) { FR[n.getAttribute('data-t-alt')] = n.getAttribute('alt'); });
    document.querySelectorAll('[data-t-aria]').forEach(function (n) { FR[n.getAttribute('data-t-aria')] = n.getAttribute('aria-label'); });
    copiers();
    loadGames();
    loadRecos();
    applyLang();
  });
})();
