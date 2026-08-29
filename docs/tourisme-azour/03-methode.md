# Plateforme touristique d'Azour — la méthode

Objectif : offrir aux visiteurs une plateforme (site web / application)
qui présente les parcours, informe et accompagne sur le terrain — le Shir,
les randonnées, le camping, les hébergements — et qui soit conçue dès le
premier jour pour être **dupliquée** : d'Azour au caza de Jezzine, puis à
l'échelle d'une région, potentiellement du pays.

La méthode tient en une phrase : **le contenu d'abord, le terrain comme
juge, la duplication comme contrainte d'architecture — pas comme une
promesse pour plus tard.**

## Ce qui rend ce projet particulier

1. **Il a déjà un ancrage physique financé.** Sentiers balisés, panneaux,
   tablettes, kiosque, jeunes guides : la plateforme est la couche
   numérique de lignes budgétaires existantes (2 900 € « structuration de
   l'offre de randonnée » + 3 200 € « panneaux et tablettes »), pas une
   app hors-sol.
2. **Le réseau est inégal sur les sentiers.** Le hors-ligne n'est pas une
   option de confort, c'est le cœur du produit.
3. **Trois langues à égalité** : arabe (droite-à-gauche), français,
   anglais — habitants, diaspora, visiteurs internationaux.
4. **La maintenance sera locale et non technique.** Ce que la
   municipalité, l'office ou les jeunes guides ne peuvent pas mettre à
   jour eux-mêmes mourra à la fin du programme.
5. **Le budget est modeste.** Chaque choix technique doit viser un coût
   récurrent quasi nul (objectif : < 300 €/an hébergement et domaine
   compris).

## Les six phases

### Phase 0 — Cadrage (septembre 2026, ~2 semaines)
- Valider la vision produit et le périmètre exact de la V1 (MoSCoW).
- Choisir le nom et la marque (voir questions ouvertes : que recouvre
  « l'offre S Chehab » évoquée ?).
- Nommer les rôles : un responsable produit côté LEY/Azour, un groupe
  contenu (jeunes guides + municipalité), le développement (REFLEY).
- Arbitrer : socle sur mesure (PWA Next.js + Supabase, stack déjà
  maîtrisée sur Solid'Pilot) ou solution existante type Geotrek —
  arbitrage documenté dans `02-benchmark.md`.
- Prendre trois contacts qui éclairent tout le reste : **Ehmej** (le
  précédent « village de randonnée », 12 éco-sentiers, side trail LMT),
  **jezzinetourism.com / Union des municipalités** (le portail du caza
  n'a pas de page Azour : s'y adosser plutôt que le doublonner), et la
  **LMTA** (l'appui au trail 2027 est déjà prévu — élargir la discussion
  au side trail officiel « Azour »).

### Phase 1 — Collecte terrain et contenus (septembre → novembre 2026)
C'est la phase la plus importante et la plus sous-estimée : une
application vide est pire que pas d'application. Elle ne part pas de
zéro : **l'étude des sentiers** (`06-etude-des-sentiers.md`) définit
déjà les trois parcours, leurs chiffres et leur récit naturaliste.

- **Récupérer les tracés existants** : les cartes de l'étude sont des
  captures Google Earth avec tracés dessinés — demander le KML/KMZ à
  l'auteur, convertir en GPX/GeoJSON, puis **vérifier sur le terrain**
  avec les jeunes guides (le relevé est aussi une formation) — la ligne
  « mapping, topographie » du budget est là pour ça.
- **Fiche type par parcours** (protocole unique) : distance, dénivelé,
  durée, difficulté, saison conseillée, points d'eau, ombre, dangers,
  accès et stationnement, point de départ précis.
- **Points d'intérêt** : le Shir, points de vue, patrimoine, camping
  El Abo - Le Cave, hébergements et maisons d'hôtes, restaurants et
  producteurs, numéros utiles et urgences.
- **Photos** : une campagne sérieuse (golden hour, drone si possible) —
  la qualité photographique EST le design d'une app de tourisme.
- **Textes** en trois langues, courts, écrits pour être lus debout sur un
  sentier. Les récits des anciens et des jeunes valent mieux qu'une
  brochure : c'est la voix d'Azour.
- **Semer les canaux mondiaux dès cette phase** : cartographier les
  sentiers dans OpenStreetMap (ils apparaissent alors dans Organic Maps,
  Komoot, Gaia…), créer le compte officiel « Azour » sur Wikiloc — comme
  le fait la LMTA — et préparer les fiches AllTrails. Être la source de
  vérité, diffuser partout : l'inverse du réflexe « tout sur mon site ».

### Phase 2 — Design (octobre → novembre 2026, en recouvrement)
- 4 personas et leurs parcours (avant / pendant / après la visite).
- Arborescence et wireframes basse fidélité, testés sur papier avec des
  jeunes guides et un élu municipal.
- Design system (couleurs, typographie trilingue, composants) puis
  maquettes haute fidélité mobile — direction détaillée dans
  `04-design-ux-ui.md`.

### Phase 3 — Développement du MVP (novembre 2026 → février 2027)
Périmètre V1 (« must ») :
- Fiches parcours complètes avec carte, profil altimétrique, GPX.
- Carte interactive fonctionnant hors-ligne une fois le parcours ouvert.
- Mode « sur le sentier » : ma position sur la trace, prochain point.
- Pages POI reliées aux panneaux du terrain par QR code.
- Rubrique pratique : dormir, manger, guides (contact WhatsApp direct),
  urgences. La « réservation » V1 est celle qui marche vraiment au
  Liban : bouton WhatsApp + téléphone — un moteur de réservation
  viendra si l'usage le demande.
- Un **bandeau « état d'accès » daté** (sentier ouvert/fermé, saison,
  route, situation) : personne ne le fait au Liban, c'est à la fois un
  manque identifié au benchmark et un gage de sérieux vis-à-vis des
  partenaires — l'axe Saïda–Jezzine reste déconseillé par la fiche
  France Diplomatie du 13/03/2026.
- Trois langues, dont l'arabe en droite-à-gauche natif.
- Back-office simple pour l'équipe locale (textes, photos, horaires) —
  et **tout ce qui identifie le territoire y est paramétrable** (arbitrage
  du 29/08, exigence « scalable ») : nom et logo (« Visit Azour » en nom
  de travail), couleurs, langues actives, contacts et **numéro
  d'information du kiosque** (communiqué plus tard — il s'affichera
  partout dès sa saisie), liste des hébergements. Rien de propre à Azour
  n'est codé en dur : dupliquer un territoire = créer une configuration,
  pas un logiciel.
- Cette logique va jusqu'aux **coordonnées GPS elles-mêmes** (arbitrage
  du 29/08 au soir) : points saisis au back-office (coller, cliquer sur
  la carte, ou « prendre ma position » sur le terrain), traces importées
  en GPX/KML avec calculs automatiques et prévisualisation avant
  publication — la carte et les parcours évoluent sans redéploiement.
  Modèle complet et impacts : `07-modele-de-donnees.md`.
