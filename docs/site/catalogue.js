/* Ludiworld : le catalogue des jeux. La même mini-fiche et la même fiche partout (page « Les jeux » du site, côté parent de l'appli).
   Autonome : ne dépend ni de site.js ni de app.js, porte ses textes FR / EN, prend la langue dans o.lang.
   Aucune donnée d'une fiche n'entre en HTML : tout passe par textContent et createElement (seuls les SVG écrits ici utilisent innerHTML).

   LudiCatalogue.charger(base)      Promise<fiches[]> : lit <base>jeux/index.json puis chaque fiche
   LudiCatalogue.miniFiche(g, o)    <article class="cat-mini" data-jeu="id"> ; o.lang, o.actions [HTMLElement], o.marque (texte sur l'icône), o.onOuvrir(g),
                                    o.nouveau (true : la petite marque « Nouveau » près du nom)
   LudiCatalogue.ouvrir(g, o)       la fiche dans un <dialog class="cat-fiche"> ; o.lang, o.actions (sous le titre), o.avant (juste après les boutons,
                                    avant les images), o.sections (avant « Ce qu'on y apprend »), o.adresse (#id dans l'adresse), o.onFermer(),
                                    o.apresAvis (juste après l'avis des parents) ; l'avis des parents (LudiNuage.avisPublics) se lit seul,
                                    rien sous 5 avis
   LudiCatalogue.rafraichirAvis(id) relit l'avis des parents de ce jeu (après un avis donné ou retiré) et redessine la fiche ouverte
   LudiCatalogue.fermer()
   LudiCatalogue.ouverte()          la fiche ouverte (ou null) ; rappeler ouvrir(g, o) la redessine sans la refermer
   LudiCatalogue.icone(g, taille)   l'icône du jeu, avec son initiale en secours
   LudiCatalogue.sujets(g, lang)    ce qu'on y apprend en quelques mots (« Tables de multiplication, calcul mental », ou « Pour le plaisir »)
   LudiCatalogue.notion(d, lang)    le nom d'une notion de learning.domains (« maths.multiplication » : « Tables de multiplication »)
   LudiCatalogue.nouveau(g, quand)  true pendant 30 jours après g.added (date d'ajout au catalogue, AAAA-MM-JJ)
   LudiCatalogue.images(g, lang)    les images du jeu : [{ src, alt }] (adresses complètes) */
