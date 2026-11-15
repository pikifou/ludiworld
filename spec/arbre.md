# L'arbre des compétences

Le découpage vit dans `docs/site/arbre.js`. Aujourd'hui, ses branches donnent les pictogrammes et le filtre « ce que ça apporte » de la page des jeux (`docs/les-jeux/`).

Explorer (`docs/explorer/`) est construit mais caché : il n'est lié nulle part tant qu'il n'y a pas beaucoup plus de jeux. Il montre les compétences sous forme d'arbre à monter : huit branches, chacune découpée en colonnes, chaque colonne en cases rangées du plus simple en bas à ce qui s'appuie dessus en haut. Une case avec une image est un jeu qui fait travailler ce sujet ; une case avec un + n'a pas encore de jeu.

## Les règles
- Rien ne rappelle l'école : ni niveau, ni classe, ni note. Les matières servent seulement à ranger les sujets. Le chemin est ouvert : aucune case ne se débloque.
- L'arbre va au-delà du savoir (« Moi et les autres », « Le corps »).
- Une case n'a un jeu que si sa fiche le déclare dans `learning.domains`. On ne relie rien à la main.
- On n'affiche que ce qui est enregistré : le temps, les parties, les réponses envoyées par `Ludi.skill`, et ce que l'enfant a choisi de dire. Un jeu sans `Ludi.skill` ne dit que le temps.
- Pas de score sur une case : ni total de réponses ni pourcentage. On cite ce qui est trouvé et ce qui reste à essayer, sans le mot « raté ».

## Relier un jeu
1. Dans la fiche, déclarer la notion (`spec/domaines.md`).
2. Si la notion est nouvelle, la donner à une case dans `docs/site/arbre.js`, avec le dernier argument de `c(id, fr, en, mots, domaine)`. Un test le vérifie.

Ajouter une case, c'est ajouter une ligne dans sa colonne, à la place qui respecte la montée. Les `mots` servent à la recherche (synonymes, dans les deux langues).

## Ce qui est enregistré
Dans le profil de l'enfant, à côté de ses statistiques :
- `avis[idCase] = { v: 'appris' | 'adore' | 'bof' | null, t }` : ce qu'il dit, s'il veut.
- `envies[idCase] = { v: true | false, t }` : les sujets sans jeu qui font envie.

Les deux se fusionnent case par case entre appareils, et n'ont pas besoin du code parent. Installer ou désinstaller un jeu le demande.
