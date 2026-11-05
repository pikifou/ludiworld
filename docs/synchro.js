/* Ludiworld : fusionner le foyer de deux appareils, sans rien d'autre (testé dans tests/synchro.test.js).
   Réglages : le plus récent gagne, enfant par enfant. Statistiques : on garde le plus grand, jamais de somme,
   pour pouvoir refusionner autant de fois qu'on veut sans compter deux fois. */
(function (root) {
  'use strict';

  function copie(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function maxNombres(a, b) { return Math.max(Number(a) || 0, Number(b) || 0); }

  // Un objet { clé: valeur } fusionné clé par clé.
  function parCle(a, b, f) {
    var out = {};
    Object.keys(a || {}).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b || {}).forEach(function (k) { out[k] = k in out ? f(out[k], b[k]) : b[k]; });
    return out;
  }
  function meilleurScore(a, b) {
    var bas = (a.better || b.better) === 'lower';
    return (bas ? b.value < a.value : b.value > a.value) ? b : a;
  }
  function plusGrandProgres(a, b) { return typeof a === 'number' && typeof b === 'number' ? Math.max(a, b) : a; }
  function notion(a, b) {
    var plusB = (b.ok || 0) + (b.ko || 0), plusA = (a.ok || 0) + (a.ko || 0);
    var serie = plusB > plusA ? b.streak : plusA > plusB ? a.streak : Math.max(a.streak || 0, b.streak || 0);
    return { ok: maxNombres(a.ok, b.ok), ko: maxNombres(a.ko, b.ko), streak: serie || 0 };
  }
  function notionDuJour(a, b) { return { ok: maxNombres(a.ok, b.ok), ko: maxNombres(a.ko, b.ko) }; }

  function fusionnerJeu(a, b) {
    return Object.assign({}, a, b, {
      ms: maxNombres(a.ms, b.ms),
      sessions: maxNombres(a.sessions, b.sessions),
      kit: !!(a.kit || b.kit),
      days: parCle(a.days, b.days, maxNombres),
      scores: parCle(a.scores, b.scores, meilleurScore),
      progress: parCle(a.progress, b.progress, plusGrandProgres),
      skills: parCle(a.skills, b.skills, notion),
      skillDays: parCle(a.skillDays, b.skillDays, notionDuJour)
    });
  }
  function fusionnerEnfant(a, b) {
    var recent = (b.maj || 0) > (a.maj || 0) ? b : a;
    return Object.assign({}, recent, { maj: maxNombres(a.maj, b.maj), games: parCle(a.games, b.games, fusionnerJeu) });
  }

  function fusionner(local, distant) {
    if (!local) return distant ? copie(distant) : null;
    if (!distant) return copie(local);
    var recent = (distant.maj || 0) > (local.maj || 0) ? distant : local;
    var out = Object.assign({}, copie(recent), { maj: maxNombres(local.maj, distant.maj) });

    var retires = parCle(local.retires, distant.retires, maxNombres);
    if (Object.keys(retires).length) out.retires = retires; else delete out.retires;

    var parId = {}, ordre = [];
    [local.enfants || [], distant.enfants || []].forEach(function (liste) {
      liste.forEach(function (e) {
        if (parId[e.id]) parId[e.id] = fusionnerEnfant(parId[e.id], e);
        else { parId[e.id] = e; ordre.push(e.id); }
      });
    });
    out.enfants = ordre
      .filter(function (id) { return !(retires[id] >= (parId[id].maj || 0)); })
      .map(function (id) { return copie(parId[id]); });

    // Deux appareils ont retiré chacun un enfant différent : on ne laisse jamais un foyer vide, le plus récent reste.
    if (!out.enfants.length && ordre.length) {
      var dernier = ordre.reduce(function (a, b) { return (parId[b].maj || 0) > (parId[a].maj || 0) ? b : a; });
      out.enfants = [copie(parId[dernier])];
      if (out.retires) { delete out.retires[dernier]; if (!Object.keys(out.retires).length) delete out.retires; }
    }

    // Qui joue sur cet appareil ne regarde que cet appareil.
    var actif = out.enfants.filter(function (e) { return e.id === local.actif; })[0];
    out.actif = actif ? actif.id : (out.enfants[0] ? out.enfants[0].id : null);
    return out;
  }

  var api = { fusionner: fusionner };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LudiSynchro = api;
})(this);
