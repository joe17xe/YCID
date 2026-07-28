-- ============================================================
-- MIGRATION 0057 — Kit de communication et logos des organisations
-- ============================================================
-- Chantier lancé le 28/07 tard (roadmap « Kit de communication »),
-- dernier de la file voulue. Deux morceaux :
--
-- 1. LOGO PAR ORGANISATION — organizations.logo_url. Les logos ne sont
--    pas à créer : chaque organisation fournit le sien, téléversé sur
--    sa fiche (dialogue Modifier) dans le bucket public `branding`
--    (chemin org-logos/), celui de la marque — même nature de donnée,
--    mêmes droits d'écriture (admins).
--
-- 2. LE KIT — bucket privé `communication` : les fichiers livrés par
--    le designer (pack de logos, charte, gabarits — fabriqués chez
--    Canva, décision du 28/07), téléchargeables par TOUT compte
--    connecté via URL signée, déposés et retirés par les admins seuls.
--    L'application HÉBERGE le kit, elle ne le crée pas.

alter table organizations add column if not exists logo_url text;

comment on column organizations.logo_url is
  'Logo fourni par l''organisation (bucket branding/org-logos), affiché partout où elle apparaît.';

insert into storage.buckets (id, name, public)
values ('communication', 'communication', false)
on conflict (id) do nothing;

drop policy if exists "Kit read" on storage.objects;
create policy "Kit read" on storage.objects
  for select using (
    bucket_id = 'communication' and auth.uid() is not null
  );

drop policy if exists "Kit upload" on storage.objects;
create policy "Kit upload" on storage.objects
  for insert with check (
    bucket_id = 'communication' and is_admin()
  );

drop policy if exists "Kit update" on storage.objects;
create policy "Kit update" on storage.objects
  for update using (
    bucket_id = 'communication' and is_admin()
  );

drop policy if exists "Kit delete" on storage.objects;
create policy "Kit delete" on storage.objects
  for delete using (
    bucket_id = 'communication' and is_admin()
  );

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select id, public from storage.buckets where id = 'communication';
--   select name, logo_url from organizations order by name;
