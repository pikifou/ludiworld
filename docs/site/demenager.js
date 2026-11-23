/* Ludiworld : le déménagement de l'ancienne adresse (pikifou.github.io/ludiworld/) vers ludiworld.app.
   Les réglages d'une famille (le foyer, clé ludiworld.v1, et la langue) sont gardés par le navigateur pour une adresse :
   à ludiworld.app, un appareil préparé avant semblait neuf. Chargé tout en haut de l'accueil et de l'appli, avant le reste.
   - À l'ancienne adresse, en ligne : on part vers la même page de ludiworld.app. Un appareil préparé emporte ses réglages
     dans la fin de l'adresse (#reprendre=…, qui ne part jamais vers un serveur) et arrive dans l'appli.
     Hors ligne : on reste (l'appli marche hors ligne, elle déménagera la prochaine fois).
   - À la nouvelle adresse, avec #reprendre= : les réglages ne sont repris que s'ils viennent de l'ancienne adresse
     (document.referrer) et si cet appareil n'a pas déjà les siens ici (on ne remplace jamais un foyer).
     La fin de l'adresse est effacée aussitôt. L'ancienne copie reste où elle était.
   Ni la session du compte ni ce qui est propre à l'appareil ne déménagent : le parent se reconnecte s'il avait un compte.
   Pas de script en ligne : la politique de sécurité du site (vercel.json) l'interdit. */
(function (racine) {
  'use strict';
  var STORE = 'ludiworld.v1', LANG = 'ludiworld.lang';
  var ANCIENNE = { hote: 'pikifou.github.io', chemin: '/ludiworld/' };
  var NEUVE = 'https://ludiworld.app/';
  var MARQUE = '#reprendre=';

  // base64url d'un texte UTF-8, et retour.
  function emballer(objet) {
    var b = btoa(unescape(encodeURIComponent(JSON.stringify(objet))));
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function deballer(texte) {
    var b = String(texte).replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    return JSON.parse(decodeURIComponent(escape(atob(b))));
  }
  // Un foyer plausible : un objet avec une famille (le reste est vérifié par l'appli comme pour tout foyer lu).
  function foyerValable(f) { return !!(f && typeof f === 'object' && !Array.isArray(f) && f.famille && typeof f.famille === 'object'); }

  // L'adresse de ludiworld.app où partir depuis l'ancienne adresse. null : rester.
  function cible(loc, stockage, enLigne) {
    if (loc.hostname !== ANCIENNE.hote || loc.pathname.indexOf(ANCIENNE.chemin) !== 0 || !enLigne) return null;
    var reste = loc.pathname.slice(ANCIENNE.chemin.length);
    var foyer = null, langue = null;
    try { foyer = JSON.parse(stockage.getItem(STORE)); } catch (e) { foyer = null; }
    try { langue = stockage.getItem(LANG); } catch (e) { langue = null; }
    if (foyerValable(foyer)) return NEUVE + 'app/' + MARQUE + emballer({ v: 1, foyer: foyer, langue: langue === 'en' ? 'en' : langue === 'fr' ? 'fr' : null });
    return NEUVE + reste + loc.search + loc.hash;
  }
  // À la nouvelle adresse : reprend les réglages arrivés dans la fin de l'adresse. Renvoie 'repris', 'garde' (l'appareil
  // a déjà les siens), 'refuse' (pas venu de l'ancienne adresse, ou illisible) ou null (rien à reprendre).
  function reprendre(hash, referrer, stockage) {
    if (String(hash || '').indexOf(MARQUE) !== 0) return null;
    var origine = '';
    try { origine = new URL(referrer).hostname; } catch (e) { origine = ''; }
    if (origine !== ANCIENNE.hote) return 'refuse';
    var d;
    try { d = deballer(hash.slice(MARQUE.length)); } catch (e) { return 'refuse'; }
    if (!d || d.v !== 1 || !foyerValable(d.foyer)) return 'refuse';
    var deja = null;
    try { deja = stockage.getItem(STORE); } catch (e) { deja = null; }
    if (deja) return 'garde';
    try {
      stockage.setItem(STORE, JSON.stringify(d.foyer));
      if ((d.langue === 'fr' || d.langue === 'en') && !stockage.getItem(LANG)) stockage.setItem(LANG, d.langue);
    } catch (e) { return 'refuse'; }
    return 'repris';
  }

  var api = { emballer: emballer, deballer: deballer, cible: cible, reprendre: reprendre, ANCIENNE: ANCIENNE, NEUVE: NEUVE };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  // Dans la page. Les tests qui servent le site sous l'ancienne adresse coupent le départ (window.LUDI_DEMENAGER = false).
  if (racine.LUDI_DEMENAGER === false) return;
  var stockage = null;
  try { stockage = racine.localStorage; } catch (e) { stockage = null; }
  if (!stockage) return;
  var loc = racine.location;
  var aller = cible(loc, stockage, racine.navigator.onLine !== false);
  if (aller) { loc.replace(aller); return; }
  var r = reprendre(loc.hash, racine.document.referrer, stockage);
  if (r) {
    try { racine.history.replaceState(null, '', loc.pathname + loc.search); } catch (e) { loc.hash = ''; }
    try { racine.sessionStorage.setItem('ludiworld.demenagement', r); } catch (e) { /* rien */ }
  }
})(typeof window !== 'undefined' ? window : this);
