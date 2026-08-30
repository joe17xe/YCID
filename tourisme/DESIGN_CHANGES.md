# Visit Azour — journal de la passe design

Passe « guide de terrain », 29/08/2026. Suite de `DESIGN_AUDIT.md`.
**Aucun texte, aucune traduction, aucune donnée, aucune route, aucune
fonctionnalité n'a changé.** Aucune dépendance ajoutée.

## 1. Fichiers touchés

| Fichier | Nature |
|---|---|
| `app/globals.css` | Réécrit — système de tokens complet |
| `app/layout.tsx` | Police de titre : Bricolage Grotesque → Fraunces |
| `app/(site)/layout.tsx` | Coquille : header extrait, espacements en tokens, safe-area |
| `app/(site)/page.tsx` | Accueil recomposé (mêmes sections, même ordre) |
| `app/(site)/parcours/page.tsx` | En-tête + carte encadrée |
| `app/(site)/parcours/[slug]/page.tsx` | Fiche recomposée : bande de mesures, encarts, fil des étapes |
| `app/(site)/explorer/page.tsx` | Cartes → lignes de liste |
| `app/(site)/explorer/[slug]/page.tsx` | Traitement éditorial |
| `app/(site)/pratique/page.tsx` | Cartes → lignes ; urgences en bloc unifié |
| `app/(site)/agenda/page.tsx` | Cartes → articles séparés par filets |
| `app/(site)/a-propos/page.tsx` | Traitement éditorial + texture |
| `components/AppNav.tsx` | Barre basse allégée, marqueur de balise |
| `components/SiteHeader.tsx` | **Nouveau** — header compact au défilement |
| `components/ParcoursCard.tsx` | Réécrit sur `FeaturedCard` |
| `components/ParcoursMeta.tsx` | `StatsRow` retiré (remplacé par `StatBand`) ; badges conservés |
| `components/SentierMode.tsx` | Chrome flottant aligné sur les tokens |
| `components/KiosqueClient.tsx` | Rayons et espacements alignés |
| `components/carte/MapView.tsx` | Trace renforcée, harmonisation du fond |
| `components/carte/harmoniser.ts` | **Nouveau** — reteinte du fond au runtime |
| `components/ui/*` | **Nouveaux** — 8 composants (ci-dessous) |

## 2. Composants créés

| Composant | Rôle | Où |
|---|---|---|
| `SectionHeading` | Balise + surtitre + titre, avec action optionnelle | toutes les pages |
| `FeaturedCard` | Traitement éditorial : l'image porte le bloc | parcours |
| `ActionCard` | La seule surface « carte + filet », pour l'action | accueil |
| `ListRow` | Ligne à filet, vignette ou pictogramme | accueil, explorer, pratique |
| `InfoNotice` | Encart terrain à filet de balise (neutre/vigilance/danger) | fiche parcours |
| `MapPanel` | Cadre de carte à rayon faible + légende | parcours, fiche, explorer, POI |
| `StatBand` | Les mesures en bande à filets, chiffres d'instrument | fiche parcours |
| `Waypoints` | Fil de sentier en pointillés, numéros des panneaux | fiche parcours |

## 3. Règles de design adoptées

**Trois rayons, et une affectation stricte** — `--r-pill` (999 px) pour
les étiquettes et contrôles, `--r-card` (14 px) pour les cartes
fonctionnelles et les boutons, `--r-media` (6 px) pour images, cartes
géographiques et blocs éditoriaux. Les 8 valeurs relevées à l'audit ont
disparu.

**Jamais quatre effets à la fois.** Une surface porte au plus deux
signes parmi : teinte, filet, ombre, rayon. `.card` (surface + filet +
ombre légère) est réservée à ce qui appelle une action ; `.bloc`
(teinte seule) porte l'éditorial ; `.ligne-liste` (filet seul) porte le
secondaire.

**Espacement** : 8 · 12 · 16 · 24 · 32 · 48 (`--s1`…`--s6`), utilisés
partout — plus de valeurs réglées à l'œil.

**Ombres** : deux niveaux seulement. `--ombre-pose` (1 px, à peine
perceptible) pour les cartes, `--ombre-flottante` pour ce qui survole
la carte en mode sentier. L'ombre diffuse systématique a disparu.

**Typographie** : échelle fluide (`--t-display` → `--t-micro`), titres
en Fraunces (serif éditorial, repli Georgia), texte en IBM Plex Sans,
**toutes les mesures en IBM Plex Mono tabulaire**. L'arabe garde IBM
Plex Sans Arabic, plus grand, sans interlettrage.

