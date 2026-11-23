/* Ludiworld : le compte du parent et la synchro, chez Supabase, en fetch simple (aucune dépendance).
   N'est appelé que sur les pages du compte, si le parent a activé la synchro par l'appli, et pour les avis de parents
   (la fiche d'un jeu les lit sans compte ; le parent connecté donne le sien). Le kit des jeux n'y touche jamais.
   Testé dans tests/nuage.test.js. L'adresse et la clé publique sont dans site/barre.js. */
(function (root) {
  'use strict';

  var CLE_SESSION = 'ludiworld.session';
  var CLE_SYNCHRO = 'ludiworld.synchro';
  var CLE_LIAISON = 'ludiworld.liaison';
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
  function masquer(email) {
    var i = String(email).lastIndexOf('@');
    if (i < 1) return '•••';
    return email.charAt(0) + '•••' + email.slice(i);
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
    function oublier() { ecrire(CLE_SESSION, null); ecrire(CLE_SYNCHRO, null); ecrire(CLE_LIAISON, null); }
    function appareilAutorise() { var s = session(), l = lire(CLE_SYNCHRO); return !!(s && s.id && l && l.compte === s.id); }
    function synchroLocale() { var l = lire(CLE_SYNCHRO); return appareilAutorise() && l.active !== false; }
    function poserSynchroLocale(v) {
      var s = session();
      ecrire(CLE_SYNCHRO, s && (v || appareilAutorise()) ? { compte: s.id, active: !!v } : null);
    }
    function liaisonDemandee() { var s = session(), l = lire(CLE_LIAISON); return !!(s && s.id && l && l.compte === s.id); }

    function requete(chemin, options, jeton) {
      if (!url || !cle) return Promise.reject(erreur('inactif'));
      options = options || {};
      var entetes = { apikey: cle, 'Content-Type': 'application/json', Accept: 'application/json' };
      if (jeton) entetes.Authorization = 'Bearer ' + jeton;
      var f = { method: options.method || 'GET', headers: entetes };
      if (options.corps !== undefined) f.body = JSON.stringify(options.corps);
      if (options.keepalive) f.keepalive = true; // la page se ferme : l'envoi part quand même
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

    var CLE_LANGUE = 'ludiworld.langueCompte';
    function retenirLangue(langue) {
      var s = session();
      if (!s || !s.id || (langue !== 'fr' && langue !== 'en')) return Promise.resolve(false);
      var deja = lire(CLE_LANGUE);
      if (deja && deja.compte === s.id && deja.langue === langue) return Promise.resolve(false);
      return moi('/auth/v1/user', { method: 'PUT', corps: { data: { langue: langue } } }).then(function () {
        ecrire(CLE_LANGUE, { compte: s.id, langue: langue });
        return true;
      });
    }

    function retourParam(retour) { return retour ? '?redirect_to=' + encodeURIComponent(retour) : ''; }

    function rpc(nom, args) { return moi('/rest/v1/rpc/' + nom, { method: 'POST', corps: args || {} }); }
    function lireTable(chemin) { return moi('/rest/v1/' + chemin); }

    function lireFoyer() {
      return lireTable('foyers?select=etat,version').then(function (l) { return l && l[0] ? l[0] : { etat: null, version: 0 }; });
    }
    // Relit la copie en ligne, fusionne, écrit si quelque chose a changé. Renvoie le foyer fusionné.
    function synchroniser(foyer, essai) {
      essai = essai || 1;
      var compte = session() && session().id;
      return lireFoyer().then(function (d) {
        if (!session() || session().id !== compte) throw erreur('session');
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
    // Le mot de passe, ou l'inscription faite ici, autorise à relier cet appareil.
    // Le code parent est vérifié par la page avant cet appel. Un lien reçu seul n'autorise aucun envoi.
    function lierAppareil(foyer) {
      if (!appareilAutorise() && !liaisonDemandee()) return Promise.resolve(null);
      var compte = session().id;
      return lireTable('comptes?select=synchro').then(function (l) {
        if (!session() || session().id !== compte) return null;
        if (!(l && l[0] && l[0].synchro)) {
          ecrire(CLE_SYNCHRO, { compte: compte, active: false });
          ecrire(CLE_LIAISON, null);
          return null;
        }
        return synchroniser(foyer).then(function (m) {
          if (!session() || session().id !== compte) return null;
          poserSynchroLocale(true);
          ecrire(CLE_LIAISON, null);
          return m;
        });
      });
    }
    // ---------- Les avis de parents (plan 5) ----------
    // Un nom de jeu sert dans l'adresse : seulement des lettres, des chiffres et des tirets.
    function idJeu(jeu) { return typeof jeu === 'string' && /^[a-z0-9-]{1,60}$/.test(jeu); }
    // Ce que voient les familles : null sous 5 avis. Sans jeton, même connecté : c'est la lecture publique.
    function avisPublics(jeu, langue) {
      if (!idJeu(jeu)) return Promise.reject(erreur('jeu'));
      return requete('/rest/v1/rpc/avis_publics', { method: 'POST', corps: { p_jeu: jeu, p_langue: langue === 'en' ? 'en' : 'fr' } }, null)
        .then(function (r) { return r && typeof r === 'object' && r.total >= 5 ? r : null; });
    }
    // Mon avis sur ce jeu, ou null.
    function lireAvis(jeu) {
      if (!idJeu(jeu)) return Promise.reject(erreur('jeu'));
      return lireTable('avis?select=etoiles,marche,mot,mot_etat,maj_le&jeu=eq.' + jeu).then(function (l) { return l && l[0] ? l[0] : null; });
    }
    // a : { etoiles (1 à 5), marche, mot, langue }. La base pose elle-même l'état de relecture du mot.
    function donnerAvis(jeu, a) {
      if (!idJeu(jeu)) return Promise.reject(erreur('jeu'));
      a = a || {};
      var n = Number(a.etoiles);
      if (!(n >= 1 && n <= 5 && Math.floor(n) === n)) return Promise.reject(erreur('etoiles'));
      return rpc('donner_avis', { p_jeu: jeu, p_etoiles: n, p_marche: a.marche, p_mot: a.mot || null, p_langue: a.langue === 'en' ? 'en' : 'fr' });
    }
    function retirerAvis(jeu) {
      if (!idJeu(jeu)) return Promise.reject(erreur('jeu'));
      return moi('/rest/v1/avis?jeu=eq.' + jeu, { method: 'DELETE' });
    }

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
        var data = { langue: d.langue || 'fr', synchro: true };
        if (d.nouvelles) data.nouvelles = 'true';
        if (d.envieId) data.envie_id = d.envieId;
        return requete('/auth/v1/signup' + retourParam(d.retour), { method: 'POST', corps: { email: d.email, password: d.motDePasse, data: data } }).then(function (r) {
          var compte = r && (r.user || r);
          if (compte && compte.id) ecrire(CLE_LIAISON, { compte: compte.id });
          if (r && r.access_token) { garder(r); return { aConfirmer: false }; }
          return { aConfirmer: true };
        });
      },
      connecter: function (email, motDePasse) {
        return requete('/auth/v1/token?grant_type=password', { method: 'POST', corps: { email: email, password: motDePasse } }).then(function (r) {
          garder(r);
          ecrire(CLE_LIAISON, { compte: session().id });
          ecrire(CLE_LANGUE, { compte: session().id, langue: r && r.user && r.user.user_metadata && r.user.user_metadata.langue });
        });
      },
      // « Code oublié ? » sur un appareil connecté : le mot de passe du compte ouvert ici, vérifié par Supabase par le même appel
      // que la connexion. La session de l'appareil ne change pas, la liaison non plus ; la session que la vérification ouvre
      // est refermée aussitôt. Le mot de passe n'est gardé nulle part. Résout si c'est le bon, rejette sinon (codes comme ailleurs).
      verifierMotDePasse: function (motDePasse) {
        var s = session();
        if (!s || !s.id || !s.email) return Promise.reject(erreur('session'));
        return requete('/auth/v1/token?grant_type=password', { method: 'POST', corps: { email: s.email, password: motDePasse } }).then(function (r) {
          var id = (r && r.user && r.user.id) || lireJwt(r && r.access_token).sub;
          if (id !== s.id) throw erreur('identifiants');
          return requete('/auth/v1/logout?scope=local', { method: 'POST' }, r.access_token).catch(function () { /* rien : elle expirera seule */ });
        }).then(function () { return true; });
      },
      // La langue du compte (user_metadata.langue) : les e-mails de Supabase partent dans cette langue (supabase/emails/).
      // Gardée à jour avec celle que le parent utilise : à la connexion, quand il change de langue, avant un code par e-mail.
      // Une fois par compte et par langue (CLE_LANGUE) ; sans compte ou hors ligne, rien (les e-mails restent dans l'ancienne).
      retenirLangue: function (langue) { return retenirLangue(langue); },
      // « Code oublié ? » sans le mot de passe : un code à 6 chiffres envoyé par e-mail à l'adresse du compte ouvert ici
      // (modèle « Magic Link » de Supabase, qui doit contenir {{ .Token }}), dans la langue de l'écran. Jamais de compte créé (create_user: false).
      envoyerCodeEmail: function (langue) {
        var s = session();
        if (!s || !s.id || !s.email) return Promise.reject(erreur('session'));
        return retenirLangue(langue).catch(function () { /* l'e-mail part quand même, dans la langue d'avant */ }).then(function () {
          return requete('/auth/v1/otp', { method: 'POST', corps: { email: s.email, create_user: false } });
        }).then(function () { return true; });
      },
      // Le code reçu, vérifié par Supabase. Même logique que verifierMotDePasse : la session ouverte par la vérification est
      // refermée aussitôt, celle de l'appareil ne change pas, rien n'est gardé. Code refusé ou périmé : rejette avec 'code'.
      verifierCodeEmail: function (code) {
        var s = session();
        if (!s || !s.id || !s.email) return Promise.reject(erreur('session'));
        code = String(code || '').replace(/\s/g, '');
        if (!/^\d{6}$/.test(code)) return Promise.reject(erreur('code'));
        return requete('/auth/v1/verify', { method: 'POST', corps: { type: 'email', email: s.email, token: code } }).catch(function (e) {
          if (e.status >= 400 && e.status < 429) e.code = 'code';
          throw e;
        }).then(function (r) {
          var id = (r && r.user && r.user.id) || lireJwt(r && r.access_token).sub;
          if (!r || !r.access_token) throw erreur('code');
          var fermer = requete('/auth/v1/logout?scope=local', { method: 'POST' }, r.access_token).catch(function () { /* rien : elle expirera seule */ });
          if (id !== s.id) return fermer.then(function () { throw erreur('code'); });
          return fermer;
        }).then(function () { return true; });
      },
      // L'adresse du compte ouvert ici, masquée : « p•••@gmail.com ». null sans compte.
      emailMasque: function () { var s = session(); return s && s.email ? masquer(s.email) : null; },
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
      liaisonDemandee: liaisonDemandee,
      appareilAutorise: appareilAutorise,
      lierAppareil: lierAppareil,
      synchroLocale: synchroLocale,
      poserSynchroLocale: poserSynchroLocale,
      avisPublics: avisPublics,
      // Les statistiques d'usage (docs/usage.js) : toujours sans le compte, même connecté, pour ne jamais les y rattacher.
      noterUsage: function (lot, opts) { return requete('/rest/v1/rpc/noter_usage', { method: 'POST', corps: { p_evts: lot }, keepalive: !!(opts && opts.keepalive) }, null); },
      lireAvis: lireAvis,
      donnerAvis: donnerAvis,
      retirerAvis: retirerAvis
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
      // Les pages du site ne chargent pas la fusion (synchro.js) : elles ne lisent que les avis publics.
      fusionner: root.LudiSynchro ? root.LudiSynchro.fusionner : function () { return null; }
    });
  }
})(this);
