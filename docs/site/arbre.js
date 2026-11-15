/* Ludiworld : l'arbre des compétences, sans rien d'autre (testé dans tests/arbre.test.js).
   Une case n'a un jeu que si la fiche du jeu déclare la notion (learning.domains) : rien n'est relié à la main. */
(function (root) {
  'use strict';

  function c(id, fr, en, mots, domaine) { return { id: id, nom: { fr: fr, en: en }, mots: mots || '', domaine: domaine || null }; }

  var BRANCHES = [
    { id: 'maths', nom: { fr: 'Maths', en: 'Maths' }, couleur: '#ffc83d', glyphe: 'M5 12h14M12 5v14', voir: ['todo-math'], sous: [
      { id: 'calcul', nom: { fr: 'Calcul', en: 'Arithmetic' }, cases: [
        c('compter', 'Compter', 'Counting', 'nombres numbers'),
        c('additions', 'Additions', 'Addition', 'plus'),
        c('soustractions', 'Soustractions', 'Subtraction', 'moins minus'),
        c('calcul-de-tete', 'Calcul de tête', 'Mental maths', 'calcul mental', 'maths.calcul-mental'),
        c('multiplications', 'Multiplications', 'Multiplication', 'tables fois times', 'maths.multiplication'),
        c('divisions', 'Divisions', 'Division', 'partager'),
        c('fractions', 'Fractions', 'Fractions', 'moitié quart half')
      ] },
      { id: 'geometrie', nom: { fr: 'Géométrie', en: 'Geometry' }, cases: [
        c('formes', 'Formes', 'Shapes', 'carré triangle cercle square circle'),
        c('symetrie', 'Symétrie', 'Symmetry'),
        c('se-reperer', 'Se repérer', 'Finding your way', 'plan espace carte map')
      ] },
      { id: 'mesures', nom: { fr: 'Mesures', en: 'Measures' }, cases: [
        c('longueurs', 'Longueurs', 'Lengths', 'mètre metre'),
        c('heure', 'Heure et durée', 'Telling time', 'temps horloge clock'),
        c('monnaie', 'Monnaie', 'Money', 'argent euros')
      ] }
    ] },
    { id: 'sciences', nom: { fr: 'Sciences', en: 'Science' }, couleur: '#6fc7f5', glyphe: 'M10 3h4M11 3v6l-5 9a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-5-9V3M8 15h8', voir: ['laboratoire-emily', 'cest-pas-sorcier'], sous: [
      { id: 'physique', nom: { fr: 'Physique', en: 'Physics' }, cases: [
        c('aimants', 'Aimants', 'Magnets', 'électromagnétisme magnétisme électroaimant pôles electromagnetism magnetism electromagnet poles', 'sciences.magnetisme'),
        c('electricite', 'Électricité', 'Electricity', 'électromagnétisme pile circuit courant electromagnetism battery'),
        c('lumiere', 'Lumière', 'Light', 'ombre shadow'),
        c('forces', 'Forces', 'Forces', 'gravité poids mouvement gravity weight motion', 'sciences.physique')
      ] },
      { id: 'vivant', nom: { fr: 'Vivant', en: 'Living things' }, cases: [
        c('animaux', 'Animaux', 'Animals', 'bêtes'),
        c('plantes', 'Plantes', 'Plants', 'fleurs arbres flowers trees'),
        c('corps-humain', 'Corps humain', 'Human body', 'squelette skeleton')
      ] },
      { id: 'terre', nom: { fr: 'Terre et espace', en: 'Earth and space' }, cases: [
        c('volcans', 'Volcans', 'Volcanoes', 'lave lava'),
        c('meteo', 'Météo', 'Weather', 'pluie climat rain climate'),
        c('planetes', 'Planètes', 'Planets', 'espace fusée étoiles space rocket stars')
      ] }
    ] },
    { id: 'monde', nom: { fr: 'Le monde', en: 'The world' }, couleur: '#ff9a56', glyphe: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18', sous: [
      { id: 'histoire', nom: { fr: 'Histoire', en: 'History' }, voir: ['il-etait-une-fois'], cases: [
        c('prehistoire', 'Préhistoire', 'Prehistory', 'âge de pierre stone age feu fire', 'histoire.prehistoire'),
        c('inventions', 'Inventions', 'Inventions', 'techniques outils tools agriculture', 'histoire.techniques')
      ] },
      { id: 'geographie', nom: { fr: 'Géographie', en: 'Geography' }, cases: [
        c('pays', 'Pays', 'Countries', 'carte continents map', 'geographie.pays'),
        c('capitales', 'Capitales', 'Capital cities', 'villes cities'),
        c('vivre-ailleurs', 'Vivre ailleurs', 'Life elsewhere', 'cultures')
      ] }
    ] },
    { id: 'mots', nom: { fr: 'Les mots', en: 'Words' }, couleur: '#f6d9b0', glyphe: 'M4 5h16v11H9l-5 4z', sous: [
      { id: 'lire', nom: { fr: 'Lire', en: 'Reading' }, cases: [
        c('lettres', 'Lettres et sons', 'Letters and sounds', 'lecture alphabet'),
        c('histoires', 'Comprendre une histoire', 'Understanding a story', 'livre book')
      ] },
      { id: 'ecrire', nom: { fr: 'Écrire', en: 'Writing' }, cases: [
        c('orthographe', 'Orthographe', 'Spelling', 'dictée'),
        c('raconter', 'Raconter', 'Telling a story', 'rédaction')
      ] },
      { id: 'langues', nom: { fr: 'Langues', en: 'Languages' }, cases: [
        c('anglais', 'Anglais', 'English', 'langue'),
        c('espagnol', 'Espagnol', 'Spanish', 'langue')
      ] }
    ] },
    { id: 'arts', nom: { fr: 'Arts', en: 'Arts' }, couleur: '#b79cff', glyphe: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0M19 16a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0', sous: [
      { id: 'musique', nom: { fr: 'Musique', en: 'Music' }, cases: [
        c('notes', 'Notes', 'Notes', 'chanter sing'),
        c('rythme', 'Rythme', 'Rhythm', 'danse dance')
      ] },
      { id: 'image', nom: { fr: 'Image', en: 'Pictures' }, cases: [
        c('dessin', 'Dessin', 'Drawing', 'dessiner draw'),
        c('couleurs', 'Couleurs', 'Colours', 'peinture paint colors')
      ] }
    ] },
    { id: 'reflechir', nom: { fr: 'Réfléchir', en: 'Thinking' }, couleur: '#5fe0b5', glyphe: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z', sous: [
      { id: 'logique', nom: { fr: 'Logique', en: 'Logic' }, cases: [c('resoudre', 'Résoudre un problème', 'Solving a problem', 'puzzle énigme riddle', 'logique.puzzle')] },
      { id: 'memoire', nom: { fr: 'Mémoire', en: 'Memory' }, cases: [c('retenir', 'Retenir une suite', 'Remembering a sequence', 'se souvenir', 'memoire.sequences')] },
      { id: 'strategie', nom: { fr: 'Stratégie', en: 'Strategy' }, cases: [
        c('choix', 'Faire des choix', 'Making choices', 'tactique tactics', 'strategie.choix'),
        c('ressources', 'Gérer des ressources', 'Managing resources', 'gestion économiser saving', 'gestion.ressources')
      ] },
      { id: 'attention', nom: { fr: 'Attention', en: 'Attention' }, cases: [c('concentration', 'Rester concentré', 'Staying focused', 'concentration focus')] }
    ] },
    { id: 'autres', nom: { fr: 'Moi et les autres', en: 'Me and others' }, couleur: '#ff7fa8', glyphe: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z', sous: [
      { id: 'emotions', nom: { fr: 'Mes émotions', en: 'My feelings' }, cases: [
        c('perdre', 'Accepter de perdre', 'Accepting defeat', 'frustration persévérance colère recommencer anger perseverance', 'emotions.frustration'),
        c('ressentir', 'Dire ce que je ressens', 'Saying how I feel', 'émotions emotions'),
        c('confiance', 'Confiance en moi', 'Self-confidence', 'timide shy')
      ] },
      { id: 'les-autres', nom: { fr: 'Les autres', en: 'Others' }, cases: [
        c('empathie', 'Empathie', 'Empathy', 'gentil comprendre kind'),
        c('cooperer', 'Coopérer', 'Working together', 'copains amis équipe friends team'),
        c('attendre', 'Attendre son tour', 'Waiting your turn', 'politesse patience'),
        c('reconcilier', 'Se réconcilier', 'Making up', 'dispute conflit fight conflict')
      ] }
    ] },
    { id: 'corps', nom: { fr: 'Le corps', en: 'The body' }, couleur: '#c6e85a', glyphe: 'M13 3 5 14h6l-1 7 8-11h-6z', sous: [
      { id: 'bouger', nom: { fr: 'Bouger', en: 'Moving' }, cases: [
        c('reflexes', 'Réflexes', 'Reflexes', 'précision esquive dodge', 'motricite.reflexes'),
        c('coordination', 'Coordination', 'Coordination', 'équilibre balance sport')
      ] },
      { id: 'soin', nom: { fr: 'Prendre soin', en: 'Taking care' }, cases: [
        c('sommeil', 'Sommeil', 'Sleep', 'dormir'),
        c('manger', 'Manger', 'Eating', 'nourriture food')
      ] }
    ] }
  ];

  var CASES = [];
  BRANCHES.forEach(function (b) {
    b.sous.forEach(function (s) {
      s.cases.forEach(function (x) {
        x.id = b.id + '.' + s.id + '.' + x.id;
        x.branche = b; x.sousBranche = s; x.jeux = [];
        CASES.push(x);
      });
    });
  });

  function caseDe(id) { return CASES.filter(function (x) { return x.id === id; })[0] || null; }
  function caseDuDomaine(d) { return CASES.filter(function (x) { return x.domaine === d; })[0] || null; }

  // Relie les jeux aux cases d'après leurs fiches. Une notion sans case n'est pas perdue : elle revient dans « orphelines ».
  function relier(jeux) {
    var orphelines = [];
    CASES.forEach(function (x) { x.jeux = []; });
    jeux.forEach(function (g) {
      ((g.learning && g.learning.domains) || []).forEach(function (d) {
        var x = caseDuDomaine(d);
        if (x) x.jeux.push(g); else orphelines.push(d);
      });
    });
    return orphelines;
  }
  function casesDuJeu(g) { return CASES.filter(function (x) { return x.jeux.indexOf(g) !== -1; }); }

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function texte(o, lang) { return o ? (o[lang] || o.fr || '') : ''; }

  // Tous les mots doivent se retrouver : un sujet par son nom, sa famille et ses mots voisins ; un jeu par son nom et sa fiche.
  function chercher(q, lang, jeux) {
    var mots = norm(q).split(/\s+/).filter(Boolean);
    if (!mots.length) return { cases: [], jeux: [] };
    function tous(hay) { return mots.every(function (m) { return hay.indexOf(m) !== -1; }); }
    return {
      cases: CASES.filter(function (x) {
        return tous(norm([x.nom.fr, x.nom.en, x.sousBranche.nom.fr, x.sousBranche.nom.en, x.branche.nom.fr, x.branche.nom.en, x.mots].join(' ')));
      }),
      jeux: jeux.filter(function (g) {
        return tous(norm([texte(g.title, lang), texte(g.pitch, lang), g.learning ? texte(g.learning.what, lang) : ''].join(' ')));
      })
    };
  }

  // Ce que la progression dit d'une notion, sans rien en déduire.
  function faits(st, domaine) {
    var out = { n: 0, ok: 0, reussies: [], ratees: [] };
    if (!st || !st.skills) return out;
    Object.keys(st.skills).forEach(function (k) {
      if (k.indexOf(domaine + '/') !== 0) return;
      var s = st.skills[k], item = k.slice(domaine.length + 1);
      out.n += (s.ok || 0) + (s.ko || 0);
      out.ok += s.ok || 0;
      if (s.streak >= 3) out.reussies.push(item);
      if (s.streak < 0) out.ratees.push(item);
    });
    return out;
  }

  function dernierJour(st) {
    var cles = Object.keys((st && st.days) || {}).map(function (k) {
      var p = k.split('-').map(Number);
      return new Date(p[0], p[1] - 1, p[2]);
    }).sort(function (a, b) { return b - a; });
    return cles[0] || null;
  }

  // État d'une case pour un enfant : aucun jeu, un jeu à essayer, un jeu joué, ou joué avec ce que l'enfant en a dit (appris, adoré).
  function etat(x, enfant) {
    if (!x.jeux.length) return 'vide';
    var av = enfant && enfant.avis && enfant.avis[x.id];
    if (av && (av.v === 'appris' || av.v === 'adore')) return av.v;
    var joue = enfant && x.jeux.some(function (g) { var st = enfant.games && enfant.games[g.id]; return st && st.ms > 0; });
    return joue ? 'joue' : 'essayer';
  }

  // La branche où ouvrir l'arbre : celle du jeu le plus joué, pour arriver sur ce que l'enfant connaît.
  function brancheDeDepart(jeux, enfant) {
    var defaut = BRANCHES[0].id, max = 0, id = null;
    jeux.forEach(function (g) {
      var st = enfant && enfant.games && enfant.games[g.id];
      if (st && st.ms > max) { max = st.ms; id = g; }
    });
    var cases = id ? casesDuJeu(id) : [];
    return cases.length ? cases[0].branche.id : defaut;
  }

  var api = { BRANCHES: BRANCHES, CASES: CASES, caseDe: caseDe, caseDuDomaine: caseDuDomaine, relier: relier, casesDuJeu: casesDuJeu, chercher: chercher, faits: faits, dernierJour: dernierJour, etat: etat, brancheDeDepart: brancheDeDepart };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LudiArbre = api;
})(this);