**Motifs propres au sujet** : la balise de sentier (deux traits pin/ocre)
en marqueur de section, en repère d'onglet actif et en filet d'encart ;
les courbes de niveau en texture des blocs éditoriaux (CSS pur) ; le fil
de sentier en pointillés pour les étapes.

**Troncature** : une seule règle, `.clamp-2` (deux lignes) et
`.clamp-1`. Les `truncate` qui coupaient les noms de lieux au milieu
d'un mot ont été remplacés.

**Contraste** : `--encre-3` passé de `#7e877d` (3,62 — échec AA) à
`#687168` en clair (4,92) et `#889287` en sombre (4,99). Les textes
secondaires sont remontés de 13 px à 14 px (`--t-small`).

## 4. Cartographie

Le fond public arrive avec des verts saturés et des routes jaunes.
Plutôt que de figer un style maison — invérifiable ici, et cassant si le
schéma de tuiles évolue — `harmoniser.ts` **reteinte au runtime** les
couleurs littérales du style effectivement chargé : désaturation à 42 %,
puis 16 % de calcaire mélangé. Marche avec n'importe quel fond.

Garde-fous : les couches de l'application (préfixe `va-`) sont
épargnées, donc la trace garde toute sa vivacité ; les couleurs définies
par expression sont laissées intactes ; tout est encadré de `try/catch`.
La trace est renforcée (gaine claire de 8 px + trait de 4 px, tirets
pour un tracé provisoire) et les marqueurs d'étape passent à 24 px avec
leur numéro en mono.

**Contrôles, échelle et attributions MapLibre : inchangés.** Le repli
sur fond calcaire en cas de tuiles injoignables est conservé.

**Limite** : les tuiles sont bloquées dans l'environnement de
développement — l'harmonisation est vérifiée structurellement (types,
lint, build, non-régression du repli) mais **son rendu réel reste à
juger en production**. Si le résultat déplaisait, une seule ligne
(`NEXT_PUBLIC_MAP_STYLE`) change de fond, et retirer l'appel à
`harmoniserFond` restaure le style d'origine.

## 5. Header et navigation

- Le header se compacte dès 16 px de défilement : hauteur et corps du
  titre diminuent (transition de 0,18 s, neutralisée par
  `prefers-reduced-motion`). Le sélecteur de langue ne bouge jamais.
- La barre basse est plus fine (`--nav-h` 58 px), posée sur un filet
  plutôt qu'un bloc, avec un repère ocre sur l'onglet actif.
- `main` et `footer` réservent `--nav-h + env(safe-area-inset-bottom)` :
  aucun contenu ne passe derrière la barre (vérifié).

## 6. Tests effectués

| Test | Résultat |
|---|---|
| Débordement horizontal — 8 pages × 5 largeurs (320, 375, 390, 430, 768) | **aucun** (après correction de `StatBand` à 320 px) |
| Focus clavier visible | `outline: 2px solid` (jeton `--bisri`) |
| `prefers-reduced-motion: reduce` | transitions neutralisées |
| Bas de page masqué par la barre | non — dernier texte à 758 px, barre à 785 px |
| Cibles tactiles < 44 px | **aucune** |
| Contrastes WCAG | tous AA (voir audit) |
| `eslint` (règles React Compiler) | vert |
| `tsc --noEmit` | vert |
| `next build` | vert, 11 routes |
| RTL arabe | miroir complet vérifié en capture (balise, chevrons, onglet actif) |

**Correction issue des tests** : à 320 px, la bande de mesures poussait
la page à 351 px (la durée « 2 h 30 – 3 h » ne pouvait pas se replier).
Colonnes passées en `min-w-0`, valeurs autorisées à s'enrouler, corps
réduit sous 640 px.

## 7. Ce qui reste à juger sur un vrai iPhone, dehors

1. **Le fond de carte harmonisé** — invérifiable ici (tuiles bloquées).
2. **Fraunces** : la police de titre ne se charge pas dans
   l'environnement de développement, le repli Georgia s'affiche à sa
   place. Le rendu réel des titres est donc à confirmer.
3. **La lisibilité en plein soleil** : les contrastes sont AA sur le
   papier, mais seul le terrain dira si `--encre-2` suffit à midi sur la
   falaise. Le mode sombre, lui, est à juger en fin de journée.
4. **Le header compact** sur Safari iOS (barre d'URL qui se rétracte) :
   le comportement combiné mérite un essai réel.
5. **La texture de courbes de niveau** sur écran OLED en mode sombre —
   elle peut demander un point d'opacité en plus ou en moins.
