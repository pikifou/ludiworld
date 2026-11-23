/* Ludiworld : la barre du site, sur les pages du site. Le côté parent de l'appli a son propre et unique bandeau
   (Julien, 2026-11-18 : jamais deux bandeaux) ; il y reprend le logo (vers le site), la pastille et FR / EN (appli()).
   Sur le site : Accueil, Les jeux, Ludiworld aime bien, FR / EN, le compte (« Se connecter », ou connecté, une pastille : initiale
   et début de l'adresse, qui ouvre Ouvrir l'appli / Mon compte / Se déconnecter). Sur une page du site d'un appareil préparé
   ou d'un parent connecté, le bouton de droite est « Ouvrir l'appli → » (vers app/#carnet).
   Le site est à la racine, l'appli sous app/ : la marque et « Accueil » mènent à la racine, même depuis l'appli.
   Dessous, une fine ligne : les promesses de Ludiworld, dites une seule fois ici (pas dans les fiches), qui mène à la charte.
   Elle porte aussi l'état du parent (code donné il y a peu) et l'adresse du compte, lus par l'appli et les pages.
   Explorer (l'arbre des compétences) existe mais n'est lié nulle part : il attend d'avoir bien plus de jeux. */
(function () {
  'use strict';

  var STORE = 'ludiworld.v1';
  var CLE_PARENT = 'ludiworld.parent'; // dernière activité du parent (sessionStorage), après son code
  var DUREE_PARENT = 5 * 60 * 1000;   // au-delà, le côté parent redemande le code
  var CLE_SESSION = 'ludiworld.session'; // la session du compte (site/nuage.js)
  // Le projet Supabase de Ludiworld. La clé est publique par nature : ce sont les règles de la base qui protègent les données.
  // Vide : pas de compte, le site et l'appli marchent comme avant. window.LUDI_NUAGE sert aux tests.
  var NUAGE = window.LUDI_NUAGE || { url: 'https://mtjayvylkapxblzybjrv.supabase.co', cle: 'sb_publishable_4t-dJM6WstpVtr31qgESmQ_bK0FEc9v' };

  var T = {
    fr: {
      nav: 'Ludiworld', accueil: 'Accueil', monLudi: 'Mon Ludiworld', jeux: 'Les jeux', creer: 'Créer un jeu', aime: 'Ludiworld aime bien',
      code: 'demande le code parent', preparer: 'Préparer Ludiworld',
      connexion: 'Se connecter', compte: 'Mon compte', essayer: 'Essayer',
      connecte: 'Connecté', connecteAvec: 'Connecté avec', sortir: 'Se déconnecter',
      ouvrirApp: 'Ouvrir l’appli', leSite: 'Le site Ludiworld',
      promesses: ['Sans pub', 'Rien à acheter', 'Aucun inconnu'], charte: 'La charte de Ludiworld', menu: 'Les pages du site'
    },
    en: {
      nav: 'Ludiworld', accueil: 'Home', monLudi: 'My Ludiworld', jeux: 'The games', creer: 'Make a game', aime: 'Ludiworld likes',
      code: 'asks for the parent code', preparer: 'Set up Ludiworld',
      connexion: 'Sign in', compte: 'My account', essayer: 'Try it',
      connecte: 'Signed in', connecteAvec: 'Signed in as', sortir: 'Sign out',
      ouvrirApp: 'Open the app', leSite: 'The Ludiworld website',
      promesses: ['No ads', 'Nothing to buy', 'No strangers'], charte: 'The Ludiworld charter', menu: 'The website pages'
    }
  };
  var ICO = {
    soleil: '<circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g>',
    menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    cadenas: '<rect x="4" y="10.5" width="16" height="11" rx="2.5" fill="currentColor"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" fill="none" stroke="currentColor" stroke-width="2.4"/>',
    coche: '<path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
    chevron: '<path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    maison: '<path d="M3.5 11.5L12 4l8.5 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10.5V20h12v-9.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><rect x="10" y="14" width="4" height="6" fill="currentColor"/>',
    personne: '<circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c.6-4.4 3.8-7 8-7s7.4 2.6 8 7z" fill="currentColor"/>',
    fleche: '<path d="M4 12h15M13.5 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
    sortie: '<path d="M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M11 12h9.5M17 8.5l3.5 3.5-3.5 3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  // Ludiworld est-il préparé sur cet appareil (un code parent existe) ?
  function configure() {
    try { var s = JSON.parse(localStorage.getItem(STORE)); return !!(s && s.famille && s.famille.pin); } catch (e) { return false; }
  }
  function parentOuvert() {
    try { var v = Number(sessionStorage.getItem(CLE_PARENT)); return v > 0 && Date.now() - v < DUREE_PARENT; } catch (e) { return false; }
  }
  function ouvrirParent() { try { sessionStorage.setItem(CLE_PARENT, String(Date.now())); } catch (e) { /* rien */ } }
  function fermerParent() { try { sessionStorage.removeItem(CLE_PARENT); } catch (e) { /* rien */ } }
  function nuageActif() { return !!(NUAGE.url && NUAGE.cle); }
  function connecte() { try { return nuageActif() && !!localStorage.getItem(CLE_SESSION); } catch (e) { return false; } }
  // Quelqu'un de nouveau : le bouton s'appelle « Essayer ». Il mène droit à la préparation de l'appareil
  // (sans questions ni compte : le compte se propose à la fin, facultatif).
  function nouveauVenu() { return nuageActif() && !configure() && !connecte(); }
  // L'appli vit sous app/ (le site est à la racine, Julien 2026-11-18).
  function lienApp(base) { return (base || '') + 'app/' + (configure() ? '' : '#demarrer'); }
  // Son Ludiworld : le côté parent de l'appli (derrière le code) ; un appareil pas encore préparé ouvre l'appli (la préparation).
  function lienMonLudi(base) { return (base || '') + 'app/' + (configure() ? '#carnet' : ''); }
  function sessionCompte() { try { return JSON.parse(localStorage.getItem(CLE_SESSION)) || null; } catch (e) { return null; } }
  // Le nom montré dans la pastille : le début de l'adresse, avant @ (le compte n'a pas de prénom).
  function nomCompte() {
    var s = sessionCompte(), e = s && typeof s.email === 'string' ? s.email : '';
    var i = e.indexOf('@');
    var n = i > 0 ? e.slice(0, i) : e;
    return n.length > 24 ? n.slice(0, 23) + '…' : n;
  }

  // « Se déconnecter » depuis la barre : le même effet que sur la page du compte, puis retour à l'accueil du site.
  function seDeconnecter(accueil) {
    var s = sessionCompte();
    try {
      // Pour que le côté parent dise vrai ensuite : la copie en ligne reste gardée si elle était active sur cet appareil.
      var l = JSON.parse(localStorage.getItem('ludiworld.synchro'));
      localStorage.setItem('ludiworld.copieVue', s && l && l.compte === s.id && l.active !== false ? '1' : '0');
      localStorage.removeItem('ludiworld.envie');
    } catch (e) { /* rien */ }
    function oublier() {
      try { ['ludiworld.session', 'ludiworld.synchro', 'ludiworld.liaison'].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* rien */ }
    }
    function fini() { oublier(); location.href = new URL(accueil, document.baseURI).href; }
    var fait;
    if (window.LudiNuage && window.LudiNuage.deconnecter) fait = window.LudiNuage.deconnecter();
    else if (s && s.jeton && s.expire > Date.now()) {
      // Pages qui ne chargent pas le client du compte : on ferme la session chez Supabase directement (hors ligne : on oublie quand même).
      fait = fetch(NUAGE.url.replace(/\/$/, '') + '/auth/v1/logout?scope=local', { method: 'POST', headers: { apikey: NUAGE.cle, Authorization: 'Bearer ' + s.jeton } });
    } else fait = Promise.resolve();
    fait.then(fini, fini);
  }

  // Le petit menu du compte (pastille) : un seul ouvert, fermé par Échap, par un toucher ailleurs, ou quand le focus en sort.
  function fermerQui(rendreFocus) {
    Array.prototype.forEach.call(document.querySelectorAll('.lw-qui-menu:not([hidden])'), function (m) {
      m.hidden = true;
      var b = m.parentNode.querySelector('.lw-pastille');
      b.setAttribute('aria-expanded', 'false');
      if (rendreFocus) b.focus();
    });
  }
  document.addEventListener('click', function (ev) { if (!(ev.target.closest && ev.target.closest('.lw-qui'))) fermerQui(false); });
  document.addEventListener('focusin', function (ev) { if (!(ev.target.closest && ev.target.closest('.lw-qui'))) fermerQui(false); });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && document.querySelector('.lw-qui-menu:not([hidden])')) { ev.stopPropagation(); fermerQui(true); }
  }, true);

  function svg(nom) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'lw-ico');
    s.innerHTML = ICO[nom];
    return s;
  }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] === null || attrs[k] === undefined) return;
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'onclick') n.addEventListener('click', attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  var nQui = 0;
  function pastille(D, b, accueil, o) {
    var nom = nomCompte(), s = sessionCompte();
    var email = s && s.email ? String(s.email) : '';
    var initiale = (nom.match(/[0-9A-Za-zÀ-ÿ]/) || [''])[0].toUpperCase();
    var id = 'lw-qui-menu-' + (++nQui);
    var dansAppli = !!document.getElementById('player'); // côté parent de l'appli : on y est déjà
    var bouton = el('button', {
      type: 'button', class: 'lw-pastille', 'aria-expanded': 'false', 'aria-controls': id,
      'aria-label': D.connecte + ' : ' + (nom || D.compte), title: email || null
    }, [
      el('span', { class: 'lw-rond', 'aria-hidden': 'true' }, [initiale || svg('personne'), el('span', { class: 'lw-coche' }, [svg('coche')])]),
      el('span', { class: 'lw-qui-txt', 'aria-hidden': 'true' }, [el('span', { class: 'lw-qui-etat', text: D.connecte }), el('span', { class: 'lw-qui-nom', text: nom || D.compte })]),
      el('span', { class: 'lw-chevron', 'aria-hidden': 'true' }, [svg('chevron')])
    ]);
    function item(href, ico, texte, courant) {
      return el('li', null, [el('a', { href: href, class: 'lw-qui-item', 'aria-current': courant ? 'page' : null }, [svg(ico), texte])]);
    }
    var menu = el('div', { class: 'lw-qui-menu', id: id, hidden: '' }, [
      email ? el('p', { class: 'lw-qui-tete' }, [el('span', { text: D.connecteAvec }), el('strong', { text: email })]) : null,
      el('ul', null, [
        // Dans l'appli : le chemin vers le site ; sur le site : le chemin vers l'appli.
        dansAppli ? item(accueil, 'maison', D.leSite, false) : item(lienMonLudi(b), 'fleche', D.ouvrirApp, false),
        item(b + 'compte/#espace', 'personne', D.compte, o.actif === 'compte'),
        el('li', null, [el('button', { type: 'button', class: 'lw-qui-item lw-sortir', onclick: function () { this.disabled = true; seDeconnecter(accueil); } }, [svg('sortie'), D.sortir])])
      ])
    ]);
    bouton.addEventListener('click', function () {
      var ouvrir = menu.hidden;
      fermerQui(false);
      menu.hidden = !ouvrir;
      bouton.setAttribute('aria-expanded', String(ouvrir));
    });
    return el('div', { class: 'lw-qui' }, [bouton, menu]);
  }

  // o : { base: chemin vers la racine du site ('' ou '../'), actif, lang, onLang(l),
  //       action : le bouton de droite fourni par l'appli (côté parent), ou false pour n'en mettre aucun,
  //       replie : sur téléphone, les pages du site passent dans un menu (côté parent, où la place manque) }
  var menuOuvert = false;
  function rendre(hote, o) {
    var D = T[o.lang] || T.fr;
    var b = o.base || '';
    var conf = configure(), ouvert = parentOuvert();
    function onglet(x) {
      return el('a', { href: x[1], 'aria-current': x[0] === o.actif ? 'page' : null, class: 'lw-onglet lw-' + x[0] }, [D[x[0]]]);
    }
    var accueil = b || './'; // l'accueil du site, c'est sa racine
    var onglets = [['accueil', accueil], ['jeux', b + 'les-jeux/'], ['aime', b + 'aime-bien/']];
    // « Créer un jeu » (creer/) n'est plus dans la barre : la page reste à son adresse, liée nulle part (Julien, 2026-11-18).
    var nav = el('nav', { class: 'lw-onglets', 'aria-label': D.nav }, onglets.map(onglet));
    var langs = el('div', { class: 'lw-langs', role: 'group', 'aria-label': 'Langue / Language' }, ['fr', 'en'].map(function (l) {
      return el('button', { type: 'button', lang: l, 'aria-pressed': String(o.lang === l), text: l.toUpperCase(), onclick: function () { o.onLang(l); } });
    }));
    // Sur une page du site d'un appareil préparé ou d'un parent connecté, un seul retour : « Mon Ludiworld »
    // (le côté parent de l'appli, avec un cadenas si le code sera demandé).
    var co = connecte();
    var action = null;
    if (o.action) action = o.action;
    else if (o.action === false) action = null;
    else if (conf || co) action = el('a', { class: 'lw-action lw-vers-parent', href: lienMonLudi(b), title: conf && !ouvert ? D.code : null }, [conf && !ouvert ? svg('cadenas') : null, D.ouvrirApp, svg('fleche')]);
    else if (nouveauVenu()) action = el('a', { class: 'lw-action', href: lienApp(b) }, [svg('soleil'), D.essayer]);
    else action = el('a', { class: 'lw-action', href: lienApp(b) }, [svg('soleil'), D.preparer]);
    var menu = null;
    if (o.replie) {
      menu = el('button', { type: 'button', class: 'lw-menu', 'aria-expanded': String(menuOuvert), 'aria-label': D.menu, title: D.menu, onclick: function () {
        menuOuvert = !menuOuvert;
        menu.setAttribute('aria-expanded', String(menuOuvert));
        menu.closest('.lw-barre').classList.toggle('lw-ouvert', menuOuvert);
      } }, [svg('menu')]);
    }
    // Le compte : « Se connecter », ou, connecté, la pastille (initiale et nom) qui ouvre un petit menu.
    var lienCompte = null;
    if (co) lienCompte = pastille(D, b, accueil, o);
    else if (nuageActif()) lienCompte = el('a', { class: 'lw-compte', href: b + 'compte/#connexion', 'aria-current': o.actif === 'compte' ? 'page' : null, text: D.connexion });
    hote.textContent = '';
    hote.appendChild(el('header', { class: 'lw-barre' + (o.replie ? ' lw-replie' : '') + (o.replie && menuOuvert ? ' lw-ouvert' : '') }, [
      el('a', { class: 'lw-marque', href: accueil, 'aria-label': 'Ludiworld' }, ['Ludi', el('span', { text: 'world' })]),
      nav,
      el('div', { class: 'lw-cote' }, [langs, lienCompte, action, menu])
    ]));
    // Les promesses de tous les jeux de Ludiworld : une fois ici, jamais dans une fiche.
    var pr = [];
    D.promesses.forEach(function (x, i) { if (i) pr.push(el('span', { class: 'lw-point', 'aria-hidden': 'true', text: '·' })); pr.push(el('span', { text: x })); });
    hote.appendChild(el('a', { class: 'lw-promesses', href: accueil + '#charte', title: D.charte }, pr));
  }

  // Côté parent de l'appli : un seul bandeau (Julien, 2026-11-18), pas la barre du site. L'appli y met ces pièces :
  // le logo (bouton vers l'accueil du site), la pastille « Connecté » (ou rien), FR / EN, et « Se connecter » sans compte.
  function appli(o) {
    var D = T[o.lang] || T.fr, b = o.base || '', accueil = b || './';
    return {
      marque: el('a', { class: 'lw-marque', href: accueil, title: D.leSite, 'aria-label': D.leSite }, ['Ludi', el('span', { text: 'world' })]),
      qui: connecte() ? pastille(D, b, accueil, o) : null,
      connexion: !connecte() && nuageActif() ? el('a', { class: 'lw-compte', href: b + 'compte/#connexion', text: D.connexion }) : null,
      langs: el('div', { class: 'lw-langs', role: 'group', 'aria-label': 'Langue / Language' }, ['fr', 'en'].map(function (l) {
        return el('button', { type: 'button', lang: l, 'aria-pressed': String(o.lang === l), text: l.toUpperCase(), onclick: function () { o.onLang(l); } });
      }))
    };
  }

  // Pages du site : quand une nouvelle version publiée prend la main, on recharge pour l'afficher.
  // (L'appli, elle, s'en occupe dans app.js, pour ne pas couper une partie.)
  if ('serviceWorker' in navigator && !document.getElementById('player')) {
    var dejaServi = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (dejaServi) location.reload();
      dejaServi = true;
    });
  }

  window.LudiBarre = {
    rendre: rendre, appli: appli, configure: configure, lienApp: lienApp, lienMonLudi: lienMonLudi, nouveauVenu: nouveauVenu, connecte: connecte,
    nuage: function () { return NUAGE; }, libelleEssai: function (lang) { var D = T[lang] || T.fr; return D.essayer; },
    parentOuvert: parentOuvert, ouvrirParent: ouvrirParent, fermerParent: fermerParent
  };
})();
