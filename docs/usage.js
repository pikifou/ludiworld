/* Les statistiques d'usage de l'appli (décision de Julien du 2026-11-23 ; règles dans spec/donnees.md).
   Des événements courts, sans nom : un numéro d'appareil tiré au hasard (renouvelé chaque année, jamais lié au compte),
   la tranche d'âge, le type d'appareil, la langue, la version. Gardés sur l'appareil, envoyés par lots hors des parties.
   Le parent peut refuser (Réglages) : plus rien n'est noté, ce qui attendait est effacé, le numéro aussi ;
   seul part, une fois, « refusé » avec un numéro neuf (signalerChoix), pour connaître la part des refus.
   Sans DOM : testé par tests/usage.test.js. */
(function (root) {
  'use strict';

  var CLE_FILE = 'ludiworld.usage';
  var CLE_APPAREIL = 'ludiworld.appareil';
  var CLE_CHOIX = 'ludiworld.usage.choix'; // « refusé » ou « accepté de nouveau », pas encore parti (hors ligne)
  var MAX_FILE = 300; // au-delà, les plus anciens partent : un appareil longtemps hors ligne ne grossit pas sans fin
  var MAX_LOT = 200; // ce que la base accepte en un envoi
  var DUREE_NUMERO = 365 * 24 * 3600 * 1000; // un nouveau numéro chaque année (13 mois au plus)

  function jourDe(d) {
    function deux(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + deux(d.getMonth() + 1) + '-' + deux(d.getDate());
  }
  function trancheAge(age) {
    age = Number(age);
    if (!(age > 0)) return null;
    if (age <= 5) return '4-5';
    if (age <= 7) return '6-7';
    if (age <= 10) return '8-10';
    return '11-12';
  }
  function nouveauNumero(aleatoire) {
    var b = aleatoire(16);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  // o : { stockage, maintenant(), aleatoire(n) -> octets, envoyer(lot) -> Promise, permis() -> bool, contexte() -> { age, format, langue, version } }
  function creer(o) {
    var stockage = o.stockage;
    var maintenant = o.maintenant || Date.now;
    var enCours = null;

    function lire(k) { try { return JSON.parse(stockage.getItem(k)); } catch (e) { return null; } }
    function ecrire(k, v) { try { if (v === null) stockage.removeItem(k); else stockage.setItem(k, JSON.stringify(v)); } catch (e) { /* plein ou interdit : tant pis */ } }
    function file() { var f = lire(CLE_FILE); return Array.isArray(f) ? f : []; }
    function permis() { try { return o.permis() !== false; } catch (e) { return false; } }

    function appareil() {
      var a = lire(CLE_APPAREIL), t = maintenant();
      if (!a || typeof a.id !== 'string' || !(a.cree <= t) || t - a.cree > DUREE_NUMERO) {
        a = { id: nouveauNumero(o.aleatoire), cree: t };
        ecrire(CLE_APPAREIL, a);
      }
      return a.id;
    }

    // evt : un mot en minuscules (jeu_lance, activite_ouverte...) ; jeu : l'id du jeu ou rien ; details : un petit objet.
    function noter(evt, jeu, details) {
      if (!permis() || !/^[a-z_]{1,40}$/.test(evt)) return false;
      var c = {};
      try { c = o.contexte() || {}; } catch (e) { /* rien */ }
      var e = { jour: jourDe(new Date(maintenant())), appareil: appareil(), evt: evt };
      if (jeu && /^[a-z0-9-]{1,60}$/.test(jeu)) e.jeu = jeu;
      var age = trancheAge(c.age); if (age) e.age = age;
      if (c.format) e.format = c.format;
      if (c.langue) e.langue = c.langue;
      if (c.version) e.version = String(c.version).slice(0, 30);
      if (details && typeof details === 'object') e.details = details;
      var f = file();
      f.push(e);
      ecrire(CLE_FILE, f.slice(-MAX_FILE));
      return true;
    }

    // Le choix du parent, pour savoir quelle part des familles refuse (décision de Julien du 2026-11-23) :
    // un seul fait, avec un numéro neuf tiré pour lui seul (jamais celui de l'appareil), la tranche d'âge et le type
    // d'appareil, puis plus rien. evt : 'statistiques_refusees' ou 'statistiques_reprises'.
    function signalerChoix(evt) {
      var c = {};
      try { c = o.contexte() || {}; } catch (e) { /* rien */ }
      var e = { jour: jourDe(new Date(maintenant())), appareil: nouveauNumero(o.aleatoire), evt: evt };
      var age = trancheAge(c.age); if (age) e.age = age;
      if (c.format) e.format = c.format;
      if (c.langue) e.langue = c.langue;
      if (c.version) e.version = String(c.version).slice(0, 30);
      // Cocher, décocher, recocher sans réseau : seul le dernier choix compte.
      ecrire(CLE_CHOIX, [e]);
      return envoyerChoix();
    }
    function envoyerChoix(opts) {
      var f = lire(CLE_CHOIX);
      if (!Array.isArray(f) || !f.length) return Promise.resolve(0);
      return Promise.resolve().then(function () { return o.envoyer(f, opts || {}); }).then(function () {
        var g = lire(CLE_CHOIX);
        if (Array.isArray(g) && JSON.stringify(g) === JSON.stringify(f)) ecrire(CLE_CHOIX, null);
        return f.length;
      }, function () { return 0; });
    }

    // Envoie ce qui attend, par lots. Une erreur garde tout pour la prochaine fois ; un refus efface tout.
    function envoyer(opts) {
      envoyerChoix(opts);
      if (!permis()) { oublier(); return Promise.resolve(0); }
      if (enCours) return enCours;
      var lot = file().slice(0, MAX_LOT);
      if (!lot.length) return Promise.resolve(0);
      enCours = Promise.resolve().then(function () { return o.envoyer(lot, opts || {}); }).then(function () {
        // Retire exactement ce qui est parti (d'autres événements ont pu arriver pendant l'envoi).
        var f = file(), n = 0;
        while (n < lot.length && f.length && JSON.stringify(f[0]) === JSON.stringify(lot[n])) { f.shift(); n++; }
        ecrire(CLE_FILE, f.length ? f : null);
        enCours = null;
        return lot.length;
      }, function () { enCours = null; return 0; });
      return enCours;
    }

    // Le parent a refusé : rien ne reste, pas même le numéro de l'appareil.
    function oublier() { ecrire(CLE_FILE, null); ecrire(CLE_APPAREIL, null); }

    return { noter: noter, envoyer: envoyer, oublier: oublier, signalerChoix: signalerChoix, enAttente: function () { return file().length; } };
  }

  var api = { creer: creer, trancheAge: trancheAge, jourDe: jourDe, CLE_FILE: CLE_FILE, CLE_APPAREIL: CLE_APPAREIL, CLE_CHOIX: CLE_CHOIX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LudiUsage = api;
})(this);
