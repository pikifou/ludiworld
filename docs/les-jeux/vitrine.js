/* Ludiworld, la page des jeux : une vitrine. Une tuile par jeu, quelques filtres, et la fiche entière quand on touche un jeu.
   Les pictogrammes sont les branches de l'arbre (site/arbre.js), d'après ce que chaque fiche déclare : rien n'est ajouté à la main.
   Chez soi, la fiche dit ce que l'enfant y a fait (rien de deviné) et permet d'installer le jeu, avec le code parent. */
(function () {
  'use strict';

  var A = window.LudiArbre;
  var STORE = 'ludiworld.v1';
  var CLE_RETOUR = 'ludiworld.retour'; // où revenir après le code parent (lu par app.js)
  var CLE_INSTALLER = 'ludiworld.a-installer'; // « jeu|enfant|ajouter ou retirer », fait une fois le code donné
  var BASE = '../';

  var TX = {
    fr: {
      placeholder: 'Dragons, aimants, tables de multiplication…',
      tout: 'Tout', ages: 'Tous les âges', agePour: 'Pour {n} ({x} ans)', ageAns: '{x} ans',
      sansLire: 'Sans avoir à lire',
      compte: { un: '1 jeu', plus: '{n} jeux' }, compteSur: '{c} sur {t}',
      rien: 'Aucun jeu ne correspond pour l\'instant.', toutVoir: 'Tout afficher', rienCreer: 'Créer un jeu là-dessus',
      installe: 'Installé',
      apporte: 'Ce que ça apporte', comment: 'Comment',
      installer: 'Installer pour {n}', retirer: 'Retirer', avecCode: 'avec le code parent', installePour: 'Installé pour {n}',
      jouer: 'Y jouer', jouerPour: 'pour {n}', essayerLudi: 'Essayer Ludiworld',
      joue: '{n} y a joué {t}', parties: { un: ', en 1 partie', plus: ', en {p} parties' }, dernier: 'Dernière partie le {d}.', jamais: '{n} n\'y a pas encore joué.',
      moinsMin: 'moins d\'une minute',
      horsAge: 'Prévu pour {a} à {b} ans, {n} a {x} ans.',
      horsLigne: 'Marche sans réseau', enLigne: 'Demande du réseau',
      fermer: 'Fermer'
    },
    en: {
      placeholder: 'Dragons, magnets, times tables…',
      tout: 'All', ages: 'All ages', agePour: 'For {n} ({x})', ageAns: 'Age {x}',
      sansLire: 'No reading needed',
      compte: { un: '1 game', plus: '{n} games' }, compteSur: '{c} of {t}',
      rien: 'No game matches yet.', toutVoir: 'Show everything', rienCreer: 'Make a game about it',
      installe: 'Installed',
      apporte: 'What it brings', comment: 'How',
      installer: 'Install for {n}', retirer: 'Remove', avecCode: 'with the parent code', installePour: 'Installed for {n}',
      jouer: 'Play it', jouerPour: 'for {n}', essayerLudi: 'Try Ludiworld',
      joue: '{n} has played {t}', parties: { un: ', in 1 session', plus: ', in {p} sessions' }, dernier: 'Last played on {d}.', jamais: '{n} has not played it yet.',
      moinsMin: 'less than a minute',
      horsAge: 'Made for ages {a} to {b}, {n} is {x}.',
      horsLigne: 'Works offline', enLigne: 'Needs a connection',
      fermer: 'Close'
    }
  };

  var jeux = [], pret = false, premiere = true;
  var theme = null, age = 'tous', sansLire = false; // les filtres
  var ouverte = null, poussee = false; // la fiche ouverte, et si on a ajouté une étape à l'historique pour elle
  var $ = function (id) { return document.getElementById(id); };

  function lang() { return LudiSite.langue(); }
  function C() { return LudiSite.commun(); }
  function pick(o) { return LudiSite.pick(o); }
  function tx(k, vars) {
    var s = TX[lang()][k];
    Object.keys(vars || {}).forEach(function (c) { s = s.split('{' + c + '}').join(vars[c]); });
    return s;
  }
  function couleurSure(c) { return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#1d2b4f'; }
  function jeuDe(id) { return jeux.filter(function (g) { return g.id === id; })[0] || null; }

  // ---------- Petits outils ----------
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.className = v;
      else if (k === 'style') n.style.cssText = v;
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function svg(d, cls) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    s.innerHTML = d.charAt(0) === '<' ? d : '<path d="' + d + '"/>';
    return s;
  }
  var ICO = {
    age: 'M12 3.5a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0-6.4M5.5 20.5c0-4 2.9-6.6 6.5-6.6s6.5 2.6 6.5 6.6',
    partie: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7.5V12l3.2 2',
    lecture: 'M3.5 5.5c3-1.2 6-1.2 8.5.8c2.5-2 5.5-2 8.5-.8v13c-3-1.2-6-1.2-8.5.8c-2.5-2-5.5-2-8.5-.8zM12 6.3v13.4',
    sansLire: 'M3.5 5.5c3-1.2 6-1.2 8.5.8c2.5-2 5.5-2 8.5-.8v13c-3-1.2-6-1.2-8.5.8c-2.5-2-5.5-2-8.5-.8zM3 3l18 18',
    reseau: 'M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a7.5 7.5 0 0 1 11 0M9.5 16a3.2 3.2 0 0 1 5 0M12 19.5v.01',
    horsLigne: 'M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a7.5 7.5 0 0 1 11 0M9.5 16a3.2 3.2 0 0 1 5 0M12 19.5v.01M3 3l18 18',
    appareils: 'M7 2.5h10a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V4A1.5 1.5 0 0 1 7 2.5zM10.5 18h3',
    langues: 'M4 5h16v11H9.5L4 20z',
    check: 'M4.5 12.5l5 5 10-11',
    croix: 'M6 6l12 12M18 6L6 18',
    core: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" class="fill"/>',
    side: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" class="fill"/>',
    none: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'
  };
  function image(g, cls) {
    var n = el('span', { class: 'vt-image ' + (cls || ''), style: '--jc:' + couleurSure(g.color) }, [el('span', { 'aria-hidden': 'true', text: (pick(g.title) || '?').charAt(0) })]);
    if (g.icon && /^https?:\/\//.test(g.icon)) {
      var img = el('img', { src: g.icon, alt: '', loading: 'lazy', width: '512', height: '512' });
      img.addEventListener('error', function () { img.remove(); }); // l'initiale reste
      n.appendChild(img);
    }
    return n;
  }
  // Les branches d'un jeu, dans l'ordre de sa fiche, et ses sujets dans chacune.
  function branchesDuJeu(g) {
    var out = [];
    A.casesDuJeu(g).forEach(function (x) {
      var b = out.filter(function (o) { return o.b === x.branche; })[0];
      if (!b) { b = { b: x.branche, sujets: [] }; out.push(b); }
      b.sujets.push(x);
    });
    return out;
  }
  function picto(b, avecNom) {
    return el('span', { class: 'vt-picto' + (avecNom ? '' : ' seul'), style: '--c:' + b.couleur, title: avecNom ? null : pick(b.nom) }, [
      el('span', { class: 'vt-rond' }, [svg(b.glyphe)]),
      el('span', { class: avecNom ? null : 'vt-cache', text: pick(b.nom) })
    ]);
  }

  // ---------- Le foyer de cet appareil ----------
  function lire() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function foyer() { var s = lire(); return s.famille && s.famille.enfants && s.famille.enfants.length ? s.famille : null; }
  function enfants() { var h = foyer(); return h ? h.enfants : []; }
  function actif() { var h = foyer(); return h ? h.enfants.filter(function (e) { return e.id === h.actif; })[0] || h.enfants[0] : null; }
  function installePour(e, g) { return !!(e && e.jeux && e.jeux[g.id]); }
  // Toujours relire avant d'écrire : l'appli a pu changer le foyer depuis un autre onglet.
  function installer(eid, gid, oui) {
    var s = lire(), h = s.famille;
    var e = h && h.enfants && h.enfants.filter(function (x) { return x.id === eid; })[0];
    if (!e) return;
    e.jeux = e.jeux || {};
    if (oui) e.jeux[gid] = e.jeux[gid] || { max: null }; else delete e.jeux[gid];
    h.maj = Date.now(); e.maj = Date.now();
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (err) { /* rien */ }
  }
  // Le code vient d'être donné pour ce geste : on le fait, sans le redemander.
  function installerEnAttente() {
    var v = null;
    try { v = sessionStorage.getItem(CLE_INSTALLER); sessionStorage.removeItem(CLE_INSTALLER); } catch (e) { /* rien */ }
    var p = (v || '').split('|');
    if (p.length === 3 && LudiBarre.parentOuvert() && jeuDe(p[0])) installer(p[1], p[0], p[2] === 'ajouter');
  }
  function geste(eid, g, oui) {
    if (!LudiBarre.parentOuvert()) {
      try {
        sessionStorage.setItem(CLE_RETOUR, 'les-jeux/#' + g.id);
        sessionStorage.setItem(CLE_INSTALLER, [g.id, eid, oui ? 'ajouter' : 'retirer'].join('|'));
      } catch (err) { /* rien */ }
      location.href = BASE + '#carnet';
      return;
    }
    installer(eid, g.id, oui);
    rendreGrille();
    remplir(g);
  }

  // ---------- Les filtres ----------
  function ageVoulu() {
    if (age === 'tous') return null;
    if (age.indexOf('e:') === 0) { var e = enfants().filter(function (x) { return x.id === age.slice(2); })[0]; return e ? e.enfant.age : null; }
    return Number(age.slice(2));
  }
  function trouves() {
    var q = $('vt-q').value.trim();
    if (!q) return null;
    var r = A.chercher(q, lang(), jeux), out = r.jeux.slice();
    r.cases.forEach(function (x) { x.jeux.forEach(function (g) { if (out.indexOf(g) === -1) out.push(g); }); });
    return out;
  }
  function filtrer() {
    var a = ageVoulu(), t = trouves();
    return jeux.filter(function (g) {
      if (theme && !branchesDuJeu(g).some(function (o) { return o.b.id === theme; })) return false;
      if (a && g.age && (a < g.age.min || a > g.age.max)) return false;
      if (sansLire && g.reading !== 'none') return false;
      return !t || t.indexOf(g) !== -1;
    });
  }
  function rendreFiltres() {
    $('vt-q').setAttribute('placeholder', tx('placeholder'));
    var presentes = A.BRANCHES.filter(function (b) { return jeux.some(function (g) { return branchesDuJeu(g).some(function (o) { return o.b === b; }); }); });
    $('vt-themes').replaceChildren.apply($('vt-themes'), [
      el('button', { type: 'button', class: 'vt-theme vt-tout', 'data-theme': '', 'aria-pressed': String(!theme), text: tx('tout') })
    ].concat(presentes.map(function (b) {
      var n = jeux.filter(function (g) { return branchesDuJeu(g).some(function (o) { return o.b === b; }); }).length;
      return el('button', { type: 'button', class: 'vt-theme', 'data-theme': b.id, 'aria-pressed': String(theme === b.id), style: '--c:' + b.couleur }, [
        el('span', { class: 'vt-rond' }, [svg(b.glyphe)]), pick(b.nom), el('span', { class: 'vt-n', text: String(n) })
      ]);
    })));
    $('vt-themes').querySelectorAll('[data-theme]').forEach(function (b) {
      b.addEventListener('click', function () { var v = b.getAttribute('data-theme') || null; theme = v === theme ? null : v; rendreFiltres(); rendreGrille(); });
    });
    var opts = [['tous', tx('ages')]].concat(enfants().map(function (e) { return ['e:' + e.id, tx('agePour', { n: e.enfant.nom, x: e.enfant.age })]; }));
    for (var x = 4; x <= 12; x++) opts.push(['a:' + x, tx('ageAns', { x: x })]);
    $('vt-age').replaceChildren.apply($('vt-age'), opts.map(function (o) { return el('option', { value: o[0], text: o[1], selected: o[0] === age }); }));
    var bl = $('vt-lire');
    bl.setAttribute('aria-pressed', String(sansLire));
    bl.replaceChildren(svg(ICO.sansLire), tx('sansLire'));
  }

  // ---------- La grille ----------
  function tuile(g, i) {
    var c = C(), deja = enfants().filter(function (e) { return installePour(e, g); });
    var meta = [g.age ? c.years(g.age.min, g.age.max) : null, g.session && g.session.minutes ? c.mins(g.session.minutes[0], g.session.minutes[1]) : null].filter(Boolean).join(' · ');
    return el('button', { type: 'button', class: 'vt-tuile', 'data-jeu': g.id, style: '--i:' + i, onclick: function () { ouvrir(g, true); } }, [
      el('span', { class: 'vt-tuile-image' }, [
        image(g),
        deja.length ? el('span', { class: 'vt-badge' }, [svg(ICO.check), enfants().length > 1 ? deja.map(function (e) { return e.enfant.nom; }).join(', ') : tx('installe')]) : null
      ]),
      el('strong', { text: pick(g.title) }),
      el('span', { class: 'vt-meta', text: meta }),
      el('span', { class: 'vt-pictos' }, branchesDuJeu(g).map(function (o) { return picto(o.b, true); }))
    ]);
  }
  function rendreGrille() {
    var vus = filtrer(), z = $('vt-grille');
    z.classList.toggle('vt-entree', premiere);
    premiere = false;
    var nb = TX[lang()].compte[vus.length === 1 ? 'un' : 'plus'].replace('{n}', vus.length);
    $('vt-compte').textContent = vus.length === jeux.length ? nb : tx('compteSur', { c: nb, t: jeux.length });
    if (vus.length) { z.replaceChildren.apply(z, vus.map(tuile)); return; }
    z.replaceChildren(el('div', { class: 'vt-vide' }, [
      el('p', { text: tx('rien') }),
      el('button', { type: 'button', class: 'vt-bouton', text: tx('toutVoir'), onclick: function () { theme = null; age = 'tous'; sansLire = false; $('vt-q').value = ''; rendreFiltres(); rendreGrille(); } }),
      el('a', { class: 'vt-bouton creux', href: BASE + 'creer/', text: tx('rienCreer') })
    ]));
  }

  // ---------- La fiche ----------
  function duree(ms) {
    var m = Math.round(ms / 60000);
    if (m < 1) return tx('moinsMin');
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + String(m % 60).padStart(2, '0') : '');
  }
  // Ce que chaque enfant y a fait, d'après ce qui est enregistré sur l'appareil.
  function faitsEnfant(e, g) {
    var st = e.games && e.games[g.id], n = e.enfant.nom;
    if (!st || !(st.ms > 0)) return el('p', { class: 'vt-fait', text: tx('jamais', { n: n }) });
    var s = tx('joue', { n: n, t: duree(st.ms) }) + (st.sessions ? TX[lang()].parties[st.sessions === 1 ? 'un' : 'plus'].replace('{p}', st.sessions) : '') + '.';
    var d = A.dernierJour(st);
    if (d) s += ' ' + tx('dernier', { d: d.toLocaleDateString(lang(), { day: 'numeric', month: 'long' }).replace(/^1 /, lang() === 'fr' ? '1er ' : '1 ') });
    return el('p', { class: 'vt-fait', text: s });
  }
  function gestes(g) {
    var c = C(), ks = enfants(), act = actif(), out = [];
    if (!ks.length) {
      out.push(el('div', { class: 'vt-gestes' }, [
        el('a', { class: 'vt-bouton', href: g.url, target: '_blank', rel: 'noopener', text: c.tryGame }),
        el('a', { class: 'vt-bouton creux', href: LudiBarre.lienApp(BASE), text: tx('essayerLudi') })
      ]));
      out.push(el('p', { class: 'vt-note', text: c.tryNote }));
      return out;
    }
    var code = LudiBarre.parentOuvert() ? null : el('small', { text: tx('avecCode') });
    var boutons = [];
    if (installePour(act, g)) {
      boutons.push(el('a', { class: 'vt-bouton', id: 'vt-jouer', href: BASE + '#jouer=' + g.id, onclick: LudiBarre.fermerParent }, [tx('jouer'), ks.length > 1 ? el('small', { text: tx('jouerPour', { n: act.enfant.nom }) }) : null]));
    }
    ks.forEach(function (e) {
      if (!installePour(e, g)) boutons.push(el('button', { type: 'button', class: 'vt-bouton' + (boutons.length ? ' creux' : ''), 'data-installer': g.id, 'data-enfant': e.id, onclick: function () { geste(e.id, g, true); } }, [tx('installer', { n: e.enfant.nom }), code ? code.cloneNode(true) : null]));
    });
    out.push(el('div', { class: 'vt-gestes' }, boutons));
    ks.forEach(function (e) {
      if (g.age && (e.enfant.age < g.age.min || e.enfant.age > g.age.max)) out.push(el('p', { class: 'vt-alerte', text: tx('horsAge', { a: g.age.min, b: g.age.max, n: e.enfant.nom, x: e.enfant.age }) }));
    });
    out.push(el('div', { class: 'vt-enfants' }, ks.map(function (e) {
      return el('div', { class: 'vt-enfant' }, [
        installePour(e, g) ? el('p', { class: 'vt-installe' }, [svg(ICO.check), tx('installePour', { n: e.enfant.nom }),
          el('button', { type: 'button', class: 'vt-retirer', 'data-retirer': g.id, 'data-enfant': e.id, onclick: function () { geste(e.id, g, false); } }, [tx('retirer')])]) : null,
        faitsEnfant(e, g)
      ]);
    })));
    return out;
  }
  function faits(g) {
    var c = C(), cases = [];
    function f(ico, val, lib) { cases.push(el('li', null, [svg(ico), el('b', { text: val }), el('span', { text: lib })])); }
    if (g.age) f(ICO.age, c.years(g.age.min, g.age.max), c.fAge);
    if (g.session && g.session.minutes) f(ICO.partie, c.mins(g.session.minutes[0], g.session.minutes[1]), c.fSession);
    if (g.reading) f(g.reading === 'none' ? ICO.sansLire : ICO.lecture, c.reading[g.reading] || g.reading, c.fReading);
    f(g.offline ? ICO.horsLigne : ICO.reseau, g.offline ? tx('horsLigne') : tx('enLigne'), c.fOffline);
    if (g.devices) f(ICO.appareils, g.devices.map(function (d) { return c.devices[d] || d; }).join(', '), c.fDevices);
    if (g.languages) f(ICO.langues, g.languages.map(function (l) { return c.langs[l] || l; }).join(', '), c.fLang);
    return el('ul', { class: 'vt-faits' }, cases);
  }
  function remplir(g) {
    var c = C(), l = g.learning || {}, niveau = ICO[l.level] && c.goal[l.level] ? l.level : 'none';
    var promesses = Object.keys(c.healthy).filter(function (k) { return g.healthy && g.healthy[k] === true; });
    var d = $('vt-fiche');
    d.style.setProperty('--jc', couleurSure(g.color));
    d.replaceChildren(el('div', { class: 'vt-f' }, [
      el('button', { type: 'button', class: 'vt-fermer', 'aria-label': tx('fermer'), onclick: fermer }, [svg(ICO.croix)]),
      el('header', { class: 'vt-f-tete' }, [
        image(g, 'grande'),
        el('div', null, [
          el('h2', { id: 'vt-fiche-titre', text: pick(g.title) }),
          el('p', { class: 'vt-auteur', text: c.by(g.author && g.author.name || '?') }),
          el('p', { class: 'goal goal-' + niveau }, [svg(ICO[niveau]), el('span', { text: c.goal[niveau] })])
        ])
      ]),
      el('div', { class: 'vt-f-gestes' }, gestes(g)),
      faits(g),
      el('p', { class: 'vt-pitch', text: pick(g.pitch) }),
      el('section', null, [
        el('h3', { text: tx('apporte') }),
        el('ul', { class: 'vt-apporte' }, branchesDuJeu(g).map(function (o) {
          return el('li', { style: '--c:' + o.b.couleur }, [
            el('span', { class: 'vt-rond' }, [svg(o.b.glyphe)]),
            el('span', null, [el('b', { text: pick(o.b.nom) }), el('span', { text: o.sujets.map(function (x) { return pick(x.nom); }).join(' · ') })])
          ]);
        })),
        l.what ? el('p', { text: pick(l.what) }) : null,
        l.how ? el('p', null, [el('strong', { text: tx('comment') + ' : ' }), pick(l.how)]) : null
      ]),
      g.content ? el('section', null, [el('h3', { text: c.content }), el('p', { text: pick(g.content) })]) : null,
      el('section', { class: 'vt-promesses' }, [
        el('h3', { text: c.promises }),
        el('ul', null, promesses.map(function (k) { return el('li', null, [svg(ICO.check), c.healthy[k]]); })),
        el('p', { class: 'vt-note', text: g.third_parties && g.third_parties.length ? c.third(g.third_parties.join(', ')) : c.thirdNone })
      ]),
      el('footer', { class: 'vt-f-pied' }, [
        g.status === 'draft' ? el('p', { class: 'vt-brouillon', text: c.draft }) : null,
        enfants().length ? el('a', { class: 'vt-lien', href: g.url, target: '_blank', rel: 'noopener', text: c.tryGame }) : null,
        g.author && g.author.url ? el('a', { class: 'vt-lien', href: g.author.url, target: '_blank', rel: 'noopener', text: c.code }) : null
      ])
    ]));
  }
  function ouvrir(g, depuisTuile) {
    ouverte = g;
    remplir(g);
    var d = $('vt-fiche');
    if (!d.open) d.showModal();
    d.scrollTop = 0;
    if (depuisTuile && location.hash !== '#' + g.id) { history.pushState(null, '', '#' + g.id); poussee = true; }
  }
  function fermer() { $('vt-fiche').close(); }
  // Fermée par la croix, Échap ou un toucher à côté : on enlève la fiche de l'adresse.
  function fermee() {
    var avait = ouverte;
    ouverte = null;
    if (!avait || location.hash !== '#' + avait.id) return;
    if (poussee) { poussee = false; history.back(); } else history.replaceState(null, '', location.pathname + location.search);
  }
  function lireAdresse() {
    var g = jeuDe(decodeURIComponent(location.hash.slice(1)));
    if (g) ouvrir(g, false);
    else if ($('vt-fiche').open) { ouverte = null; poussee = false; fermer(); }
  }

  function rendreTout() {
    rendreFiltres();
    rendreGrille();
    if (ouverte) remplir(ouverte);
  }

  function getJSON(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); }); }

  document.addEventListener('DOMContentLoaded', function () {
    var d = $('vt-fiche');
    d.addEventListener('close', fermee);
    d.addEventListener('click', function (ev) { if (ev.target === d) fermer(); }); // le fond, autour de la fiche
    $('vt-q').addEventListener('input', rendreGrille);
    $('vt-age').addEventListener('change', function () { age = $('vt-age').value; rendreGrille(); });
    $('vt-lire').addEventListener('click', function () { sansLire = !sansLire; rendreFiltres(); rendreGrille(); });
    window.addEventListener('popstate', function () { if (pret) lireAdresse(); });
    LudiSite.surLangue(function () { if (pret) rendreTout(); });
    getJSON(BASE + 'jeux/index.json').then(function (idx) {
      return Promise.all(((idx && idx.games) || []).map(function (f) {
        if (!/^[a-z0-9-]+\.json$/i.test(f)) return null;
        return getJSON(BASE + 'jeux/' + f).catch(function () { return null; });
      }));
    }).then(function (l) {
      jeux = l.filter(function (g) { return g && g.title; });
      if (!jeux.length) throw new Error('aucun jeu');
      A.relier(jeux);
      pret = true;
      installerEnAttente();
      rendreTout();
      lireAdresse();
    }).catch(function () {
      $('vt-grille').replaceChildren(el('p', { class: 'jeux-wait', text: C().gError }));
    });
  });
})();
