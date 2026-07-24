-- ============================================================
-- MIGRATION 0018 — Configuration de la marque (white-label)
-- ============================================================
-- Réglages plateforme en un enregistrement UNIQUE (singleton) :
-- nom de marque, accroche, couleurs, logo. Lecture publique (la marque
-- doit s'afficher AVANT connexion, sur la page de login) ; écriture
-- réservée aux admins plateforme (is_admin() — cf. 0017).

create table if not exists platform_settings (
  id boolean primary key default true check (id),
  brand_name text not null default 'Solid''Pilot',
  tagline text not null default 'Pilotage de projets de solidarité internationale',
  accent_color text not null default '#0E6B5C',
  accent_soft_color text not null default '#E4F0EC',
  logo_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

-- L'enregistrement unique (id = true) ; le CHECK interdit toute autre ligne
insert into platform_settings (id) values (true) on conflict (id) do nothing;

alter table platform_settings enable row level security;

-- Lecture publique : la marque est visible même déconnecté (login)
drop policy if exists "Platform settings read" on platform_settings;
create policy "Platform settings read" on platform_settings
  for select using (true);

-- Écriture réservée aux admins plateforme
drop policy if exists "Platform settings write" on platform_settings;
create policy "Platform settings write" on platform_settings
  for update using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- Bucket Storage public « branding » pour le logo.
-- Lecture publique ; écriture réservée aux admins plateforme.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

drop policy if exists "Branding read" on storage.objects;
create policy "Branding read" on storage.objects
  for select using (bucket_id = 'branding');

drop policy if exists "Branding insert" on storage.objects;
create policy "Branding insert" on storage.objects
  for insert with check (bucket_id = 'branding' and is_admin());

drop policy if exists "Branding update" on storage.objects;
create policy "Branding update" on storage.objects
  for update using (bucket_id = 'branding' and is_admin());

drop policy if exists "Branding delete" on storage.objects;
create policy "Branding delete" on storage.objects
  for delete using (bucket_id = 'branding' and is_admin());
