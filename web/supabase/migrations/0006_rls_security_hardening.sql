-- ============================================================
-- PATCH SÉCURITÉ — Durcissement RLS
-- À exécuter dans le SQL Editor Supabase (après les patchs
-- rls-fix-recursion.sql et rls-fix-project-orgs.sql)
-- ============================================================
-- Corrige :
--   1. Escalade de privilèges : un utilisateur pouvait passer
--      son propre profil en is_platform_admin via l'API REST.
--   2. validation_rules et budget_categories sans RLS (lecture
--      et écriture ouvertes à tout utilisateur connecté).
--   3. Policies trop permissives (auth.uid() is not null) sur
--      documents, indicator_measures, organizations, validations.

-- ------------------------------------------------------------
-- 1. Verrou sur is_platform_admin
-- ------------------------------------------------------------
-- is_admin() est définie par rls-fix-recursion.sql ; on la
-- (re)crée ici pour rendre le patch autonome.
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id::text = auth.uid()::text and is_platform_admin = true
  );
$$;

create or replace function protect_profile_flags()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    if new.is_platform_admin and not is_admin() then
      raise exception 'is_platform_admin ne peut être attribué que par un administrateur';
    end if;
  elsif new.is_platform_admin is distinct from old.is_platform_admin and not is_admin() then
    raise exception 'is_platform_admin ne peut être modifié que par un administrateur';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_flags on profiles;
create trigger trg_protect_profile_flags
  before insert or update on profiles
  for each row execute function protect_profile_flags();

-- ------------------------------------------------------------
-- 2. RLS manquant : validation_rules et budget_categories
-- ------------------------------------------------------------
alter table validation_rules enable row level security;

drop policy if exists "See validation rules" on validation_rules;
create policy "See validation rules" on validation_rules
  for select using (is_project_member(project_id));

drop policy if exists "Chef manage validation rules" on validation_rules;
create policy "Chef manage validation rules" on validation_rules
  for all using (
    is_admin()
    or exists(
      select 1 from project_members
      where project_id = validation_rules.project_id
      and user_id::text = auth.uid()::text and role = 'chef_projet'
    )
  );

alter table budget_categories enable row level security;

-- project_id null = catégories par défaut de la plateforme
drop policy if exists "See budget categories" on budget_categories;
create policy "See budget categories" on budget_categories
  for select using (project_id is null or is_project_member(project_id));

drop policy if exists "Manage budget categories" on budget_categories;
create policy "Manage budget categories" on budget_categories
  for all using (
    is_admin()
    or (project_id is not null and exists(
      select 1 from project_members pm
      where pm.project_id = budget_categories.project_id
      and pm.user_id::text = auth.uid()::text and pm.role in ('chef_projet','resp_financier')
    ))
  );

-- ------------------------------------------------------------
-- 3. Policies trop permissives
-- ------------------------------------------------------------
-- Documents : l'upload exige d'être membre du projet de la tâche
-- ou de la ligne budgétaire cible (avant : tout connecté).
drop policy if exists "Upload documents" on documents;
create policy "Upload documents" on documents
  for insert with check (
    (task_id is not null and is_project_member((
      select ph.project_id from tasks t
      join phases ph on ph.id = t.phase_id
      where t.id = documents.task_id
    )))
    or (budget_line_id is not null and is_project_member((
      select bl.project_id from budget_lines bl
      where bl.id = documents.budget_line_id
    )))
  );

-- Mesures d'indicateurs : membres du projet uniquement.
drop policy if exists "Add measure" on indicator_measures;
create policy "Add measure" on indicator_measures
  for insert with check (
    is_project_member((
      select project_id from indicators
      where id = indicator_measures.indicator_id
    ))
  );

-- Création d'organisations : réservée aux admins plateforme
-- (aucune UI de création aujourd'hui ; à rouvrir avec l'écran
-- d'administration si besoin).
drop policy if exists "Auth users create orgs" on organizations;
create policy "Admins create orgs" on organizations
  for insert with check (is_admin());

-- Validations : visibles par les membres du projet du document
-- (avant : tout connecté).
drop policy if exists "See validations" on validations;
create policy "See validations" on validations
  for select using (
    is_project_member((
      select coalesce(
        (select ph.project_id from tasks t join phases ph on ph.id = t.phase_id where t.id = d.task_id),
        (select bl.project_id from budget_lines bl where bl.id = d.budget_line_id)
      )
      from documents d where d.id = validations.document_id
    ))
  );
