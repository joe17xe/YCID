# Visit Azour

Plateforme touristique du village d'Azour (caza de Jezzine, Liban) —
parcours de randonnée, points d'intérêt, mode sentier, kiosque de la
place du village. Construite pour être **dupliquée** : un territoire =
une configuration, jamais du code. Programme CEM Liban 2025-2027
(Villepreux · Azour · LEY, YCID, CD78, MEAE).

Le dossier de conception complet vit dans `../docs/tourisme-azour/`
(état des lieux, benchmark sourcé, méthode, design, modèle de données,
étude des sentiers, déploiement).

## Ce que c'est

- **PWA Next.js 16** (App Router, Turbopack), trilingue **AR/FR/EN**
  avec arabe droite-à-gauche natif (cookie `VA_LOCALE`, `?lang=` honoré
  par `proxy.ts` pour les QR des panneaux et du kiosque).
- **Hors-ligne réel** : service worker (`public/sw.js`) — enveloppe en
  réseau-d'abord, « packs sentier » versionnés téléchargés par le
  visiteur, tuiles de carte en cache au fil de l'eau.
- **Carte MapLibre** (fond vectoriel OpenFreeMap sans clé, surchargeable
  via `NEXT_PUBLIC_MAP_STYLE`), tracés provisoires en tirets, étapes
  numérotées comme les panneaux physiques.
- **Mode sentier** : position GPS suivie, distance restante le long de
  la trace, prochaine étape, alerte hors-trace (150 m), urgences à un
  geste.
- **Préparer sa venue** (`/venir`) : pourquoi monter, comment y monter
  (distance et durée depuis Beyrouth, Saida, Jezzine — des paramètres),
  le point d'arrivée avec ses coordonnées et des liens **Google Maps /
  Waze / Plans**, le stationnement, la région, les saisons. Les mêmes
  liens de navigation figurent sur chaque POI et sur le départ de chaque
  parcours.
- **Réservation** (`/reserver`) : catalogue de **formules paramétrables**
  (visite guidée, randonnée accompagnée, journée, groupes…), fiche par
  formule, formulaire de demande. Avec base, la demande s'inscrit au
  registre du kiosque (RLS : dépôt public, lecture éditeurs seuls) ;
  sans base, elle est rédigée à l'écran et part par WhatsApp, e-mail ou
  téléphone. L'entrée est en haut de la page d'accueil, à côté du numéro.
- **Kiosque** (`/kiosque`) : plein écran clair verrouillé, trois langues
  chacune dans son écriture, parcours du jour, QR vers la fiche dans la
  langue choisie, numéro d'information paramétrable, retour accueil
  après 120 s.
- **Back-office** (`/admin`, français) : lien magique Supabase, RLS par
  territoire ; état d'accès daté, numéro du kiosque, statuts, chiffres
  officiels, **import GPX** dans le navigateur, coordonnées collées
  format Google Maps (ordre détecté, hors-Liban refusé).

## Les deux modes de contenu

La couche `lib/content.ts` sert les mêmes formes dans les deux cas :

| Mode | Quand | Source |
|---|---|---|
| **fichiers** (défaut) | aucune variable Supabase définie | `content/*.json` — le seed versionné dans git |
| **supabase** | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Postgres/PostGIS via les vues publiques, éditable par `/admin` |

Le mode fichiers permet de déployer **jour 1 sans aucune
infrastructure**, puis d'activer la base quand elle est prête. En mode
fichiers, modifier le contenu = éditer `content/*.json` puis
`node scripts/gen-seed.mjs` (régénère `supabase/seed.sql`, qui reste la
projection SQL du même contenu).

## Démarrer

```bash
npm install
npm run dev        # développement (mode fichiers)
npm run build && npm start
npm run lint       # eslint (règles React Compiler)
npm run check      # tsc --noEmit
```

Variables (voir `.env.example`) : `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TERRITOIRE` (défaut
`azour`), `NEXT_PUBLIC_MAP_STYLE` (défaut OpenFreeMap liberty).

## Base de données

`supabase/migrations/` dans l'ordre (0001 schéma + RLS, 0002 vues
publiques GeoJSON, 0003 fonctions et vues d'admin, 0004 services rendus
sur place, 0005 formules et demandes de réservation, 0006 « sur
réservation », 0007 accès et présentation du territoire, 0008 photo au
back-office), puis
`supabase/seed.sql`. Vérifiées rejouables sur un PostGIS 16 nu avec
`supabase/dev/shim-auth-local.sql` (local uniquement — jamais sur un
vrai projet Supabase). Les droits d'écriture s'attribuent en SQL :

```sql
insert into territoire_editeurs (territoire_id, user_id)
values ((select id from territoires where slug = 'azour'),
        (select id from auth.users where email = 'personne@exemple.org'));
```

## Dupliquer un territoire

1. Une ligne `territoires` (slug, nom, marque, langues, contacts…) ;
2. ses parcours/POI/événements (back-office ou seed) ;
3. une instance avec `NEXT_PUBLIC_TERRITOIRE=<slug>` — par exemple
   `jeita.ezrya.fr`. Rien d'autre : c'est l'exigence « scalable » du
   cadrage du 29/08.

## Limites assumées de la V1 (et leur suite)

- **Tracés provisoires** dessinés d'après l'étude des sentiers, marqués
  et affichés comme tels — à remplacer par le KML de l'auteur de l'étude
  puis le relevé terrain (import GPX de `/admin`, statut « vérifiée
  terrain »).
- **Pas de profil altimétrique** tant que les traces n'ont pas
  d'altitude ; les D+/D− officiels de l'étude font foi.
- **Arabe validé** (29/08/2026) ; toute retouche future passe par
  `content/*.json` / `messages/ar.json` ou le back-office.
- **Enregistrement de trace GPS non promis** (limite PWA iOS) : le
  visiteur suit sa position, l'app n'enregistre pas — l'export GPX sert
  les apps spécialisées.
- **Formules à valider** : durées, capacités et tarifs des six formules
  livrées sont des *propositions*. Les tarifs sont volontairement vides —
  l'app affiche alors « communiqué au kiosque » plutôt qu'un chiffre
  inventé. Tout se règle dans `/admin` ou `content/formules.json`.
- **Aucun WhatsApp ni e-mail de kiosque renseigné** : sans base, la
  demande ne peut donc partir que par téléphone ou copier-coller. Un
  numéro WhatsApp dans le back-office rend le circuit immédiat.
- Tuiles OpenFreeMap à confirmer en production (bloquées par le proxy du
  bac à sable de développement) ; repli en une ligne d'env.
