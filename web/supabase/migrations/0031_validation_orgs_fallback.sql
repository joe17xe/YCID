-- ============================================================
-- PR 38b (correctif) — Repli de validation : financeur PUIS porteuse
-- ============================================================
-- La 0030 annonçait « le financeur de la ligne, sinon l'organisation
-- porteuse », mais sollicitait les DEUX : le UNION ALL du repli
-- rassemblait funder_org_id et lead_org_id sans priorité entre eux.
-- Constaté en test — un devis sur une ligne financée par le Département
-- partait aussi en validation chez l'association porteuse, à qui l'on
-- demandait donc d'approuver un devis qu'elle avait elle-même obtenu.
--
-- Ordre rétabli : règles du projet si configurées, sinon financeur de la
-- ligne, sinon seulement l'organisation porteuse.

create or replace function public.validation_orgs_for_document(doc_id uuid)
returns setof uuid
language sql
security definer
set search_path = public
as $$
  with doc as (
    select d.id, d.type, d.project_id, d.budget_line_id from documents d where d.id = doc_id
  ),
  par_regle as (
    select distinct po.org_id
      from doc
      join validation_rules vr on vr.project_id = doc.project_id and vr.doc_type = doc.type
      join project_organizations po on po.project_id = doc.project_id and po.role = vr.role
  ),
  financeur as (
    select distinct bl.funder_org_id as org_id
      from doc join budget_lines bl on bl.id = doc.budget_line_id
     where bl.funder_org_id is not null
  ),
  porteuse as (
    select distinct p.lead_org_id as org_id
      from doc join projects p on p.id = doc.project_id
     where p.lead_org_id is not null
  )
  select org_id from par_regle
  union
  select org_id from financeur where not exists (select 1 from par_regle)
  union
  select org_id from porteuse
   where not exists (select 1 from par_regle)
     and not exists (select 1 from financeur);
$$;
