# Procédure de déploiement — Option A (base propre + code du dépôt)

Contexte : la base de production actuelle (`nthyaspoutcfefiafqro`) porte un
ancien schéma prototype qui ne correspond pas au code du dépôt. Les données
actuelles sont des données de remplissage, jetables (décision du 23/07/2026).
On réinstalle donc le schéma complet du dépôt, puis on déploie `master`.

⚠️ **À faire APRÈS la démo** — pendant l'opération, le site est vide/instable.

---

## Étape 1 — Réinstaller la base (SQL Editor Supabase)

1. Ouvrir https://supabase.com/dashboard/project/nthyaspoutcfefiafqro/sql
2. Copier-coller **l'intégralité** de `web/supabase/install-complet.sql`
   (depuis la branche `master` à jour) et exécuter.
   - Ce script **supprime toutes les tables métier existantes** puis installe
     le schéma complet (migrations 0001 → 0008, correctifs inclus).
   - Il est rejouable : en cas d'erreur, corriger et relancer en entier.

## Étape 2 — Créer votre compte et vous promouvoir admin

1. Dashboard Supabase → **Authentication → Users → Add user** (ou via la page
   de connexion de l'app une fois déployée, tant que le signup est ouvert).
   Utiliser votre email réel.
2. La table `profiles` se remplit automatiquement à la création du compte
   (trigger `handle_new_user`).
3. Dans le SQL Editor :
   ```sql
   update profiles set is_platform_admin = true where email = 'votre@email';
   ```

## Étape 3 — (Optionnel) Charger les données de démonstration

Dans le SQL Editor, exécuter `web/supabase/seed.sql` : programme CEM Liban
complet (9 organisations, 3 projets, phases, tâches, budget, indicateurs,
COPIL). Les assignations de tâches à des personnes nécessitent des comptes
réels — à faire ensuite via l'écran Administration > Utilisateurs.

## Étape 4 — Configurer l'authentification

1. **Authentication → Providers → Email** : décocher « Allow new users to
   sign up » (l'accès devient sur invitation, cohérent avec la PR #3).
2. Les invitations se font ensuite depuis **Administration > Utilisateurs**
   dans l'app (nécessite l'étape 5.3).

## Étape 5 — Déployer le code sur le serveur

Sur le serveur (`/opt/ycid-app/web`) :

```bash
cd /opt/ycid-app/web
git pull origin master
npm ci
```

Vérifier/compléter les variables d'environnement (fichier `.env.local` ou
équivalent — ne jamais committer) :

```
NEXT_PUBLIC_SUPABASE_URL=https://nthyaspoutcfefiafqro.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon>
SUPABASE_SERVICE_ROLE_KEY=<clé service_role>   # requise pour les invitations
```

Puis :

```bash
npm run build
pm2 restart ycid
```

## Étape 6 — Vérifications post-déploiement

- [ ] Connexion avec votre compte → dashboard s'affiche.
- [ ] Section **ADMINISTRATION** visible dans la sidebar (Utilisateurs,
      Accès & rôles).
- [ ] `/projets` liste les projets du seed (si étape 3 faite).
- [ ] Fiche projet : onglets Tâches / Budget / Impact / COPIL / Journal.
- [ ] Une invitation part depuis Administration > Utilisateurs.
- [ ] « Nouveau projet » crée un projet (vous devenez chef de projet,
      l'événement apparaît dans le Journal).
- [ ] Sur une tâche terminée : bouton « Modifier » → double confirmation →
      modification tracée au Journal.
- [ ] Un compte non-admin ne voit ni ADMINISTRATION, ni le bouton
      « Modifier » des tâches terminées.

## En cas de problème

- Page vide / « Aucun projet » : vérifier que l'étape 1 s'est exécutée sans
  erreur (les policies RLS filtrent tout si une migration manque) et que le
  compte est bien membre/admin.
- Erreur au build : vérifier la version de Node (≥ 20) et relancer `npm ci`.
- Retour arrière : `git checkout 21b312e && npm run build && pm2 restart ycid`
  (le site retrouvera son état actuel, mais la base aura changé — l'ancien
  build ne matchera plus : le rollback complet suppose de ne PAS avoir fait
  l'étape 1, d'où l'importance de dérouler dans l'ordre).

---

## Branches abandonnées

- `claude/adapt-schema-reel` : adaptation du code à l'ancien schéma prototype.
  Rendue obsolète par l'Option A — ne pas fusionner.