- La fiche du sentier « Hyrax Rock » (accès guidé par cordes uniquement)
  inaugure le gabarit « expérience encadrée » : pas de bouton
  « télécharger le GPX » mais « réserver avec un guide » (WhatsApp).

Hors V1 (« later ») : avis et notes, réservation en ligne, audio-guides,
compte utilisateur, gamification, agenda avancé, application vitrine des
autres villages.

### Phase 4 — Kiosque et terrain (mars → mai 2027)
- Kiosque : les tablettes budgétées passent en « mode kiosque » (session
  qui se réinitialise, grand écran d'accueil, sortie systématique par QR
  « emportez Azour dans votre poche »).
- Panneaux : chaque panneau imprimé porte le QR du POI ou du parcours
  correspondant — le lien entre les deux budgets (panneaux + plateforme)
  se décide à l'impression, donc tôt.
- Tests terrain en conditions réelles : parcours complets téléphone en
  main, en mode avion, par des personnes extérieures au projet.
- Formation du groupe contenu au back-office : l'autonomie locale est un
  livrable au même titre que l'app.

### Phase 5 — Lancement (été 2027)
Deux rampes de lancement offertes par le programme :
- la **randonnée d'inauguration** (presse, élus, diaspora) ;
- le **trail d'Azour 2027** — 250 participants attendus, dossards avec QR,
  parcours du trail publié dans l'app, billetterie via ihjoz et
  référencement Ahotu/UTMB Index (précédent : la Spring LMT Race de
  Maasser el-Chouf).
Et un canal qui compte plus que la publicité : **les clubs de randonnée**
(Vamos Todos, Promax, HighKings, LOA…) — c'est eux qui amènent les bus du
dimanche. Leur préparer une offre groupe clé en main (guides, repas,
camping) et une page dédiée, relayer chaque sortie sur Lebtivity.
Mesure dès le premier jour (voir indicateurs), recueil de retours à chaud
au kiosque, itérations rapides pendant la saison.

### Phase 6 — Duplication (fin 2027 →)
L'architecture est multi-territoire dès la V1 (un « territoire » = un
ensemble de parcours, POI, contacts, langues) mais on ne l'ouvre qu'après
une saison réussie à Azour :
1. **Jeïta** en premier — le diagnostic « office de tourisme local » de la
   triade jumelle est déjà budgété (3 000 €), le terrain d'entente existe.
2. Le **caza de Jezzine** (gabarit « 1 modèle de village × N villages »,
   en s'adossant à jezzinetourism.com et à l'Union des municipalités —
   28 communes). C'est à cette échelle qu'une instance **Geotrek
   mutualisée** redevient pertinente (une base, N portails — le modèle
   des départements français), et que la contribution arabe/RTL à
   Geotrek, inexistante à ce jour, devient un projet de coopération
   finançable en soi.
