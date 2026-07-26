# Règles de livraison

Trois des huit pannes recensées avant la bêta n'étaient ni des bugs ni
des erreurs de conception. C'étaient des erreurs de **livraison** :

- un commit poussé mais absent de master, avec un déploiement annoncé à
  tort ;
- un `push --force` qui a effacé le contenu d'une branche ;
- huit commits poussés sans PR ouverte — l'écran attendu n'était donc
  pas en ligne, et personne ne le savait.

Aucun test ne les attrape. Elles se préviennent par la méthode.

---

## 1. Ne jamais annoncer un déploiement sans l'avoir vérifié

Un `git push` réussi ne prouve rien : ni que la PR est mergée, ni que
master contient le commit, ni que le déploiement a tourné.

**Avant d'écrire « c'est en ligne »**, les trois :

```bash
git fetch origin master
git merge-base --is-ancestor <sha> origin/master && echo "dans master"
```

puis vérifier que la dernière exécution du workflow de déploiement porte
bien ce SHA **et** conclut en succès.

La formulation compte autant que la vérification : dire « poussé, PR à
merger » quand c'est le cas, et réserver « en ligne » à ce qui a été
constaté. La confusion entre les deux a coûté une demi-journée de
recherche sur un écran qui n'existait pas encore.

## 2. Un push sans PR ouverte n'existe pas

Après le merge d'une PR, la branche continue de vivre : les commits
suivants partent dans le vide tant qu'une nouvelle PR ne les reprend
pas. C'est arrivé sur huit commits d'affilée.

**Règle** : après chaque merge, soit on ouvre immédiatement la PR
suivante, soit on repart de master.

```bash
git fetch origin master
git checkout -B <branche> origin/master
```

## 3. Le force-push se justifie, ou ne se fait pas

`--force` a effacé un plan de test et un jeu de données qu'il a fallu
récupérer commit par commit. Quand il est vraiment nécessaire :

```bash
git push --force-with-lease
```

`--force-with-lease` refuse d'écraser ce qu'on n'a pas vu. Ce n'est pas
une précaution de plus : c'est la seule qui distingue « je réécris mon
travail » de « j'efface celui d'un autre ».

## 4. Toute suppression de colonne se termine par une recherche

La 0033 a supprimé `phases.budget`. La page projet, qui sélectionne
`*`, n'a rien vu ; le rapport IA, qui nommait la colonne, a échoué en
silence pendant une journée.

`npm run check:selects` fait désormais cette recherche automatiquement,
et la CI la lance sur chaque PR. **La règle subsiste pour ce que le
contrôle ne voit pas** : les listes construites dynamiquement, les
filtres `.eq('colonne', …)`, les `order('colonne')`.

## 5. Le SQL se colle dans la conversation

Les migrations vivent dans `web/supabase/migrations/`, mais elles
s'exécutent à la main dans le SQL Editor. Le contenu à exécuter est
donné **dans la conversation**, prêt à copier — chercher un fichier dans
GitHub au moment de l'exécution fait perdre du temps et fait coller la
mauvaise version.

Pour un rattrapage de plusieurs migrations : un fichier unique,
idempotent, avec un bloc de vérification final qui ne modifie rien.

---

## Ce que la CI couvre désormais

`.github/workflows/ci.yml`, sur chaque PR vers master :

| Contrôle | Panne visée |
|---|---|
| `tsc --noEmit` | ruptures de type |
| `check:selects` | colonne demandée absente du schéma |
| `check:rbac` | matrice des droits ≠ policies |
| `build` | ce que ferait le déploiement, mais avant le merge |
| `lint` | informatif — 91 erreurs de dette, à passer bloquant une fois résorbée |

Les deux contrôles maison sont **vérifiés par injection de régression** :
on y réintroduit la panne historique et on constate qu'ils la
signalent. Un contrôle qui ne casse jamais ne prouve rien.
