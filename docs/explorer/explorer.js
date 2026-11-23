/* Ludiworld, la page Explorer : l'arbre à monter, une branche à la fois, avec les jeux dans les cases.
   Pas liée dans la barre pour l'instant : elle reviendra quand il y aura bien plus de jeux (la page des jeux suffit d'ici là).
   Ce que l'enfant a fait vient de ce qui est enregistré sur l'appareil ; rien n'est deviné. Installer demande le code parent. */
(function () {
  'use strict';

  var A = window.LudiArbre;
  var STORE = 'ludiworld.v1';
  var CLE_RETOUR = 'ludiworld.retour'; // où revenir après le code parent (lu par app.js)
  var CLE_INSTALLER = 'ludiworld.a-installer'; // le jeu à installer une fois le code donné
  var BASE = '../';

  var TX = {
    fr: {
      placeholder: 'Aimants, empathie, fractions, dragons…',
      tous: 'Tous les jeux', tousTitre: 'Tous les jeux',
      accueilTitre: 'Touchez une case', accueilTexte: 'Une case avec une image, c\'est un jeu qui fait travailler ce sujet. Une case avec un +, il n\'y a pas encore de jeu.',
      legJoue: 'Joué', legAppris: 'A appris un truc', legAdore: 'A adoré', legEssayer: 'Jeu à essayer', legVide: 'Pas encore de jeu', legEnvie: 'Dans nos envies', legSens: 'Toutes les cases sont ouvertes : on va où on veut.',
      leJeu: 'Le jeu sur ce sujet', lesJeux: 'Les jeux sur ce sujet',
      sansJeu: 'Il n\'y a pas encore de jeu ici.', envie: 'On voudrait ça', envieOui: 'Retirer de nos envies', envieDedans: 'C\'est dans vos envies.', envieNote: 'Une liste pour vous : ça ne prévient personne et aucun jeu n\'est promis.', creer: 'Créer ce jeu', creerNote: 'Comptez une soirée, avec une IA. Le pas à pas est là.',
      voir: 'À découvrir ensemble', voirDans: 'Recommandé dans « Ludiworld aime bien »',
      dit: 'Qu\'en dit {n} ?', ditSans: 'Qu\'en dit l\'enfant ?', appris: 'J\'ai appris un truc', adore: 'J\'ai adoré', bof: 'Bof',
      temps: '{t} de jeu', parties: { un: '1 partie', plus: '{n} parties' }, dernier: 'Dernière partie le {d}', jamais: 'Pas encore joué',
      moinsMin: 'moins d\'une minute',
      reussies: 'Trouvées 3 fois de suite : {l}.', ratees: 'Encore à essayer : {l}.',
      queTemps: 'Ce jeu dit le temps passé, pas le détail de ce sujet.',
      installe: 'Installé', pasInstalle: 'Pas installé', installer: 'Installer pour {n}', desinstaller: 'Désinstaller', avecCode: 'avec le code parent',
      jouer: 'Y jouer', fiche: 'Lire la fiche complète', essayer: 'Essayer Ludiworld',
      apprend: 'Ce qu\'on y apprend', travaille: 'Les sujets de ce jeu', ages: 'De {a} à {b} ans', horsAge: 'Prévu pour {a} à {b} ans, {n} a {x} ans.',
      goal: { core: 'Apprendre est le but', side: 'On apprend en passant', none: 'Pour le plaisir' },
      envies: 'Nos envies : {n}', enviesTitre: 'Nos envies', enviesTexte: 'Touchez un sujet pour le retrouver dans l\'arbre, ou le retirer.', enviesRien: 'Rien pour l\'instant. Touchez une case vide pour ajouter une envie.',
      rien: 'Rien pour « {q} » pour l\'instant.', rienCreer: 'Créer un jeu là-dessus', pasEncore: 'Pas encore de jeu', jeu: 'Jeu',
      fermer: 'Fermer', charge: 'L\'arbre n\'a pas pu se charger. Réessayez avec du réseau.', enfant: 'L\'enfant'
    },
    en: {
      placeholder: 'Magnets, empathy, fractions, dragons…',
      tous: 'All games', tousTitre: 'All games',
      accueilTitre: 'Touch a square', accueilTexte: 'A square with a picture is a game that works on this topic. A square with a + has no game yet.',
      legJoue: 'Played', legAppris: 'Learnt something', legAdore: 'Loved it', legEssayer: 'Game to try', legVide: 'No game yet', legEnvie: 'On our wish list', legSens: 'All the squares are open: go wherever you like.',
      leJeu: 'The game on this topic', lesJeux: 'The games on this topic',
      sansJeu: 'There is no game here yet.', envie: 'We\'d like this', envieOui: 'Remove from our wishes', envieDedans: 'It\'s on your wish list.', envieNote: 'A list for you: nobody is told and no game is promised.', creer: 'Make this game', creerNote: 'Allow an evening, with an AI. The step-by-step guide is there.',
      voir: 'To discover together', voirDans: 'Recommended in "Ludiworld likes"',
      dit: 'What does {n} say?', ditSans: 'What does the child say?', appris: 'I learnt something', adore: 'I loved it', bof: 'Meh',
      temps: '{t} played', parties: { un: '1 session', plus: '{n} sessions' }, dernier: 'Last played on {d}', jamais: 'Not played yet',
      moinsMin: 'less than a minute',
      reussies: 'Found 3 times in a row: {l}.', ratees: 'Still to try: {l}.',
      queTemps: 'This game reports time played, not the detail of this topic.',
      installe: 'Installed', pasInstalle: 'Not installed', installer: 'Install for {n}', desinstaller: 'Uninstall', avecCode: 'with the parent code',
      jouer: 'Play it', fiche: 'Read the full card', essayer: 'Try Ludiworld',
      apprend: 'What you learn', travaille: 'The topics of this game', ages: 'Ages {a} to {b}', horsAge: 'Made for ages {a} to {b}, {n} is {x}.',
      goal: { core: 'Learning is the point', side: 'Some learning on the way', none: 'Just for fun' },
      envies: 'Our wishes: {n}', enviesTitre: 'Our wishes', enviesTexte: 'Touch a topic to find it in the tree, or remove it.', enviesRien: 'Nothing yet. Touch an empty square to add a wish.',
      rien: 'Nothing for "{q}" yet.', rienCreer: 'Make a game about it', pasEncore: 'No game yet', jeu: 'Game',
      fermer: 'Close', charge: 'The tree could not load. Try again with a connection.', enfant: 'The child'
    }
  };

  var jeux = [], aime = [], vu = 'maths', depart = 'maths', selection = null, enfantVu = null, pret = false;
  var $ = function (id) { return document.getElementById(id); };

  function lang() { return LudiSite.langue(); }
  function tx(k, vars) {
    var s = TX[lang()][k];
    Object.keys(vars || {}).forEach(function (c) { s = s.split('{' + c + '}').join(vars[c]); });
    return s;
  }
  function pick(o) { return o ? (o[lang()] || o.fr || '') : ''; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function jeuDe(id) { return jeux.filter(function (g) { return g.id === id; })[0] || null; }
  function iconeSure(g) { return g.icon && /^https?:\/\//.test(g.icon) ? g.icon : ''; }
  function couleurSure(c) { return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#1d2b4f'; }

  // ---------- Le foyer de cet appareil ----------
  function lire() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function foyer() { var s = lire(); return s.famille && s.famille.enfants && s.famille.enfants.length ? s.famille : null; }
  function enfant() {
    var h = foyer();
    if (!h) return null;
    var id = enfantVu || h.actif;
    return h.enfants.filter(function (e) { return e.id === id; })[0] || h.enfants[0];
  }
  // Toujours relire avant d'écrire : l'appli a pu changer le foyer depuis un autre onglet.
  function changerEnfant(f, reglage) {
    var s = lire(), h = s.famille, id = enfant().id;
    var e = h.enfants.filter(function (x) { return x.id === id; })[0];
    f(e);
    if (reglage) { h.maj = Date.now(); e.maj = Date.now(); }
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (err) { /* rien */ }
  }
  function statsDe(g) { var e = enfant(); return e && e.games ? e.games[g.id] : null; }
  function installe(g) { var e = enfant(); return !!(e && e.jeux && e.jeux[g.id]); }
  function envies() {
    var e = enfant(), o = (e && e.envies) || {};
    return Object.keys(o).filter(function (id) { return o[id].v && A.caseDe(id); });
  }

  // ---------- Dessins ----------
  function glyphe(p, c, t) { return '<svg aria-hidden="true" width="' + t + '" height="' + t + '" viewBox="0 0 24 24" class="ex-glyphe"><path d="' + p + '" fill="none" stroke="' + c + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  var HEX = '50,2 98,29 98,83 50,110 2,83 2,29';
  var nHex = 0;
  function marque(etat, c) {
    if (etat === 'joue') return '<circle cx="82" cy="20" r="15" fill="' + c + '"/><path d="M75 20l5 5 9-10" fill="none" stroke="#10183a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>';
    if (etat === 'appris') return '<circle cx="82" cy="20" r="16" fill="#fbf7ee"/><path d="M82 8.5l3.5 7.2 7.9 1-5.8 5.4 1.5 7.9-7.1-3.9-7.1 3.9 1.5-7.9-5.8-5.4 7.9-1z" fill="#10183a"/>';
    if (etat === 'adore') return '<circle cx="82" cy="20" r="16" fill="#fbf7ee"/><path d="M82 30s-11-7-11-15a6 6 0 0 1 11-3.500a6 6 0 0 1 11 3.500c0 8-11 15-11 15z" fill="#10183a"/>';
    if (etat === 'envie') return '<circle cx="82" cy="20" r="16" fill="#fbf7ee"/><path d="M76 31V10h13l-3 5 3 5H76" fill="#10183a"/>';
    return '';
  }
  function aEnvie(x) { var e = enfant(); return !!(e && e.envies && e.envies[x.id] && e.envies[x.id].v); }
  function hexagone(x, etat, c) {
    var bord = etat === 'joue' || etat === 'appris' || etat === 'adore' ? 'stroke="' + c + '" stroke-width="6"' : etat === 'essayer' ? 'stroke="' + c + '" stroke-width="3"' : 'stroke="' + c + '" stroke-opacity=".6" stroke-width="2.5" stroke-dasharray="7 6"';
    var g = x.jeux[0], clip = 'ex-clip-' + (nHex++), image = '', plus = '';
    if (g) {
      var e = enfant();
      var joue = e && x.jeux.filter(function (j) { return e.games && e.games[j.id] && e.games[j.id].ms > 0; })[0];
      g = joue || g;
      image = '<clipPath id="' + clip + '"><polygon points="' + HEX + '"/></clipPath>' +
        '<polygon points="' + HEX + '" fill="' + couleurSure(g.color) + '"/>' +
        '<text x="50" y="72" text-anchor="middle" class="ex-initiale">' + esc((pick(g.title) || '?').charAt(0)) + '</text>' +
        (iconeSure(g) ? '<image href="' + esc(iconeSure(g)) + '" width="100" height="112" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + clip + ')"' + (etat === 'essayer' ? ' class="ex-terne"' : '') + '/>' : '');
    } else {
      plus = '<path d="M50 44v24M38 56h24" stroke="' + c + '" stroke-opacity=".75" stroke-width="4" stroke-linecap="round"/>';
    }
    var encore = x.jeux.length > 1 ? '<circle cx="18" cy="20" r="14" fill="#fbf7ee"/><text x="18" y="26" text-anchor="middle" class="ex-encore">+' + (x.jeux.length - 1) + '</text>' : '';
    return '<svg class="ex-hex" viewBox="0 0 100 112" aria-hidden="true"><polygon points="' + HEX + '" fill="#1a2455"/>' + image + '<polygon points="' + HEX + '" fill="none" ' + bord + '/>' + plus + encore + marque(!x.jeux.length && aEnvie(x) ? 'envie' : etat, c) + '</svg>';
  }
  function libelleEtat(etat) { return { joue: tx('legJoue'), appris: tx('legAppris'), adore: tx('legAdore'), essayer: tx('legEssayer'), vide: tx('legVide'), envie: tx('legEnvie') }[etat]; }

  // ---------- L'arbre ----------
  // Une colonne se lit de bas en haut, en zigzag : le plus simple en bas, ce qui s'appuie dessus au-dessus.
  function colonne(s, b, i) {
    var PAS = 66, n = s.cases.length, L = n === 1 ? 130 : 250, H = n * PAS + 164, e = enfant();
    var pos = s.cases.map(function (x, k) { return { x: n === 1 ? L / 2 : L / 2 + (k % 2 ? 60 : -60), y: H - 120 - k * PAS }; });
    var traits = s.cases.map(function (x, k) {
      var p = k ? pos[k - 1] : { x: L / 2, y: H - 24 }, q = pos[k], et = A.etat(x, e), fort = et === 'joue' || et === 'appris' || et === 'adore';
      return '<path d="M' + p.x + ' ' + p.y + 'L' + q.x + ' ' + q.y + '" fill="none" stroke-linecap="round" stroke-width="' + (fort ? 7 : 4) + '" stroke="' + (fort ? b.couleur : '#2f3c86') + '"/>';
    }).join('');
    var noeuds = s.cases.map(function (x, k) {
      var et = A.etat(x, e), nom = pick(x.nom);
      return '<button type="button" class="ex-case' + (selection === x.id ? ' sel' : '') + '" data-case="' + x.id + '" aria-label="' + esc(nom + ', ' + libelleEtat(!x.jeux.length && aEnvie(x) ? 'envie' : et) + (x.jeux[0] ? ', ' + pick(x.jeux[0].title) : '')) + '" style="left:' + (pos[k].x - 59) + 'px;top:' + (pos[k].y - 41) + 'px">' + hexagone(x, et, b.couleur) + '<span class="ex-nom">' + esc(nom) + '</span></button>';
    }).join('');
    return '<div class="ex-colonne ex-monte" style="width:' + L + 'px;height:' + H + 'px;animation-delay:' + (i * 70) + 'ms"><svg width="' + L + '" height="' + H + '" class="ex-traits" aria-hidden="true">' + traits + '</svg>' + noeuds + '<div class="ex-pied">' + esc(pick(s.nom)) + '</div></div>';
  }
  function legende() {
    var c = '#fbf7ee', e = enfant();
    var dessins = {
      joue: '<path d="M28 58l16 16 28-32" fill="none" stroke="' + c + '" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>',
      appris: '<path d="M50 24l9 18 20 3-14 14 3 20-18-10-18 10 3-20-14-14 20-3z" fill="' + c + '"/>',
      adore: '<path d="M50 84S22 66 22 44a15 15 0 0 1 28-8a15 15 0 0 1 28 8c0 22-28 40-28 40z" fill="' + c + '"/>',
      envie: '<path d="M32 88V24h40l-10 16 10 16H32" fill="' + c + '"/>'
    };
    function item(et) { var trait = et === 'vide' || et === 'envie' ? 'stroke-width="7" stroke-dasharray="14 12"' : 'stroke-width="' + (et === 'essayer' ? 7 : 14) + '"'; return '<span><svg width="20" height="22" viewBox="0 0 100 112" aria-hidden="true"><polygon points="' + HEX + '" fill="#1a2455" stroke="' + c + '" ' + trait + '/>' + (dessins[et] || '') + '</svg>' + esc(libelleEtat(et)) + '</span>'; }
    return '<div class="ex-legende">' + (e ? item('joue') + item('appris') + item('adore') : '') + item('essayer') + item('vide') + (e ? item('envie') : '') + '<span class="ex-sens">' + esc(tx('legSens')) + '</span></div>';
  }
  function rendreBranches() {
    var html = '<button type="button" data-b="tous" style="--c:#fbf7ee" aria-pressed="' + (vu === 'tous') + '" class="ex-tous">' + esc(tx('tous')) + '</button>' + A.BRANCHES.map(function (b) {
      return '<button type="button" data-b="' + b.id + '" style="--c:' + b.couleur + '" aria-pressed="' + (vu === b.id) + '">' + glyphe(b.glyphe, b.couleur, 18) + esc(pick(b.nom)) + '</button>';
    }).join('');
    $('ex-branches').innerHTML = html;
    $('ex-branches').querySelectorAll('[data-b]').forEach(function (n) {
      n.addEventListener('click', function () { vu = n.getAttribute('data-b'); selection = null; poserAdresse(); rendreBranches(); rendreArbre(); rendrePanneauAccueil(); });
    });
  }
  function rendreArbre() {
    var zone = $('ex-arbre');
    nHex = 0;
    if (vu === 'tous') { rendreTous(zone); return; }
    var b = A.BRANCHES.filter(function (x) { return x.id === vu; })[0];
    zone.innerHTML = '<div class="ex-progression" id="ex-progression" style="--c:' + b.couleur + '"><div class="ex-colonnes">' + b.sous.map(function (s, i) { return colonne(s, b, i); }).join('') + '</div><div class="ex-tronc"></div></div>' + legende();
    brancherCases(zone);
    var p = $('ex-progression');
    var sel = selection && zone.querySelector('.ex-case.sel');
    // On fait défiler l'arbre seulement, jamais la page : la barre reste en place.
    if (sel) {
      var ra = p.getBoundingClientRect(), rc = sel.getBoundingClientRect();
      p.scrollTop += rc.top - ra.top - (ra.height - rc.height) / 2;
      p.scrollLeft += rc.left - ra.left - (ra.width - rc.width) / 2;
    } else p.scrollTop = p.scrollHeight;
  }
  function rendreTous(zone) {
    var e = enfant();
    zone.innerHTML = '<div class="ex-mur">' + jeux.map(function (g) {
      var st = statsDe(g), joue = st && st.ms > 0;
      return '<article class="ex-tuile' + (selection === 'jeu:' + g.id ? ' sel' : '') + '">' +
        '<button type="button" class="ex-tuile-jeu" data-jeu="' + esc(g.id) + '">' + imageJeu(g, '') + '<strong>' + esc(pick(g.title)) + '</strong>' +
        (e ? '<em>' + esc(joue ? duree(st.ms) : installe(g) ? tx('installe') : tx('pasInstalle')) + '</em>' : '') + '</button>' +
        '<div class="ex-pastilles">' + A.casesDuJeu(g).map(function (x) { return '<button type="button" data-case="' + x.id + '" style="--c:' + x.branche.couleur + '">' + glyphe(x.branche.glyphe, x.branche.couleur, 14) + esc(pick(x.nom)) + '</button>'; }).join('') + '</div></article>';
    }).join('') + '</div>';
    brancherCases(zone);
  }
  function imageJeu(g, cls) {
    return '<span class="ex-image ' + cls + '" style="--jeu:' + couleurSure(g.color) + '"><span aria-hidden="true">' + esc((pick(g.title) || '?').charAt(0)) + '</span>' + (iconeSure(g) ? '<img src="' + esc(iconeSure(g)) + '" alt="" loading="lazy">' : '') + '</span>';
  }
  function brancherCases(zone) {
    zone.querySelectorAll('[data-case]').forEach(function (n) { n.addEventListener('click', function () { voirCase(A.caseDe(n.getAttribute('data-case'))); }); });
    zone.querySelectorAll('[data-jeu]').forEach(function (n) { n.addEventListener('click', function () { voirJeu(jeuDe(n.getAttribute('data-jeu'))); }); });
  }
  function marquerSelection() {
    document.querySelectorAll('.ex-case').forEach(function (n) { n.classList.toggle('sel', n.getAttribute('data-case') === selection); });
    document.querySelectorAll('.ex-tuile').forEach(function (n) { var j = n.querySelector('[data-jeu]'); n.classList.toggle('sel', !!j && 'jeu:' + j.getAttribute('data-jeu') === selection); });
  }

  // ---------- Le panneau ----------
  function duree(ms) {
    var m = Math.round(ms / 60000);
    if (m < 1) return tx('moinsMin');
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + String(m % 60).padStart(2, '0') : '');
  }
  function parties(n) { return n === 1 ? TX[lang()].parties.un : TX[lang()].parties.plus.replace('{n}', n); }
  function montrer(html) {
    var p = $('ex-panneau');
    p.hidden = false;
    p.classList.add('ouvert');
    p.innerHTML = '<button type="button" class="ex-fermer" id="ex-fermer">' + esc(tx('fermer')) + '</button>' + html;
    p.scrollTop = 0;
    $('ex-fermer').addEventListener('click', fermerPanneau);
    p.querySelectorAll('[data-case]').forEach(function (n) { n.addEventListener('click', function () { voirCase(A.caseDe(n.getAttribute('data-case')), true); }); });
    p.querySelectorAll('[data-jeu]').forEach(function (n) { n.addEventListener('click', function () { voirJeu(jeuDe(n.getAttribute('data-jeu'))); }); });
    p.querySelectorAll('[data-branche-envies]').forEach(function (n) { n.addEventListener('click', voirEnvies); });
  }
  function fermerPanneau() { $('ex-panneau').classList.remove('ouvert'); selection = null; poserAdresse(); marquerSelection(); }
  function rendrePanneauAccueil() {
    var n = envies().length;
    montrer('<h2>' + esc(tx('accueilTitre')) + '</h2><p>' + esc(tx('accueilTexte')) + '</p>' + (n ? '<button type="button" class="ex-action creux" data-branche-envies>' + esc(tx('envies', { n: n })) + '</button>' : ''));
    $('ex-panneau').classList.remove('ouvert');
  }
  function libelleCle(k) { if (/^\d+x\d+$/.test(k)) return k.replace('x', '×'); var l = k.replace(/[-_]/g, ' '); return l.charAt(0).toUpperCase() + l.slice(1); }
  function faitsJeu(g, x) {
    var e = enfant();
    if (!e) return '';
    var st = statsDe(g);
    if (!st || !(st.ms > 0)) return '<p class="ex-fait">' + esc(tx('jamais')) + ' · ' + esc(installe(g) ? tx('installe') : tx('pasInstalle')) + '</p>';
    var d = A.dernierJour(st), lignes = [tx('temps', { t: duree(st.ms) }) + (st.sessions ? ' · ' + parties(st.sessions) : '')];
    if (d) lignes.push(tx('dernier', { d: d.toLocaleDateString(lang(), { day: 'numeric', month: 'long' }) }));
    if (x) {
      var f = A.faits(st, x.domaine);
      if (f.n) {
        if (f.reussies.length) lignes.push(tx('reussies', { l: f.reussies.slice(0, 12).map(libelleCle).join(', ') }));
        if (f.ratees.length) lignes.push(tx('ratees', { l: f.ratees.slice(0, 12).map(libelleCle).join(', ') }));
      } else lignes.push(tx('queTemps'));
    } else {
      Object.keys(st.progress || {}).forEach(function (k) { lignes.push(libelleCle(k) + ' : ' + st.progress[k]); });
      Object.keys(st.scores || {}).forEach(function (k) { lignes.push(libelleCle(k) + ' : ' + Number(st.scores[k].value).toLocaleString(lang())); });
    }
    return lignes.map(function (l) { return '<p class="ex-fait">' + esc(l) + '</p>'; }).join('');
  }
  function boutonInstaller(g, creux) {
    var e = enfant(), ins = installe(g);
    return '<button type="button" class="ex-action' + (ins || creux ? ' creux' : '') + '" data-installer="' + esc(g.id) + '">' + esc(ins ? tx('desinstaller') : tx('installer', { n: e.enfant.nom })) + (LudiBarre.parentOuvert() ? '' : '<small>' + esc(tx('avecCode')) + '</small>') + '</button>';
  }
  function carteJeu(g, x) {
    var e = enfant();
    return '<button type="button" class="ex-carte" data-jeu="' + esc(g.id) + '">' + imageJeu(g, 'petite') + '<span><strong>' + esc(pick(g.title)) + '</strong><span>' + esc(pick(g.pitch)) + '</span></span></button>' + faitsJeu(g, x) + (e && !installe(g) ? boutonInstaller(g) : '');
  }
  function basculerInstallation(id) {
    changerEnfant(function (en) { en.jeux = en.jeux || {}; if (en.jeux[id]) delete en.jeux[id]; else en.jeux[id] = { max: null }; }, true);
  }
  function brancherInstaller(zone, apres) {
    zone.querySelectorAll('[data-installer]').forEach(function (n) {
      n.addEventListener('click', function () {
        var id = n.getAttribute('data-installer');
        if (!LudiBarre.parentOuvert()) {
          try {
            sessionStorage.setItem(CLE_RETOUR, 'explorer/' + location.hash);
            sessionStorage.setItem(CLE_INSTALLER, id);
          } catch (err) { /* rien */ }
          location.href = BASE + 'app/#carnet';
          return;
        }
        basculerInstallation(id);
        apres();
      });
    });
  }
  function blocVoir(x) {
    var ids = x.sousBranche.voir || x.branche.voir || [];
    var fiches = ids.map(function (id) { return aime.filter(function (r) { return r.id === id; })[0]; }).filter(Boolean);
    if (!fiches.length) return '';
    return '<h3>' + esc(tx('voir')) + '</h3>' + fiches.map(function (r) { return '<a class="ex-lien" href="' + BASE + 'aime-bien/#' + esc(r.id) + '">' + esc(pick(r.title)) + '</a>'; }).join('') + '<p class="ex-note">' + esc(tx('voirDans')) + '</p>';
  }
  function poserAdresse() {
    var h = !selection ? (vu === depart ? '' : '#' + vu) : selection.indexOf('jeu:') === 0 ? '#jeu=' + selection.slice(4) : '#case=' + selection;
    if ((location.hash || '') !== h) history.pushState(null, '', location.pathname + location.search + h);
  }
  function voirCase(x, allerA) {
    if (!x) return;
    selection = x.id;
    if (allerA || vu !== x.branche.id) { if (vu !== x.branche.id) { vu = x.branche.id; rendreBranches(); rendreArbre(); } }
    poserAdresse();
    marquerSelection();
    var e = enfant(), corps = '';
    if (x.jeux.length) {
      corps = '<h3>' + esc(tx(x.jeux.length > 1 ? 'lesJeux' : 'leJeu')) + '</h3>' + x.jeux.map(function (g) { return carteJeu(g, x); }).join('');
      var joue = e && x.jeux.some(function (g) { var st = statsDe(g); return st && st.ms > 0; });
      if (joue) {
        var v = e.avis && e.avis[x.id] ? e.avis[x.id].v : null;
        corps += '<h3>' + esc(tx('dit', { n: e.enfant.nom })) + '</h3><div class="ex-choix">' + [['appris', tx('appris')], ['adore', tx('adore')], ['bof', tx('bof')]].map(function (a) {
          return '<button type="button" data-avis="' + a[0] + '" aria-pressed="' + (v === a[0]) + '">' + esc(a[1]) + '</button>';
        }).join('') + '</div>';
      }
    } else {
      var oui = e && e.envies && e.envies[x.id] && e.envies[x.id].v;
      corps = '<p>' + esc(tx('sansJeu')) + (oui ? ' ' + esc(tx('envieDedans')) : '') + '</p><div class="ex-actions">' +
        (e ? '<button type="button" class="ex-action' + (oui ? ' creux' : '') + '" id="ex-envie" aria-pressed="' + !!oui + '">' + esc(tx(oui ? 'envieOui' : 'envie')) + '</button><p class="ex-note">' + esc(tx('envieNote')) + '</p>' : '') +
        '<a class="ex-action creux" href="' + BASE + 'creer/">' + esc(tx('creer')) + '</a><p class="ex-note">' + esc(tx('creerNote')) + '</p></div>';
    }
    corps += blocVoir(x);
    montrer('<p class="ex-fil">' + esc(pick(x.branche.nom)) + ' › ' + esc(pick(x.sousBranche.nom)) + '</p><h2 style="color:' + x.branche.couleur + '">' + esc(pick(x.nom)) + '</h2>' + corps);
    var p = $('ex-panneau');
    p.querySelectorAll('[data-avis]').forEach(function (n) {
      n.addEventListener('click', function () {
        var val = n.getAttribute('data-avis');
        changerEnfant(function (en) {
          en.avis = en.avis || {};
          var av = en.avis[x.id];
          en.avis[x.id] = { v: av && av.v === val ? null : val, t: Date.now() };
        });
        rendreArbre();
        voirCase(x);
      });
    });
    var be = $('ex-envie');
    if (be) be.addEventListener('click', function () {
      changerEnfant(function (en) {
        en.envies = en.envies || {};
        var ev = en.envies[x.id];
        en.envies[x.id] = { v: !(ev && ev.v), t: Date.now() };
      });
      rendreEnfants();
      rendreArbre();
      voirCase(x);
    });
    brancherInstaller(p, function () { voirCase(x); });
  }
  function voirJeu(g) {
    if (!g) return;
    selection = 'jeu:' + g.id;
    poserAdresse();
    marquerSelection();
    var e = enfant(), ins = installe(g), ageOk = !e || (e.enfant.age >= g.age.min && e.enfant.age <= g.age.max);
    var niveau = TX[lang()].goal[g.learning.level] ? g.learning.level : 'none';
    var gestes = '<div class="ex-actions">';
    if (e) {
      if (ins) gestes += '<a class="ex-action" id="ex-jouer" href="' + BASE + 'app/#jouer=' + esc(g.id) + '">' + esc(tx('jouer')) + '</a>';
      gestes += boutonInstaller(g);
    } else {
      gestes += '<a class="ex-action" href="' + esc(LudiBarre.lienApp(BASE)) + '">' + esc(tx('essayer')) + '</a>';
    }
    gestes += '</div>';
    var html = imageJeu(g, 'grande') + '<h2>' + esc(pick(g.title)) + '</h2><p>' + esc(pick(g.pitch)) + '</p>' +
      '<p class="ex-fait">' + esc(tx('ages', { a: g.age.min, b: g.age.max })) + ' · ' + esc(TX[lang()].goal[niveau]) + '</p>' +
      (ageOk ? '' : '<p class="ex-alerte">' + esc(tx('horsAge', { a: g.age.min, b: g.age.max, n: e.enfant.nom, x: e.enfant.age })) + '</p>') +
      faitsJeu(g, null) + gestes +
      '<h3>' + esc(tx('travaille')) + '</h3><div class="ex-pastilles">' + A.casesDuJeu(g).map(function (x) { return '<button type="button" data-case="' + x.id + '" style="--c:' + x.branche.couleur + '">' + glyphe(x.branche.glyphe, x.branche.couleur, 14) + esc(pick(x.nom)) + '</button>'; }).join('') + '</div>' +
      '<h3>' + esc(tx('apprend')) + '</h3><p>' + esc(pick(g.learning.what)) + '</p>' +
      '<a class="ex-action creux" href="' + BASE + 'les-jeux/#' + esc(g.id) + '">' + esc(tx('fiche')) + '</a>';
    montrer(html);
    brancherInstaller($('ex-panneau'), function () { voirJeu(g); if (vu === 'tous') rendreArbre(); });
    var bj = $('ex-jouer');
    if (bj) bj.addEventListener('click', LudiBarre.fermerParent);
  }
  function voirEnvies() {
    var ls = envies().map(A.caseDe);
    selection = null;
    marquerSelection();
    montrer('<h2>' + esc(tx('enviesTitre')) + '</h2>' + (ls.length ? '<p>' + esc(tx('enviesTexte')) + '</p><div class="ex-pastilles">' + ls.map(function (x) { return '<button type="button" data-case="' + x.id + '" style="--c:' + x.branche.couleur + '">' + glyphe(x.branche.glyphe, x.branche.couleur, 14) + esc(pick(x.nom)) + '</button>'; }).join('') + '</div>' : '<p>' + esc(tx('enviesRien')) + '</p>'));
  }

  // ---------- Enfant et envies ----------
  function rendreEnfants() {
    var h = foyer(), z = $('ex-enfants');
    if (!h) { z.innerHTML = ''; return; }
    var cur = enfant(), n = envies().length;
    z.innerHTML = h.enfants.map(function (e) { return '<button type="button" class="ex-enfant" data-enfant="' + esc(e.id) + '" aria-pressed="' + (e.id === cur.id) + '"' + (h.enfants.length === 1 ? ' disabled' : '') + '>' + esc(e.enfant.nom) + '</button>'; }).join('') +
      (n ? '<button type="button" class="ex-envies" id="ex-envies">' + esc(tx('envies', { n: n })) + '</button>' : '');
    z.querySelectorAll('[data-enfant]').forEach(function (b) {
      b.addEventListener('click', function () { enfantVu = b.getAttribute('data-enfant'); selection = null; rendreTout(); });
    });
    var be = $('ex-envies');
    if (be) be.addEventListener('click', voirEnvies);
  }

  // ---------- La recherche ----------
  function rendreResultats() {
    var q = $('ex-q').value.trim(), z = $('ex-resultats');
    if (!q) { z.hidden = true; z.innerHTML = ''; return; }
    var r = A.chercher(q, lang(), jeux);
    var html = r.cases.slice(0, 8).map(function (x) {
      var g = x.jeux[0];
      return '<button type="button" data-case="' + x.id + '">' + (g ? imageJeu(g, 'mini') : '<span class="ex-mini-vide">' + glyphe(x.branche.glyphe, x.branche.couleur, 20) + '</span>') + '<span>' + esc(pick(x.nom)) + '<small>' + esc(pick(x.branche.nom)) + ' › ' + esc(pick(x.sousBranche.nom)) + (g ? '' : ' · ' + tx('pasEncore')) + '</small></span></button>';
    }).join('') + r.jeux.slice(0, 6).map(function (g) {
      return '<button type="button" data-jeu="' + esc(g.id) + '">' + imageJeu(g, 'mini') + '<span>' + esc(pick(g.title)) + '<small>' + esc(tx('jeu')) + '</small></span></button>';
    }).join('');
    if (!html) html = '<p>' + esc(tx('rien', { q: q })) + '</p><a class="ex-lien" href="' + BASE + 'creer/">' + esc(tx('rienCreer')) + '</a>';
    z.innerHTML = html;
    z.hidden = false;
    z.querySelectorAll('[data-case]').forEach(function (n) { n.addEventListener('click', function () { fermerRecherche(); voirCase(A.caseDe(n.getAttribute('data-case')), true); }); });
    z.querySelectorAll('[data-jeu]').forEach(function (n) { n.addEventListener('click', function () { fermerRecherche(); vu = 'tous'; rendreBranches(); voirJeu(jeuDe(n.getAttribute('data-jeu'))); rendreArbre(); }); });
  }
  function fermerRecherche() { $('ex-q').value = ''; rendreResultats(); }

  // ---------- Assemblage ----------
  function lireAdresse() {
    var h = location.hash.slice(1);
    vu = depart; selection = null;
    if (h.indexOf('case=') === 0) { var x = A.caseDe(h.slice(5)); if (x) { vu = x.branche.id; selection = x.id; } }
    else if (h.indexOf('jeu=') === 0) { if (jeuDe(h.slice(4))) { vu = 'tous'; selection = 'jeu:' + h.slice(4); } }
    else if (h === 'tous' || A.BRANCHES.some(function (b) { return b.id === h; })) { vu = h; selection = null; }
  }
  function rendreTout() {
    $('ex-q').setAttribute('placeholder', tx('placeholder'));
    rendreEnfants();
    rendreBranches();
    rendreArbre();
    if (!selection) rendrePanneauAccueil();
    else if (selection.indexOf('jeu:') === 0) voirJeu(jeuDe(selection.slice(4)));
    else voirCase(A.caseDe(selection));
    rendreResultats();
  }

  // Le code vient d'être donné pour installer ce jeu : on le fait, sans redemander le geste.
  function installerEnAttente() {
    var id = null;
    try { id = sessionStorage.getItem(CLE_INSTALLER); sessionStorage.removeItem(CLE_INSTALLER); } catch (e) { /* rien */ }
    if (id && LudiBarre.parentOuvert() && jeuDe(id) && enfant() && !installe(jeuDe(id))) basculerInstallation(id);
  }

  function getJSON(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); }); }
  function charger() {
    return getJSON(BASE + 'jeux/index.json').then(function (idx) {
      return Promise.all(idx.games.map(function (f) { return getJSON(BASE + 'jeux/' + f).catch(function () { return null; }); }));
    }).then(function (l) {
      jeux = l.filter(Boolean);
      A.relier(jeux);
      return getJSON(BASE + 'aime-bien/fiches.json').catch(function () { return {}; });
    }).then(function (f) {
      aime = f.items || [];
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Une icône qui ne vient pas : on laisse l'initiale du jeu.
    document.addEventListener('error', function (ev) { var n = ev.target; if (n && (n.tagName === 'IMG' || n.tagName === 'image') && n.closest('.ex')) n.remove(); }, true);
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (!$('ex-resultats').hidden) fermerRecherche();
      else if ($('ex-panneau').classList.contains('ouvert')) fermerPanneau();
    });
    document.addEventListener('click', function (ev) { if (!ev.target.closest('.ex-cherche')) { $('ex-resultats').hidden = true; } });
    window.addEventListener('popstate', function () { if (pret) { lireAdresse(); rendreTout(); } });
    $('ex-q').addEventListener('input', rendreResultats);
    $('ex-q').addEventListener('focus', rendreResultats);
    LudiSite.surLangue(function () { if (pret) rendreTout(); });
    charger().then(function () {
      pret = true;
      depart = A.brancheDeDepart(jeux, enfant());
      lireAdresse();
      installerEnAttente();
      rendreTout();
    }).catch(function () {
      $('ex-arbre').innerHTML = '<p class="ex-attente">' + esc(tx('charge')) + '</p>';
    });
  });
})();