3. L'échelle **régionale puis nationale** : une marque + un agrégateur
   au-dessus des instances locales (modèle MaRando/Geotrek-Agrégateur),
   gouvernance type SuisseMobile — un standard commun (balisage,
   numérotation, données) porté avec la LMTA et le ministère plutôt
   qu'une plateforme de plus. Le produit devient un bien commun, sa
   gouvernance doit suivre.

## Le portage budgétaire proposé (arbitrage demandé le 29/08)

La plateforme doit être portée par une ligne existante. Lecture du
budget transposé (`web/docs/donnees-cem-liban/budget-cem-azour.csv`) :

| Quoi | Ligne | Montant | Pourquoi elle |
|---|---|---|---|
| **La plateforme elle-même** (développement, cartes, hébergement, back-office) | « **Structuration d'une offre de randonnée cohérente avec mapping, topographie, renforcement des offices touristiques locaux** » — MEAE, 1 450 € (2026) + 1 450 € (2027), décaissement LEY puis Azour | 2 900 € | L'intitulé dit exactement ce que fait la plateforme : structurer l'offre (fiches normalisées), mapping/topographie (les tracés), outil de l'office touristique local (le kiosque). Justificatifs attendus « devis + facture prestation/étude » : une prestation de développement s'y range naturellement. À répartir avec les relevés terrain qui émargent sur la même ligne (ex. 2026 : relevés + MVP ; 2027 : finitions + amorce de duplication) |
| **Le matériel du kiosque et le lien terrain** (tablettes, supports, impression des QR sur les panneaux) | « **Dotation d'équipement pour la réalisation des sensibilisations (panneaux explicatifs, tablettes, etc.)** » — YCID, 2026 | 3 200 € | C'est la ligne des panneaux et des tablettes ; le QR s'imprime avec le panneau, la tablette porte le mode kiosque |
| **La campagne photo/vidéo** (en complément, si le COPIL l'accepte) | « **Communication (photo, vidéo, documentaire)** » — volet Coordination, YCID porteur, 2026 | 3 000 € | Les images produites pour la communication du programme sont exactement celles dont l'app a besoin — une seule campagne, deux usages. Ligne du volet commun : à proposer au COPIL |
| **La page trail et ses QR dossards** | « Trail annuel à Azour » — MEAE, 2026 et 2027 | 2 000 €/an | La communication du trail inclut naturellement sa page dans l'app et la billetterie |

Toutes ces lignes sont au statut « prévue » : la première dépense passe
par un devis validé dans le circuit LEY → Azour, comme le veut le
programme. Concrètement : établir le devis de la prestation plateforme
sur la ligne « Structuration » est l'acte qui lance la phase 0.

## Les indicateurs de réussite

| Indicateur | Cible saison 2027 |
|---|---|
| Visiteurs uniques de la plateforme | 3 000 |
| Parcours consultés hors-ligne / téléchargés | 800 |
| Scans de QR (panneaux + kiosque + dossards) | 1 000 |
| Contacts établis (guides, hébergements, camping) | 150 |
| Sorties de clubs de randonnée accueillies à Azour | 6 |
| Contenus publiés par l'équipe locale sans assistance | 20 mises à jour |
| Répartition des langues d'usage | suivi (pas de cible) |

Ces chiffres sont des ordres de grandeur à confirmer en phase 0 ; ils
s'ajoutent aux indicateurs MEAE existants (7 km de sentiers, 250
participants au trail) sans les remplacer.

## Les risques et leur parade

| Risque | Parade |
|---|---|
| App vide ou datée après le programme — le cimetière libanais des portails de bailleurs (destinationlebanon.gov.lb mort, Dhiafee éteint…) | Phase 1 massive, back-office simple, groupe contenu formé, objectif « 20 mises à jour locales », **domaine et hébergement payés 5 ans d'avance**, coûts récurrents < 300 €/an |
| Réseau/électricité inégaux | Hors-ligne par défaut, app légère, kiosque autonome |
| Contexte sécuritaire (axe Saïda–Jezzine déconseillé par la France au 13/03/2026) | Publics de départ réalistes (Libanais + diaspora), bandeau « état d'accès » daté et honnête, contenu qui reste valable quand la situation s'améliore |
| Dupliquer trop tôt et se disperser | Une saison réussie à Azour avant toute extension |
| Refaire ce qui existe (LMT, jezzinetourism.com, apps privées…) | Positionnement complémentaire : profondeur locale + adossement au portail du caza + publication des traces sur les plateformes mondiales (voir benchmark) |
| Dépendance à un prestataire | Open source, données exportables (GPX/GeoJSON), documentation |

## Le calendrier en une ligne

Cadrage sept. 2026 → contenus + design automne 2026 → MVP hiver →
kiosque + tests printemps 2027 → lancement à l'inauguration et au trail
2027 → duplication ensuite.
