/* Ludiworld, la vitrine : langue FR / EN et cartes des jeux. Aucune dépendance. */
(function () {
  'use strict';

  var LANG_KEY = 'ludiworld.lang';

  // Le français est déjà dans la page : il est relevé au chargement.
  var T = {
    fr: {
      metaDesc: document.querySelector('meta[name="description"]').getAttribute('content'),
      legend: 'Légende',
      gError: 'Les fiches n\'ont pas pu se charger ici. Les jeux sont dans l\'app.',
      years: function (a, b) { return a + ' à ' + b + ' ans'; },
      mins: function (a, b) { return a === b ? a + ' min' : a + ' à ' + b + ' min'; },
      fAge: 'Âge', fSession: 'Partie', fReading: 'Lecture',
      reading: { none: 'Sans lecture', some: 'Quelques mots', fluent: 'Bien lire' },
      goal: { core: 'Apprendre est le but', side: 'On apprend en passant', none: 'Pour le plaisir' },
      domains: {
        'maths.multiplication': 'Tables de multiplication', 'sciences.magnetisme': 'Magnétisme',
        'logique.puzzle': 'Logique', 'histoire.prehistoire': 'Préhistoire',
        'histoire.techniques': 'Histoire des techniques', 'gestion.ressources': 'Gestion',
        'motricite.reflexes': 'Réflexes', 'strategie.choix': 'Stratégie', 'emotions.frustration': 'Gérer la frustration',
        'memoire.sequences': 'Mémoire', 'sciences.physique': 'Physique',
        'maths.calcul-mental': 'Calcul mental'
      }
    },
    en: {
      metaDesc: 'Small games made by parents, with no ads, nothing to buy and no traps. You choose, your child plays, the sun says when to stop.',
      skip: 'Skip to content',
      barApp: 'Open the app',
      heroAlt: 'Evening in a living room, a parent and child on the sofa. A small island floats above the tablet.',
      h1a: 'The sun says',
      h1b: 'when to stop.',
      lede: 'Small games made by parents. You choose, your child plays, the sun sets the pace.',
      cta: 'Open Ludiworld',
      how: 'How it works',

      pbKick: 'The problem',
      pbTitle: 'On a tablet, most games are built so kids never put it down.',
      hooksTitle: 'The usual hooks',
      hook1: 'An ad between two levels.',
      hook2: 'Something to buy, "just this once".',
      hook3: '"Come back tomorrow", or lose your streak.',
      hook4: 'Levels that never end.',
      pbEnd: 'And at bedtime, a fight to switch it off.',
      pbTurn: 'Ludiworld starts from the other end: few games, chosen by you, and an ending planned ahead.',

      jKick: 'How it works',
      jTitle: 'One day, along the sun\'s path',
      jIntro: 'Play time is the sun crossing the sky. Your child watches it go down, no need to read a clock.',
      t1: 'Morning',
      s1Title: 'The parent sets things up',
      s1Text: 'You open the parents\' notebook, protected by a code. You pick games with filters:',
      f1: 'age',
      f2: 'what the game teaches',
      f3: 'whether reading is needed',
      s1Time: 'Then you set the time: one for school days, one for days off, and a per-game limit if you like.',
      t2: 'Afternoon',
      s2Title: 'The child plays',
      s2Text: 'Only the games you chose are there. No store, no ads, nothing else to open.',
      s2Sun: 'While they play, the sun goes down the sky. One glance tells them where they are.',
      t3: 'Evening',
      s3Title: 'Stopping, with no surprise',
      s3Text: 'Five minutes before the end, the marmot yawns. You choose how it ends:',
      softT: 'Soft end',
      softD: 'waits for the current race or level to finish, in games that support it.',
      hardT: 'Hard end',
      hardD: 'stops right on the minute.',
      s3Sleep: 'Then the island falls asleep. That\'s it for today.',
      noteTitle: 'Worth knowing, honestly',
      noteText: 'A web app cannot lock a tablet on its own. Pair it with Android screen pinning or Family Link, or Guided Access on iPad. The app explains how.',

      gKick: 'The games',
      gTitle: 'Few games, and each one tells the truth.',
      gIntro: 'Every game has an honest card: age, what it teaches, how long a session lasts. Even when it is less flattering.',
      goalCore: 'Learning is the point',
      goalSide: 'Some learning on the way',
      goalNone: 'Just for fun',
      gLoading: 'Loading the cards…',
      gMore: 'See the games in Ludiworld',
      legend: 'Legend',
      gError: 'The cards could not load here. The games are in the app.',
      years: function (a, b) { return 'ages ' + a + ' to ' + b; },
      mins: function (a, b) { return a === b ? a + ' min' : a + ' to ' + b + ' min'; },
      fAge: 'Age', fSession: 'Session', fReading: 'Reading',
      reading: { none: 'No reading', some: 'A few words', fluent: 'Fluent reading' },
      goal: { core: 'Learning is the point', side: 'Some learning on the way', none: 'Just for fun' },
      domains: {
        'maths.multiplication': 'Times tables', 'sciences.magnetisme': 'Magnetism',
        'logique.puzzle': 'Logic', 'histoire.prehistoire': 'Prehistory',
        'histoire.techniques': 'History of techniques', 'gestion.ressources': 'Resource management',
        'motricite.reflexes': 'Reflexes', 'strategie.choix': 'Strategy', 'emotions.frustration': 'Handling frustration',
        'memoire.sequences': 'Memory', 'sciences.physique': 'Physics',
        'maths.calcul-mental': 'Mental maths'
      },

      cKick: 'The charter',
      cTitle: 'What the games promise not to do',
      cIntro: 'Each game states it on its card. Parents check it by playing.',
      p1: 'No ads',
      p2: 'Nothing to buy',
      p3: 'No subscription',
      p4: 'No random rewards',
      p5: 'No "come back tomorrow"',
      p6: 'No notifications',
      p7: 'No strangers',
      p8: 'No data sent',
      p9: 'And always moments to stop without losing anything',
      dTitle: 'Data stays on the tablet.',
      dText: 'Settings and play time are kept in the browser. Nothing goes to a server. If a game contacts another site, for a font for example, its card says so.',

      sKick: 'Away from games',
      sTitle: 'Also worth watching',
      sIntro: 'Calm, curious series, for when it is not play time.',
      se1: 'A little puffin and her family on an island. Nature, at a very gentle pace.',
      se2t: 'Ada Twist, Scientist',
      se2: 'A girl who asks lots of questions and runs experiments to answer them.',
      se3: 'Short episodes answering the big questions of a curious child.',
      se4: 'Little robots look for answers to children\'s questions, often in song.',
      se5t: 'Once Upon a Time… Life',
      se5: 'The classic that tells the story of the human body from the inside.',
      se6t: 'Emily\'s Wonder Lab',
      se6: 'Simple science experiments, done with kids, easy to try at home.',
      se7: 'A French show explaining science and the world with models. Better for older kids.',
      se8: 'Short documentaries for younger kids, in French, about everyday topics.',

      mTitle: 'Making a game for your child with Claude Code, ChatGPT…?',
      mText: 'Ludiworld is made for that. Give the guide to your AI: it explains how to make the game compatible and write its honest card. Then propose it. An automatic check runs, then Julien plays it and reads the card before adding it.',
      mSmall: 'Your game stays with you: Ludiworld does not host games, only their cards.',
      mGuide: 'The guide for your AI',
      mPropose: 'Propose a game',

      islandAlt: 'The Ludiworld island at night, its windows lit.',
      dodoAlt: 'The marmot is asleep, curled up in its scarf.',
      nTitle: 'The island is asleep. It wakes up when you open it.',
      install: 'On the tablet, open the browser menu and choose "Add to Home Screen": Ludiworld then opens like an app.',
      foot: 'Made by Julien (pikifou), first for his son.',
      footCode: 'The code on GitHub'
    }
  };

  // Relever le français présent dans la page.
  document.querySelectorAll('[data-t]').forEach(function (el) { T.fr[el.getAttribute('data-t')] = el.innerHTML; });
  document.querySelectorAll('[data-t-alt]').forEach(function (el) { T.fr[el.getAttribute('data-t-alt')] = el.getAttribute('alt'); });

  var lang = (function () {
    try { var l = localStorage.getItem(LANG_KEY); if (l === 'fr' || l === 'en') return l; } catch (e) { /* rien */ }
    return /^fr/i.test(navigator.language || '') ? 'fr' : 'en';
  })();

  var games = null; // fiches chargées
  var gamesFailed = false;

  function applyLang() {
    var D = T[lang];
    document.documentElement.lang = lang;
    document.querySelector('meta[name="description"]').setAttribute('content', D.metaDesc);
    document.querySelectorAll('[data-t]').forEach(function (el) {
      var v = D[el.getAttribute('data-t')];
      if (typeof v === 'string') el.innerHTML = v; // textes écrits ici, jamais venus du réseau
    });
    document.querySelectorAll('[data-t-alt]').forEach(function (el) {
      var v = D[el.getAttribute('data-t-alt')]; if (v) el.setAttribute('alt', v);
    });
    document.querySelectorAll('[data-t-aria]').forEach(function (el) {
      var v = D[el.getAttribute('data-t-aria')]; if (v) el.setAttribute('aria-label', v);
    });
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
    });
    renderGames();
  }

  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      lang = b.getAttribute('data-lang');
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* rien */ }
      applyLang();
    });
  });

  /* ---------- Cartes des jeux ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  // Textes des fiches : en français, espace insécable avant « ? ! : ; » pour qu'ils ne partent pas seuls à la ligne.
  function pick(bi) {
    var s = bi ? (bi[lang] || bi.fr || bi.en || '') : '';
    return lang === 'fr' ? s.replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ') : s;
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  var GOAL_SVG = {
    core: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" class="fill"/>',
    side: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" class="fill"/>',
    none: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'
  };
  function goalBadge(level) {
    if (!GOAL_SVG[level]) level = 'none';
    var p = el('p', { class: 'goal goal-' + level });
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = GOAL_SVG[level];
    p.appendChild(s);
    p.appendChild(el('span', { text: T[lang].goal[level] }));
    return p;
  }
  function safeColor(c) { return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#1d2b4f'; }

  function card(g) {
    var D = T[lang];
    var title = pick(g.title);
    var ico = el('div', { class: 'jeu-ico', 'aria-hidden': 'true', text: (title || '?').charAt(0) });
    if (g.icon && /^https?:\/\//.test(g.icon)) {
      var img = el('img', { src: g.icon, alt: '', loading: 'lazy', width: '64', height: '64' });
      img.addEventListener('error', function () { img.remove(); });
      img.addEventListener('load', function () { ico.firstChild && ico.firstChild.nodeType === 3 && ico.removeChild(ico.firstChild); });
      ico.appendChild(img);
    }
    var lv = g.learning && g.learning.level;
    var age = g.age ? D.years(g.age.min, g.age.max) : '';
    var mn = g.session && g.session.minutes ? D.mins(g.session.minutes[0], g.session.minutes[1]) : '';
    var facts = el('dl', { class: 'facts' }, [
      age ? el('div', null, [el('dt', { text: D.fAge }), el('dd', { text: age })]) : null,
      mn ? el('div', null, [el('dt', { text: D.fSession }), el('dd', { text: mn })]) : null,
      g.reading ? el('div', null, [el('dt', { text: D.fReading }), el('dd', { text: D.reading[g.reading] || g.reading })]) : null
    ]);
    var domains = (g.learning && g.learning.domains) || [];
    var tags = domains.length ? el('ul', { class: 'tags', 'aria-label': lang === 'fr' ? 'Ce qu\'on y apprend' : 'What it teaches' },
      domains.map(function (d) { return el('li', { text: D.domains[d] || d.split('.').pop() }); })) : null;

    var a = el('article', { class: 'jeu' }, [
      el('div', { class: 'jeu-top' }, [ico, el('div', null, [el('h3', { text: title }), goalBadge(lv)])]),
      el('p', { class: 'jeu-pitch', text: pick(g.pitch) }),
      facts,
      tags
    ]);
    a.style.setProperty('--jc', safeColor(g.color));
    return a;
  }

  function renderGames() {
    var list = document.getElementById('jeux-list');
    if (!list) return;
    if (gamesFailed) { list.replaceChildren(el('p', { class: 'jeux-wait', text: T[lang].gError })); return; }
    if (!games) return;
    list.replaceChildren.apply(list, games.map(card));
  }

  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  getJSON('../jeux/index.json').then(function (idx) {
    var files = (idx && idx.games) || [];
    return Promise.all(files.map(function (f) {
      if (!/^[a-z0-9-]+\.json$/i.test(f)) return null;
      return getJSON('../jeux/' + f).catch(function () { return null; });
    }));
  }).then(function (list) {
    games = list.filter(function (g) { return g && g.title; });
    if (!games.length) gamesFailed = true;
    renderGames();
  }).catch(function () { gamesFailed = true; renderGames(); });

  applyLang();
})();
