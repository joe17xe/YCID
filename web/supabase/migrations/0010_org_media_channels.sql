-- ============================================================
-- MIGRATION 0010 — Canaux médias par organisation (PR 25)
-- ============================================================
-- Chaque organisation paramètre ses canaux de communication
-- disponibles (Facebook, Instagram, LinkedIn, site web,
-- newsletter, WhatsApp, presse) avec langue, ton, audience et
-- signature. Base de la phase Communication (PR 25 à 27) :
-- la génération de contenu IA (PR 27) proposera un contenu
-- par canal actif.

create table if not exists org_media_channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in
    ('facebook','instagram','linkedin','site_web','newsletter','whatsapp','presse')),
  name text not null,
  url text,
  language text not null default 'fr' check (language in ('fr','en','ar')),
  tone text not null default '',
  audience text not null default '',
  signature text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists org_media_channels_org_idx on org_media_channels(org_id);

alter table org_media_channels enable row level security;

-- Lecture : tout utilisateur connecté (mêmes règles que la table
-- organizations — les canaux décrivent des supports publics).
drop policy if exists "Authenticated read media channels" on org_media_channels;
create policy "Authenticated read media channels" on org_media_channels
  for select using (auth.uid() is not null);

-- Écriture : admins plateforme, admins YCID/LEY, ou admin de
-- l'organisation propriétaire du canal (permission
-- comm.channels.manage du registre RBAC).
drop policy if exists "Org admins manage media channels" on org_media_channels;
create policy "Org admins manage media channels" on org_media_channels
  for all using (
    is_admin()
    or is_lead_org_admin()
    or exists(
      select 1 from memberships
      where user_id = auth.uid()
        and org_id = org_media_channels.org_id
        and role = 'admin_org'
    )
  )
  with check (
    is_admin()
    or is_lead_org_admin()
    or exists(
      select 1 from memberships
      where user_id = auth.uid()
        and org_id = org_media_channels.org_id
        and role = 'admin_org'
    )
  );
