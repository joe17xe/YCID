-- ============================================================
-- MIGRATION 0024 — Historique des rapports IA + brief de campagne
-- ============================================================
-- Rapport de test du 25/07/2026 :
--  · P0-3 « Aucune persistance » : fermer l'onglet perdait le rapport,
--    alors que l'usage attendu est un reporting daté et comparable ;
--  · P2-13 « Il n'y a pas de brief de campagne » : l'IA ne recevait que
--    titre, date et langues — d'où des contenus génériques.

-- ------------------------------------------------------------
-- 1. Historique des rapports d'expertise
-- ------------------------------------------------------------
create table if not exists ai_reports (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  content text not null,
  model text,
  instructions text,
  truncated boolean not null default false,
  tokens int,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_reports_project_idx
  on ai_reports(project_id, created_at desc);

alter table ai_reports enable row level security;

drop policy if exists "See ai reports" on ai_reports;
create policy "See ai reports" on ai_reports
  for select using (is_project_member(project_id) or is_admin() or is_lead_org_admin());

drop policy if exists "Create ai reports" on ai_reports;
create policy "Create ai reports" on ai_reports
  for insert with check (is_project_member(project_id) or is_admin() or is_lead_org_admin());

drop policy if exists "Delete ai reports" on ai_reports;
create policy "Delete ai reports" on ai_reports
  for delete using (is_chef_projet(project_id) or is_admin() or is_lead_org_admin());

-- ------------------------------------------------------------
-- 2. Brief de campagne (canaux, audience, objectif, ton, message clé)
-- ------------------------------------------------------------
alter table comm_campaigns add column if not exists brief jsonb;