(function () {
  'use strict';

  // La racine du site, d'après l'adresse de ce script (site/catalogue.js) : sert aux images quand la fiche ne vient pas de charger().
  var RACINE = (function () {
    try {
      var s = document.currentScript && document.currentScript.src;
      return s ? new URL('../', s).href : new URL('./', document.baseURI).href;
    } catch (e) { return ''; }
  })();

  var TX = {
    fr: {
      ans: function (a, b) { return a === b ? a + ' ans' : a + ' à ' + b + ' ans'; },
      min: function (a, b) { return a === b ? a + ' min' : a + ' à ' + b + ' min'; },
      lire: { none: 'Sans lecture', some: 'Un peu de lecture', fluent: 'Il faut bien lire' }, // les mêmes mots sur la mini-fiche et dans la fiche
      fAge: 'Âge', fPartie: 'Une partie', fLire: 'Lecture', fReseau: 'Réseau',
      horsLigne: 'Marche sans réseau', enLigne: 'Demande du réseau',
      fJoueurs: 'Joueurs', aDeux: 'À deux possible', // together: true, le jeu se joue aussi à deux sur le même appareil
      niveau: { core: 'Apprendre est le but', side: 'On apprend en passant', none: 'Pour le plaisir' },
      // Les notions de spec/domaines.md, en mots simples. La seule table du site pour ces noms.
      notions: {
        'maths.multiplication': 'Tables de multiplication', 'maths.calcul-mental': 'Calcul mental',
        'sciences.magnetisme': 'Magnétisme', 'sciences.physique': 'Physique', 'geographie.pays': 'Pays du monde',
        'histoire.prehistoire': 'Préhistoire', 'histoire.techniques': 'Histoire des techniques', 'logique.puzzle': 'Logique',
        'memoire.sequences': 'Mémoire', 'gestion.ressources': 'Gestion', 'motricite.reflexes': 'Réflexes',
        'strategie.choix': 'Stratégie', 'emotions.frustration': 'Gérer la frustration'
      },
      apprend: 'Ce qu\'on y apprend', comment: 'Comment ça se joue', aSavoir: 'À savoir', engagements: 'Les sites contactés',
      tout: 'Toute la fiche',
      tiersAucun: 'Ne contacte aucun autre site.', tiers: function (l) { return 'Contacte aussi : ' + l + '.'; },
      controle: function (d, s) { return 'Contrôlé le ' + d + ' : ' + (s ? 'pendant quelques minutes de jeu, il a contacté ' + s + '.' : 'pendant quelques minutes de jeu, il n\'a contacté aucun autre site.'); },
      par: function (n) { return 'par ' + n; },
      // Les avis de parents : les étoiles moyennes et le nombre d'avis, puis à part ceux chez qui le jeu ne marche pas bien ; rien sous 5 avis.
      avisTitre: 'L’avis des parents',
      chiffre: function (x) { return x.toFixed(1).replace('.', ','); },
      avisSur5: function (m) { return m + ' sur 5'; },
      avisNombre: function (n) { return n + ' avis'; },
      avisSouci: function (n, sans) {
        return (n > 1 ? n + ' parents disent que le jeu ne marche pas bien chez eux.' : '1 parent dit que le jeu ne marche pas bien chez lui.')
          + (sans ? (n > 1 ? ' Sans eux : ' : ' Sans lui : ') + sans + '.' : '');
      },
      avisMots: 'Des parents écrivent :',
      avisNote: 'Ces avis viennent de parents connectés. Leurs mots sont lus par Julien avant d’être montrés, sans nom.',
      nouveau: 'Nouveau',
      code: 'Le code du jeu',
      fermer: 'Fermer la fiche', images: 'Images du jeu', plusAvant: 'Images précédentes', plusApres: 'Images suivantes',
      agrandir: function (a) { return 'Agrandir l\'image : ' + a; },
      retour: 'Revenir à la fiche', avant: 'Image précédente', apres: 'Image suivante',
      surN: function (i, n) { return i + ' sur ' + n; }
    },
    en: {
      ans: function (a, b) { return a === b ? 'age ' + a : 'ages ' + a + ' to ' + b; },
      min: function (a, b) { return a === b ? a + ' min' : a + ' to ' + b + ' min'; },
      lire: { none: 'No reading', some: 'Some reading', fluent: 'Fluent reading needed' },
      fAge: 'Age', fPartie: 'One session', fLire: 'Reading', fReseau: 'Connection',
      horsLigne: 'Works offline', enLigne: 'Needs a connection',
      fJoueurs: 'Players', aDeux: 'Two can play',
      niveau: { core: 'Learning is the point', side: 'Some learning on the way', none: 'Just for fun' },
      notions: {
        'maths.multiplication': 'Times tables', 'maths.calcul-mental': 'Mental maths',
        'sciences.magnetisme': 'Magnetism', 'sciences.physique': 'Physics', 'geographie.pays': 'Countries of the world',
        'histoire.prehistoire': 'Prehistory', 'histoire.techniques': 'History of techniques', 'logique.puzzle': 'Logic',
        'memoire.sequences': 'Memory', 'gestion.ressources': 'Resource management', 'motricite.reflexes': 'Reflexes',
        'strategie.choix': 'Strategy', 'emotions.frustration': 'Handling frustration'
      },
      apprend: 'What it teaches', comment: 'How it plays', aSavoir: 'Worth knowing', engagements: 'Sites it contacts',
      tout: 'The whole card',
      tiersAucun: 'Contacts no other site.', tiers: function (l) { return 'Also contacts: ' + l + '.'; },
      controle: function (d, s) { return 'Checked on ' + d + ': ' + (s ? 'during a few minutes of play, it contacted ' + s + '.' : 'during a few minutes of play, it contacted no other site.'); },
      par: function (n) { return 'by ' + n; },
      avisTitre: 'What parents say',
      chiffre: function (x) { return x.toFixed(1); },
      avisSur5: function (m) { return m + ' out of 5'; },
      avisNombre: function (n) { return n + ' reviews'; },
      avisSouci: function (n, sans) {
        return (n > 1 ? n + ' parents say the game does not work well at their home.' : '1 parent says the game does not work well at their home.')
          + (sans ? ' Without them: ' + sans + '.' : '');
      },
      avisMots: 'Parents write:',
      avisNote: 'These views come from signed-in parents. Their words are read by Julien before being shown, with no name.',
      nouveau: 'New',
      code: 'The game\'s code',
      fermer: 'Close the card', images: 'Pictures of the game', plusAvant: 'Previous pictures', plusApres: 'Next pictures',
      agrandir: function (a) { return 'Enlarge the picture: ' + a; },
      retour: 'Back to the card', avant: 'Previous picture', apres: 'Next picture',
      surN: function (i, n) { return i + ' of ' + n; }
    }
  };

  function langue(o) { return o && o.lang === 'en' ? 'en' : 'fr'; }
  // Textes d'une fiche : en français, espace insécable avant « ? ! : ; » pour qu'ils ne partent pas seuls à la ligne.
  function pick(bi, l) {
    var s = bi && typeof bi === 'object' ? (bi[l] || bi.fr || bi.en || '') : '';
    if (typeof s !== 'string') return '';
    return l === 'fr' ? s.replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ') : s;
  }
  function couleur(c) { return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#1d2b4f'; }
  // Une adresse web, jamais javascript: ou data: (http ne sert qu'au serveur local de dev : le catalogue publié exige https).
  function https(u) { return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null; }
  // La première phrase du pitch, coupée proprement.
  function phrase(s) {
    var m = /^[\s\S]+?[.!?…](?=\s|$)/.exec(s || '');
    return (m ? m[0] : s || '').trim();
  }
  // Le nom d'une notion ; une notion encore inconnue garde son dernier mot plutôt que rien.
  function notion(d, lang) {
    var l = lang === 'en' ? 'en' : 'fr';
    if (typeof d !== 'string' || !d) return '';
    return TX[l].notions[d] || d.split('.').pop().replace(/-/g, ' ');
  }
  // Ce qu'on y apprend en quelques mots : les deux premières notions de la fiche, ou « Pour le plaisir ».
  function sujets(g, lang) {
    var l = lang === 'en' ? 'en' : 'fr', lv = (g && g.learning) || {};
    if (lv.level === 'none') return TX[l].niveau.none;
    var n = (Array.isArray(lv.domains) ? lv.domains : []).slice(0, 2).map(function (d) { return notion(d, l); }).filter(Boolean);
    if (!n.length) return TX[l].niveau[lv.level] || '';
    return n.map(function (s, i) { return i ? s.charAt(0).toLowerCase() + s.slice(1) : s; }).join(', ');
  }

  // « Nouveau » : pendant 30 jours après l'entrée du jeu au catalogue (champ added). Pas de compte à rebours.
  var JOURS_NOUVEAU = 30;
  function ajoutLe(g) {
    var a = g && typeof g.added === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.added) ? new Date(g.added + 'T00:00:00') : null;
    return a && !isNaN(a) ? a : null;
  }
  function nouveau(g, quand) {
    var a = ajoutLe(g);
    if (!a) return false;
    var age = (quand instanceof Date ? quand.getTime() : Date.now()) - a.getTime();
    return age >= 0 && age < JOURS_NOUVEAU * 864e5;
  }

  // ---------- Petits outils ----------
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.className = v;
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  var SVG = {
    croix: '<path d="M6 6l12 12M18 6L6 18"/>',
    avant: '<path d="M15 5l-7 7 7 7"/>',
    apres: '<path d="M9 5l7 7-7 7"/>',
    coche: '<path d="M4.5 12.5l5 5 10-11"/>',
    loupe: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5M10.5 8v5M8 10.5h5"/>',
    etoile: '<path d="M12 2.8l2.85 5.95 6.55.85-4.8 4.55 1.2 6.5L12 17.5l-5.8 3.15 1.2-6.5-4.8-4.55 6.55-.85z"/>',
    livre: '<path d="M3.5 6c2.8-1.3 5.8-1.2 8.5.6 2.7-1.8 5.7-1.9 8.5-.6v12.6c-2.8-1.1-5.8-1-8.5.8-2.7-1.8-5.7-1.9-8.5-.8z"/><path d="M12 6.6v13"/>'
  };
  function svg(nom, cls) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    s.setAttribute('class', 'cat-svg' + (cls ? ' ' + cls : ''));
    s.innerHTML = SVG[nom]; // dessins écrits ici, jamais venus d'une fiche
    return s;
  }

  // Remplace les enfants d'un nœud, en sautant les cases vides (replaceChildren écrirait « null »).
  function poser(n, kids) { n.replaceChildren.apply(n, kids.filter(Boolean)); }

  // ---------- Une bande d'images qu'on fait défiler ----------
  // Au doigt, elle défile d'elle-même. À la souris, pas de barre : deux flèches discrètes aux bords quand la bande dépasse,
  // ou on la fait glisser. Un glisser n'est pas un toucher : il n'ouvre ni la fiche ni l'image.
  function defilable(sc, cls, l) {
    var T = TX[l];
    var avant = el('button', { type: 'button', class: 'cat-fleche cat-fleche-avant', tabindex: '-1', 'aria-hidden': 'true', title: T.plusAvant }, [svg('avant')]);
    var apres = el('button', { type: 'button', class: 'cat-fleche cat-fleche-apres', tabindex: '-1', 'aria-hidden': 'true', title: T.plusApres }, [svg('apres')]);
    var bande = el('div', { class: 'cat-bande' + (cls ? ' ' + cls : '') }, [sc, avant, apres]);
    function maj() {
      var max = sc.scrollWidth - sc.clientWidth;
      bande.classList.toggle('cat-plus-avant', sc.scrollLeft > 4);
      bande.classList.toggle('cat-plus-apres', max > 4 && sc.scrollLeft < max - 4);
    }
    function pousser(sens) {
      return function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var pas = Math.max(120, sc.clientWidth * 0.8) * sens;
        try { sc.scrollBy({ left: pas, behavior: 'smooth' }); } catch (e) { sc.scrollLeft += pas; }
      };
    }
    avant.addEventListener('click', pousser(-1));
    apres.addEventListener('click', pousser(1));
    sc.addEventListener('scroll', maj, { passive: true });
    sc.querySelectorAll('img').forEach(function (i) { i.addEventListener('load', maj); });
    if (typeof ResizeObserver === 'function') new ResizeObserver(maj).observe(sc);
    // Glisser à la souris
    var depart = null, glisse = false;
    sc.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType !== 'mouse' || ev.button !== 0 || sc.scrollWidth <= sc.clientWidth + 4) return;
      depart = { x: ev.clientX, g: sc.scrollLeft }; glisse = false;
      function bouge(e) {
        var dx = e.clientX - depart.x;
        if (!glisse && Math.abs(dx) < 6) return;
        if (!glisse) { glisse = true; bande.classList.add('cat-glisse'); }
        sc.scrollLeft = depart.g - dx;
      }
      function lache() {
        window.removeEventListener('pointermove', bouge);
        window.removeEventListener('pointerup', lache);
        window.removeEventListener('pointercancel', lache);
        depart = null;
        bande.classList.remove('cat-glisse');
        if (glisse) setTimeout(function () { glisse = false; }, 0);
      }
      window.addEventListener('pointermove', bouge);
      window.addEventListener('pointerup', lache);
      window.addEventListener('pointercancel', lache);
    });
    sc.addEventListener('click', function (ev) { if (glisse) { ev.preventDefault(); ev.stopPropagation(); } }, true);
    requestAnimationFrame(maj);
    return bande;
  }

  // ---------- Charger ----------
  var dossiers = typeof WeakMap === 'function' ? new WeakMap() : null; // fiche -> adresse de son dossier jeux/
  var controles = typeof WeakMap === 'function' ? new WeakMap() : null; // fiche -> { le, sites } du dernier contrôle
  // « Contrôlé le … » seulement si le contrôle a moins de 90 jours.
  function ligneControle(g, l) {
    var k = controles && controles.get(g);
    if (!k || !/^\d{4}-\d{2}-\d{2}$/.test(k.le || '') || !Array.isArray(k.sites)) return null;
    var d = new Date(k.le + 'T12:00:00');
    if (isNaN(d) || Date.now() - d.getTime() > 90 * 864e5) return null;
    var date = d.toLocaleDateString(l === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    var sites = k.sites.filter(function (x) { return typeof x === 'string'; }).join(', ');
    return el('p', { class: 'cat-controle', text: TX[l].controle(date, sites) });
  }
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }
  function charger(base) {
    var racine;
    // '' veut dire « le dossier de la page » (pour l'appli, la racine du site, d'après sa balise <base>).
    try { racine = base === undefined || base === null ? RACINE : new URL(base || './', document.baseURI).href; } catch (e) { racine = RACINE; }
    if (racine.slice(-1) !== '/') racine += '/';
    var dossier = racine + 'jeux/';
    // Le contrôle des sites contactés (fait par la factory) : facultatif, la fiche se lit sans lui.
    var ctl = getJSON(dossier + 'controles.json').catch(function () { return null; });
    return getJSON(dossier + 'index.json').then(function (idx) {
      return Promise.all(((idx && idx.games) || []).map(function (f) {
        if (!/^[a-z0-9-]+\.json$/i.test(f)) return null;
        return getJSON(dossier + f).catch(function () { return null; });
      }).concat([ctl]));
    }).then(function (l) {
      var c = l.pop(), jeux = (c && c.jeux) || {};
      return l.filter(function (g) {
        if (!g || !g.title || !/^[a-z0-9-]+$/.test(g.id || '')) return false;
        if (dossiers) dossiers.set(g, dossier);
        if (controles && jeux[g.id]) controles.set(g, jeux[g.id]);
        return true;
      });
    });
  }
  // Les images du jeu, avec leur adresse complète. Un chemin local doit être img/<nom>.webp (rien qui sorte du dossier).
  function images(g, l) {
    var dossier = (dossiers && dossiers.get(g)) || RACINE + 'jeux/';
    return (Array.isArray(g.screenshots) ? g.screenshots : []).slice(0, 5).map(function (s) {
      if (!s) return null;
      var src = https(s.src) || (typeof s.src === 'string' && /^img\/[a-z0-9-]+\.webp$/i.test(s.src) ? dossier + s.src : null);
      return src ? { src: src, alt: pick(s.alt, l) } : null;
    }).filter(Boolean);
  }
  function portrait(g) { return g.screens === 'portrait'; }
  function imageJeu(g, im, cls, paresseuse) {
    var p = portrait(g);
    var img = el('img', {
      class: cls, src: im.src, alt: im.alt, decoding: 'async', loading: paresseuse ? 'lazy' : null,
      width: p ? '720' : '960', height: p ? '1280' : '540', draggable: 'false'
    });
    return img;
  }

  // ---------- L'icône ----------
  function icone(g, taille) {
    var t = Number(taille) > 0 ? Number(taille) : 56;
    var titre = pick(g && g.title, 'fr');
    var n = el('span', { class: 'cat-icone', 'aria-hidden': 'true' }, [el('span', { class: 'cat-initiale', text: (titre || '?').charAt(0) })]);
    n.style.setProperty('--cat-taille', t + 'px');
    n.style.setProperty('--jc', couleur(g && g.color));
    var src = https(g && g.icon);
    if (src) {
      var img = el('img', { src: src, alt: '', width: String(t), height: String(t), loading: 'lazy', decoding: 'async', draggable: 'false' });
      img.addEventListener('error', function () { img.remove(); n.classList.remove('cat-chargee'); });
      img.addEventListener('load', function () { n.classList.add('cat-chargee'); });
      n.appendChild(img);
    }
    return n;
  }

  // ---------- La mini-fiche ----------
  function faitsMini(g, l) {
    var T = TX[l], out = [];
    if (g.age) out.push(T.ans(g.age.min, g.age.max));
    if (g.reading && T.lire[g.reading]) out.push(T.lire[g.reading]);
    if (g.together === true) out.push(T.aDeux);
    return out.join(' · ');
  }
  // La ligne « ce qu'on y apprend », la même sur la mini-fiche et dans la fiche.
  function ligneSujets(g, l, cls) {
    var s = sujets(g, l);
    if (!s) return null;
    return el('p', { class: 'cat-sujets' + (cls ? ' ' + cls : '') }, [
      svg('livre'), el('span', null, [el('span', { class: 'cat-cache', text: TX[l].apprend + (l === 'fr' ? ' : ' : ': ') }), s])
    ]);
  }
  function miniFiche(g, o) {
    o = o || {};
    var l = langue(o), nom = pick(g.title, l);
    var ico = icone(g, 56);
    if (o.marque) ico.appendChild(el('span', { class: 'cat-marque', text: String(o.marque) }));
    var ims = images(g, l);
    var art = el('article', { class: 'cat-mini', 'data-jeu': g.id }, [
      el('div', { class: 'cat-mini-tete' }, [
        el('span', { class: 'cat-mini-ico' }, [ico]),
        el('div', { class: 'cat-mini-nom' }, [
          o.nouveau ? el('p', { class: 'cat-nouveau', text: TX[l].nouveau }) : null,
          el('h3', null, [el('button', { type: 'button', class: 'cat-mini-ouvrir', text: nom })]),
          ligneSujets(g, l, 'cat-mini-sujets'),
          el('p', { class: 'cat-mini-phrase', text: phrase(pick(g.pitch, l)) })
        ])
      ]),
      ims.length ? defilable(el('div', { class: 'cat-mini-images ' + (portrait(g) ? 'cat-portrait' : 'cat-paysage') + ' cat-n' + Math.min(ims.length, 4) }, ims.map(function (im) {
        var img = imageJeu(g, im, 'cat-mini-img', true);
        img.addEventListener('error', function () { img.remove(); });
        return img;
      })), 'cat-mini-bande', l) : null,
      el('p', { class: 'cat-mini-faits', text: faitsMini(g, l) }),
      o.actions && o.actions.length ? el('div', { class: 'cat-mini-actions' }, o.actions) : null
    ]);
    art.style.setProperty('--jc', couleur(g.color));
    // Toute la mini-fiche ouvre la fiche, sauf ses boutons à elle (o.actions) et les liens ou champs qu'on y aurait mis.
    art.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t.closest('.cat-mini-actions')) return;
      var interactif = t.closest('a, button, input, select, textarea, label, summary');
      if (interactif && !interactif.classList.contains('cat-mini-ouvrir')) return;
      if (typeof o.onOuvrir === 'function') o.onOuvrir(g);
      else ouvrir(g, { lang: l });
    });
    return art;
  }

  // ---------- La fiche ----------
  var dlg = null, panneau = null, loupe = null;
  var etat = null;        // { g, o, cle, poussee } de la fiche ouverte
  var ignorerPop = 0;     // retours d'historique que la fiche a demandés elle-même
  var compteur = 0;

  function creer() {
    if (dlg) return;
    dlg = el('dialog', { class: 'cat-fiche', 'aria-labelledby': 'cat-fiche-titre' });
    panneau = el('div', { class: 'cat-panneau', tabindex: '-1' });
    loupe = el('div', { class: 'cat-loupe', hidden: true });
    dlg.appendChild(panneau);
    dlg.appendChild(loupe);
    document.body.appendChild(dlg);
    // Un toucher sur le fond, autour du panneau.
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) fermer(); });
    // Échap : ferme d'abord l'image agrandie, puis la fiche.
    dlg.addEventListener('cancel', function (ev) { if (!loupe.hidden) { ev.preventDefault(); fermerLoupe(); } });
    dlg.addEventListener('keydown', function (ev) {
      if (loupe.hidden) return;
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); montrer(loupeIndex - 1); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); montrer(loupeIndex + 1); }
    });
    dlg.addEventListener('close', fermee);
    // Dès qu'on fait défiler, la croix se pose sur une bande de papier : le texte passe sous la bande, jamais sous la croix seule.
    panneau.addEventListener('scroll', haute, { passive: true });
  }
  function haute() { if (panneau) panneau.classList.toggle('cat-defilee', panneau.scrollTop > 6); }

  function faits(g, l) {
    var T = TX[l], cases = [];
    function f(lib, val) { cases.push(el('div', null, [el('dt', { text: lib }), el('dd', { text: val })])); }
    if (g.age) f(T.fAge, T.ans(g.age.min, g.age.max));
    if (g.session && Array.isArray(g.session.minutes)) f(T.fPartie, T.min(g.session.minutes[0], g.session.minutes[1]));
    if (g.reading && T.lire[g.reading]) f(T.fLire, T.lire[g.reading]);
    if (typeof g.offline === 'boolean') f(T.fReseau, g.offline ? T.horsLigne : T.enLigne);
    if (g.together === true) f(T.fJoueurs, T.aDeux);
    return el('dl', { class: 'cat-faits' }, cases);
  }
  function galerie(g, l) {
    var ims = images(g, l), T = TX[l];
    if (!ims.length) return null;
    var sc = el('div', { class: 'cat-galerie ' + (portrait(g) ? 'cat-portrait' : 'cat-paysage') + ' cat-n' + Math.min(ims.length, 4), role: 'group', 'aria-label': T.images },
      ims.map(function (im, i) {
        var fig = el('figure', { class: 'cat-vue' }, [
          el('button', { type: 'button', class: 'cat-vignette', 'aria-label': T.agrandir(im.alt), onclick: function () { ouvrirLoupe(ims, i, fig); } }, [
            imageJeu(g, im, 'cat-vue-img', i > 0), svg('loupe', 'cat-vue-loupe')
          ]),
          im.alt ? el('figcaption', null, [el('span', { text: im.alt })]) : null
        ]);
        fig.querySelector('img').addEventListener('error', function () { fig.remove(); });
        return fig;
      }));
    return defilable(sc, 'cat-galerie-bande', l);
  }
  // ---------- L'avis des parents ----------
  // Lu par LudiNuage.avisPublics, sans compte. Sous 5 avis la base ne rend rien : la section reste cachée.
  // Gardé par jeu et par langue le temps de la page : redessiner la fiche ne relit pas la base.
  var avisLus = {};
  function avisCle(id, l) { return id + '|' + l; }
  // Cinq étoiles dessinées, remplies jusqu'à la moyenne (4,2 : quatre pleines et un cinquième de la dernière). Lues « 4,2 sur 5 ».
  function etoilesMoyenne(m, l) {
    var T = TX[l], cinq = function () { return [1, 2, 3, 4, 5].map(function () { return svg('etoile'); }); };
    var pleines = el('span', { class: 'cat-etoiles-pleines' }, cinq());
    pleines.style.width = Math.max(0, Math.min(100, Math.round(m * 20 * 10) / 10)) + '%';
    return el('span', { class: 'cat-etoiles', role: 'img', 'aria-label': T.avisSur5(T.chiffre(m)) }, [el('span', { class: 'cat-etoiles-vides' }, cinq()), pleines]);
  }
  function remplirAvis(sec, d, l) {
    var T = TX[l];
    var total = d ? Number(d.total) : 0, moyenne = d ? Number(d.moyenne) : NaN;
    if (!(total >= 5) || !(moyenne >= 1 && moyenne <= 5)) { sec.hidden = true; sec.replaceChildren(); return; }
    // Ceux pour qui le jeu ne marche pas bien (« pas toujours » ou « non ») : mis à part, avec la moyenne des autres.
    var m = d.marche || {}, souci = (Number(m['pas-toujours']) || 0) + (Number(m.non) || 0);
    var sans = Number(d.moyenne_marche_bien);
    var mots = (Array.isArray(d.mots) ? d.mots : []).filter(function (m) { return typeof m === 'string' && m; }).slice(0, 3);
    poser(sec, [
      el('h3', { text: T.avisTitre }),
      el('p', { class: 'cat-avis-note-moyenne' }, [
        etoilesMoyenne(moyenne, l),
        el('b', { class: 'cat-avis-chiffre', 'aria-hidden': 'true', text: T.chiffre(moyenne) }),
        el('span', { class: 'cat-avis-nombre', text: T.avisNombre(total) })
      ]),
      souci > 0 ? el('p', { class: 'cat-avis-souci', text: T.avisSouci(souci, d.moyenne_marche_bien != null && sans >= 1 && sans <= 5 ? T.chiffre(sans) : '') }) : null,
      mots.length ? el('p', { class: 'cat-avis-mots-titre', text: T.avisMots }) : null,
      mots.length ? el('div', { class: 'cat-avis-mots' }, mots.map(function (m) { return el('blockquote', { lang: l }, [el('p', { text: m })]); })) : null,
      el('p', { class: 'cat-avis-note', text: T.avisNote })
    ]);
    sec.hidden = false;
  }
  function sectionAvis(g, l) {
    var N = window.LudiNuage;
    if (!N || typeof N.avisPublics !== 'function' || !N.actif()) return null;
    var sec = el('section', { class: 'cat-sec cat-avis', 'data-avis': g.id, hidden: true });
    var cle = avisCle(g.id, l), lu = avisLus[cle];
    if (lu && lu.fait) { remplirAvis(sec, lu.d, l); return sec; }
    if (!lu) {
      lu = avisLus[cle] = { fait: false, p: N.avisPublics(g.id, l).then(function (d) { lu.fait = true; lu.d = d; return d; },
        function () { delete avisLus[cle]; return null; }) }; // hors ligne : on réessaiera à la prochaine ouverture
    }
    lu.p.then(function (d) { remplirAvis(sec, d, l); });
    return sec;
  }
  // Après un avis donné ou retiré : la fiche relira les totaux.
  function rafraichirAvis(id) {
    Object.keys(avisLus).forEach(function (k) { if (k.split('|')[0] === id) delete avisLus[k]; });
    if (etat && dlg && dlg.open && etat.g.id === id) ouvrir(etat.g, etat.o);
  }

  function remplir(g, o) {
    var l = langue(o), T = TX[l], lv = g.learning || {};
    var niveau = T.niveau[lv.level] ? lv.level : 'none';
    var tiers = Array.isArray(g.third_parties) ? g.third_parties.filter(function (x) { return typeof x === 'string'; }) : [];
    var auteur = g.author && typeof g.author.name === 'string' ? g.author.name : '';
    var code = https(g.author && g.author.url);
    var ims = images(g, l);
    var avant = (Array.isArray(o.avant) ? o.avant : []).filter(Boolean);
    panneau.style.setProperty('--jc', couleur(g.color));
    dlg.setAttribute('lang', l);
    poser(panneau, [
      el('div', { class: 'cat-haut' }, [
        el('button', { type: 'button', class: 'cat-fermer', 'aria-label': T.fermer, title: T.fermer, onclick: fermer }, [svg('croix')])
      ]),
      el('header', { class: 'cat-f-tete' }, [
        icone(g, 72),
        el('div', null, [
          el('h2', { id: 'cat-fiche-titre', text: pick(g.title, l) }),
          auteur ? el('p', { class: 'cat-auteur', text: T.par(auteur) }) : null
        ])
      ]),
      o.actions && o.actions.length ? el('div', { class: 'cat-f-actions' }, o.actions) : null,
      avant.length ? el('div', { class: 'cat-avant' }, avant) : null,
      galerie(g, l),
      el('p', { class: 'cat-pitch' + (ims.length ? '' : ' cat-sans-images'), text: pick(g.pitch, l) }),
      faits(g, l),
      (o.sections && o.sections.length) ? el('div', { class: 'cat-sections' }, o.sections) : null,
      el('section', { class: 'cat-sec cat-apprend' }, [
        el('h3', { text: T.apprend }),
        el('div', { class: 'cat-apprend-tete' }, [
          ligneSujets(g, l, 'cat-f-sujets'),
          niveau !== 'none' ? el('p', { class: 'cat-niveau cat-niveau-' + niveau, text: T.niveau[niveau] }) : null
        ]),
        lv.what ? el('p', { text: pick(lv.what, l) }) : null
      ]),
      g.content ? el('section', { class: 'cat-sec' }, [el('h3', { text: T.aSavoir }), el('p', { text: pick(g.content, l) })]) : null,
      // L'avis des parents (rien sous 5 avis), puis celui du parent connecté (o.apresAvis, côté parent de l'appli).
      o.avisPublics === false ? null : sectionAvis(g, l),
      o.apresAvis || null,
      // Le reste, replié : comment ça se joue, les sites contactés et leur contrôle, le code. Les engagements, les mêmes pour tous les jeux,
      // ne sont dits qu'une fois, dans la charte de l'accueil (Julien, 2026-11-18).
      el('details', { class: 'cat-tout' }, [
        el('summary', null, [el('span', { text: T.tout }), svg('apres', 'cat-tout-fleche')]),
        lv.how ? el('section', { class: 'cat-sec' }, [el('h3', { text: T.comment }), el('p', { text: pick(lv.how, l) })]) : null,
        el('section', { class: 'cat-sec cat-engagements' }, [
          el('h3', { text: T.engagements }),
          el('p', { class: 'cat-tiers', text: tiers.length ? T.tiers(tiers.join(', ')) : T.tiersAucun }),
          ligneControle(g, l)
        ]),
        el('div', { class: 'cat-f-pied' }, [
          code ? el('a', { class: 'cat-lien', href: code, target: '_blank', rel: 'noopener', text: T.code }) : null
        ])
      ])
    ]);
  }

  // ---------- L'image agrandie, dans la fiche ----------
  var loupeImages = [], loupeIndex = 0, loupeDepuis = null;
  function ouvrirLoupe(ims, i, depuis) {
    loupeImages = ims; loupeDepuis = depuis;
    loupe.hidden = false;
    loupe.classList.toggle('cat-portrait', !!(etat && portrait(etat.g)));
    montrer(i);
    var b = loupe.querySelector('.cat-loupe-fermer');
    if (b) b.focus();
  }
  function montrer(i) {
    var n = loupeImages.length;
    if (!n) return;
    loupeIndex = (i + n) % n;
    var im = loupeImages[loupeIndex], T = TX[langue(etat && etat.o)];
    poser(loupe, [
      el('img', { class: 'cat-loupe-img', src: im.src, alt: im.alt, onclick: fermerLoupe }),
      el('p', { class: 'cat-loupe-legende' }, [el('span', { text: im.alt }), n > 1 ? el('small', { text: T.surN(loupeIndex + 1, n) }) : null]),
      n > 1 ? el('button', { type: 'button', class: 'cat-loupe-nav cat-loupe-avant', 'aria-label': T.avant, onclick: function () { montrer(loupeIndex - 1); } }, [svg('avant')]) : null,
      n > 1 ? el('button', { type: 'button', class: 'cat-loupe-nav cat-loupe-apres', 'aria-label': T.apres, onclick: function () { montrer(loupeIndex + 1); } }, [svg('apres')]) : null,
      el('button', { type: 'button', class: 'cat-loupe-fermer', onclick: fermerLoupe }, [svg('croix'), el('span', { text: T.retour })])
    ]);
  }
  function fermerLoupe() {
    if (!loupe || loupe.hidden) return;
    loupe.hidden = true;
    loupe.replaceChildren();
    var b = loupeDepuis && loupeDepuis.isConnected ? loupeDepuis.querySelector('button') : null;
    if (b) b.focus();
  }

  // ---------- Ouvrir, fermer, et le retour du navigateur ----------
  function ouvrir(g, o) {
    if (!g || !g.id) return;
    o = o || {};
    creer();
    var deja = !!(etat && dlg.open);
    var meme = deja && etat.g.id === g.id;
    var haut = meme ? panneau.scrollTop : 0;
    var gal = meme && panneau.querySelector('.cat-galerie');
    var gauche = gal ? gal.scrollLeft : 0;
    var loupeOuverte = meme && !loupe.hidden ? loupeIndex : -1;
    var toutOuvert = !!(meme && panneau.querySelector('.cat-tout[open]'));
    fermerLoupe();

    if (!deja) {
      compteur += 1;
      etat = { g: g, o: o, cle: 'lw-cat-' + compteur + '-' + Date.now(), poussee: false };
      // Une étape dans l'historique : le retour du navigateur (ou d'Android) ferme la fiche au lieu de quitter la page.
      try {
        var url = o.adresse ? '#' + g.id : null;
        if (!(o.adresse && location.hash === '#' + g.id)) {
          var st = { lwCat: etat.cle };
          if (url) history.pushState(st, '', url); else history.pushState(st, '');
          etat.poussee = true;
        }
      } catch (e) { /* rien */ }
    } else {
      etat.g = g; etat.o = o;
      if (o.adresse && location.hash !== '#' + g.id) {
        try { history.replaceState(history.state, '', '#' + g.id); } catch (e) { /* rien */ }
      }
    }

    remplir(g, o);
    if (toutOuvert) panneau.querySelector('.cat-tout').open = true;
    if (!dlg.open) {
      dlg.showModal();
      document.documentElement.classList.add('cat-verrou');
    }
    panneau.scrollTop = haut;
    haute();
    var g2 = panneau.querySelector('.cat-galerie');
    if (g2 && gauche) g2.scrollLeft = gauche;
    if (loupeOuverte >= 0) {
      var figs = panneau.querySelectorAll('.cat-vue');
      ouvrirLoupe(images(g, langue(o)), loupeOuverte, figs[loupeOuverte] || null);
    }
  }
  function fermer() { if (dlg && dlg.open) dlg.close(); }
  // Fermée par la croix, Échap, le fond ou le retour : on enlève l'étape d'historique et l'adresse, puis on prévient l'appelant.
  function fermee() {
    var e = etat;
    etat = null;
    if (loupe) { loupe.hidden = true; loupe.replaceChildren(); }
    document.documentElement.classList.remove('cat-verrou');
    if (!e) return;
    try {
      if (e.poussee && history.state && history.state.lwCat === e.cle) { ignorerPop += 1; history.back(); }
      else if (!e.poussee && e.o.adresse && location.hash === '#' + e.g.id) history.replaceState(history.state, '', location.pathname + location.search);
    } catch (err) { /* rien */ }
    if (typeof e.o.onFermer === 'function') e.o.onFermer();
  }
  // En capture, pour passer avant les autres écouteurs : les retours qui ne concernent que la fiche ne leur arrivent pas.
  window.addEventListener('popstate', function (ev) {
    if (ignorerPop > 0) { ignorerPop -= 1; ev.stopImmediatePropagation(); return; }
    if (!etat || !dlg || !dlg.open) return;
    var surLaFiche = etat.poussee
      ? !!(history.state && history.state.lwCat === etat.cle)
      : !(etat.o.adresse && location.hash !== '#' + etat.g.id);
    if (surLaFiche) return;
    etat.poussee = false;
    var o = etat.o;
    etat.o = Object.assign({}, o, { adresse: false }); // l'adresse a déjà changé : ne pas la retoucher
    dlg.close();
    ev.stopImmediatePropagation();
  }, true);

  window.LudiCatalogue = {
    charger: charger,
    miniFiche: miniFiche,
    ouvrir: ouvrir,
    fermer: fermer,
    ouverte: function () { return etat && dlg && dlg.open ? etat.g : null; },
    icone: icone,
    sujets: sujets,
    notion: notion,
    nouveau: nouveau,
    images: images,
    rafraichirAvis: rafraichirAvis
  };
})();
