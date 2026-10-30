/* Ludiworld : les règles du temps de jeu, sans rien d'autre (testées dans tests/temps.test.js). */
(function (root) {
  'use strict';

  var MIN = 60000;
  var AVERTIR = 5 * MIN;      // l'enfant est prévenu 5 minutes avant la fin
  var POINT_DOUX = 3 * MIN;   // en fin douce, une fin de manche à moins de 3 minutes de la fin suffit pour s'arrêter
  var GRACE_SANS_KIT = 3;     // un jeu qui ne sait pas dire « fin de manche » a 3 minutes pour finir

  var REGLES_DEFAUT = {
    ecole: 30,                // minutes par jour d'école (null : sans limite)
    libre: 60,                // minutes par jour sans école
    joursLibres: [0, 3, 6],   // dimanche, mercredi, samedi
    fin: 'douce',             // 'douce' : on attend la fin de la manche ; 'nette' : on s'arrête à la minute
    grace: 10,                // fin douce : au plus 10 minutes de plus
    bonus: null,              // { jour, min } : minutes ajoutées pour aujourd'hui
    fini: null,               // jour (cleJour) où le parent a dit « fini pour aujourd'hui »
    heures: null,             // { debut: 'HH:MM', fin: 'HH:MM' } : on ne joue qu'entre ces heures (null : à toute heure)
    vacances: null            // 'AAAA-MM-JJ' : jusqu'à ce jour inclus, tous les jours sont des jours sans école
  };

  function cleJour(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  function regles(r) {
    var out = {};
    Object.keys(REGLES_DEFAUT).forEach(function (k) { out[k] = r && r[k] !== undefined ? r[k] : REGLES_DEFAUT[k]; });
    return out;
  }

  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function jourLibre(r, d) {
    r = regles(r); d = d || new Date();
    if (r.vacances && iso(d) <= r.vacances) return true;
    return r.joursLibres.indexOf(d.getDay()) !== -1;
  }

  // Minutes de jeu autorisées aujourd'hui, bonus compris (null : pas de limite).
  function minutesDuJour(r, d) {
    r = regles(r); d = d || new Date();
    if (r.fini === cleJour(d)) return 0;
    var m = jourLibre(r, d) ? r.libre : r.ecole;
    if (m === null) return null;
    if (r.bonus && r.bonus.jour === cleJour(d)) m += r.bonus.min;
    return Math.max(0, m);
  }

  function minutesDe(hhmm) { var p = String(hhmm).split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); }

  // Heures de jeu : ms avant la fin de la plage (Infinity sans plage, 0 en dehors de la plage).
  function restePlage(r, d) {
    r = regles(r); d = d || new Date();
    if (!r.heures) return Infinity;
    var maintenant = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    var debut = minutesDe(r.heures.debut), fin = minutesDe(r.heures.fin);
    if (maintenant < debut || maintenant >= fin) return 0;
    return (fin - maintenant) * MIN;
  }
  // Avant l'heure ou après l'heure (pour le message à l'enfant).
  function horsPlage(r, d) {
    r = regles(r); d = d || new Date();
    if (!r.heures) return null;
    var maintenant = d.getHours() * 60 + d.getMinutes();
    if (maintenant < minutesDe(r.heures.debut)) return 'avant';
    if (maintenant >= minutesDe(r.heures.fin)) return 'apres';
    return null;
  }

  // Temps restant (ms) pour un jeu donné. Infinity : aucune limite ne s'applique.
  // o : { regles, limiteJeu (minutes ou null), joueTotal (ms aujourd'hui), joueJeu (ms aujourd'hui sur ce jeu), date }
  function reste(o) {
    var tot = minutesDuJour(o.regles, o.date);
    var total = tot === null ? Infinity : tot * MIN - (o.joueTotal || 0);
    var jeu = o.limiteJeu === null || o.limiteJeu === undefined ? Infinity : o.limiteJeu * MIN - (o.joueJeu || 0);
    var plage = restePlage(o.regles, o.date);
    var cause = jeu < total ? 'jeu' : 'total';
    if (plage < Math.min(total, jeu)) cause = 'heure';
    return { total: Math.min(total, plage), jeu: jeu, reste: Math.min(total, jeu, plage), cause: cause };
  }

  // Part du temps du jour qui reste (1 : tout, 0 : plus rien). Sert à placer le soleil.
  function part(o) {
    var tot = minutesDuJour(o.regles, o.date);
    if (tot === null) return 1;
    if (tot === 0) return 0;
    return Math.max(0, Math.min(1, 1 - (o.joueTotal || 0) / (tot * MIN)));
  }

  // Pendant une partie : ce que doit faire le launcher.
  // e : { reste (ms), fin, kit (le jeu sait dire « fin de manche »), grace (min), pointArret (une manche vient de finir) }
  // Renvoie 'jouer', 'bientot' (prévenir), 'finir' (finis ta manche) ou 'arreter'.
  function decision(e) {
    if (!(e.reste < Infinity) || e.reste > AVERTIR) return 'jouer';
    var douce = e.fin !== 'nette';
    if (e.reste > 0) return douce && e.pointArret && e.reste <= POINT_DOUX ? 'arreter' : 'bientot';
    if (!douce || e.pointArret) return 'arreter';
    var grace = (e.kit ? e.grace : Math.min(e.grace, GRACE_SANS_KIT)) * MIN;
    return -e.reste >= grace ? 'arreter' : 'finir';
  }

  var api = {
    MIN: MIN, AVERTIR: AVERTIR, POINT_DOUX: POINT_DOUX, GRACE_SANS_KIT: GRACE_SANS_KIT,
    REGLES_DEFAUT: REGLES_DEFAUT,
    cleJour: cleJour, iso: iso, regles: regles, jourLibre: jourLibre, minutesDuJour: minutesDuJour,
    restePlage: restePlage, horsPlage: horsPlage,
    reste: reste, part: part, decision: decision
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LudiTemps = api;
})(this);
