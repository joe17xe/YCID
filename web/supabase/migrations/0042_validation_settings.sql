-- ============================================================
-- 0042 — Le circuit devient réglable depuis l'application
-- ============================================================
-- La 0041 a posé la chaîne réelle — porteur, puis coordinateur — mais
-- ses deux réglages n'avaient aucun écran : `coordinator_org_id` ne se
-- changeait qu'en SQL, et `projects.lead_org_id` se figeait à la
-- création. Annoncer un circuit « paramétrable » dans ces conditions
-- serait une affirmation de documentation, pas une réalité d'usage : le
-- jour où la mairie donne son vrai contact et où le porteur change, on
-- ne peut rien corriger.
--
-- Cette migration ajoute le seul réglage qui manquait vraiment, et les
-- écrans arrivent avec elle.

-- ------------------------------------------------------------
-- Seuil de sollicitation du coordinateur
-- ------------------------------------------------------------
-- Faire signer deux organisations pour 80 € de fournitures use le
-- circuit — et un circuit qu'on trouve pénible finit contourné. En
-- dessous du seuil, l'organisation porteuse valide seule.
--
-- Le porteur, LUI, n'est jamais sauté : une dépense engage toujours
-- quelqu'un. Un seuil qui supprimerait toute validation ferait du
-- circuit une option, ce qu'il ne doit pas être sur de l'argent public.
--
-- Zéro = aucun seuil, donc comportement de la 0041 inchangé. C'est le
-- défaut : un réglage neuf ne doit pas modifier un circuit en service
-- sans décision explicite.
alter table platform_settings
  add column if not exists coordinator_min_amount numeric not null default 0;

-- ------------------------------------------------------------
-- La chaîne tient compte du seuil
-- ------------------------------------------------------------
-- Le montant lu est celui du DOCUMENT, pas de la ligne budgétaire : ce
-- qu'on soumet à validation est un devis précis, pas l'enveloppe qui le
-- contient. Un devis sans montant ne bénéficie d'aucune dispense — il
-- n'y a rien à comparer, et le passe-droit irait au dossier le moins
-- renseigné.
create or replace function public.validation_chain_for_document(doc_id uuid)
returns table (org_id uuid, step smallint)
language sql
security definer
set search_path = public
as $$
  with doc as (
    select d.id, d.project_id, d.amount from documents d where d.id = doc_id
  ),
  reglages as (
    select s.coordinator_org_id, s.coordinator_min_amount
      from platform_settings s where s.id = true
  ),
  porteur as (
    select p.lead_org_id as org_id
      from doc join projects p on p.id = doc.project_id
     where p.lead_org_id is not null
  ),
  coordinateur as (
    select r.coordinator_org_id as org_id
      from reglages r, doc
     where r.coordinator_org_id is not null
       -- Sous le seuil, le coordinateur n'est pas sollicité.
       and (r.coordinator_min_amount <= 0
            or doc.amount is null
            or doc.amount >= r.coordinator_min_amount)
  ),
  -- Sans coordinateur — non configuré, ou écarté par le seuil — le
  -- porteur reste le seul échelon.
  coordinateur_toujours as (
    select r.coordinator_org_id as org_id
      from reglages r where r.coordinator_org_id is not null
  )
  select org_id, 1::smallint from porteur
  union all
  select c.org_id, 2::smallint
    from coordinateur c
   where not exists (select 1 from porteur p where p.org_id = c.org_id)
  union all
  -- Repli : projet sans organisation porteuse. Le coordinateur devient
  -- le premier et unique échelon, seuil ou non — sinon le devis ne
  -- partirait nulle part, et la panne serait muette.
  select c.org_id, 1::smallint
    from coordinateur_toujours c
   where not exists (select 1 from porteur);
$$;

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select brand_name, coordinator_org_id, coordinator_min_amount
--     from platform_settings where id = true;
--
-- Attendu après cette migration : coordinator_min_amount = 0, donc
-- aucune dispense tant qu'un administrateur n'en décide pas.
