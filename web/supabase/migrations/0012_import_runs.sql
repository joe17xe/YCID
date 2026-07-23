-- ============================================================
-- MIGRATION 0012 — Journal des imports CSV (PR 10)
-- ============================================================
-- Chaque exécution d'import devient un « run » tracé : type, fichier,
-- compteurs créées/ignorées, erreurs détaillées, auteur, date.
-- (pattern « Journal des synchronisations » d'OrthoPilot)

create table if not exists import_runs (
  id uuid primary key default uuid_generate_v4(),
  kind text not null,
  filename text,
  created_count int not null default 0,
  skipped_count int not null default 0,
  errors jsonb,
  status text not null default 'succes',
  by_user uuid references profiles(id),
  at timestamptz not null default now()
);

create index if not exists import_runs_at_idx on import_runs (at desc);

alter table import_runs enable row level security;

drop policy if exists "See import runs" on import_runs;
create policy "See import runs" on import_runs
  for select using (is_admin() or is_lead_org_admin() or by_user = auth.uid());

drop policy if exists "Insert import runs" on import_runs;
create policy "Insert import runs" on import_runs
  for insert with check (by_user = auth.uid());
