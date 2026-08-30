# Visit Azour — audit design

Audit du 29/08/2026, avant la passe « guide de terrain ». Périmètre :
**apparence uniquement**. Aucun texte, aucune traduction, aucune donnée,
aucune route, aucune fonctionnalité ne change.

## 1. Périmètre inspecté

| Zone | Fichiers |
|---|---|
| Styles | `app/globals.css` (189 lignes — tokens, composants, marqueurs de carte) |
| Coquille | `app/layout.tsx`, `app/(site)/layout.tsx`, `components/AppNav.tsx`, `components/LangSwitcher.tsx`, `components/EtatAccesBanner.tsx` |
| Pages publiques | accueil, `parcours`, `parcours/[slug]`, `parcours/[slug]/sentier`, `explorer`, `explorer/[slug]`, `pratique`, `agenda`, `a-propos` |
| Composants | `ParcoursCard`, `ParcoursMeta` (badges + StatsRow), `PackHorsLigne`, `SentierMode`, `KiosqueClient`, `carte/MapView` |
| Aligné sans refonte | `admin/AdminClient` (outil interne), `app/kiosque` (déjà spécifique) |

## 2. Ce que l'inventaire montre

**L'effet « template » est mesurable, pas une impression :**

- **25 usages de la classe `.card`** répartis sur 12 fichiers. Presque
  chaque bloc de contenu est une carte : parcours, POI, hébergement,
  agenda, sécurité, saison, accès, kiosque, QR, statut hors-ligne.
- **8 valeurs de rayon** coexistent : `rounded-xl` (×15), `rounded-full`
  (×10), `rounded-lg` (×8), `rounded-3xl` (×4), `rounded-2xl` (×3), plus
  `999px`, `16px` et `14px` en CSS. Aucune règle ne dit laquelle sert à quoi.
- **La carte porte trois effets à la fois** : fond de surface + bordure
  1 px + ombre diffuse (`0 1px 2px` et `0 8px 24px`) + rayon 16 px. C'est
  précisément la recette qui fait « composant généré ».
- **18 tailles de police en dur** (`text-[13px]` ×26, `text-[13.5px]` ×18,
  `text-[15px]` ×16, `text-[12.5px]`, `text-[14.5px]`…). Il n'existe pas
  d'échelle : chaque écran a été réglé à l'œil.
- **Rythme vertical uniforme** : titre → paragraphe → carte → carte →
  carte, sans respiration ni changement de densité. Sur la fiche parcours,
  cinq blocs consécutifs partagent le même gabarit visuel.
- **Les cinq chiffres clés sont cinq tuiles encadrées** — la signature
  visuelle d'un tableau de bord, pas d'un guide.
- **8 troncatures** (`truncate`) coupent des titres de lieux au milieu
  d'un mot, dont « Boucle de la forêt d'Azour et de la falaise… ».

**Contrastes mesurés** (WCAG, sur `--surface`) — meilleurs qu'attendu,
sauf un :

| Token | Clair | Sombre | Verdict |
|---|---|---|---|
| `--encre` | 14,54 | 13,45 | AA |
| `--encre-2` | 6,09 | 7,27 | AA |
| **`--encre-3`** | **3,62** | **4,30** | **échec AA texte** |
| `--pin` | 8,19 | 7,12 | AA |
| `--ocre` | 4,80 | 6,70 | AA |

Le seul vrai défaut de lisibilité est `--encre-3`, utilisé pour les
mentions et les crédits. Corrigé en `#687168` (4,92 clair) et `#889287`
(4,99 sombre).

**La carte** utilise le style public par défaut : ses verts saturés et
ses routes jaunes appartiennent à un autre univers que le calcaire et le
pin de l'application. Le tracé, lui, est correct mais fin.

**Le thème.** L'application est **claire par défaut** (calcaire `#F4F2E8`)
avec un mode sombre automatique — arbitrage confirmé le 29/08 : la
lisibilité en plein soleil sur le sentier prime, le sombre sert le soir
et la batterie. Le « vert-noir + menthe » perçu était le mode sombre et
le mode sentier.

## 3. Direction : « guide de terrain », pas « dashboard sombre »

Quatre motifs tirés du sujet lui-même — c'est ce qui distingue une
interface enracinée d'un thème générique :

1. **La balise de sentier** (deux traits horizontaux, pin sur ocre) —
   le balisage que le programme installe justement sur les chemins
   d'Azour. Elle devient le marqueur de section, l'état actif de la
   navigation, et le repère des blocs d'alerte.
2. **La courbe de niveau** — l'étude des sentiers est topographique ;
   un tracé de courbes en très faible opacité habille les blocs
   éditoriaux, sans image ni dépendance.
3. **Le registre d'instrument** : toutes les mesures (distances,
   dénivelés, altitudes, coordonnées) en chiffres tabulaires
   monospace — le carnet de terrain, pas le widget.
4. **Le fil du sentier** : les étapes numérotées deviennent un fil
   vertical en pointillés qui rejoue la trace de la carte, au lieu
   d'une pile de cartes identiques.

**Typographie.** On quitte le duo « grotesque display + grotesque
texte », très répandu. Titres en **Fraunces** (serif variable, à
l'optique éditoriale — un registre de guide imprimé), texte en **IBM
Plex Sans** (conservé : sa jumelle **Plex Sans Arabic** est indispensable
au trilingue), mesures en **IBM Plex Mono**. Aucune police ajoutée en
nombre : Bricolage Grotesque est retiré.

## 4. Plan de modification

| # | Chantier | Effet attendu |
|---|---|---|
| 1 | **Tokens** : 3 rayons (`pill` 999, `card` 14, `media` 6), échelle 8/12/16/24/32/48, ombres réduites à deux niveaux discrets, filets à faible opacité, échelle typographique fluide, `--encre-3` corrigé | Fin de l'arbitraire ; les 8 rayons et 18 tailles disparaissent |
| 2 | **Composants** : `FeaturedCard`, `ActionCard`, `ListRow`, `InfoNotice`, `MapPanel`, `StatBand`, `SectionHeading`, `Waypoints` | Le secondaire passe en lignes à filets ; la carte redevient l'exception qui signale l'important |
| 3 | **Pages** : application des variantes, alternance des densités (photo pleine largeur, ligne compacte, bloc éditorial, encart pratique) | Le rythme cesse d'être « carte, carte, carte » |
| 4 | **Chiffres clés** : `StatBand` (bande à filets) au lieu de cinq tuiles | Registre guide, pas tableau de bord |
| 5 | **Carte** : harmonisation des couleurs du fond au runtime (désaturation + virage terre/forêt), trace et marqueurs renforcés | La carte rejoint l'univers ; attributions et contrôles intacts |
| 6 | **Coquille** : header qui se compacte au scroll, navigation basse allégée et safe-area iOS | Moins d'espace confisqué, moins de masse visuelle |
| 7 | **Lisibilité** : `--encre-3` AA, secondaires remontés à 14 px, troncatures remplacées par un `line-clamp` stable à 2 lignes | Plus de titres coupés au milieu d'un mot |

**Ce que l'audit ne touchera pas** : textes, traductions, libellés,
données, dates, routes, liens, fonctionnalités, framework, MapLibre,
next-intl, attributions cartographiques. Aucune dépendance ajoutée.
