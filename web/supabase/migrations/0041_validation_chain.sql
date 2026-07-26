-- ============================================================
-- 0041 — Le circuit réel : porteur, PUIS coordinateur
-- ============================================================
-- Arbitrage YCID du 27/07, qui invalide le routage précédent :
--
--   « Le schéma est très simple. Maria, chef de projet, propose ; LEY, le
--     porteur, valide ; puis YCID valide. Nous n'allons pas solliciter le
--     ministère des Affaires étrangères pour chaque ligne : nous avons
--     déjà eu le budget, nous le gérons et nous rendons compte. »
--
-- Deux erreurs de conception sont corrigées d'un coup.
--
-- 1. LE MAUVAIS DESTINATAIRE. La 0031 adressait le devis au FINANCEUR de
--    la ligne. Sur ce programme, les financeurs sont le MEAE et le
--    Département — qui ont voté une enveloppe et attendent un
--    compte rendu, pas une approbation ligne à ligne. Le circuit
--    sollicitait donc des organisations qui n'ont ni compte, ni vocation
--    à répondre : chaque devis restait bloqué, et l'unanimité livrée
--    hier aurait gelé l'engagé de tout le programme.
--
--    Le financeur ne joue plus aucun rôle dans le routage. Le budget est
--    voté en amont ; la redevabilité s'exerce en aval, par le rapport.
--
-- 2. L'ABSENCE D'ORDRE. `validations` était un ensemble plat : toutes les
--    organisations sollicitées en même temps. Or « le porteur valide,
--    PUIS YCID valide » est une hiérarchie — l'association engage sa
--    dépense, le coordinateur du programme l'entérine. Laisser YCID se
--    prononcer avant le porteur viderait le premier échelon de son sens.
--
-- La chaîne devient donc : étape 1, l'organisation PORTEUSE du projet ;
-- étape 2, l'organisation COORDINATRICE du programme. Quand les deux
-- coïncident — la Coordination est portée par YCID — la chaîne se réduit
-- à une seule étape plutôt que de demander deux fois la même signature.

-- ------------------------------------------------------------
-- 1. Qui coordonne
-- ------------------------------------------------------------
-- En configuration, pas en dur : l'application est en marque blanche
-- (0018), et « YCID » n'est le coordinateur que de CE déploiement.
alter table platform_settings
  add column if not exists coordinator_org_id uuid references organizations(id) on delete set null;

update platform_settings
   set coordinator_org_id = (select id from organizations where name = 'YCID' limit 1)
 where coordinator_org_id is null;

-- ------------------------------------------------------------
-- 2. L'ordre
-- ------------------------------------------------------------
alter table validations
  add column if not exists step smallint not null default 1;

-- Les validations déjà en base sont toutes de premier échelon : elles ont
-- été créées sans notion d'ordre, et rien ne permet de deviner après coup
-- laquelle aurait été seconde.
create index if not exists validations_doc_step_idx on validations (document_id, step);

-- ------------------------------------------------------------
-- 3. La chaîne
-- ------------------------------------------------------------
-- Remplace validation_orgs_for_document(), qui partait du financeur.
--
-- `validation_rules` n'est plus consultée. Cette table, prévue dans la
-- 0001 pour paramétrer le circuit par rôle d'organisation, n'a jamais
-- reçu une seule ligne en un an — et surtout, elle ne sait pas exprimer
-- un ORDRE. La consulter ici casserait la garantie qu'apporte l'étape.
-- Elle reste en base, dormante ; c'est une candidate au retrait.
drop function if exists public.validation_orgs_for_document(uuid);

create or replace function public.validation_chain_for_document(doc_id uuid)
returns table (org_id uuid, step smallint)
language sql
security definer
set search_path = public
as $$
  with doc as (
    select d.id, d.project_id from documents d where d.id = doc_id
  ),
  porteur as (
    select p.lead_org_id as org_id
      from doc join projects p on p.id = doc.project_id
     where p.lead_org_id is not null
  ),
  coordinateur as (
    select s.coordinator_org_id as org_id
      from platform_settings s
     where s.id = true and s.coordinator_org_id is not null
  )
  select org_id, 1::smallint from porteur
  union all
  -- Le coordinateur n'est sollicité qu'en second, et seulement s'il n'est
  -- pas déjà le porteur : sur la Coordination, YCID porte le projet et
  -- signerait sinon deux fois.
  select c.org_id, 2::smallint
    from coordinateur c
   where not exists (select 1 from porteur p where p.org_id = c.org_id)
  union all
  -- Repli : si le projet n'a pas d'organisation porteuse, le
  -- coordinateur devient le premier et unique échelon. Sans cela un
  -- devis ne partirait nulle part, et la panne serait muette.
  select c.org_id, 1::smallint
    from coordinateur c
   where not exists (select 1 from porteur);
$$;

-- ------------------------------------------------------------
-- 4. On ne saute pas son tour
-- ------------------------------------------------------------
-- L'ordre serait décoratif s'il n'était pas opposable : un lien direct,
-- un rafraîchissement mal placé, et le second échelon se prononcerait
-- avant le premier. La règle est donc posée au niveau de la base, comme
-- toutes celles qui protègent l'argent public.
drop policy if exists "Decide validation" on validations;
create policy "Decide validation" on validations
  for update using (
    -- Aucun échelon antérieur ne doit rester en attente ou refusé.
    not exists (
      select 1 from validations prev
       where prev.document_id = validations.document_id
         and prev.step < validations.step
         and prev.decision is distinct from 'valide'
    )
    and (
      -- Cas normal : membre de l'organisation sollicitée.
      exists (
        select 1 from memberships m
         where m.user_id = auth.uid() and m.org_id = validations.org_id
      )
      -- Recours d'exploitation, réservé au rôle « admin » (0036).
      or exists (
        select 1 from profiles p
         where p.id = auth.uid()
           and coalesce(p.platform_role, case when p.is_platform_admin then 'admin' else 'user' end) = 'admin'
      )
    )
  );

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select pr.name as projet,
--          porteur.name as etape_1,
--          coord.name   as etape_2
--     from projects pr
--     left join organizations porteur on porteur.id = pr.lead_org_id
--     left join platform_settings s on s.id = true
--     left join organizations coord on coord.id = s.coordinator_org_id
--    order by pr.name;
--
-- Attendu : Triade Villepreux → LEY puis YCID ; Triade Jouy → Comité de
-- Jumelage puis YCID ; Coordination → YCID seul (porteur et coordinateur
-- confondus).
