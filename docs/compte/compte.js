/* Ludiworld : essayer (quelques questions), créer son compte, se connecter, son espace.
   Les textes sont dans index.html (français) et en.js (anglais). */
(function () {
  'use strict';

  var STORE = 'ludiworld.v1';
  var CLE_ENVIE = 'ludiworld.envie';
  var N = window.LudiNuage;
  var scene = document.getElementById('scene');
  var espace = document.getElementById('espace');
  var VUES = ['ferme', 'essayer', 'creer', 'verifier', 'connexion', 'oublie', 'nouveau'];
  var CIEL = { essayer: 'aube', ferme: 'jour', creer: 'jour', verifier: 'jour', connexion: 'nuit', oublie: 'nuit', nouveau: 'nuit' };
  var retourUrl = location.href.split('#')[0];

  function $(id) { return document.getElementById(id); }
  function tx(k, vars) {
    var s = LudiSite.texte(k) || k;
    Object.keys(vars || {}).forEach(function (c) { s = s.split('{' + c + '}').join(vars[c]); });
    return s;
  }
  // Les textes viennent de cette page (jamais du réseau) : ils peuvent contenir &nbsp; et des liens.
  function dire(n, k, vars) { n.innerHTML = tx(k, vars); n.hidden = false; }
  function alerte(form, k) { var a = form.querySelector('.alerte'); if (a) dire(a, k); }
  function sansAlerte(form) { form.querySelectorAll('.alerte').forEach(function (a) { a.hidden = true; }); }
  var ERREURS = {
    identifiants: 'erreurIdentifiants', non_confirme: 'erreurNonConfirme', mot_de_passe_faible: 'erreurFaible',
    meme_mot_de_passe: 'erreurMeme', adresse: 'erreurAdresse', trop_de_demandes: 'erreurTrop', reseau: 'erreurReseau',
    ferme: 'erreurFerme', session: 'erreurSession'
  };
  function cleErreur(e) { return ERREURS[e && e.code] || 'erreurAutre'; }
  function adresseValide(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function occupe(form, oui) { form.querySelectorAll('button[type=submit]').forEach(function (b) { b.disabled = oui; }); }

  // ---------- Ce qui est sur l'appareil ----------
  function lireStore() { try { return JSON.parse(localStorage.getItem(STORE)) || { games: {} }; } catch (e) { return { games: {} }; } }
  function foyerLocal() { var s = lireStore(); return s.famille && s.famille.enfants ? s.famille : null; }
  // Un appareil pas rouvert depuis l'ancien format attend que l'appli le range : on n'y touche pas d'ici.
  function ancienFormat() { var s = lireStore(); return !!(s.famille && !s.famille.enfants); }
  function ecrireFoyer(f) {
    if (!f) return;
    var s = lireStore();
    s.famille = f;
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* rien */ }
  }

  // Une tablette préparée reste du côté de l'enfant : le compte du parent y demande le code.
  function verrouille() { return LudiBarre.configure() && !LudiBarre.parentOuvert(); }
  var enRecuperation = false;

  // ---------- Vues ----------
  function voir(v) {
    var estEspace = v === 'espace';
    scene.hidden = estEspace;
    espace.hidden = !estEspace;
    document.querySelectorAll('[data-vue]').forEach(function (s) { s.hidden = s.getAttribute('data-vue') !== v; });
    if (!estEspace) scene.setAttribute('data-ciel', CIEL[v] || 'jour');
    if (v !== 'essayer') scene.style.setProperty('--avance', CIEL[v] === 'nuit' ? '0' : '1');
    window.scrollTo(0, 0);
    if (v === 'essayer') ouvrirQuestions();
    if (estEspace) chargerEspace();
    else focaliser(document.querySelector('[data-vue="' + v + '"] h1'));
  }
  function focaliser(n) { if (n) { try { n.focus({ preventScroll: true }); } catch (e) { /* rien */ } } }
  function route() {
    if (!N.actif()) return voir('ferme');
    var v = location.hash.replace('#', '');
    if (v === 'espace' || v === '') return voir(N.connecte() ? 'espace' : (v ? 'connexion' : 'essayer'));
    if (v === 'nouveau' && !N.connecte()) return voir('oublie');
    // Sur une tablette préparée, changer le mot de passe demande le code parent, sauf en arrivant du lien reçu par e-mail.
    if (v === 'nouveau' && !enRecuperation && verrouille()) return voir('espace');
    voir(VUES.indexOf(v) !== -1 ? v : 'essayer');
  }
  function aller(v) { if (location.hash === '#' + v) route(); else location.hash = v; }

  // ---------- Le questionnaire ----------
  function nouvelId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  var rep = (function () {
    var vide = { envie: [], profils: [], ages: [], priorites: [], experience: null, message: '' };
    try { return Object.assign(vide, JSON.parse(localStorage.getItem(CLE_ENVIE))); } catch (e) { return vide; }
  })();
  function garderRep() { try { localStorage.setItem(CLE_ENVIE, JSON.stringify(rep)); } catch (e) { /* rien */ } }
  var rangQ = 0;

  // La question sur l'IA ne se pose qu'à ceux qui veulent aider ou faire un jeu.
  function etapes() {
    var e = ['envie', 'profils', 'ages', 'priorites'];
    if (rep.envie.indexOf('aider') !== -1 || rep.envie.indexOf('creer') !== -1) e.push('experience');
    e.push('message');
    return e;
  }
  function repondu(q) { var v = rep[q]; return Array.isArray(v) ? v.length > 0 : !!v; }

  function ouvrirQuestions() {
    $('q-intro').hidden = false;
    $('q-corps').hidden = true;
    scene.style.setProperty('--avance', '0');
    focaliser(document.querySelector('[data-vue="essayer"] h1'));
  }
  function montrerQuestion() {
    var e = etapes();
    if (rangQ >= e.length) rangQ = e.length - 1;
    var q = e[rangQ];
    document.querySelectorAll('.q').forEach(function (f) { f.hidden = f.getAttribute('data-q') !== q; });
    $('q-rang').textContent = tx('rang', { i: rangQ + 1, n: e.length });
    $('q-avant').hidden = rangQ === 0;
    majBouton();
    document.querySelectorAll('.q[data-q="' + q + '"] .opt').forEach(function (b) {
      var v = b.getAttribute('data-val'), r = rep[q];
      b.setAttribute('aria-pressed', String(Array.isArray(r) ? r.indexOf(v) !== -1 : r === v));
    });
    $('q-message').value = rep.message || '';
    // Le soleil monte à chaque question : 1 quand le dernier écran est passé.
    scene.style.setProperty('--avance', String(rangQ / e.length));
    focaliser(document.querySelector('.q[data-q="' + q + '"] legend'));
  }
  function majBouton() {
    var e = etapes();
    var dernier = rangQ === e.length - 1;
    $('q-suite').textContent = dernier ? tx('finir') : (repondu(e[rangQ]) ? tx('suivant') : tx('passer'));
  }
  // Un seul envoi à la fois, et toujours les réponses les plus récentes : sur un réseau lent, un envoi en retard écraserait les suivants.
  var envoiEnCours = false, envoiTermine = null;
  function envoyerRep(termine) {
    if (!rep.id) rep.id = nouvelId();
    garderRep();
    envoiTermine = !!termine;
    if (!envoiEnCours) partirRep();
  }
  function partirRep() {
    var termine = envoiTermine;
    envoiTermine = null;
    envoiEnCours = true;
    // Pas de nouvelle question à poser si ça ne part pas : le parcours continue, le questionnaire n'est jamais un obstacle.
    N.rpc('enregistrer_envie', {
      p_id: rep.id, p_langue: document.documentElement.lang === 'en' ? 'en' : 'fr', p_envie: rep.envie, p_profils: rep.profils, p_ages: rep.ages,
      p_priorites: rep.priorites, p_experience: rep.experience, p_message: rep.message || null, p_termine: termine
    }).catch(function () { /* rien */ }).then(function () {
      envoiEnCours = false;
      if (envoiTermine !== null) partirRep();
    });
  }
  function brancherQuestions() {
    $('q-go').addEventListener('click', function () {
      $('q-intro').hidden = true; $('q-corps').hidden = false;
      rangQ = 0; montrerQuestion();
    });
    document.querySelectorAll('.q').forEach(function (f) {
      var q = f.getAttribute('data-q'), multi = f.hasAttribute('data-multi');
      f.querySelectorAll('.opt').forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.getAttribute('data-val');
          if (multi) {
            var i = rep[q].indexOf(v);
            if (i !== -1) rep[q].splice(i, 1);
            else rep[q].push(v);
          } else rep[q] = rep[q] === v ? null : v;
          if (q === 'envie' && rep.envie.indexOf('aider') === -1 && rep.envie.indexOf('creer') === -1) rep.experience = null;
          f.querySelectorAll('.opt').forEach(function (o) {
            var w = o.getAttribute('data-val');
            o.setAttribute('aria-pressed', String(multi ? rep[q].indexOf(w) !== -1 : rep[q] === w));
          });
          majBouton();
          garderRep();
        });
      });
    });
    $('q-message').addEventListener('input', function () { rep.message = this.value; garderRep(); });
    $('q-suite').addEventListener('click', function () {
      var e = etapes(), dernier = rangQ === e.length - 1;
      envoyerRep(dernier);
      if (dernier) {
        if (N.connecte()) aller('espace'); else aller('creer');
        return;
      }
      rangQ++; montrerQuestion();
    });
    $('q-avant').addEventListener('click', function () { rangQ = Math.max(0, rangQ - 1); montrerQuestion(); });
  }

  // ---------- Après la connexion ----------
  // Le mot de passe autorise la liaison ; sur une tablette préparée, le code parent la précède.
  function apresMotDePasse() {
    var msg = '';
    return Promise.resolve().then(function () {
      if (rep.id) return N.rpc('rattacher_envie', { p_id: rep.id }).catch(function () { /* rien */ });
    }).then(function () {
      if (verrouille() || ancienFormat()) return;
      return N.lierAppareil(foyerLocal()).then(function (m) {
        if (m) { ecrireFoyer(m); msg = 'synchroPrete'; }
      });
    }).catch(function () { /* hors ligne : on entre quand même, l'appli dira ce qui manque */ }).then(function () { entrer(msg, true); });
  }
  // Venu des Réglages du côté parent : on y retourne une fois connecté (l'état du compte s'y lit).
  function retourReglages() {
    var r = null;
    try { r = sessionStorage.getItem('ludiworld.retourCompte'); sessionStorage.removeItem('ludiworld.retourCompte'); } catch (e) { /* rien */ }
    return r === '../app/#reglages' && LudiBarre.configure() && LudiBarre.parentOuvert() ? r : null;
  }
  // Après « Se connecter » (versAppli), on entre dans l'appli, comme sur les sites des applis (Julien, 2026-11-18) :
  // le côté parent sur un appareil préparé, ou que la copie en ligne vient de préparer (le code de la famille d'abord, s'il le faut),
  // sinon la préparation. Après un lien reçu par e-mail ou une création de compte : l'espace du compte.
  function entrer(msg, versAppli) {
    var r = retourReglages();
    if (r) { location.href = r; return; }
    if (versAppli) {
      location.href = !LudiBarre.configure() ? '../app/#demarrer' : LudiBarre.parentOuvert() ? '../app/#reglages' : '../app/#carnet';
      return;
    }
    sessionStorage.setItem('ludiworld.message', msg || '');
    LudiSite.rafraichir();
    aller('espace');
  }

  // ---------- Formulaires ----------
  function brancherFormulaires() {
    $('f-creer').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this; sansAlerte(f);
      var email = $('c-email').value.trim(), mdp = $('c-mdp').value;
      if (!adresseValide(email)) return alerte(f, 'erreurAdresse');
      if (mdp.length < 8) return alerte(f, 'erreurMdp');
      if (!$('c-adulte').checked) return alerte(f, 'erreurAdulte');
      occupe(f, true);
      N.inscrire({ email: email, motDePasse: mdp, langue: document.documentElement.lang, nouvelles: $('c-nouvelles').checked, envieId: rep.id, retour: retourUrl }).then(function (r) {
        $('c-mdp').value = '';
        if (r.aConfirmer) { $('v-email').textContent = email; aller('verifier'); return; }
        entrer('eBienvenue');
      }).catch(function (e) { alerte(f, cleErreur(e)); }).then(function () { occupe(f, false); });
    });

    $('f-connexion').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this; sansAlerte(f);
      $('s-renvoyer').hidden = true;
      var email = $('s-email').value.trim(), mdp = $('s-mdp').value;
      if (!adresseValide(email)) return alerte(f, 'erreurAdresse');
      occupe(f, true);
      N.connecter(email, mdp).then(function () {
        $('s-mdp').value = '';
        return apresMotDePasse();
      }).catch(function (e) {
        alerte(f, cleErreur(e));
        if (e.code === 'non_confirme') $('s-renvoyer').hidden = false;
      }).then(function () { occupe(f, false); });
    });
    $('s-renvoyer').addEventListener('click', function () {
      var f = $('f-connexion');
      N.renvoyer($('s-email').value.trim(), retourUrl).then(function () { alerte(f, 'reRenvoye'); }).catch(function (e) { alerte(f, cleErreur(e)); });
    });
    $('v-renvoyer').addEventListener('click', function () {
      var s = document.querySelector('[data-vue="verifier"]');
      N.renvoyer($('v-email').textContent, retourUrl).then(function () { alerte(s, 'reRenvoye'); }).catch(function (e) { alerte(s, cleErreur(e)); });
    });

    $('f-oublie').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this; sansAlerte(f);
      var ok = f.querySelector('.bien'); ok.hidden = true;
      var email = $('o-email').value.trim();
      if (!adresseValide(email)) return alerte(f, 'erreurAdresse');
      occupe(f, true);
      N.oublie(email, retourUrl).then(function () { ok.hidden = false; }).catch(function (e) { alerte(f, cleErreur(e)); }).then(function () { occupe(f, false); });
    });

    $('f-nouveau').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this; sansAlerte(f);
      var mdp = $('n-mdp').value;
      if (mdp.length < 8) return alerte(f, 'erreurMdp');
      occupe(f, true);
      N.changerMotDePasse(mdp).then(function () {
        $('n-mdp').value = '';
        enRecuperation = false;
        sessionStorage.setItem('ludiworld.message', 'mdpChange');
        aller('espace');
      }).catch(function (e) { alerte(f, cleErreur(e)); }).then(function () { occupe(f, false); });
    });
  }

  // ---------- Mon espace ----------
  function erreurEspace(e) {
    if (e && e.code === 'session') { aller('connexion'); return; }
    dire($('e-alerte'), cleErreur(e));
  }
  // Le mot qui va pour l'appareil qu'on tient (le même calcul que l'appli).
  function appareil() {
    var tactile = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
    if (!tactile) return 'aOrdi';
    return Math.min(screen.width, screen.height) < 600 ? 'aTelephone' : 'aTablette';
  }
  function chargerEspace() {
    var verrou = verrouille();
    $('e-code').hidden = !verrou;
    $('e-corps').hidden = verrou;
    var msg = sessionStorage.getItem('ludiworld.message');
    sessionStorage.removeItem('ludiworld.message');
    var pret = LudiBarre.configure(), ici = foyerLocal();
    var liste = ici ? ici.enfants.map(function (e) { return e.enfant && e.enfant.nom; }).filter(Boolean) : [];
    var noms = liste.join(', ');
    // Reconnecté sur un appareil vidé : on dit que les enfants sont revenus (le prénom vient de l'appareil : du texte, jamais du HTML).
    var retour = $('e-code-retour');
    retour.hidden = !(verrou && msg === 'synchroPrete' && liste.length);
    if (!retour.hidden) {
      var et = liste.length > 1 ? liste.slice(0, -1).join(', ') + ' ' + tx('et') + ' ' + liste[liste.length - 1] : liste[0];
      retour.textContent = tx(liste.length > 1 ? 'retourPlusieurs' : 'retourUn', { n: et, a: tx(appareil()) });
    }
    if (verrou) return focaliser($('e-code').querySelector('h1'));
    focaliser($('e-corps').querySelector('h1'));
    $('e-email').textContent = N.email() || '';
    $('e-alerte').hidden = true;
    var b = $('e-bienvenue');
    if (msg) dire(b, msg); else b.hidden = true;
    // Le prénom vient de l'appareil : écrit comme du texte, jamais comme du HTML.
    if (pret) { $('e-appareil').textContent = tx('appPret', { n: noms }); $('e-appareil').hidden = false; } else dire($('e-appareil'), 'appVide');
    var reglages = pret && LudiBarre.parentOuvert();
    $('e-ouvrir').textContent = tx(reglages ? 'appReglages' : pret ? 'appOuvrir' : 'appPreparer');
    $('e-ouvrir').setAttribute('href', reglages ? '../app/#reglages' : pret ? '../app/' : '../app/#demarrer');
    $('e-synchro').disabled = true;
    $('e-formule').innerHTML = tx('formuleLibre');
    Promise.all([N.lireTable('comptes?select=synchro,nouvelles'), N.rpc('mes_droits'), N.rpc('est_admin')]).then(function (r) {
      var c = r[0] && r[0][0];
      if (!c) { N.oublier(); LudiSite.rafraichir(); aller('connexion'); return; }
      // La case représente le choix du compte, partagé entre tous les appareils.
      if (!c.synchro) N.poserSynchroLocale(false);
      $('e-synchro').checked = !!c.synchro;
      $('e-synchro-aide').hidden = !c.synchro; // « Si vous la désactivez… » : seulement quand elle est active
      $('e-synchro-etat').classList.toggle('neutre', !c.synchro);
      if (!c.synchro) dire($('e-synchro-etat'), 'syOff');
      else if (!N.appareilAutorise() && !N.liaisonDemandee()) dire($('e-synchro-etat'), 'syAutre');
      else $('e-synchro-etat').hidden = true;
      $('e-nouvelles').checked = !!c.nouvelles;
      var nom = r[1] && r[1].nom && (r[1].nom[document.documentElement.lang] || r[1].nom.fr);
      if (nom) {
        $('e-formule').textContent = nom + '. ';
        $('e-formule').appendChild(document.createElement('span')).innerHTML = tx('formuleLibre');
      }
      $('e-bureau-p').hidden = r[2] !== true;
      if (c.synchro && !ancienFormat()) return N.lierAppareil(foyerLocal()).then(ecrireFoyer);
    }).catch(erreurEspace).then(function () { $('e-synchro').disabled = false; });
  }
  function brancherEspace() {
    $('e-synchro').addEventListener('change', function () {
      var on = this.checked, boite = this, etat = $('e-synchro-etat');
      boite.disabled = true; etat.hidden = true;
      N.rpc('poser_synchro', { p_active: on }).then(function () {
        if (!on) return N.poserSynchroLocale(false);
        // L'appareil n'est relié qu'une fois la première synchro réussie : la case ne ment jamais.
        return (ancienFormat() ? Promise.resolve() : N.synchroniser(foyerLocal()).then(ecrireFoyer)).then(function () { N.poserSynchroLocale(true); });
      }).then(function () { etat.classList.toggle('neutre', !on); dire(etat, on ? 'syOn' : 'syOff'); $('e-synchro-aide').hidden = !on; })
        .catch(function (e) { boite.checked = !on; erreurEspace(e); })
        .then(function () { boite.disabled = false; });
    });
    $('e-nouvelles').addEventListener('change', function () {
      var on = this.checked, boite = this;
      N.ecrireTable('comptes?id=not.is.null', { nouvelles: on }).catch(function (e) { boite.checked = !on; erreurEspace(e); });
    });
    $('e-sortir').addEventListener('click', function () {
      // Pour que le côté parent dise vrai ensuite : la copie en ligne reste gardée si elle était active.
      try { localStorage.setItem('ludiworld.copieVue', $('e-synchro').checked ? '1' : '0'); } catch (e) { /* rien */ }
      N.deconnecter().then(function () {
        try { localStorage.removeItem(CLE_ENVIE); } catch (e) { /* rien */ }
        // Un appareil préparé : on revient à Ludiworld (aux Réglages si le côté parent est ouvert), avec une phrase qui confirme.
        if (LudiBarre.configure()) {
          try { sessionStorage.setItem('ludiworld.toast', 'signedOut'); } catch (e) { /* rien */ }
          location.href = LudiBarre.parentOuvert() ? '../app/#reglages' : '../app/';
        } else location.href = '../';
      });
    });
    $('e-exporter').addEventListener('click', function () {
      Promise.all([
        N.lireTable('comptes?select=*'), N.rpc('mes_droits'), N.lireTable('envies?select=*'), N.lireTable('foyers?select=etat,version,maj_le'),
        N.lireTable('avis?select=jeu,etoiles,marche,mot,mot_etat,langue,cree_le,maj_le').catch(function () { return []; })
      ]).then(function (r) {
        var data = { adresse: N.email(), compte: r[0] && r[0][0], formule: r[1], reponses: r[2], copie_en_ligne: r[3] && r[3][0] || null, avis: r[4] || [] };
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        a.download = 'ludiworld-mes-donnees.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      }).catch(erreurEspace);
    });
    $('f-effacer').addEventListener('submit', function (ev) {
      ev.preventDefault();
      if ($('e-mot').value.trim().toUpperCase() !== tx('motEffacer')) return dire($('e-alerte'), 'erreurMot');
      N.rpc('effacer_mon_compte').then(function () {
        try { localStorage.removeItem(CLE_ENVIE); } catch (e) { /* rien */ }
        rep = { envie: [], profils: [], ages: [], priorites: [], experience: null, message: '' };
        N.oublier();
        location.href = '../';
      }).catch(erreurEspace);
    });
  }

  // Revenir d'un lien reçu par e-mail : l'adresse contient le jeton, on l'en retire aussitôt.
  function arriver() {
    var retour = N.lireRetour(location.hash);
    if (!retour) return route();
    history.replaceState(history.state, '', location.pathname + location.search);
    if (retour.erreur === 'autre_compte') {
      sessionStorage.setItem('ludiworld.message', '');
      location.hash = 'espace';
      setTimeout(function () { dire($('e-alerte'), 'erreurAutreCompte'); }, 300);
    } else if (retour.erreur) {
      location.hash = 'connexion';
      setTimeout(function () { alerte($('f-connexion'), 'erreurLien'); }, 0);
    } else if (retour.type === 'recovery') {
      enRecuperation = true;
      LudiSite.rafraichir();
      location.hash = 'nouveau';
    } else entrer('eBienvenue'); // le compte s'ouvre, et c'est tout : un lien ne relie rien et ne rattache rien
  }

  // ---------- Démarrage ----------
  document.addEventListener('DOMContentLoaded', function () {
    brancherQuestions();
    brancherFormulaires();
    brancherEspace();
    LudiSite.surLangue(function () {
      if (!$('q-corps').hidden) { $('q-rang').textContent = tx('rang', { i: rangQ + 1, n: etapes().length }); majBouton(); }
      if (!espace.hidden && !$('e-corps').hidden) chargerEspace();
    });
    window.addEventListener('hashchange', arriver);
    arriver();
  });
})();
