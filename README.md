# Solid'Pilot — YCID

Application de pilotage du programme **CEM Liban-Yvelines** (et de tout portefeuille de projets de coopération internationale multi-partenaires).

Next.js + Supabase (Postgres, Auth, RLS). Fonctionne aussi **sans base configurée** en mode démo (données en mémoire).

## Structure

```
app/                  Pages Next.js (App Router)
components/
  SolidPilot.jsx      Application complète (projets, budget, validations, impact, COPIL, carte, aide)
lib/
  supabaseClient.js   Client Supabase + détection du mode démo
  data.js             Couche de persistance (lecture + écriture automatique par diff/upsert)
supabase/
  migrations/001_schema.sql   14 tables + trigger de liaison compte/profil
  migrations/002_rls.sql      Row Level Security : permissions par projet côté serveur
  seed.sql                    Données réelles du programme (106 200 €, 132 inserts)
prototypes/           Historique des prototypes (phases 2 à 4)
docs/                 Spécification fonctionnelle (sections 1-12)
```

## Démarrage local (mode démo, 2 minutes)

```bash
npm install
npm run dev
```
Ouvrir http://localhost:3000 — l'app tourne sur les données de démonstration, sélecteur « Voir en tant que » actif.

## Passage en production (Supabase réel)

1. **Créer un projet** sur https://supabase.com (région EU).
2. **SQL Editor** : exécuter dans l'ordre `001_schema.sql`, `002_rls.sql`, `seed.sql`.
3. **Authentication → Providers** : activer Email, et Google si souhaité (renseigner les identifiants OAuth Google Cloud, redirect `https://<projet>.supabase.co/auth/v1/callback`).
4. **Créer les comptes** : Authentication → Users → Add user, avec les **mêmes emails** que les profils du seed (bayoub@yvelines.fr, etc.). Le trigger lie automatiquement chaque compte à son profil ; un email inconnu voit l'écran « compte non provisionné ».
5. Copier `.env.example` en `.env.local`, renseigner `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`, mettre `NEXT_PUBLIC_DEMO_MODE=false`.
6. `npm run dev` — connexion réelle, données lues et écrites en base, droits appliqués par RLS.

## Déploiement sur ycid.joefr.cloud

1. Pousser ce dépôt sur GitHub.
2. Sur https://vercel.com : **Import Project** → sélectionner le dépôt → renseigner les 3 variables d'environnement → Deploy.
3. Vercel → Settings → **Domains** → ajouter `ycid.joefr.cloud`.
4. Chez le gestionnaire DNS de `joefr.cloud` : ajouter un **CNAME** `ycid` → `cname.vercel-dns.com`. Le certificat HTTPS est émis automatiquement.
5. Supabase → Authentication → URL Configuration : ajouter `https://ycid.joefr.cloud` aux Redirect URLs.

## Limites connues de cette V1 (à durcir ensuite)

- Persistance par upsert générique : suffisant mono-équipe, à remplacer par des mutations ciblées + temps réel (Supabase Realtime) pour l'édition simultanée.
- Les fichiers (devis, factures) ne stockent que le nom : brancher Supabase Storage pour l'upload réel.
- Policies RLS volontairement lisibles : quelques cas fins (ex. contributeur limité à SES tâches en écriture) sont appliqués dans l'UI et à resserrer en SQL.
- Notifications in-app calculées : ajouter l'envoi email (Edge Function + Resend) ensuite.
