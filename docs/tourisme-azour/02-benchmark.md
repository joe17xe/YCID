# Plateforme touristique d'Azour — benchmark

Recherche menée le 29/08/2026 (web + dépôts GitHub). Deux volets : ce qui
existe au Liban, et les références internationales dont s'inspirer. Les
sources sont citées ; ce qui n'a pas pu être vérifié est dit tel quel en
fin de document.

## Volet 1 — Ce qui existe au Liban

### Le paysage en un tableau

| Offre | Type | État 08/2026 | À retenir pour Azour |
|---|---|---|---|
| **Lebanon Mountain Trail** (lebanontrail.org) | Web + traces GPS, pas d'app | Actif ; sections sud perturbées depuis 2024 ; maintenance web fragile (spam indexé sur le sous-domaine de réservation) | LA référence nationale : 470 km, 27 sections, guesthouses et guides villageois. Les **side trails** (dont **Bkassine, même caza**) montrent la voie ; les sections 21-22 passent près d'Azour. GPX par e-mail, trace officielle publiée… sur Wikiloc |
| **Ministère du Tourisme** | Web (mot.gov.lb) + app officielle | Ancien portail destinationlebanon.gov.lb **mort** (DNS vérifié) ; nouveau site actif ; app IA lancée le 12/08/2025 (Smartr AI) | Les sites peuvent **s'auto-enregistrer** dans l'app officielle — inscrire le Shir, El Abo et les sentiers dès qu'ils existent |
| **Jabal Moussa** (jabalmoussa.org) | Web | Actif, à jour | **L'étalon-or local** : 15 sentiers, tarifs affichés, réservation en ligne, carte PDF. Aucune réserve n'a d'app |
| **Réserve du Shouf** (shoufcedar.org) | Web | Actif | 250+ km de sentiers, institution solide — voisine de la vallée du Bisri : un corridor Barouk–Bisri–Azour se dessine |
| **jezzinetourism.com** | Web + office physique | Actif | **Seul portail touristique de caza du pays** : sentiers décrits, tours, agenda… mais pas de GPX, pas de réservation, et **pas de page Azour**. S'y adosser, pas le doublonner |
| **Ehmej** (ehmej.org) | Web municipal | Actif, vieillissant | **Le précédent direct** : « village de randonnée » avec 12 éco-sentiers cartographiés, side trail LMT, cartes gratuites à la municipalité. À contacter avant de concevoir |
| **Kazderni** | App iOS/Android | Actif — app tourisme n°1 du pays (208 000+ téléchargements) | Généraliste EN/**AR**, guesthouses et activités — y référencer Azour gratuitement ; contenu rando superficiel |
| **Jedo · Travel Lebanon · MOOVTOO** | Apps/web | Actifs | Agrégateurs privés jeunes ; MOOVTOO est le rare acteur **francophone** (annuaire de guides certifiés) |
| **DARB Hike &amp; Navigate** (darb-mea.com) | App rando | Lancée 2025, jeune | Premier essai d'« AllTrails du Machrek » : 16 sentiers au Liban, hors-ligne. Pérennité non prouvée |
| **Clubs de rando** (Vamos Todos, Promax, HighKings, LOA…) | Sites + Instagram/WhatsApp | Très actifs | **Le vrai canal de la pratique** : sorties dominicales en bus, 30 à 250 participants, découverte via Instagram/WhatsApp, agenda Lebtivity, billetterie ihjoz. C'est eux qu'une destination doit séduire |
| **Wikiloc** | App/web communautaire | Actif — la plateforme de fait des randonneurs libanais | Pages Jezzine/Bkassine existantes ; la LMTA y publie sa trace officielle. Y créer le compte « Azour » officiel |
| **AllTrails / Komoot / izi.TRAVEL** | Apps mondiales | Actives mais **quasi vides sur le Liban** (~15 itinéraires AllTrails pour tout le pays, ~18 Komoot, 0 audio-guide izi.TRAVEL) | Être premier y coûte peu — le créneau est vide |
| **OpenStreetMap Liban** | Base carto | Incomplet (« a lot of work to be done », wiki OSM) | Cartographier les sentiers d'Azour dans OSM les fait apparaître dans Organic Maps, Komoot, Gaia… |
| **Maisons d'hôtes** : L'Hôte Libanais (FR/EN), Guesthouses Lebanon ; **à Azour** : Blue Jay Valley, Pineview Hotel | Web | Actifs | Le réseau Dhiafee (ANERA/USAID) est éteint — exemple type du portail de bailleur non pérennisé. À Azour même, deux hébergeurs privés existent déjà : les associer |

### Le contexte d'usage (vérifié 2025-2026)

- **Connectivité** : 91,8 % de pénétration internet, débit mobile médian
  43,9 Mbps — le smartphone est universel, la 4G correcte mais inégale en
  montagne (DataReportal 2026).
- **Électricité** : 12-16 h/jour d'EDL en 2025, solaire massif ; les
  coupures restent la norme — tout service doit tolérer l'intermittence.
- **Tourisme** : rebond 2025 (~1,63 M de visiteurs, +45 %), étés dominés
  par la **diaspora** (250 000 arrivées en juillet 2025) — fragilisé par
  le contexte 2026.
- **Sécurité, à regarder en face** : la fiche France Diplomatie
  (13/03/2026) déconseille l'axe Saïda–Jezzine–Machghara. Le marché
  réaliste de départ est **domestique + diaspora** ; la plateforme devra
  afficher un état d'accès honnête et daté — personne ne le fait
  aujourd'hui, c'est même un des manques identifiés.
- **Langues** : l'offre numérique existante est massivement anglophone.
  Le français est quasi absent alors que Jezzine est un bastion
  francophone et que le jumelage est yvelinois : le trilingue AR/FR/EN
  est un vrai différenciant.

### Les manques criants — le créneau d'Azour

1. **Aucune plateforme « village » complète** : personne n'offre fiches
   normalisées + GPX ouverts + hébergement + guides joignables + agenda +
   état d'accès à jour. Ehmej s'en approche avec un site vieillissant ;
   Azour peut faire la version 2026.
2. **Les canaux mondiaux sont vides** (AllTrails, Komoot, izi.TRAVEL,
   OSM) — publier 5-6 belles fiches suffit à exister mondialement.
3. **Aucune information d'état en temps réel** (sentier ouvert/fermé,
   eau, météo, accès) nulle part au Liban.
4. **Le français manque**, la **réservation en ligne** est rarissime
   (Jabal Moussa et La Maison de la Forêt de Bkassine exceptées), les
   **audio-guides** n'existent pas.
5. **La pérennité est LE problème** : cimetière de portails de projets
   (destinationlebanon.gov.lb mort, Dhiafee éteint, booking LMTA spammé).
   Le manque n'est pas de créer des sites — c'est de les maintenir.
6. **Azour n'existe pas en ligne** : ni le Shir, ni El Abo, ni les
   sentiers vers Beba / Bteddine El Lockh / Bisri n'ont d'empreinte
   numérique (seule une fiche PeakVisor « Azour » et le toponyme du Chir
   en photo). Tout est à écrire — c'est une chance : aucune dette, aucun
   doublon.

### Les partenariats qui ne coûtent presque rien

- ~~**LMTA** : side trail officiel « Azour » raccordé aux sections
  21-22~~ — **piste abandonnée le 03/09/2026.** Le programme ne s'adosse
  à aucun réseau extérieur : parcours, guides, kiosque et réservation
  sont tenus au village. Le LMT reste ci-dessus comme référence de
  marché, pas comme partenaire.
- **jezzinetourism.com + Union des municipalités** : page Azour dans le
  portail du caza, liens réciproques, mutualisation de l'accueil.
- **App officielle du ministère** : auto-enregistrement des sites.
- **Wikiloc / AllTrails / OSM / PeakVisor** : compte officiel + traces.
- **Clubs** : offre groupe clé en main (bus, guides, repas) ; **ihjoz**
  pour la billetterie du trail ; **Lebtivity** pour l'agenda ; l'index
  UTMB/Ahotu pour le référencement international du trail (précédent :
  Spring LMT Race à Maasser el-Chouf).
- **izi.TRAVEL** : le premier audio-guide de village du Liban, en trois
  langues — une exclusivité nationale à coût faible.
- **PBVL (Plus Beaux Villages du Liban)** : Jezzine, Bkassine et
  Qaytouleh y sont — viser le label pour Azour.

## Volet 2 — Les références internationales

| Plateforme | Portée | Modèle | Ce qu'on lui emprunte |
|---|---|---|---|
| **GeoTrek** (admin / rando / mobile / widget) | ~150 structures publiques françaises | Open source (BSD/MIT), communauté évaluée à > 4 M€ mutualisés | Le modèle de données (itinéraire, POI, zones sensibles, services), la logique « 1 base → N portails », la fiche type, le widget léger |
| **SuisseMobile** | Nationale (36 700 km signalisés, 600+ itinéraires) | Fondation sous surveillance de la Confédération ; freemium 35 CHF/an | La leçon de gouvernance : un standard commun (balisage + données + numérotation) AVANT la techno |
| **Komoot** | Grand public mondial | Commercial — racheté 2025 par Bending Spoons, équipe licenciée, passage au tout-abonnement | Types de chemins chiffrés, difficulté normée 3 niveaux — et l'avertissement : ne jamais dépendre d'une app commerciale « gratuite » |
| **AllTrails** | 450 000+ sentiers | Freemium | Le bloc « conditions récentes du sentier » daté — la confiance — et le pack hors-ligne par sentier |
| **Outdooractive** | Europe + offre B2B destinations | Commercial, sur devis | « La plateforme fournit la techno, la destination le contenu » ; option de repli (Via Dinarica est une marque blanche Outdooractive) |
| **Visorando** | ~70 000 circuits, France | Freemium ; **Espace Pro gratuit pour offices de tourisme** | Le descriptif pas-à-pas imprimable (PDF) — survit aux batteries vides — et l'espace pro gratuit |
| **Wikiloc** | Mondial, communautaire | Freemium | Y publier gratuitement les traces officielles d'Azour — le LMT libanais y publie déjà les siennes |
| **izi.TRAVEL** | 25 000+ audioguides, 50+ langues | Gratuit (CMS + apps) | Les audio-histoires du Shir en 3 langues sans développer de lecteur audio |
| **Jordan Trail** | 650 km, 75 villages | ONG | Le modèle « GPX + PDF en libre accès + annuaire de guides et d'hébergements » qui assume la non-connectivité |
| **Masar Ibrahim (Palestine)** | ~500 km, 60 communautés | ONG, bailleurs | La fiche d'étape « survie » (eau, ravitaillement, dodo) et l'ancrage communautaire — le contexte le plus proche du nôtre |
| **MaRando (FFRandonnée) / Cirkwi** | Nationale France, 7 500+ itinéraires | App fédératrice construite par un agrégateur | Le schéma cible « national » : une marque + un agrégateur au-dessus d'instances locales ; repère tarifaire : ~300 €/an pour une petite structure chez Cirkwi |

### GeoTrek, le candidat « duplicable », en détail

- **Les briques** : Geotrek-admin (back-office Django + PostgreSQL/PostGIS,
  BSD), Geotrek-rando v3 (portail public React/Next.js, PWA installable,
  hors-ligne par fiche, exports PDF/GPX/KML, plusieurs portails sur une
  même base), Geotrek-mobile (Ionic/Capacitor, MIT), Geotrek-rando-widget
  (web components à insérer dans n'importe quel site).
  Sources : github.com/GeotrekCE (admin, rando-v3, mobile, widget).
- **Qui l'utilise** : parcs nationaux, PNR, départements, offices de
  tourisme — né aux parcs des Écrins et du Mercantour ; un projet
  « Agrégateur » fusionne plusieurs bases en un portail unique — exactement
  le mécanisme village → région → national. Roadmap 2025-2026 : import
  automatique depuis OpenStreetMap.
- **Le point bloquant pour nous, vérifié dans le code** : l'interface de
  Geotrek-rando v3 n'existe qu'en 7 langues européennes ; **pas d'arabe et
  aucun support droite-à-gauche documenté** dans aucune brique
  (frontend/src/translations du dépôt). Ajouter l'arabe = déclarer la
  langue côté admin (facile), traduire un fichier JSON (facile), et
  développer le miroir RTL du layout (vrai chantier). Ce serait une
  contribution upstream inédite — un beau projet de coopération pour la
  phase régionale, pas un préalable réaliste pour la V1 d'Azour.
- **Coûts** : logiciel 0 €, mais serveur Linux dédié + compétences
  d'administration. Surdimensionné pour un village seul ; pertinent quand
  une structure héberge pour N villages (le modèle français : le
  département héberge, les communes saisissent).

**Verdict** : ne pas installer Geotrek pour un village au lancement ;
**adopter son vocabulaire de données** (itinéraire, POI, zone sensible,
service, événement) dans une PWA légère pour rendre la migration
indolore, et viser une instance Geotrek mutualisée à l'échelle
Jezzine/région en phase de duplication.

### La leçon SuisseMobile (pour l'ambition nationale)

Une seule marque, une seule numérotation d'itinéraires, un standard de
balisage terrain négocié entre tous les échelons, porté par une fondation
neutre — le numérique n'est que le miroir de ce standard. Transposé au
Liban : travailler tôt avec la LMTA (Lebanon Mountain Trail Association)
et le ministère du Tourisme sur un embryon de standard commun
(numérotation, pictos, modèle de données) plutôt que d'ajouter une
plateforme de plus.

### L'anatomie de la fiche parcours idéale (synthèse des meilleures apps)

1. Photo d'appel plein écran, vraie et locale, + nom + village.
2. Stats scannables en 3 secondes : distance, D+/D-, durée, difficulté, type (boucle/aller-retour).
3. Difficulté normée et expliquée (3 niveaux, critères affichés — modèle Komoot).
4. Carte interactive : trace, départ, POI.
5. Profil altimétrique interactif couplé à la carte.
6. Actions immédiates : hors-ligne, GPX, PDF imprimable, « envoyer sur mon téléphone » (QR).
7. Types de chemins chiffrés (x km sentier, x km piste, x km route).
8. Descriptif narratif pas-à-pas numéroté (modèle Visorando — utilisable sans carte).
9. Bloc sécurité : eau, ombre, passages exposés (la falaise du Shir), urgences, période conseillée.
10. Météo localisée à 3 jours.
11. POI patrimoine/nature le long de la trace, avec audio (izi.TRAVEL).
12. Preuve sociale : photos, avis, et surtout « conditions récentes » datées (la force d'AllTrails) — alimentées par les jeunes guides.
13. Services à proximité : dormir, manger, guides, camping.
14. Accès : venir, se garer, point de départ précis.
15. Le tout traduit intégralement en AR/FR/EN — pas seulement le titre.

### Les patterns kiosque (tablettes du point d'accueil)

1. Boucle d'attraction : diaporama plein écran des sentiers quand la tablette est inactive.
2. Retour automatique à l'accueil après 30-90 s d'inactivité, avec purge de session (vie privée).
3. Bouton « Recommencer » permanent, toujours au même endroit.
4. Navigation ultra-plate (2 niveaux max), boutons 9-12 mm, tap plutôt que scroll.
5. Choix de langue en premier écran, chaque langue dans sa propre écriture — pas de drapeaux.
6. Le QR comme issue de chaque écran : la fiche affichée s'emporte sur le téléphone.
7. Verrouillage en mode kiosque (MDM type Fully Kiosk / Accès guidé), redémarrage auto, contenu **hors-ligne** pour survivre aux coupures.
8. Implantation : hauteur accessible fauteuil, à l'ombre (le plein soleil exige des écrans 800+ nits), antivol, alimentation.

### Les recommandations techniques

- **PWA d'abord, pas d'app native en V1** : un seul code pour site +
  mobile + kiosque, installable sans stores (choix validé par
  Geotrek-rando v3), idéale pour les QR. Limites iOS assumées : cache
  purgé après 7 jours sans visite (sauf app ajoutée à l'écran d'accueil —
  d'où une incitation explicite), pas de suivi GPS en arrière-plan — donc
  **ne pas promettre l'enregistrement de trace** ; proposer à la place
  l'export GPX vers l'app préférée du visiteur.
- **Cartes** : MapLibre GL JS + tuiles vectorielles OSM. Deux options à
  ~0 € : l'instance publique OpenFreeMap (sans clé, sans limite déclarée)
  ou l'auto-hébergement PMTiles/Protomaps (un seul fichier statique pour
  l'extrait Liban, servable depuis un hébergement statique). Relief et
  courbes de niveau depuis un MNT libre (SRTM/Copernicus).
- **Hors-ligne** : service worker + « pack » par sentier (fiche + trace +
  tuiles de la zone), quelques dizaines de Mo maximum par pack.
- **Formats** : GeoJSON en interne, GPX en échange universel, KML en
  option (c'est ce que distribue la LMTA), PDF par fiche. Vocabulaire de
  données aligné sur Geotrek dès le premier jour.
- **Coûts récurrents vérifiables** : logiciels 0 € (open source), tuiles
  ~0 €, domaine + hébergement statique ou petit VPS de quelques dizaines
  d'€/an à ~15 €/mois, izi.TRAVEL/Wikiloc/Espace Pro Visorando gratuits.

## L'arbitrage proposé

1. **V1 Azour (2026-2027)** : PWA sur mesure légère (stack Next.js +
   Supabase déjà maîtrisée sur Solid'Pilot), vocabulaire de données
   compatible Geotrek, MapLibre + tuiles libres, packs hors-ligne,
   trilingue AR/FR/EN pensé arabe d'abord. Le kiosque est la même PWA en
   mode verrouillé.
2. **Couches gratuites en complément** (coût nul, portée immédiate) :
   traces officielles publiées sur Wikiloc — comme la LMTA — et
   AllTrails/Visorando ; audio-histoires sur izi.TRAVEL en 3 langues.
3. **Duplication (2027+)** : instance Geotrek-admin mutualisée à
   l'échelle Jezzine/Sud quand plusieurs villages saisissent leurs
   données ; la contribution arabe/RTL à Geotrek devient alors un projet
   de coopération finançable en soi.
4. **National (horizon)** : une marque + un agrégateur au-dessus des
   instances locales (modèle MaRando/Geotrek-Agrégateur), gouvernance
   type SuisseMobile avec LMTA et ministère — un standard avant une
   techno.

## Ce qui n'a pas pu être vérifié

- L'environnement de recherche bloquait l'accès direct à la plupart des
  sites libanais (lebanontrail.org, mot.gov.lb, jabalmoussa.org,
  jezzinetourism.com, wikiloc.com…) : les constats du volet Liban
  reposent sur les extraits indexés et la presse 2024-2026. Langues
  exactes des sites, fraîcheur page par page et tarifs 2026 à confirmer
  par navigation directe — idéalement depuis le Liban.
- Statut réel 2026 de Dhiafee (probablement éteint), d'Esprit-Nomade
  (références 2003 uniquement) et du site propre de Darb Akkar ; tenue du
  Thru-Walk LMTA 2026 et périmètre exact des sections sud praticables.
- Tarifs Makina Corpus (Geotrek hébergé) et Outdooractive Destination :
  sur devis, non publics.
- Chiffres détaillés du rapport annuel SuisseMobile 2024 (PDF
  inaccessible depuis l'environnement de recherche).
- Politique d'usage production des tuiles opentopomap.org ; pérennité
  financière d'izi.TRAVEL (gratuit sans modèle de revenu public — une
  dépendance à surveiller).
- Aucun déploiement Geotrek au Moyen-Orient trouvé ; le support
  arabe/RTL serait bien une première.

### Sources principales (volet Liban)

lebanontrail.org · booking.lebanontrail.org · wikiloc.com (trace
officielle LMTA, pages Jezzine/Bkassine) · aflmt.org · mot.gov.lb ·
fiches App Store / Google Play de l'app « Ministry of Tourism Lebanon »
(Smartr AI, 12/08/2025) · lorientlejour.com · jabalmoussa.org
(trails-facilities, book) · shoufcedar.org · horshehden.org ·
jezzinetourism.com/hikingTrails · jezzine-union.com ·
baladi-lebanon.org · ehmej.org/en/hike-ehmej-trails · lamaisondelaforet.net ·
bluejayvalley.com · pbvliban.org · kazderni.com · jedo.app ·
travel-lb.com · moovtoo.com · darb-mea.com · lebanontraveler.com ·
lebtivity.com · ihjoz.com · vamos-todos.com · promax.me ·
highkings961.com · alltrails.com/lebanon · komoot.com/guide (Liban) ·
wiki.openstreetmap.org/wiki/Lebanon · peakvisor.com/poi/azour ·
datareportal.com (Digital 2026 Lebanon) · libnanews.com (électricité) ·
diplomatie.gouv.fr (conseils aux voyageurs Liban, 13/03/2026) ·
utmb.world · ahotu.com. Toutes identifiées le 29/08/2026.

### Sources principales (volet international)

github.com/GeotrekCE/Geotrek-admin · Geotrek-rando-v3
(docs/presentation-fr.md et frontend/src/translations) · Geotrek-mobile ·
Geotrek-rando-widget · geotrek.readthedocs.io · parcsnationaux.fr ·
makina-corpus.com (roadmap 2025-2026, agrégateur) · ffrandonnee.fr
(MaRando) · pro.cirkwi.com · suissemobile.ch/en/about-us ·
schweizmobil.ch · komoot.com/tour-characteristics · road.cc (rachat
Komoot) · alltrails.com/plans · business.outdooractive.com/product-plans ·
support.visorando.com (Espace Pro) · wikiloc.com (traces officielles
LMTA) · izi.travel/fr/create · echoes.xyz · jordantrail.org/maps-gps ·
phtrail.masaribrahim.ps · trail.viadinarica.com · openfreemap.org ·
til.simonwillison.net/gis/pmtiles · magicbell.com (limites PWA iOS) ·
kioskindustry.org · kioskmarketplace.com · reffine.com et hamrix.com
(RTL/typo arabe) · freedomhouse.org (connectivité Liban 2024).
