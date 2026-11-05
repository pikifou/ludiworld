/* Ludiworld : le compte du parent et la synchro, chez Supabase, en fetch simple (aucune dépendance).
   N'est appelé que sur les pages du compte et, si le parent a activé la synchro, par l'appli. Le kit des jeux n'y touche jamais.
   Testé dans tests/nuage.test.js. L'adresse et la clé publique sont dans site/barre.js. */
(function (root) {
  'use strict';

  var CLE_SESSION = 'ludiworld.session';
  var CLE_SYNCHRO = 'ludiworld.synchro';
  var MARGE = 60 * 1000; // on renouvelle le jeton une minute avant qu'il expire
  var ESSAIS = 3;        // écritures concurrentes : on relit et on refusionne au plus trois fois

  function erreur(code, detail) { var e = new Error(detail || code); e.code = code; return e; }
  function traduire(status, corps) {
    var c = (corps && (corps.error_code || corps.error)) || '';
    if (c === 'invalid_credentials' || c === 'invalid_grant') return 'identifiants';
    if (c === 'email_not_confirmed') return 'non_confirme';
    if (c === 'weak_password') return 'mot_de_passe_faible';
    if (c === 'email_address_invalid' || c === 'validation_failed') return 'adresse';
    if (c === 'same_password') return 'meme_mot_de_passe';
    if (c === 'signup_disabled') return 'ferme';
    if (status === 429 || /rate_limit/.test(c)) return 'trop_de_demandes';
    if (status === 401 || status === 403) return 'session';
    return 'inconnu';
  }
  function lireJwt(jeton) {
    try {
      var b = jeton.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var texte = typeof atob === 'function' ? atob(b) : Buffer.from(b, 'base64').toString('binary');
      return JSON.parse(decodeURIComponent(escape(texte)));
    } catch (e) { return {}; }
  }
  function sansActif(f) { var c = Object.assign({}, f); delete c.actif; return c; }

  function creer(o) {
    var url = (o.url || '').replace(/\/$/, '');
    var cle = o.cle || '';
    var appeler = o.fetch;
    var stockage = o.stockage;
    var maintenant = o.maintenant || Date.now;
    var fusionner = o.fusionner;

    function lire(k) { try { return JSON.parse(stockage.getItem(k)); } catch (e) { return null; } }
    function ecrire(k, v) { try { if (v === null) stockage.removeItem(k); else stockage.setItem(k, JSON.stringify(v)); } catch (e) { /* rien */ } }
    function session() { return lire(CLE_SESSION); }
    function garder(s) {
      var u = s.user || {}, jwt = lireJwt(s.access_token);
      ecrire(CLE_SESSION, {
        jeton: s.access_token, renouveau: s.refresh_token,
        expire: maintenant() + (Number(s.expires_in) || 3600) * 1000,
        id: u.id || jwt.sub || null, email: u.email || jwt.email || null
      });
    }
    function oublier() { ecrire(CLE_SESSION, null); ecrire(CLE_SYNCHRO, null); }

    function requete(chemin, options, jeton) {
      if (!url || !cle) return Promise.reject(erreur('inactif'));
      options = options || {};
      var entetes = { apikey: cle, 'Content-Type': 'application/json', Accept: 'application/json' };
      if (jeton) entetes.Authorization = 'Bearer ' + jeton;
      var f = { method: options.method || 'GET', headers: entetes };
      if (options.corps !== undefined) f.body = JSON.stringify(options.corps);
      return appeler(url + chemin, f).catch(function () { throw erreur('reseau'); }).then(function (r) {
        return r.text().then(function (txt) {
          var corps = null;
          try { corps = txt ? JSON.parse(txt) : null; } catch (e) { /* pas du JSON */ }
          if (!r.ok) { var ko = erreur(traduire(r.status, corps), corps && (corps.msg || corps.message)); ko.status = r.status; throw ko; }
          return corps;
        });
      });
    }

    // Le jeton à jour, ou null si personne n'est connecté.
    function jeton() {
      var s = session();
      if (!s) return Promise.resolve(null);
      if (s.expire - MARGE > maintenant()) return Promise.resolve(s.jeton);
      return requete('/auth/v1/token?grant_type=refresh_token', { method: 'POST', corps: { refresh_token: s.renouveau } }).then(function (n) {
        garder(n);
        return n.access_token;
      }).catch(function (e) {
        // Seul un refus du serveur met fin à la session. Hors ligne, serveur en panne ou en pause : elle reste pour plus tard.
        if (e.status !== 400 && e.status !== 401 && e.status !== 403) throw e;
        oublier();
        throw erreur('session');
      });
    }
    function moi(chemin, options) { return jeton().then(function (j) { return requete(chemin, options, j); }); }

    function retourParam(retour) { return retour ? '?redirect_to=' + encodeURIComponent(retour) : ''; }

    function rpc(nom, args) { return moi('/rest/v1/rpc/' + nom, { method: 'POST', corps: args || {} }); }
    function lireTable(chemin) { return moi('/rest/v1/' + chemin); }

    function lireFoyer() {
      return lireTable('foyers?select=etat,version').then(function (l) { return l && l[0] ? l[0] : { etat: null, version: 0 }; });
    }
    // Relit la copie en ligne, fusionne, écrit si quelque chose a changé. Renvoie le foyer fusionné.
    function synchroniser(foyer, essai) {
      essai = essai || 1;
      return lireFoyer().then(function (d) {
        var fusion = fusionner(foyer, d.etat);
        if (!fusion) return null;
        if (d.etat && memeContenu(fusion, d.etat)) return fusion; // déjà à jour : on n'écrit pas
        return rpc('pousser_foyer', { p_etat: fusion, p_version: d.version }).then(function (v) {
          if (v !== null && v !== undefined) return fusion;
          if (essai >= ESSAIS) throw erreur('conflit');
          return synchroniser(fusion, essai + 1);
        });
      });
    }
    // Deux foyers sont les mêmes si les comparer clé par clé ne montre aucune différence (l'ordre des clés ne compte pas).
    function memeContenu(a, b) { return trie(sansActif(a)) === trie(sansActif(b)); }
    function trie(v) {
      return JSON.stringify(v, function (k, x) {
        if (x && typeof x === 'object' && !Array.isArray(x)) {
          var t = {};
          Object.keys(x).sort().forEach(function (c) { t[c] = x[c]; });
          return t;
        }
        return x;
      });
    }

    return {
      actif: function () { return !!(url && cle); },
      connecte: function () { return !!session(); },
      email: function () { var s = session(); return s ? s.email : null; },
      inscrire: function (d) {
        var data = { langue: d.langue || 'fr' };
        if (d.nouvelles) data.nouvelles = 'true';
        if (d.envieId) data.envie_id = d.envieId;
        return requete('/auth/v1/signup' + retourParam(d.retour), { method: 'POST', corps: { email: d.email, password: d.motDePasse, data: data } }).then(function (r) {
          if (r && r.access_token) { garder(r); return { aConfirmer: false }; }
          return { aConfirmer: true };
        });
      },
      connecter: function (email, motDePasse) {
        return requete('/auth/v1/token?grant_type=password', { method: 'POST', corps: { email: email, password: motDePasse } }).then(function (r) { garder(r); });
      },
      renvoyer: function (email, retour) {
        return requete('/auth/v1/resend' + retourParam(retour), { method: 'POST', corps: { type: 'signup', email: email } });
      },
      oublie: function (email, retour) {
        return requete('/auth/v1/recover' + retourParam(retour), { method: 'POST', corps: { email: email } });
      },
      changerMotDePasse: function (motDePasse) { return moi('/auth/v1/user', { method: 'PUT', corps: { password: motDePasse } }); },
      deconnecter: function () {
        return jeton().then(function (j) { return j ? requete('/auth/v1/logout?scope=local', { method: 'POST' }, j) : null; })
          .catch(function () { /* hors ligne : on oublie quand même la session ici */ })
          .then(oublier);
      },
      // Ce qu'un lien reçu par e-mail met dans l'adresse (#access_token=... ou #error=...). null s'il n'y a rien de tel.
      lireRetour: function (hash) {
        var p = new URLSearchParams((hash || '').replace(/^#/, ''));
        if (p.get('error') || p.get('error_code')) return { erreur: p.get('error_code') || p.get('error') };
        if (!p.get('access_token')) return null;
        // Un lien ne remplace jamais le compte déjà ouvert ici : il pourrait venir de quelqu'un d'autre.
        var deja = session();
        if (deja && deja.id && deja.id !== lireJwt(p.get('access_token')).sub) return { erreur: 'autre_compte' };
        garder({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: p.get('expires_in') });
        return { type: p.get('type') || 'signup' };
      },
      oublier: oublier,
      rpc: rpc,
      lireTable: lireTable,
      ecrireTable: function (chemin, valeurs) { return moi('/rest/v1/' + chemin, { method: 'PATCH', corps: valeurs }); },
      lireFoyer: lireFoyer,
      synchroniser: synchroniser,
      // Cet appareil est-il relié à ce compte ? Le lien porte le nom du compte, et seul un geste du parent le pose :
      // ni un lien reçu, ni le fait que le compte ait une copie en ligne ne font partir un foyer vers un compte.
      synchroLocale: function () { var s = session(), l = lire(CLE_SYNCHRO); return !!(s && s.id && l && l.compte === s.id); },
      poserSynchroLocale: function (v) { var s = session(); ecrire(CLE_SYNCHRO, v && s ? { compte: s.id } : null); }
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    var S = require('../synchro.js');
    module.exports = { creer: function (o) { return creer(Object.assign({ fusionner: S.fusionner }, o)); } };
  } else {
    var c = root.LudiBarre ? root.LudiBarre.nuage() : { url: '', cle: '' };
    root.LudiNuage = creer({
      url: c.url, cle: c.cle,
      fetch: function (u, f) { return root.fetch(u, f); },
      stockage: root.localStorage,
      fusionner: root.LudiSynchro.fusionner
    });
  }
})(this);
