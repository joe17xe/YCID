-- ============================================================
-- MIGRATION 0066 — Appels de fonds : promesses annuelles et relances
-- ============================================================
-- Chantier lancé sur décision utilisateur (roadmap « Appels de fonds :
-- les promesses annuelles et leurs relances », 28/07). Chaque année,
-- des promesses de financement sont faites — YCID, mairies, LEY, MEAE,
-- comités de jumelage — et la directrice de programme relance chacun
-- pour le versement. Exemple 2026 : la mairie de Villepreux VERSE
-- 2 000 € à LEY ; LEY RÉSERVE 1 000 € pour le projet ; YCID verse
-- 17 000 € au comité de jumelage.
--
-- Une promesse est un FLUX entre organisations, pas une dépense : le
-- budget (budget_lines) reste la référence, l'appel de fonds la réalité
-- politique. Les deux se COMPARENT à l'écran (écart signalé), ne se
-- confondent jamais — c'est l'arbitrage acté en roadmap, et la raison
-- pour laquelle cette table ne porte aucune colonne de budget_lines.
--
--   · payer_org_id       — qui s'est engagé à payer (obligatoire) ;
--   · beneficiary_org_id — qui reçoit. NULL = « pour le projet
--     lui-même » : le cas « réserver », où l'organisation garde la
--     somme chez elle mais la fléche sur le projet ;
--   · amount             — saisie LIBRE, voulue telle quelle : la
--     promesse ne se plie pas au budget, elle s'y compare ;
--   · status             — promis → demandé → reçu. « promis » est daté
--     par created_at ; les deux autres par requested_at / received_at,
--     posés par l'application au changement d'état ;
--   · last_reminder_at/by — la relance est MANUELLE (geste politique :
--     c'est la directrice qui appuie, jamais un robot) ; on garde la
--     trace de la dernière, l'historique complet vit au Journal.

create table if not exists funding_calls (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  payer_org_id uuid not null references organizations(id),
  -- `on delete restrict` implicite (pas de cascade) : une organisation
  -- qui porte des promesses ne se supprime pas sans les regarder.
  beneficiary_org_id uuid references organizations(id),
  amount numeric not null default 0 check (amount >= 0),
  note text,
  status text not null default 'promis'
    check (status in ('promis', 'demande', 'recu')),
  requested_at timestamptz,
  received_at timestamptz,
  last_reminder_at timestamptz,
  last_reminder_by uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_funding_calls_project
  on funding_calls(project_id, year desc);

alter table funding_calls enable row level security;

-- Lecture : l'appartenance au projet suffit — mêmes yeux que le budget
-- (budget.view, tous les rôles), l'auditeur y compris : contrôler les
-- promesses de versement est exactement son travail.
drop policy if exists "Read funding calls" on funding_calls;
create policy "Read funding calls" on funding_calls
  for select using (
    is_admin() or is_project_member(project_id)
  );

-- Écriture : les mêmes mains que le budget (budget.manage). La liste
-- passe par has_project_role (0062) — une policy sur funding_calls
-- pourrait lire project_members directement, mais la forme `array[...]`
-- est celle que `npm run check:rbac` sait comparer à la matrice
-- (SQL_RULES ▸ « Manage funding calls »).
drop policy if exists "Manage funding calls" on funding_calls;
create policy "Manage funding calls" on funding_calls
  for all using (
    is_admin()
    or has_project_role(project_id, array['chef_projet', 'referent_mairie', 'resp_financier'])
  )
  with check (
    is_admin()
    or has_project_role(project_id, array['chef_projet', 'referent_mairie', 'resp_financier'])
  );

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select p.name, fc.year, payer.name as paye, coalesce(benef.name, '(pour le projet)') as recoit,
--          fc.amount, fc.status
--     from funding_calls fc
--     join projects p on p.id = fc.project_id
--     join organizations payer on payer.id = fc.payer_org_id
--     left join organizations benef on benef.id = fc.beneficiary_org_id
--    order by fc.year desc, p.name;
