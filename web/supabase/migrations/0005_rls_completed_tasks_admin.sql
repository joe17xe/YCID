-- ============================================================
-- PATCH RLS — Modification des tâches terminées
-- À exécuter dans le SQL Editor Supabase
-- ============================================================
-- Règle métier :
--   · Une tâche TERMINÉE ne peut plus être modifiée par les
--     contributeurs / chefs de projet / resp. financiers.
--   · Seuls les admins plateforme et les admins d'organisation
--     YCID / LEY peuvent la rouvrir et la modifier.
--   · Toute modification est tracée dans audit_log (l'insertion
--     est autorisée par la policy ajoutée en bas de ce fichier).

-- Qui a le droit de modifier une tâche terminée ?
create or replace function can_edit_completed_tasks()
returns boolean language sql security definer as $$
  select
    exists (select 1 from profiles where id::text = auth.uid()::text and is_platform_admin = true)
    or exists (
      select 1 from memberships m
      join organizations o on o.id = m.org_id
      where m.user_id::text = auth.uid()::text
        and m.role = 'admin_org'
        and (upper(o.name) like '%YCID%' or upper(o.name) like '%LEY%')
    );
$$;

-- L'ancienne policy laissait les contributeurs modifier toutes les
-- tâches, y compris terminées. On la remplace par des policies par
-- commande pour exclure les tâches terminées.
drop policy if exists "Contributeur manage tasks" on tasks;
drop policy if exists "Contributeur insert tasks" on tasks;
drop policy if exists "Contributeur update open tasks" on tasks;
drop policy if exists "Contributeur delete open tasks" on tasks;
drop policy if exists "Admins manage tasks" on tasks;

create policy "Contributeur insert tasks" on tasks for insert with check (
  exists(
    select 1 from project_members pm
    join phases ph on ph.id = tasks.phase_id
    where pm.project_id = ph.project_id and pm.user_id::text = auth.uid()::text
    and pm.role in ('chef_projet','resp_financier','contributeur')
  )
);

-- USING porte sur la ligne existante : une tâche déjà terminée est
-- verrouillée. WITH CHECK ne re-teste que l'appartenance, pour que
-- l'on puisse encore passer une tâche EN COURS → TERMINÉE.
create policy "Contributeur update open tasks" on tasks for update using (
  tasks.status <> 'terminee'
  and exists(
    select 1 from project_members pm
    join phases ph on ph.id = tasks.phase_id
    where pm.project_id = ph.project_id and pm.user_id::text = auth.uid()::text
    and pm.role in ('chef_projet','resp_financier','contributeur')
  )
) with check (
  exists(
    select 1 from project_members pm
    join phases ph on ph.id = tasks.phase_id
    where pm.project_id = ph.project_id and pm.user_id::text = auth.uid()::text
    and pm.role in ('chef_projet','resp_financier','contributeur')
  )
);

create policy "Contributeur delete open tasks" on tasks for delete using (
  tasks.status <> 'terminee'
  and exists(
    select 1 from project_members pm
    join phases ph on ph.id = tasks.phase_id
    where pm.project_id = ph.project_id and pm.user_id::text = auth.uid()::text
    and pm.role in ('chef_projet','resp_financier','contributeur')
  )
);

-- Les admins YCID / LEY et admins plateforme gardent la main sur
-- toutes les tâches, terminées comprises.
create policy "Admins manage tasks" on tasks for all
  using (can_edit_completed_tasks())
  with check (can_edit_completed_tasks());

-- audit_log n'avait pas de policy d'insertion : nécessaire pour
-- tracer la réouverture d'une tâche terminée.
drop policy if exists "Insert audit" on audit_log;
create policy "Insert audit" on audit_log for insert with check (
  user_id::text = auth.uid()::text
  and (is_project_member(project_id) or can_edit_completed_tasks())
);
