/* Ludiworld : le bureau de Julien. Tout ce qui s'affiche ici vient de fonctions de la base réservées aux adresses du bureau,
   et les réponses libres des visiteurs ne passent jamais par innerHTML. Écran interne : en français seulement. */
(function () {
  'use strict';

  var N = window.LudiNuage;
  var GH_API = 'https://api.github.com/repos/pikifou/ludiworld/issues?state=open&per_page=50';
  var GH = 'https://github.com/pikifou/ludiworld/issues';

  var LIBELLES = {
    envie: { jouer: 'Trouver de bons jeux', aider: 'Aider, tester, donner son avis', creer: 'Faire un jeu', curieux: 'Regarde, par curiosité' },
    profils: { parent: 'Parent', famille: 'Famille', enseignant: 'Enseignant, animateur', createur: 'Créateur de jeux', autre: 'Autre' },
    ages: { moins6: 'Moins de 6 ans', '6-8': '6 à 8 ans', '9-10': '9 à 10 ans', '11plus': '11 ans et plus' },
    priorites: { apprendre: 'Apprendre', temps: 'Temps cadré', sain: 'Sans pub ni pièges', plaisir: 'S\'amuser', ensemble: 'Jouer ensemble' },
    experience: { jamais: 'Jamais', 'un-peu': 'Un peu', souvent: 'Souvent' }
  };
  var TITRES = { envie: 'Ce qui les amène', profils: 'Qui ils sont', ages: 'Âge des enfants', priorites: 'Ce qui compte', experience: 'A déjà fabriqué avec une IA' };

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] === null || attrs[k] === undefined) return;
      if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined) n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); });
    return n;
  }
  function vider(n) { n.textContent = ''; return n; }
  function pct(a, b) { return b ? Math.round(100 * a / b) + ' %' : ''; }
  function date(d) { return d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' }) : ''; }
  function libelle(champ, v) { return (LIBELLES[champ] && LIBELLES[champ][v]) || v; }
  function liste(champ, v) { return (v || []).map(function (x) { return libelle(champ, x); }).join(', '); }
  function erreur(hote, e) {
    vider(hote).appendChild(el('p', { class: 'alerte', role: 'alert', text: e && e.code === 'reseau' ? 'Pas de réseau. Rechargez la page quand la connexion revient.' : 'La base n\'a pas répondu. Rechargez la page.' }));
  }

  // Une barre par valeur, classées : la longueur porte la quantité, le nombre est écrit à côté.
  function barres(hote, lignes, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, lignes.map(function (l) { return l.n; }).concat([1]));
    vider(hote).classList.add('b-barres');
    if (!lignes.length) { hote.appendChild(el('p', { class: 'b-vide', text: opts.vide || 'Personne n\'a encore répondu.' })); return; }
    lignes.forEach(function (l) {
      hote.appendChild(el('div', { class: 'b-barre', title: l.nom + ' : ' + l.n + (l.note ? ' (' + l.note + ')' : '') }, [
        el('span', { class: 'b-nom', text: l.nom }),
        el('span', { class: 'b-piste' }, [el('i', { style: 'width:' + (100 * l.n / max) + '%' })]),
        el('b', { text: l.n }),
        el('span', { class: 'b-pct', text: l.note || '' })
      ]));
    });
  }
  function repartition(ap, champ) {
    var d = (ap.reponses && ap.reponses[champ]) || {};
    var tot = ap.parcours.commences;
    return Object.keys(LIBELLES[champ]).map(function (k) { return { nom: LIBELLES[champ][k], n: d[k] || 0, note: pct(d[k] || 0, tot) }; })
      .sort(function (a, b) { return b.n - a.n; });
  }

  // Petites colonnes : une série par graphique, jamais deux échelles sur le même.
  function colonnes(titre, semaines, cle) {
    var max = Math.max.apply(null, semaines.map(function (s) { return s[cle]; }).concat([1]));
    var total = semaines.reduce(function (a, s) { return a + s[cle]; }, 0);
    return el('figure', { class: 'b-colonnes' }, [
      el('figcaption', null, [titre + ' : ', el('b', { text: total })]),
      el('div', { class: 'b-cols', role: 'img', 'aria-label': titre + ', ' + semaines.map(function (s) { return date(s.semaine) + ' ' + s[cle]; }).join(', ') }, semaines.map(function (s) {
        return el('span', { class: 'b-col', title: 'Semaine du ' + date(s.semaine) + ' : ' + s[cle] }, [el('i', { style: 'height:' + Math.max(s[cle] ? 6 : 1, 100 * s[cle] / max) + '%' })]);
      }))
    ]);
  }

  // ---------- Aperçu ----------
  var apercu = null;
  function chargerApercu() {
    return N.rpc('bureau_apercu').then(function (a) { apercu = a; return a; });
  }
  function rendreApercu() {
    chargerApercu().then(function (a) {
      var p = a.parcours;
      barres($('ap-parcours'), [
        { nom: 'Ont commencé les questions', n: p.commences },
        { nom: 'Sont allés au bout', n: p.termines, note: pct(p.termines, p.commences) },
        { nom: 'Ont créé un compte', n: p.comptes },
        { nom: 'Ont confirmé leur adresse', n: p.confirmes, note: pct(p.confirmes, p.comptes) }
      ]);
      var dl = vider($('ap-chiffres'));
      [['Connectés sur 7 jours', p.actifs_7j], ['Copie en ligne activée', p.synchro], ['Acceptent nos messages', p.nouvelles], ['Réponses rattachées à un compte', p.rattaches]].forEach(function (c) {
        dl.appendChild(el('div', null, [el('dt', { text: c[0] }), el('dd', { text: c[1] })]));
      });
      barres($('ap-envie'), repartition(a, 'envie'));
      var s = vider($('ap-semaines'));
      s.appendChild(colonnes('Réponses aux questions', a.semaines, 'envies'));
      s.appendChild(colonnes('Comptes créés', a.semaines, 'comptes'));
    }).catch(function (e) { erreur($('ap-parcours'), e); });
    rendreAttente();
  }
  // Ce qui attend le jugement de Julien, à un seul endroit.
  function rendreAttente() {
    var hote = vider($('ap-attente'));
    Promise.all([catalogue(), github().catch(function () { return null; }), N.rpc('bureau_envies', { p_limite: 1000 }).catch(function () { return []; }),
      N.rpc('bureau_avis', { p_limite: 1000 }).catch(function () { return null; })]).then(function (r) {
      var c = r[0], gh = r[1];
      var messages = r[2].filter(function (e) { return e.message; }).length;
      var items = [
        [r[3] === null ? '?' : r[3].filter(function (a) { return a.mot_etat === 'a-relire'; }).length, 'mots de parents à relire', '#avis'],
        [gh === null ? '?' : gh.length, 'demandes ouvertes sur GitHub', '#catalogue'],
        [c.jeux.filter(function (g) { return g.status !== 'published'; }).length, 'fiches de jeux à relire', '#catalogue'],
        [c.recos.filter(function (x) { return x.status !== 'valide'; }).length, 'recommandations proposées', '#catalogue'],
        [messages, 'messages laissés dans les questions', '#envies']
      ];
      items.forEach(function (it) {
        hote.appendChild(el('a', { href: it[2] }, [el('b', { text: it[0] }), el('span', { text: it[1] })]));
      });
    });
  }

  // ---------- Les envies ----------
  var envies = [];
  function rendreEnvies() {
    chargerApercu().then(function (a) {
      var hote = vider($('en-totaux'));
      Object.keys(TITRES).forEach(function (champ) {
        var b = el('div');
        hote.appendChild(el('div', null, [el('h2', { text: TITRES[champ] }), b]));
        barres(b, repartition(a, champ));
      });
    }).catch(function (e) { erreur($('en-totaux'), e); });
    N.rpc('bureau_envies', { p_limite: 1000 }).then(function (l) { envies = l || []; rendreTableEnvies(); }).catch(function (e) { erreur($('en-table'), e); });
  }
  function enviesVisibles() {
    var f = $('en-filtre').value;
    return envies.filter(function (e) { return !f || (f === 'message' ? !!e.message : (e.envie || []).indexOf(f) !== -1); });
  }
  function rendreTableEnvies() {
    var t = vider($('en-table')), l = enviesVisibles();
    t.appendChild(el('thead', null, [el('tr', null, ['Date', 'Vient pour', 'Qui', 'Âges', 'Ce qui compte', 'IA', 'Message', 'Compte'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]));
    var b = el('tbody');
    l.forEach(function (e) {
      b.appendChild(el('tr', null, [
        el('td', { class: 'nowrap', text: date(e.cree_le) }), el('td', { text: liste('envie', e.envie) }), el('td', { text: liste('profils', e.profils) }),
        el('td', { text: liste('ages', e.ages) }), el('td', { text: liste('priorites', e.priorites) }), el('td', { text: e.experience ? libelle('experience', e.experience) : '' }),
        el('td', { class: 'b-message', text: e.message || '' }), el('td', { text: e.email || (e.termine ? 'sans compte' : 'pas fini') })
      ]));
    });
    t.appendChild(b);
    if (!l.length) t.appendChild(el('caption', { class: 'b-vide', text: 'Rien à montrer ici pour l\'instant.' }));
  }

  // ---------- Les comptes ----------
  var comptes = [], minuteur = null;
  function rendreComptes() {
    var q = $('co-cherche').value.trim();
    N.rpc('bureau_comptes', { p_recherche: q || null, p_limite: 1000 }).then(function (l) {
      comptes = l || [];
      var t = vider($('co-table'));
      t.appendChild(el('thead', null, [el('tr', null, ['Adresse', 'Créé le', 'Adresse confirmée', 'Dernière connexion', 'Formule', 'Vient pour', 'Copie en ligne', 'Messages'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]));
      var b = el('tbody');
      comptes.forEach(function (c) {
        b.appendChild(el('tr', null, [
          el('td', { class: 'b-adresse', text: c.email }), el('td', { class: 'nowrap', text: date(c.cree_le) }),
          el('td', { class: 'nowrap', text: c.confirme_le ? '✓ ' + date(c.confirme_le) : 'en attente' }), el('td', { class: 'nowrap', text: date(c.derniere_connexion) }),
          el('td', { text: c.formule || '' }), el('td', { text: liste('envie', c.envie) }), el('td', { text: c.synchro ? '✓ oui' : 'non' }), el('td', { text: c.nouvelles ? '✓ oui' : 'non' })
        ]));
      });
      t.appendChild(b);
      if (!comptes.length) t.appendChild(el('caption', { class: 'b-vide', text: q ? 'Aucune adresse ne contient ces lettres.' : 'Pas encore de compte.' }));
    }).catch(function (e) { erreur($('co-table'), e); });
  }

  // ---------- Les avis de parents ----------
  // Les mots libres passent ici avant d'être montrés. Tout s'affiche en textContent : ce sont des textes de parents.
  var MARCHE = { oui: 'marche bien', 'pas-toujours': 'marche pas toujours', non: 'ne marche pas' };
  var ETAT_MOT = { 'a-relire': 'à relire', accepte: '✓ montré', refuse: '✗ pas montré' };
  var SEUIL_AVIS = 5;
  function nomJeu(c, id) {
    var g = c.jeux.filter(function (x) { return x.id === id; })[0];
    return g ? fr(g.title) : id;
  }
  // « ★★★☆☆ 3 » : les étoiles pleines et vides, et le chiffre écrit.
  function etoiles(n) {
    n = Math.max(0, Math.min(5, Number(n) || 0));
    return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n) + ' ' + n;
  }
  function virgule(x) { return x.toFixed(1).replace('.', ','); }
  function rendreAvis() {
    Promise.all([N.rpc('bureau_avis', { p_limite: 1000 }), catalogue().catch(function () { return { jeux: [] }; })]).then(function (r) {
      var l = r[0] || [], c = r[1];
      // Les mots à relire, le plus ancien en dernier : accepter ou refuser, un par un.
      var aRelire = l.filter(function (a) { return a.mot_etat === 'a-relire'; });
      $('av-relire-t').textContent = 'Mots à relire (' + aRelire.length + ')';
      var hote = vider($('av-relire'));
      if (!aRelire.length) hote.appendChild(el('p', { class: 'b-vide', text: 'Aucun mot à relire.' }));
      aRelire.forEach(function (a) {
        var msg = el('div', { class: 'b-avis-msg', role: 'status' });
        function relire(oui) {
          return function () {
            N.rpc('bureau_relire_mot', { p_compte: a.compte_id, p_jeu: a.jeu, p_mot: a.mot, p_accepte: oui }).then(function (fait) {
              if (fait === true) return rendreAvis();
              vider(msg).appendChild(el('p', { class: 'alerte', text: 'Le parent a changé son mot entre-temps. Rechargez la page pour lire la nouvelle version.' }));
            }).catch(function (e) { erreur(msg, e); });
          };
        }
        hote.appendChild(el('article', { class: 'b-avis', 'data-avis': a.jeu }, [
          el('p', { class: 'b-avis-tete' }, [el('b', { text: nomJeu(c, a.jeu) }), ' · ' + date(a.maj_le) + ' · ' + (a.langue === 'en' ? 'en anglais' : 'en français')]),
          el('p', { class: 'b-avis-note' }, [el('span', { class: 'b-etoiles', text: etoiles(a.etoiles) }), ' · ' + (MARCHE[a.marche] || a.marche)]),
          el('blockquote', { class: 'b-avis-mot', lang: a.langue, text: a.mot }),
          el('div', { class: 'b-avis-boutons' }, [
            el('button', { type: 'button', class: 'btn-ligne b-accepter', text: 'Accepter : le montrer' }),
            el('button', { type: 'button', class: 'btn-ligne b-refuser', text: 'Refuser : ne pas le montrer' })
          ]),
          msg
        ]));
        var b = hote.lastChild.querySelectorAll('button');
        b[0].addEventListener('click', relire(true));
        b[1].addEventListener('click', relire(false));
      });
      // Par jeu : comme les familles le liront (rien sur la fiche sous 5 avis).
      var parJeu = {};
      l.forEach(function (a) {
        var j = parJeu[a.jeu] || (parJeu[a.jeu] = { n: 0, somme: 0, marche: {}, nBien: 0, sommeBien: 0 });
        j.n++; j.somme += Number(a.etoiles) || 0;
        j.marche[a.marche] = (j.marche[a.marche] || 0) + 1;
        if (a.marche === 'oui') { j.nBien++; j.sommeBien += Number(a.etoiles) || 0; }
      });
      function compte(o) { return Object.keys(MARCHE).filter(function (k) { return o[k]; }).map(function (k) { return o[k] + ' ' + MARCHE[k]; }).join(', '); }
      var tj = vider($('av-jeux'));
      tj.appendChild(el('thead', null, [el('tr', null, ['Jeu', 'Avis', 'Étoiles (moyenne)', 'Le jeu marche chez eux', 'Moyenne là où il marche bien', 'Sur la fiche'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]));
      var bj = el('tbody');
      Object.keys(parJeu).sort(function (x, y) { return parJeu[y].n - parJeu[x].n; }).forEach(function (id) {
        var j = parJeu[id];
        bj.appendChild(el('tr', null, [el('td', { text: nomJeu(c, id) }), el('td', { text: j.n }), el('td', { class: 'nowrap', text: virgule(j.somme / j.n) }),
          el('td', { text: compte(j.marche) }), el('td', { text: j.nBien ? virgule(j.sommeBien / j.nBien) : '' }),
          el('td', { text: j.n >= SEUIL_AVIS ? '✓ montré' : 'pas encore (' + j.n + ' sur ' + SEUIL_AVIS + ')' })]));
      });
      tj.appendChild(bj);
      if (!l.length) tj.appendChild(el('caption', { class: 'b-vide', text: 'Pas encore d\'avis.' }));
      var t = vider($('av-table'));
      t.appendChild(el('thead', null, [el('tr', null, ['Date', 'Jeu', 'Étoiles', 'Le jeu chez eux', 'Mot', 'Mot sur la fiche'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]));
      var b = el('tbody');
      l.forEach(function (a) {
        b.appendChild(el('tr', null, [el('td', { class: 'nowrap', text: date(a.maj_le) }), el('td', { text: nomJeu(c, a.jeu) }),
          el('td', { class: 'nowrap b-etoiles', text: etoiles(a.etoiles) }), el('td', { text: MARCHE[a.marche] || a.marche }),
          el('td', { class: 'b-message', text: a.mot || '' }), el('td', { class: 'nowrap', text: a.mot ? ETAT_MOT[a.mot_etat] || '' : '' })]));
      });
      t.appendChild(b);
    }).catch(function (e) { erreur($('av-relire'), e); });
  }

  // ---------- Le catalogue : les fichiers du site et les demandes GitHub ----------
  var cat = null, gh = null;
  function catalogue() {
    if (cat) return cat;
    cat = Promise.all([
      fetch('../jeux/index.json').then(function (r) { return r.json(); }).then(function (i) {
        return Promise.all(i.games.map(function (f) { return fetch('../jeux/' + f).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }));
      }),
      fetch('../aime-bien/fiches.json').then(function (r) { return r.json(); })
    ]).then(function (r) { return { jeux: r[0].filter(Boolean), recos: r[1].items || [] }; });
    return cat;
  }
  function github() {
    if (gh) return gh;
    gh = fetch(GH_API, { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
    return gh;
  }
  function fr(bi) { return bi && (bi.fr || bi.en) || ''; }
  function rendreCatalogue() {
    catalogue().then(function (c) {
      var t = vider($('ca-jeux'));
      t.appendChild(el('thead', null, [el('tr', null, ['Jeu', 'État', 'Âge', 'But', 'Kit', 'Autres sites contactés'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]));
      var b = el('tbody');
      c.jeux.forEach(function (g) {
        b.appendChild(el('tr', null, [
          el('td', null, [el('a', { href: '../les-jeux/#' + g.id, text: fr(g.title) })]),
          el('td', { text: g.status === 'published' ? '✓ publiée' : 'à relire' }),
          el('td', { class: 'nowrap', text: g.age ? g.age.min + ' à ' + g.age.max + ' ans' : '' }),
          el('td', { text: g.learning ? ({ core: 'Apprendre', side: 'En passant', none: 'Plaisir' })[g.learning.level] || '' : '' }),
          el('td', { text: g.kit ? '✓ oui' : 'non' }),
          el('td', { text: (g.third_parties || []).map(function (x) { return typeof x === 'string' ? x : x.name || x.domain || ''; }).join(', ') || 'aucun' })
        ]));
      });
      t.appendChild(b);
      var r = vider($('ca-recos'));
      r.appendChild(el('thead', null, [el('tr', null, ['Titre', 'Type', 'État', 'Fiche'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]));
      var rb = el('tbody');
      c.recos.forEach(function (x) {
        rb.appendChild(el('tr', null, [
          el('td', null, [el('a', { href: '../aime-bien/#' + x.id, text: fr(x.title) })]),
          el('td', { text: x.type || '' }), el('td', { text: x.status === 'valide' ? '✓ recommandée' : 'proposée' }), el('td', { text: x.incomplete ? 'à compléter' : 'complète' })
        ]));
      });
      r.appendChild(rb);
    }).catch(function (e) { erreur($('ca-jeux'), e); });
    var hote = vider($('ca-github'));
    github().then(function (l) {
      if (!l.length) { hote.appendChild(el('p', { class: 'b-vide', text: 'Rien d\'ouvert. Les jeux proposés et les recommandations arriveront ici.' })); return; }
      hote.appendChild(el('ul', { class: 'b-liste' }, l.map(function (i) {
        return el('li', null, [el('a', { href: i.html_url, text: i.title }), el('span', { text: ' ' + date(i.created_at) + ((i.labels || []).length ? ', ' + i.labels.map(function (x) { return x.name; }).join(', ') : '') })]);
      })));
    }).catch(function () {
      hote.appendChild(el('p', null, ['GitHub ne répond pas pour l\'instant. ', el('a', { href: GH, text: 'Voir les demandes sur GitHub' })]));
    });
  }

  // ---------- Les formules ----------
  function rendreFormules() {
    chargerApercu().then(function (a) {
      var t = vider($('fo-table'));
      t.appendChild(el('thead', null, [el('tr', null, ['Formule', 'Nom affiché', 'Droits', 'Ouverte', 'Comptes'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]));
      var b = el('tbody');
      a.formules.forEach(function (f) {
        var droits = Object.keys(f.droits || {}).filter(function (k) { return f.droits[k]; }).join(', ') || 'aucun';
        b.appendChild(el('tr', null, [el('td', { text: f.id }), el('td', { text: fr(f.nom) }), el('td', { text: droits }), el('td', { text: f.ouverte ? '✓ oui' : 'non' }), el('td', { text: f.comptes })]));
      });
      t.appendChild(b);
    }).catch(function (e) { erreur($('fo-table'), e); });
  }

  // ---------- Exports ----------
  // Une cellule qui commence par = + - @ serait une formule dans un tableur : c'est du texte venu de visiteurs.
  function cellule(v) {
    var s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(' + ') : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function csv(nom, entetes, lignes) {
    var txt = [entetes.map(cellule).join(';')].concat(lignes.map(function (l) { return l.map(cellule).join(';'); })).join('\r\n');
    var a = el('a', { href: URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' })), download: nom });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  // ---------- Navigation ----------
  var RUBRIQUES = { apercu: rendreApercu, envies: rendreEnvies, comptes: rendreComptes, avis: rendreAvis, catalogue: rendreCatalogue, formules: rendreFormules };
  function route() {
    var r = location.hash.replace('#', '');
    if (!RUBRIQUES[r]) r = 'apercu';
    document.querySelectorAll('[data-rub]').forEach(function (s) { s.hidden = s.getAttribute('data-rub') !== r; });
    document.querySelectorAll('#b-nav a').forEach(function (a) {
      if (a.getAttribute('href') === '#' + r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    RUBRIQUES[r]();
  }

  function refuser(texte, connexion) {
    $('b-garde-p').textContent = texte;
    $('b-garde-a').hidden = !connexion;
  }
  function demarrer() {
    if (!N.actif()) return refuser('Le bureau attend que les comptes soient ouverts.');
    if (!N.connecte()) return refuser('Connectez-vous pour entrer.', true);
    N.rpc('est_admin').then(function (oui) {
      if (oui !== true) return refuser('Cette page est réservée à l\'équipe de Ludiworld.');
      $('b-garde').hidden = true;
      $('bureau').hidden = false;
      $('b-qui').textContent = N.email() || '';
      $('en-filtre').addEventListener('change', rendreTableEnvies);
      $('co-cherche').addEventListener('input', function () { clearTimeout(minuteur); minuteur = setTimeout(rendreComptes, 250); });
      $('en-csv').addEventListener('click', function () {
        csv('ludiworld-envies.csv', ['date', 'langue', 'vient pour', 'qui', 'ages', 'ce qui compte', 'ia', 'message', 'fini', 'adresse'],
          enviesVisibles().map(function (e) { return [e.cree_le, e.langue, e.envie, e.profils, e.ages, e.priorites, e.experience, e.message, e.termine ? 'oui' : 'non', e.email]; }));
      });
      $('co-csv').addEventListener('click', function () {
        csv('ludiworld-contacts.csv', ['adresse', 'vient pour'],
          comptes.filter(function (c) { return c.nouvelles && c.confirme_le; }).map(function (c) { return [c.email, c.envie]; }));
      });
      window.addEventListener('hashchange', route);
      route();
    }).catch(function (e) {
      if (e.code === 'session') return refuser('Votre session a expiré.', true);
      refuser(e.code === 'reseau' ? 'Pas de réseau pour l\'instant.' : 'La base n\'a pas répondu.');
    });
  }
  demarrer();
})();
