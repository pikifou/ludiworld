/* Ludiworld, la page des jeux : les mini-fiches de tous les jeux, et la fiche au toucher (site/catalogue.js).
   Pour un visiteur, la fiche propose d'essayer le jeu et de préparer Ludiworld. Sur un appareil déjà préparé, elle ne propose
   pas de préparer à nouveau ; le seul retour vers le côté parent est « Mon Ludiworld » dans la barre du site (site/barre.js).
   Les anciens liens les-jeux/#<id> ouvrent toujours la bonne fiche. */
(function () {
  'use strict';

  var BASE = '../';
  var TX = {
    fr: { essayer: 'Essayer le jeu', preparer: 'Préparer Ludiworld', erreur: 'Les fiches n\'ont pas pu se charger. Réessayez avec du réseau.' },
    en: { essayer: 'Try the game', preparer: 'Set up Ludiworld', erreur: 'The cards could not load. Try again with a connection.' }
  };
  var jeux = [], pret = false, premiere = true;
  var $ = function (id) { return document.getElementById(id); };

  function lang() { return LudiSite.langue() === 'en' ? 'en' : 'fr'; }
  function tx(k) { return TX[lang()][k]; }
  function jeuDe(id) { return jeux.filter(function (g) { return g.id === id; })[0] || null; }
  function prepare() { return !!(window.LudiBarre && LudiBarre.configure()); }

  function lien(cls, href, texte, nouvelOnglet) {
    var a = document.createElement('a');
    a.className = cls; a.href = href; a.textContent = texte;
    if (nouvelOnglet) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }
  function actions(g) {
    var out = [];
    if (/^https?:\/\//i.test(g.url || '')) out.push(lien('cat-bouton', g.url, tx('essayer'), true));
    if (!prepare()) out.push(lien('cat-bouton creux', LudiBarre.lienApp(BASE), tx('preparer')));
    return out;
  }
  function ouvrir(g) {
    LudiCatalogue.ouvrir(g, { lang: lang(), adresse: true, actions: actions(g) });
  }

  function rendre() {
    var z = $('jx-grille');
    z.classList.toggle('jx-entree', premiere);
    premiere = false;
    // Les jeux nouveaux (30 jours après leur entrée au catalogue) d'abord, le plus récent en tête ; puis l'ordre du catalogue.
    var neufs = jeux.filter(function (g) { return LudiCatalogue.nouveau(g); }).sort(function (a, b) { return a.added < b.added ? 1 : a.added > b.added ? -1 : 0; });
    var ordre = neufs.concat(jeux.filter(function (g) { return neufs.indexOf(g) === -1; }));
    z.replaceChildren.apply(z, ordre.map(function (g, i) {
      var m = LudiCatalogue.miniFiche(g, { lang: lang(), onOuvrir: ouvrir, nouveau: neufs.indexOf(g) !== -1 });
      m.style.setProperty('--i', String(i));
      return m;
    }));
    var g = LudiCatalogue.ouverte();
    if (g) ouvrir(g); // la langue a changé : la fiche ouverte se redessine
  }
  function lireAdresse() {
    var g = jeuDe(decodeURIComponent(location.hash.slice(1)));
    if (g) { if (!LudiCatalogue.ouverte() || LudiCatalogue.ouverte().id !== g.id) ouvrir(g); }
    else if (LudiCatalogue.ouverte()) LudiCatalogue.fermer();
  }

  document.addEventListener('DOMContentLoaded', function () {
    LudiSite.surLangue(function () { if (pret) rendre(); });
    window.addEventListener('hashchange', function () { if (pret) lireAdresse(); });
    LudiCatalogue.charger(BASE).then(function (l) {
      jeux = l;
      if (!jeux.length) throw new Error('aucun jeu');
      pret = true;
      rendre();
      lireAdresse();
    }).catch(function () {
      var p = document.createElement('p');
      p.className = 'jeux-wait';
      p.textContent = tx('erreur');
      $('jx-grille').replaceChildren(p);
    });
  });
})();
