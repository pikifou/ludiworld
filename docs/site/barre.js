/* Ludiworld : la barre du site. La même sur les pages du site et dans le carnet parent de l'appli.
   Le premier onglet est « Accueil » tant que rien n'est préparé sur l'appareil, puis « Mon Ludiworld » (le carnet). */
(function () {
  'use strict';

  var STORE = 'ludiworld.v1';
  var CLE_PARENT = 'ludiworld.parent'; // dernière activité du parent (sessionStorage), après son code
  var DUREE_PARENT = 5 * 60 * 1000;   // au-delà, le carnet redemande le code

  var T = {
    fr: {
      nav: 'Ludiworld', accueil: 'Accueil', moi: 'Mon Ludiworld', jeux: 'Les jeux', creer: 'Créer un jeu', aime: 'Ludiworld aime bien',
      code: 'demande le code parent', preparer: 'Préparer la tablette', ouvrir: 'Ouvrir Ludiworld', enfant: 'Côté enfant'
    },
    en: {
      nav: 'Ludiworld', accueil: 'Home', moi: 'My Ludiworld', jeux: 'The games', creer: 'Make a game', aime: 'Ludiworld likes',
      code: 'asks for the parent code', preparer: 'Set up the tablet', ouvrir: 'Open Ludiworld', enfant: 'Child side'
    }
  };
  var ICO = {
    soleil: '<circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g>',
    cadenas: '<rect x="4" y="10.5" width="16" height="11" rx="2.5" fill="currentColor"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" fill="none" stroke="currentColor" stroke-width="2.4"/>'
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
  // Adresse de l'appli depuis une page : préparer la tablette, ou l'ouvrir.
  function lienApp(base) { return configure() ? base : base + '#demarrer'; }

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

  // o : { base: chemin vers la racine du site ('' ou '../'), actif, lang, onLang(l), action (false dans l'appli) }
  function rendre(hote, o) {
    var D = T[o.lang] || T.fr;
    var b = o.base || '';
    var conf = configure(), ouvert = parentOuvert();
    var onglets = [
      conf ? ['moi', b + '#carnet'] : ['accueil', b + 'decouvrir/'],
      ['jeux', b + 'les-jeux/'],
      ['creer', b + 'creer/'],
      ['aime', b + 'aime-bien/']
    ];
    var nav = el('nav', { class: 'lw-onglets', 'aria-label': D.nav }, onglets.map(function (x) {
      var actif = x[0] === o.actif;
      var verrou = x[0] === 'moi' && !ouvert && !actif;
      return el('a', { href: x[1], 'aria-current': actif ? 'page' : null, class: 'lw-onglet lw-' + x[0], title: verrou ? D.code : null }, [
        verrou ? svg('cadenas') : null, D[x[0]]
      ]);
    }));
    var langs = el('div', { class: 'lw-langs', role: 'group', 'aria-label': 'Langue / Language' }, ['fr', 'en'].map(function (l) {
      return el('button', { type: 'button', lang: l, 'aria-pressed': String(o.lang === l), text: l.toUpperCase(), onclick: function () { o.onLang(l); } });
    }));
    var action = null;
    if (o.action !== false) {
      if (ouvert) action = el('a', { class: 'lw-action', href: b, onclick: fermerParent }, [svg('soleil'), D.enfant]);
      else action = el('a', { class: 'lw-action', href: lienApp(b) }, [svg('soleil'), conf ? D.ouvrir : D.preparer]);
    }
    hote.textContent = '';
    hote.appendChild(el('header', { class: 'lw-barre' }, [
      el('a', { class: 'lw-marque', href: b + 'decouvrir/', 'aria-label': 'Ludiworld' }, ['Ludi', el('span', { text: 'world' })]),
      nav,
      el('div', { class: 'lw-cote' }, [langs, action])
    ]));
  }

  window.LudiBarre = {
    rendre: rendre, configure: configure, lienApp: lienApp,
    parentOuvert: parentOuvert, ouvrirParent: ouvrirParent, fermerParent: fermerParent
  };
})();
