-- ============================================================
-- PR 38b — Devis, factures et circuit de validation
-- ============================================================
-- La table `validations` existe depuis la 0001 mais n'a JAMAIS servi.
-- Et pour cause : elle porte une policy de lecture et une policy de
-- décision (update), mais AUCUNE policy d'insertion. Personne ne pouvait
-- donc créer une validation — le circuit était structurellement mort,
-- pas seulement inutilisé.
--
-- Cette migration ouvre l'insertion, réaligne la lecture sur
-- documents.project_id (posé en 0029), et ajoute le peu qui manquait au
-- suivi des montants : la date de paiement.

-- ------------------------------------------------------------
-- 1. Date de paiement
-- ------------------------------------------------------------
-- `documents.paid` (booléen) existe depuis la 0001, mais sans date : on
-- pouvait savoir QU'une facture était payée, jamais QUAND. Un financeur
-- public demande l'échéancier réel, pas un état à l'instant T.
alter table documents
  add column if not exists paid_at date;

-- ------------------------------------------------------------
-- 2. RLS de validations
-- ------------------------------------------------------------
-- Lecture : la 0006 remontait au projet par sous-requête à travers
-- tasks → phases ou budget_lines. Depuis la 0029, documents.project_id
-- est renseigné et NOT NULL : la jointure devient directe, et cesse
-- d'être aveugle aux documents rattachés au seul projet.
drop policy if exists "See validations" on validations;
create policy "See validations" on validations
  for select using (
    exists (
      select 1 from documents d
       where d.id = validations.document_id
         and (is_project_member(d.project_id) or is_admin() or is_lead_org_admin())
    )
  );

-- Insertion : c'est ce qui manquait. Créer une validation revient à
-- soumettre une pièce au circuit — même droit que déposer la pièce.
drop policy if exists "Create validation" on validations;
create policy "Create validation" on validations
  for insert with check (
    exists (
      select 1 from documents d
       where d.id = validations.document_id
         and can_upload_document(d.project_id)
    )
  );

-- Décision : membre de l'organisation sollicitée, ou pilotage du projet.
-- La 0001 n'admettait QUE le membre de l'organisation : un devis adressé
-- à une organisation sans compte actif restait bloqué pour toujours,
-- sans recours.
drop policy if exists "Decide validation" on validations;
create policy "Decide validation" on validations
  for update using (
    exists (select 1 from memberships m where m.user_id = auth.uid() and m.org_id = validations.org_id)
    or exists (
      select 1 from documents d
        join project_members pm on pm.project_id = d.project_id
       where d.id = validations.document_id
         and pm.user_id = auth.uid() and pm.role in ('chef_projet', 'validateur')
    )
    or is_admin() or is_lead_org_admin()
  );

-- Suppression : retirer une pièce doit emporter ses validations. La
-- cascade de la FK s'en charge, mais un retrait manuel doit rester
-- possible pour le pilotage (soumission adressée à la mauvaise organisation).
drop policy if exists "Delete validation" on validations;
create policy "Delete validation" on validations
  for delete using (
    exists (
      select 1 from documents d
        join project_members pm on pm.project_id = d.project_id
       where d.id = validations.document_id
         and pm.user_id = auth.uid() and pm.role in ('chef_projet', 'resp_financier')
    )
    or is_admin() or is_lead_org_admin()
  );

create index if not exists validations_document_id_idx on validations(document_id);

-- ------------------------------------------------------------
-- 3. À qui adresser une validation
-- ------------------------------------------------------------
-- `validation_rules(project_id, doc_type, role)` existe depuis la 0001,
-- également inutilisée. Elle reste la source de vérité quand elle est
-- renseignée. Mais exiger une configuration préalable rendrait le
-- circuit invisible sur tout projet existant — d'où un repli explicite :
-- le financeur de la ligne, sinon l'organisation porteuse du projet.
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
  repli as (
    select distinct org_id from (
      -- Financeur de la ligne budgétaire concernée
      select bl.funder_org_id as org_id
        from doc join budget_lines bl on bl.id = doc.budget_line_id
       where bl.funder_org_id is not null
      union all
      -- À défaut, l'organisation porteuse du projet
      select p.lead_org_id
        from doc join projects p on p.id = doc.project_id
       where p.lead_org_id is not null
    ) s where org_id is not null
  )
  select org_id from par_regle
  union
  select org_id from repli where not exists (select 1 from par_regle);
$$;
