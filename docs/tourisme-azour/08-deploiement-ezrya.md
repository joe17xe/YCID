# Visit Azour — déploiement sur azour.ezrya.fr

Le sous-domaine `azour.ezrya.fr` est réservé sur le VPS (confirmé le
29/08/2026). L'app vit dans `tourisme/` du dépôt YCID — le même dépôt
que Solid'Pilot, déjà cloné sur le VPS dans `/opt/ycid-app` — et suit
les mêmes conventions (PM2, utilisateur `deploy`, nginx). Solid'Pilot
occupe le port 5001 ; Visit Azour prend le **5002**.

Le sous-domaine EST le modèle de duplication : demain,
`jeita.ezrya.fr` = une seconde instance PM2 avec
`NEXT_PUBLIC_TERRITOIRE=jeita` et une ligne de plus en base.

## 0. Deux chemins possibles

- **Chemin court (jour 1, sans base)** : déployer en *mode fichiers* —
  aucune variable Supabase, le contenu vient de `content/*.json`,
  `/admin` est désactivé (il l'explique lui-même). Étapes 2 à 4
  seulement. Idéal pour montrer le produit aux partenaires dès
  maintenant.
- **Chemin complet** : projet Supabase + back-office actif. Étapes 1 à 5.

## 1. Le projet Supabase (chemin complet)

1. Créer un projet sur supabase.com (le palier gratuit suffit au
   lancement), région `eu-central` de préférence.
2. SQL Editor ▸ exécuter **dans l'ordre** :
   `tourisme/supabase/migrations/0001_schema.sql` →
   `0002_vues_publiques.sql` → `0003_admin.sql` →
   `tourisme/supabase/seed.sql`.
   (Ne jamais exécuter `supabase/dev/shim-auth-local.sql` ici — il ne
   sert qu'à la vérification sur un PostgreSQL local nu.)
3. Authentication ▸ Providers : e-mail avec **lien magique** activé ;
   Authentication ▸ URL Configuration : Site URL
   `https://azour.ezrya.fr`, redirect `https://azour.ezrya.fr/admin`.
4. Donner les droits d'édition (après une première connexion de la
   personne sur `/admin`, qui crée son compte) :
   ```sql
   insert into territoire_editeurs (territoire_id, user_id)
   values ((select id from territoires where slug = 'azour'),
           (select id from auth.users where email = 'personne@exemple.org'));
   ```
5. Relever dans Settings ▸ API : `Project URL` et `anon public key`.

## 2. Le VPS

```bash
# en tant que deploy, dans le dépôt déjà cloné
cd /opt/ycid-app && git pull
cd tourisme
cp .env.example .env.production.local   # puis renseigner les variables
npm ci
npm run build
pm2 start ecosystem.config.js           # app « visit-azour », port 5002
pm2 save
```

Redéploiement ultérieur : `git pull && npm ci && npm run build && pm2 restart visit-azour`
(à encapsuler dans un `deploy-tourisme.sh` sur le modèle de
`scripts/deploy.sh` de Solid'Pilot — mêmes précautions de droits que
son post-mortem du 23/07/2026).

## 3. nginx + HTTPS

```nginx
# /etc/nginx/sites-available/azour.ezrya.fr
server {
    server_name azour.ezrya.fr;
    listen 80;
    location / {
        proxy_pass http://127.0.0.1:5002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/azour.ezrya.fr /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d azour.ezrya.fr        # HTTPS obligatoire : PWA + géolocalisation l'exigent
```

DNS : un enregistrement `A` (ou `CNAME`) `azour.ezrya.fr` → le VPS.

## 4. La recette de mise en ligne (checklist)

- [ ] `https://azour.ezrya.fr` s'ouvre, bandeau « état d'accès » daté visible
- [ ] `?lang=ar` bascule en arabe **miroir complet** (RTL), `?lang=en` en anglais
- [ ] Les trois fiches parcours s'ouvrent ; Hyrax Rock ne propose PAS de GPX mais « réserver avec un guide »
- [ ] La carte affiche fond + tracés (tuiles OpenFreeMap à confirmer en conditions réelles — bloquées dans le bac à sable de dev ; sinon renseigner `NEXT_PUBLIC_MAP_STYLE`)
- [ ] « Télécharger pour le sentier » puis mode avion : la fiche et le mode sentier s'ouvrent encore
- [ ] Installation sur l'écran d'accueil (Android + iOS) : icône montagne, nom « Visit Azour »
- [ ] `/kiosque` sur la tablette : langues, parcours du jour, QR scanné avec un téléphone ouvre la fiche dans la bonne langue ; retour accueil après 120 s
- [ ] `/admin` : connexion par lien magique, modification du numéro du kiosque → visible dans Pratique et au kiosque
- [ ] En navigation privée sans connexion : impossible d'écrire quoi que ce soit (RLS)
- [ ] `/api/gpx/boucle-foret-falaise` télécharge un GPX marqué « tracé provisoire »

## 5. Verrouiller la tablette du kiosque

Android : Fully Kiosk Browser (ou équivalent MDM) sur
`https://azour.ezrya.fr/kiosque`, démarrage automatique, veille écran
raisonnée. iPad : Accès guidé. Alimentation permanente, fixation
antivol, à l'ombre (l'écran plein soleil exige 800+ nits — voir
benchmark kiosque).

## Ce qui reste entre les mains de l'équipe

1. **Le KML de l'étude** : le récupérer auprès de l'auteur, l'importer
   par `/admin` (Import GPX — convertir KML→GPX via gpx.studio si
   besoin), vérifier sur la carte, passer la trace en « vérifiée
   terrain » après le relevé avec les jeunes guides.
2. **Le numéro d'information du kiosque** : une saisie dans `/admin`,
   il s'affiche partout.
3. **La relecture de l'arabe** par des locuteurs natifs.
4. **Les photos de la campagne pro** (remplacer/compléter celles de
   l'étude).
5. Les **comptes éditeurs** (étape 1.4) pour LEY, la municipalité et
   les jeunes guides référents.
