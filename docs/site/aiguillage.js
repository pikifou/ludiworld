/* Ludiworld : l'aiguillage des anciennes adresses (Julien, 2026-11-18 : la racine montre le site, l'appli vit sous app/).
   Chargé tout en haut de l'accueil du site (la racine), avant le reste :
   - une ancienne adresse de l'appli (#carnet, #reglages, #demarrer, #enfant, #jouer=…) part vers app/ avec la même fin ;
   - une appli installée avant ce changement (son adresse de départ était la racine) retombe dans l'appli :
     ouverte seule (display-mode standalone) et sans venir d'une page de Ludiworld (le logo du côté parent, lui, montre le site).
   Avec data-vers (decouvrir/, l'ancienne adresse de l'accueil) : renvoie vers cette adresse, en gardant la fin (#charte…).
   Pas de script en ligne : la politique de sécurité du site (vercel.json) l'interdit. */
(function () {
  'use strict';
  var s = document.currentScript;
  var vers = s && s.getAttribute('data-vers');
  if (vers) { location.replace(vers + location.hash); return; }

  var APPLI = /^#(carnet|reglages|demarrer|enfant|jouer=.+)$/;
  // Même sans recharger la page (adresse tapée alors que l'accueil est ouvert).
  window.addEventListener('hashchange', function () {
    if (APPLI.test(location.hash)) location.replace('app/' + location.search + location.hash);
  });
  var h = location.hash || '';
  var appli = APPLI.test(h);
  if (!appli) {
    var seule = false, depuisLudiworld = false;
    try { seule = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { /* rien */ }
    try { depuisLudiworld = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { /* rien */ }
    appli = seule && !depuisLudiworld;
  }
  if (appli) location.replace('app/' + location.search + h);
})();
