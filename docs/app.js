/* Ludiworld : le launcher (v0). Tout reste sur l'appareil. */
(function () {
  'use strict';

  var STORE = 'ludiworld.v1';
  var LANG_KEY = 'ludiworld.lang';

  // ---------- Textes ----------
  var T = {
    fr: {
      tagline: 'Des petits jeux faits maison par des parents, choisis pour les enfants.',
      footer: 'Sans pub, sans achat, sans pièges. Chaque jeu a sa fiche : ce qu’on y apprend, pour quel âge, combien de temps.',
      addGame: 'Ajouter un jeu',
      install: 'Installer Ludiworld',
      weekNone: 'Pas encore joué cette semaine',
      week: 'Cette semaine : <strong>{t}</strong> de jeu',
      ages: '{a} à {b} ans',
      play: 'Jouer',
      back: '← Ludiworld',
      close: 'Fermer',
      by: 'Par {n}',
      age: 'Âge',
      reading: 'Lecture',
      session: 'Une partie',
      sessionVal: '{a} à {b} min',
      languages: 'Langues',
      devices: 'Appareils',
      offline: 'Sans réseau',
      yes: 'Oui', no: 'Non',
      learnTitle: 'Ce qu’on apprend',
      learnHow: 'Comment',
      contentTitle: 'À savoir',
      promisesTitle: 'Engagements',
      thirdNone: 'Ne contacte aucun autre site.',
      third: 'Contacte aussi : {l}.',
      oursTitle: 'Chez nous',
      oursNone: 'Pas encore joué sur cet appareil.',
      oursWeek: 'Cette semaine : {t}',
      oursTotal: 'En tout : {t} en {n} partie(s)',
      draft: 'Fiche en cours de relecture par son auteur.',
      code: 'Voir le jeu sur GitHub',
      newTab: 'S’ouvre dans un nouvel onglet : le temps de jeu n’y est pas compté.',
      source: 'Fiche vérifiée le {d}.',
      kitOn: 'Ce jeu partage ses scores avec Ludiworld.',
      kitOff: 'Le temps de jeu est mesuré par Ludiworld ; les scores arriveront quand le jeu utilisera le kit.',
      loadError: 'Impossible de charger les jeux. Vérifie la connexion et réessaie.',
      empty: 'Aucun jeu pour l’instant.',
      level: { core: 'Apprendre est le but du jeu', side: 'On apprend en passant', none: 'Pour le plaisir' },
      read: { none: 'Pas besoin de savoir lire', some: 'Quelques mots à lire', fluent: 'Il faut savoir lire' },
      dev: { phone: 'téléphone', tablet: 'tablette', computer: 'ordinateur' },
      lang: { fr: 'français', en: 'anglais' },
      healthy: {
        no_ads: 'Aucune publicité', no_purchases: 'Rien à acheter', no_subscription: 'Pas d’abonnement',
        no_loot_boxes: 'Pas de récompense au hasard', no_daily_pressure: 'Pas de « reviens demain »',
        no_notifications: 'Aucune notification', no_strangers: 'Aucun inconnu', no_tracking: 'Aucune donnée envoyée',
        natural_stops: 'On peut s’arrêter sans rien perdre'
      },
      domains: {
        'maths.multiplication': 'Tables de multiplication', 'maths.calcul-mental': 'Calcul mental',
        'sciences.magnetisme': 'Magnétisme', 'sciences.physique': 'Physique',
        'histoire.prehistoire': 'Préhistoire', 'histoire.techniques': 'Histoire des techniques',
        'logique.puzzle': 'Logique', 'memoire.sequences': 'Mémoire', 'gestion.ressources': 'Gestion',
        'motricite.reflexes': 'Réflexes', 'strategie.choix': 'Stratégie'
      }
    },
    en: {
      tagline: 'Small home-made games by parents, chosen for kids.',
      footer: 'No ads, no purchases, no dark patterns. Every game has a card: what it teaches, for which age, for how long.',
      addGame: 'Add a game',
      install: 'Install Ludiworld',
      weekNone: 'Nothing played yet this week',
      week: 'This week: <strong>{t}</strong> of play',
      ages: 'Ages {a} to {b}',
      play: 'Play',
      back: '← Ludiworld',
      close: 'Close',
      by: 'By {n}',
      age: 'Age',
      reading: 'Reading',
      session: 'One session',
      sessionVal: '{a} to {b} min',
      languages: 'Languages',
      devices: 'Devices',
      offline: 'Works offline',
      yes: 'Yes', no: 'No',
      learnTitle: 'What kids learn',
      learnHow: 'How',
      contentTitle: 'Good to know',
      promisesTitle: 'Commitments',
      thirdNone: 'Contacts no other website.',
      third: 'Also contacts: {l}.',
      oursTitle: 'At home',
      oursNone: 'Not played on this device yet.',
      oursWeek: 'This week: {t}',
      oursTotal: 'In total: {t} over {n} session(s)',
      draft: 'This card is being reviewed by its author.',
      code: 'See the game on GitHub',
      newTab: 'Opens in a new tab: play time isn’t counted there.',
      source: 'Card checked on {d}.',
      kitOn: 'This game shares its scores with Ludiworld.',
      kitOff: 'Play time is measured by Ludiworld; scores will come once the game uses the kit.',
      loadError: 'Couldn’t load the games. Check the connection and try again.',
      empty: 'No games yet.',
      level: { core: 'Learning is the point of the game', side: 'Learning along the way', none: 'Just for fun' },
      read: { none: 'No reading needed', some: 'A few words to read', fluent: 'Needs fluent reading' },
      dev: { phone: 'phone', tablet: 'tablet', computer: 'computer' },
      lang: { fr: 'French', en: 'English' },
      healthy: {
        no_ads: 'No ads', no_purchases: 'Nothing to buy', no_subscription: 'No subscription',
        no_loot_boxes: 'No random rewards', no_daily_pressure: 'No “come back tomorrow”',
        no_notifications: 'No notifications', no_strangers: 'No strangers', no_tracking: 'No data sent',
        natural_stops: 'Can stop without losing anything'
      },
      domains: {
        'maths.multiplication': 'Times tables', 'maths.calcul-mental': 'Mental maths',
        'sciences.magnetisme': 'Magnetism', 'sciences.physique': 'Physics',
        'histoire.prehistoire': 'Prehistory', 'histoire.techniques': 'History of techniques',
        'logique.puzzle': 'Logic', 'memoire.sequences': 'Memory', 'gestion.ressources': 'Resource management',
        'motricite.reflexes': 'Reflexes', 'strategie.choix': 'Strategy'
      }
    }
  };

  var lang = (function () {
    try { var l = localStorage.getItem(LANG_KEY); if (l === 'fr' || l === 'en') return l; } catch (e) { /* rien */ }
    return /^fr/i.test(navigator.language || 'fr') ? 'fr' : 'en';
  })();
  function t(key, vars) {
    var s = key.split('.').reduce(function (o, k) { return o && o[k]; }, T[lang]);
    if (s === undefined) s = key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function pick(bi) { return bi ? (bi[lang] || bi.fr || bi.en || '') : ''; }

  // ---------- Petits outils ----------
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'style') n.setAttribute('style', attrs[k]);
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function duration(ms) {
    var min = Math.round(ms / 60000);
    if (min < 1) return lang === 'fr' ? 'moins d’une minute' : 'under a minute';
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    return h + ' h' + (m ? ' ' + (m < 10 ? '0' : '') + m : '');
  }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function lastDays(n) { var out = [], d = new Date(); for (var i = 0; i < n; i++) { out.push(dayKey(d)); d.setDate(d.getDate() - 1); } return out; }

  // ---------- Ce que Ludiworld retient (sur l'appareil) ----------
  var store = (function () {
    try { return JSON.parse(localStorage.getItem(STORE)) || { games: {} }; } catch (e) { return { games: {} }; }
  })();
  function saveStore() { try { localStorage.setItem(STORE, JSON.stringify(store)); } catch (e) { /* rien */ } }
  function gameStats(id) {
    var g = store.games[id];
    if (!g) g = store.games[id] = { ms: 0, sessions: 0, days: {}, scores: {}, progress: {}, kit: false };
    return g;
  }
  function addTime(id, ms) {
    if (!(ms > 0)) return;
    var g = gameStats(id), k = dayKey();
    g.ms += ms; g.days[k] = (g.days[k] || 0) + ms;
    // On ne garde que 60 jours.
    var keep = lastDays(60);
    Object.keys(g.days).forEach(function (d) { if (keep.indexOf(d) === -1) delete g.days[d]; });
    saveStore();
  }
  function weekMs(id) {
    var days = lastDays(7);
    var ids = id ? [id] : Object.keys(store.games);
    return ids.reduce(function (sum, gid) {
      var g = store.games[gid]; if (!g) return sum;
      return sum + days.reduce(function (s, d) { return s + (g.days[d] || 0); }, 0);
    }, 0);
  }

  // ---------- Catalogue ----------
  var games = [];
  var shelvesEl = document.getElementById('shelves');

  function loadCatalogue() {
    return fetch('jeux/index.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (index) {
        return Promise.all(index.games.map(function (file) {
          return fetch('jeux/' + file, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
        }));
      })
      .then(function (list) { games = list.filter(function (g) { return g && g.id && g.url; }); });
  }

  function columns() { var w = window.innerWidth; return w < 560 ? 2 : w < 900 ? 3 : 4; }

  function renderShelves() {
    shelvesEl.textContent = '';
    if (!games.length) { shelvesEl.appendChild(el('p', { class: 'empty', text: t('empty') })); return; }
    var cols = columns();
    for (var i = 0; i < games.length; i += cols) {
      var row = games.slice(i, i + cols);
      var shelf = el('section', { class: 'shelf', style: '--cols:' + cols });
      var top = el('div', { class: 'shelf-row' });
      var labels = el('div', { class: 'labels' });
      row.forEach(function (g) {
        var title = pick(g.title);
        top.appendChild(el('button', {
          type: 'button', class: 'game', style: '--game:' + (g.color || ''), 'aria-label': title,
          onclick: function () { openSheet(g); }
        }, [el('img', { src: g.icon, alt: '', loading: 'lazy', decoding: 'async' })]));
        labels.appendChild(el('div', { class: 'game-label' }, [
          el('b', { text: title }),
          el('span', { text: t('ages', { a: g.age.min, b: g.age.max }) })
        ]));
      });
      shelf.appendChild(top);
      shelf.appendChild(el('div', { class: 'plank', 'aria-hidden': 'true' }));
      shelf.appendChild(labels);
      shelvesEl.appendChild(shelf);
    }
  }

  function renderWeek() {
    var ms = weekMs();
    var w = document.getElementById('week');
    if (ms < 60000) w.textContent = t('weekNone');
    else w.innerHTML = t('week', { t: duration(ms) }); // seule la durée calculée est insérée
  }

  function renderStatic() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach(function (n) { n.textContent = t(n.getAttribute('data-t')); });
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
    document.getElementById('player-back').textContent = t('back');
    renderWeek();
  }

  // ---------- Fiche ----------
  var sheet = document.getElementById('sheet');
  var current = null;

  function fact(label, value) { return el('div', null, [el('dt', { text: label }), el('dd', { text: value })]); }

  function openSheet(g, fromHistory) {
    current = g;
    var stats = store.games[g.id];
    var playIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    playIcon.setAttribute('viewBox', '0 0 24 24'); playIcon.setAttribute('aria-hidden', 'true');
    playIcon.innerHTML = '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>';

    var learnBits = [el('p', { class: 'level', text: t('level.' + g.learning.level) })];
    if (g.learning.domains.length) learnBits.push(el('ul', { class: 'chips' }, g.learning.domains.map(function (d) { return el('li', { text: t('domains')[d] || d }); })));
    if (g.learning.what) learnBits.push(el('p', { text: pick(g.learning.what) }));
    if (g.learning.how) learnBits.push(el('p', null, [el('strong', { text: t('learnHow') + ' : ' }), pick(g.learning.how)]));

    var promises = Object.keys(T[lang].healthy).filter(function (k) { return g.healthy && g.healthy[k] === true; });
    var ours = [];
    if (!stats || !stats.ms) ours.push(el('p', { text: t('oursNone') }));
    else {
      ours.push(el('p', { text: t('oursWeek', { t: duration(weekMs(g.id)) }) }));
      ours.push(el('p', { text: t('oursTotal', { t: duration(stats.ms), n: stats.sessions }) }));
      Object.keys(stats.scores || {}).forEach(function (k) { ours.push(el('p', { text: k + ' : ' + stats.scores[k].value })); });
    }

    var inner = el('div', { class: 'sheet-inner', style: '--game:' + (g.color || '') }, [
      el('button', { type: 'button', class: 'sheet-close', 'aria-label': t('close'), text: '×', onclick: function () { closeSheet(); } }),
      el('div', { class: 'sheet-head' }, [
        el('img', { src: g.icon, alt: '' }),
        el('div', null, [el('h2', { id: 'sheet-title', text: pick(g.title) }), el('p', { text: t('by', { n: g.author.name }) })])
      ]),
      el('p', { class: 'pitch', text: pick(g.pitch) }),
      el('button', { type: 'button', class: 'play', onclick: function () { play(g); } }, [playIcon, t('play')]),
      g.embed === false ? el('p', { class: 'newtab', text: t('newTab') }) : null,
      el('dl', { class: 'facts' }, [
        fact(t('age'), t('ages', { a: g.age.min, b: g.age.max })),
        fact(t('reading'), t('read.' + g.reading)),
        fact(t('session'), t('sessionVal', { a: g.session.minutes[0], b: g.session.minutes[1] })),
        fact(t('languages'), g.languages.map(function (l) { return (T[lang].lang[l] || l); }).join(', ')),
        fact(t('devices'), g.devices.map(function (d) { return T[lang].dev[d] || d; }).join(', ')),
        fact(t('offline'), g.offline ? t('yes') : t('no'))
      ]),
      el('section', null, [el('h3', { text: t('learnTitle') })].concat(learnBits)),
      el('section', null, [el('h3', { text: t('contentTitle') }), el('p', { text: pick(g.content) })]),
      el('section', null, [
        el('h3', { text: t('promisesTitle') }),
        el('ul', { class: 'promises' }, promises.map(function (k) { return el('li', { text: T[lang].healthy[k] }); })),
        el('p', { class: 'third', text: g.third_parties.length ? t('third', { l: g.third_parties.join(', ') }) : t('thirdNone') })
      ]),
      el('section', { class: 'ours' }, [el('h3', { text: t('oursTitle') })].concat(ours)),
      el('div', { class: 'meta' }, [
        el('p', { text: (stats && stats.kit) || g.kit ? t('kitOn') : t('kitOff') }),
        g.status === 'draft' ? el('p', { text: t('draft') }) : null,
        g.source && g.source.imported ? el('p', { text: t('source', { d: new Date(g.source.imported).toLocaleDateString(lang) }) }) : null,
        g.author.url ? el('p', null, [el('a', { href: g.author.url, target: '_blank', rel: 'noopener', text: t('code') })]) : null
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
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); }); // clic sur le fond
  sheet.addEventListener('cancel', function (e) { e.preventDefault(); closeSheet(); });   // touche Échap

  // ---------- Jouer ----------
  var player = document.getElementById('player');
  var frame = null;   // l'iframe est recréée à chaque partie (changer src ajouterait des pas à l'historique)
  var playing = null; // { game, origin, kit, since }
  var ignorePop = 0;  // nos propres history.back() ne doivent rien fermer d'autre

  function tick() {
    // Temps mesuré par le launcher, tant que le jeu n'a pas le kit.
    if (!playing || playing.kit || playing.since === null) return;
    var t0 = Date.now();
    addTime(playing.game.id, t0 - playing.since);
    playing.since = document.visibilityState === 'hidden' ? null : t0;
  }

  function play(g, fromHistory) {
    if (playing) return;
    var stats = gameStats(g.id);
    stats.sessions += 1; saveStore();
    // Site qui interdit l'affichage dans un cadre : le jeu s'ouvre dans un nouvel onglet.
    if (g.embed === false) { window.open(g.url, '_blank', 'noopener'); return; }
    playing = { game: g, origin: new URL(g.url, location.href).origin, kit: false, since: Date.now(), sheet: sheet.open };
    // La fiche est une fenêtre modale (au-dessus de tout) : on la cache pendant la partie.
    if (sheet.open) { if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open'); }
    frame = el('iframe', { title: pick(g.title), src: g.url, allow: 'fullscreen; autoplay; screen-wake-lock; gamepad', allowfullscreen: '' });
    player.appendChild(frame);
    player.hidden = false;
    document.body.style.overflow = 'hidden';
    if (!fromHistory) history.pushState({ ludi: 'play', id: g.id }, '');
    try { frame.focus(); } catch (e) { /* rien */ }
  }
  function stop(fromHistory) {
    if (!playing) return;
    tick();
    var backToSheet = playing.sheet;
    playing = null;
    if (frame) { frame.remove(); frame = null; }
    player.hidden = true;
    document.body.style.overflow = '';
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    if (!fromHistory && history.state && history.state.ludi === 'play') { ignorePop++; history.back(); }
    renderWeek();
    if (current && backToSheet) openSheet(current, true);
  }
  document.getElementById('player-back').addEventListener('click', function () { stop(); });
  setInterval(tick, 15000);
  document.addEventListener('visibilitychange', function () {
    if (!playing || playing.kit) return;
    if (document.visibilityState === 'hidden') tick();
    else if (playing.since === null) playing.since = Date.now();
  });
  window.addEventListener('pagehide', tick);

  // Dialogue avec le kit ludi.js (spec/kit.md)
  window.addEventListener('message', function (e) {
    if (!playing || !frame || e.source !== frame.contentWindow || e.origin !== playing.origin) return;
    var m = e.data;
    if (!m || typeof m !== 'object' || m.game !== playing.game.id) return;
    var g = gameStats(playing.game.id);
    if (m.type === 'ludi:hello') {
      tick();                // on arrête de mesurer nous-mêmes : le kit prend le relais
      playing.kit = true; g.kit = true; saveStore();
      frame.contentWindow.postMessage({ type: 'ludi:welcome', player: null }, playing.origin);
    } else if (m.type === 'ludi:event' && m.event) {
      var ev = m.event;
      if (ev.kind === 'session') addTime(playing.game.id, Math.min(Number(ev.ms) || 0, 120000));
      else if (ev.kind === 'score' && ev.record) { g.scores[ev.key] = { value: ev.value, better: ev.better }; saveStore(); }
      else if (ev.kind === 'progress') { g.progress[ev.key] = ev.value; saveStore(); }
    }
  });

  // Bouton retour (Android) : ferme le jeu, puis la fiche.
  window.addEventListener('popstate', function () {
    if (ignorePop) { ignorePop--; return; }
    if (playing) { stop(true); return; }
    if (sheet.open) closeSheet(true);
  });

  // ---------- Langue ----------
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      lang = b.getAttribute('data-lang');
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* rien */ }
      renderStatic(); renderShelves();
      if (sheet.open && current) openSheet(current, true);
    });
  });

  // ---------- Installation ----------
  var installEvt = null;
  var installBtn = document.getElementById('install');
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; installBtn.hidden = false; });
  installBtn.addEventListener('click', function () {
    if (!installEvt) return;
    installEvt.prompt();
    installEvt.userChoice.finally(function () { installEvt = null; installBtn.hidden = true; });
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});

  // ---------- Démarrage ----------
  var lastCols = columns();
  window.addEventListener('resize', function () { var c = columns(); if (c !== lastCols) { lastCols = c; renderShelves(); } });
  renderStatic();
  loadCatalogue().then(renderShelves).catch(function () {
    shelvesEl.textContent = '';
    shelvesEl.appendChild(el('p', { class: 'error', text: t('loadError') }));
  });
})();
