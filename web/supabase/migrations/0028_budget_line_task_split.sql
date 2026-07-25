-- ============================================================
-- PR 40b — Répartition d'une ligne budgétaire sur plusieurs tâches
-- ============================================================
-- Précision du cadrage YCID (25/07/2026), postérieure à la 0027 :
-- « une ligne budgétaire peut avoir plusieurs tâches ; un budget de
-- 40 000 € peut être divisé en deux tâches, 10 000 € et 30 000 € ».
--
-- La 0027 posait `budget_lines.task_id` : UNE ligne → UNE tâche, pour
-- la TOTALITÉ du montant. Cette colonne ne peut structurellement pas
-- porter une répartition — il n'y a nulle part où écrire « 10 000 sur
-- celle-ci, 30 000 sur celle-là ». D'où une table de liaison portant
-- le montant affecté.
--
-- Le modèle devient N:M avec montant, et couvre les quatre cas réels :
--   · co-financement — plusieurs lignes financent une même tâche
--     (Département + Mairie + association sur le même livrable) ;
--   · répartition — une ligne se répartit sur plusieurs tâches ;
--   · ligne sans tâche — valorisation, frais de structure ;
--   · tâche sans ligne — « signer la convention », budget 0 €.
--
-- La ligne conserve son `planned_amount` intact : c'est la vérité de
-- la convention de financement, qu'on ne découpe pas. La répartition
-- est opérationnelle et vient par-dessus. La somme des affectations
-- peut donc être INFÉRIEURE au montant de la ligne (reste non
-- affecté), jamais supérieure.

create table if not exists budget_line_tasks (
  budget_line_id uuid not null references budget_lines(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  amount numeric not null default 0 check (amount >= 0),
  primary key (budget_line_id, task_id)
);

create index if not exists budget_line_tasks_task_id_idx on budget_line_tasks(task_id);

-- Reprise des données de la 0027 : le lien 1:1 existant devient une
-- affectation de la totalité du montant. Sans cela, les rattachements
-- saisis entre les deux migrations seraient perdus en silence.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'budget_lines' and column_name = 'task_id'
  ) then
    insert into budget_line_tasks (budget_line_id, task_id, amount)
    select bl.id, bl.task_id, coalesce(bl.planned_amount, 0)
      from budget_lines bl
     where bl.task_id is not null
    on conflict do nothing;
  end if;
end $$;

drop index if exists budget_lines_task_id_idx;
alter table budget_lines drop column if exists task_id;

-- ------------------------------------------------------------
-- RLS : strictement alignée sur budget_lines. Une affectation n'a pas
-- de droits propres — elle suit la ligne qu'elle découpe.
-- ------------------------------------------------------------
alter table budget_line_tasks enable row level security;

drop policy if exists "See budget line tasks" on budget_line_tasks;
create policy "See budget line tasks" on budget_line_tasks for select using (
  exists (
    select 1 from budget_lines bl
     where bl.id = budget_line_tasks.budget_line_id
       and is_project_member(bl.project_id)
  )
);

drop policy if exists "Manage budget line tasks" on budget_line_tasks;
create policy "Manage budget line tasks" on budget_line_tasks for all using (
  exists (
    select 1 from budget_lines bl
      join project_members pm on pm.project_id = bl.project_id
     where bl.id = budget_line_tasks.budget_line_id
       and pm.user_id = auth.uid()
       and pm.role in ('chef_projet', 'resp_financier')
  )
) with check (
  exists (
    select 1 from budget_lines bl
      join project_members pm on pm.project_id = bl.project_id
     where bl.id = budget_line_tasks.budget_line_id
       and pm.user_id = auth.uid()
       and pm.role in ('chef_projet', 'resp_financier')
  )
);

drop policy if exists "Admins manage budget line tasks" on budget_line_tasks;
create policy "Admins manage budget line tasks" on budget_line_tasks
  for all using (is_admin() or is_lead_org_admin())
  with check (is_admin() or is_lead_org_admin());

-- ------------------------------------------------------------
-- Cohérence
-- ------------------------------------------------------------
-- La 0027 validait `new.task_id`, colonne qui vient de disparaître :
-- la fonction est remplacée, sans quoi les écritures sur budget_lines
-- échoueraient. Elle conserve le contrôle phase ↔ projet (trou de la
-- 0001) et gagne deux règles liées à la répartition.
create or replace function public.check_budget_line_coherence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase_project uuid;
  v_bad_task text;
  v_allocated numeric;
begin
  if new.phase_id is not null then
    select ph.project_id into v_phase_project from phases ph where ph.id = new.phase_id;
    if v_phase_project is distinct from new.project_id then
      raise exception 'La phase sélectionnée n''appartient pas au projet de la ligne budgétaire.';
    end if;
  end if;

  -- Changer la phase d'une ligne déjà répartie rendrait ses
  -- affectations incohérentes : on refuse plutôt que de les détacher
  -- en silence.
  if tg_op = 'UPDATE' and new.phase_id is distinct from old.phase_id then
    select t.title into v_bad_task
      from budget_line_tasks blt
      join tasks t on t.id = blt.task_id
     where blt.budget_line_id = new.id
       and (new.phase_id is null or t.phase_id <> new.phase_id)
     limit 1;
    if v_bad_task is not null then
      raise exception 'La tâche « % » financée par cette ligne n''appartient pas à la nouvelle phase. Retirez l''affectation avant de changer de phase.', v_bad_task;
    end if;
  end if;

  -- Baisser le montant sous la somme déjà répartie créerait une ligne
  -- qui finance plus qu'elle ne porte.
  if tg_op = 'UPDATE' then
    select coalesce(sum(blt.amount), 0) into v_allocated
      from budget_line_tasks blt where blt.budget_line_id = new.id;
    if v_allocated > coalesce(new.planned_amount, 0) then
      raise exception 'Le montant de la ligne (%) est inférieur à la somme déjà répartie sur les tâches (%).', coalesce(new.planned_amount, 0), v_allocated;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_budget_line_coherence on budget_lines;
create trigger trg_budget_line_coherence
  before insert or update on budget_lines
  for each row execute function public.check_budget_line_coherence();

-- Symétrique, côté affectation.
create or replace function public.check_budget_line_task_coherence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line_phase uuid;
  v_line_amount numeric;
  v_task_phase uuid;
  v_allocated numeric;
begin
  select bl.phase_id, coalesce(bl.planned_amount, 0)
    into v_line_phase, v_line_amount
    from budget_lines bl where bl.id = new.budget_line_id;
  select t.phase_id into v_task_phase from tasks t where t.id = new.task_id;
  if v_task_phase is null then
    raise exception 'Tâche introuvable.';
  end if;

  if v_line_phase is null then
    -- Aligner plutôt que refuser : affecter une tâche suffit à situer
    -- la ligne dans une phase (comportement retenu en 0027).
    update budget_lines set phase_id = v_task_phase where id = new.budget_line_id;
  elsif v_line_phase <> v_task_phase then
    raise exception 'La tâche financée n''appartient pas à la phase de la ligne budgétaire.';
  end if;

  select coalesce(sum(blt.amount), 0) into v_allocated
    from budget_line_tasks blt
   where blt.budget_line_id = new.budget_line_id
     and blt.task_id <> new.task_id;
  if v_allocated + new.amount > v_line_amount then
    raise exception 'La répartition (%) dépasse le montant de la ligne (%).', v_allocated + new.amount, v_line_amount;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_budget_line_task_coherence on budget_line_tasks;
create trigger trg_budget_line_task_coherence
  before insert or update on budget_line_tasks
  for each row execute function public.check_budget_line_task_coherence();
