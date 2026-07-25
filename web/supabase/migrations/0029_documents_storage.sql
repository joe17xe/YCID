-- ============================================================
-- PR 38a — Socle documentaire : bucket, rattachement, RLS
-- ============================================================
-- État de départ : la table `documents` existe depuis la 0001 (colonnes
-- storage_path, type, amount, paid…) et l'enum doc_type couvre déjà les
-- dix natures utiles. Mais RIEN n'était branché : aucun bucket Storage,
-- aucune server action, aucun composant de dépôt, aucune requête
-- `from('documents')` dans l'application. Le seul usage était le
-- compteur « 📎 N doc » sur les tâches, structurellement toujours à 0.
--
-- Cette migration ne livre pas de fonction métier visible : c'est la
-- plomberie sur laquelle reposent les PR 38b à 38e.

-- ------------------------------------------------------------
-- 1. Rattachement élargi
-- ------------------------------------------------------------
-- Un document ne pouvait se rattacher qu'à une tâche ou à une ligne
-- budgétaire. Impossible d'attacher une convention au projet, ou des
-- photos à une phase, sans inventer une tâche pour les porter.
--
-- `project_id` devient le rattachement de référence : toutes les RLS
-- s'appuient dessus. Les policies d'origine remontaient au projet par
-- sous-requête à travers tasks → phases, ce qui les rendait à la fois
-- coûteuses et aveugles aux documents sans tâche.
alter table documents
  add column if not exists project_id uuid references projects(id) on delete cascade,
  add column if not exists phase_id   uuid references phases(id)   on delete set null;

-- Reprise de l'existant AVANT la contrainte NOT NULL : le projet se
-- déduit de la tâche ou de la ligne selon le cas.
update documents d set project_id = ph.project_id
  from tasks t join phases ph on ph.id = t.phase_id
 where d.task_id = t.id and d.project_id is null;

update documents d set project_id = bl.project_id
  from budget_lines bl
 where d.budget_line_id = bl.id and d.project_id is null;

update documents d set phase_id = t.phase_id
  from tasks t
 where d.task_id = t.id and d.phase_id is null;

-- Un document sans projet n'est rattachable à rien et invisible sous
-- RLS : on refuse plutôt que de laisser des orphelins silencieux.
do $$
declare n int;
begin
  select count(*) into n from documents where project_id is null;
  if n > 0 then
    raise exception 'Migration 0029 : % document(s) sans projet identifiable. Rattachez-les ou supprimez-les avant de rejouer.', n;
  end if;
end $$;

alter table documents alter column project_id set not null;

create index if not exists documents_project_id_idx on documents(project_id);
create index if not exists documents_phase_id_idx   on documents(phase_id);

-- ------------------------------------------------------------
-- 2. Qui peut déposer
-- ------------------------------------------------------------
-- La lecture suit l'appartenance au projet ; le dépôt exige un rôle
-- actif. `validateur`, `auditeur` et `lecteur` consultent sans déposer.
create or replace function public.can_upload_document(pid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(pid is not null and (
    exists (
      select 1 from project_members pm
       where pm.project_id = pid and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'resp_financier', 'contributeur', 'referent_mairie')
    )
    or is_admin() or is_lead_org_admin()
  ), false);
$$;

-- ------------------------------------------------------------
-- 3. RLS de la table documents
-- ------------------------------------------------------------
-- Les policies de la 0001 / 0006 passaient par task_id ou
-- budget_line_id : un document rattaché seulement au projet ou à une
-- phase serait resté invisible. Elles sont remplacées, pas complétées.
drop policy if exists "Project members see documents" on documents;
create policy "Project members see documents" on documents
  for select using (is_project_member(project_id) or is_admin() or is_lead_org_admin());

drop policy if exists "Upload documents" on documents;
create policy "Upload documents" on documents
  for insert with check (can_upload_document(project_id));

drop policy if exists "Update documents" on documents;
create policy "Update documents" on documents
  for update using (can_upload_document(project_id))
  with check (can_upload_document(project_id));

-- Suppression : l'auteur du dépôt, ou un profil de pilotage. Un
-- contributeur ne doit pas pouvoir effacer la facture d'un autre.
drop policy if exists "Delete documents" on documents;
create policy "Delete documents" on documents
  for delete using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from project_members pm
       where pm.project_id = documents.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'resp_financier')
    )
    or is_admin() or is_lead_org_admin()
  );

-- ------------------------------------------------------------
-- 4. Bucket Storage privé
-- ------------------------------------------------------------
-- PRIVÉ, contrairement à « avatars » : un devis, une facture ou une
-- photo de terrain ne doivent pas être atteignables par URL devinable.
-- L'accès passe par des URL signées à durée limitée.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Chemin : projets/<project_id>/<phase_id|_>/<uuid>-<nom>
-- soit foldername(name) = {projets, <project_id>, <phase_id|_>}.
-- Le cast en uuid est isolé dans une fonction : un objet au chemin
-- inattendu ferait autrement échouer TOUTE requête sur storage.objects,
-- Postgres ne garantissant pas l'ordre d'évaluation d'un AND.
create or replace function public.document_path_project_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return ((storage.foldername(object_name))[2])::uuid;
exception when others then
  return null;
end;
$$;

drop policy if exists "Documents read" on storage.objects;
create policy "Documents read" on storage.objects
  for select using (
    bucket_id = 'documents'
    and is_project_member(public.document_path_project_id(name))
  );

drop policy if exists "Documents upload" on storage.objects;
create policy "Documents upload" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and public.can_upload_document(public.document_path_project_id(name))
  );

drop policy if exists "Documents update" on storage.objects;
create policy "Documents update" on storage.objects
  for update using (
    bucket_id = 'documents'
    and public.can_upload_document(public.document_path_project_id(name))
  );

drop policy if exists "Documents delete" on storage.objects;
create policy "Documents delete" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and public.can_upload_document(public.document_path_project_id(name))
  );
