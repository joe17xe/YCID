-- ============================================================
-- MIGRATION 0017 — Module de gestion des utilisateurs
-- ============================================================
-- Rôle plateforme à 3 niveaux + statut actif, sur profiles :
--   admin → Administrateur (accès complet, gère tout le monde)
--   ycid  → YCID (super user : accès complet, mais ne peut ni
--           supprimer ni modifier un Administrateur)
--   user  → Utilisateur
-- is_platform_admin reste synchronisé (admin/ycid => true) pour ne
-- rien casser des policies existantes.

alter table profiles add column if not exists platform_role text not null default 'user'
  check (platform_role in ('admin', 'ycid', 'user'));
alter table profiles add column if not exists active boolean not null default true;

-- Backfill : les admins plateforme existants deviennent 'admin'
update profiles set platform_role = 'admin' where is_platform_admin = true and platform_role = 'user';

-- is_admin() reconnaît aussi platform_role (admin/ycid), en plus du flag
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (is_platform_admin = true or platform_role in ('admin', 'ycid'))
  );
$$;
