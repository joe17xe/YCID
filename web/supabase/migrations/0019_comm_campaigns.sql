-- ============================================================
-- MIGRATION 0019 — Campagnes de communication (PR 26)
-- ============================================================
-- Une campagne = un moment de communication d'un projet (kickoff,
-- fin de phase, objectif atteint, clôture, ou manuelle), avec des
-- contenus multi-canaux/multi-langues générés par IA, un workflow
-- de validation humaine et une check-list éthique.
-- Décisions produit du 24/07/2026 : validation par le responsable
-- (asso), mentions CEM & YCID par défaut, FR/EN/AR paramétrables.

create table if not exists comm_campaigns (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  trigger_kind text not null default 'manuelle'
    check (trigger_kind in ('kickoff', 'phase', 'objectif', 'cloture', 'manuelle')),
  title text not null,
  scheduled_date date,
  responsible_id uuid references profiles(id) on delete set null,
  status text not null default 'proposee'
    check (status in ('proposee', 'brouillon', 'validee', 'publiee', 'annulee')),
  languages text[] not null default array['fr', 'en', 'ar'],
  -- contenus : { fr: {linkedin, facebook, communique}, en: {...}, ar: {...} }
  contents jsonb,
  -- check-list éthique obligatoire avant validation
  checklist jsonb not null default
    '{"chiffres_ok": false, "mentions_ok": false, "images_ok": false}'::jsonb,
  published_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists comm_campaigns_project_idx
  on comm_campaigns(project_id, scheduled_date);

alter table comm_campaigns enable row level security;

-- Lecture : membres du projet + admins
drop policy if exists "See campaigns" on comm_campaigns;
create policy "See campaigns" on comm_campaigns
  for select using (is_project_member(project_id) or is_admin() or is_lead_org_admin());

-- Gestion complète : chef de projet + admins
drop policy if exists "Chef manage campaigns" on comm_campaigns;
create policy "Chef manage campaigns" on comm_campaigns
  for all
  using (is_chef_projet(project_id) or is_admin() or is_lead_org_admin())
  with check (is_chef_projet(project_id) or is_admin() or is_lead_org_admin());

-- Le responsable désigné peut éditer sa campagne (contenus, check-list, statut)
drop policy if exists "Responsible update campaigns" on comm_campaigns;
create policy "Responsible update campaigns" on comm_campaigns
  for update using (responsible_id = auth.uid()) with check (responsible_id = auth.uid());
