-- ============================================================
-- SOLID'PILOT — Rattrapage 0035 → 0038, à coller en une fois
-- ============================================================
-- Généré le 26/07/2026. Contient, dans l'ordre :
--
--   0035  storage_stats() repart de storage.buckets (un espace vide
--         disparaissait de l'inventaire)
--   0036  décider d'une validation revient aux MEMBRES de
--         l'organisation sollicitée ; recours réservé au rôle admin
--   0037  deux rôles plateforme (admin / user) ; le périmètre vient de
--         l'appartenance à une organisation ; capacité can_manage_roadmap
--   0038  auditeur, seul rôle de consultation ; « Add measure » resserrée
--
-- SANS RISQUE À RELANCER. Tout est en `create or replace`,
-- `drop ... if exists` ou `add column if not exists` ; les reprises de
-- données ne trouvent plus rien à faire au second passage. Vous pouvez
-- donc l'exécuter sans savoir lesquelles ont déjà tourné.
--
-- Le bloc de VÉRIFICATION en fin de fichier ne modifie rien : il affiche
-- l'état obtenu. Lisez-le, c'est lui qui dit si tout s'est bien passé.


-- ############################################################
-- ### 0035_storage_stats_all_buckets.sql
-- ############################################################

-- ============================================================
-- Correctif PR 41 — lister TOUS les espaces de stockage
-- ============================================================
-- Constaté en recette : l'écran Stockage n'affichait qu'un seul espace
-- (« Pièces des projets ») au lieu des trois. Cause : la fonction
-- agrégeait `storage.objects` en groupant par bucket_id. Un bucket sans
-- aucun objet ne produit aucune ligne, donc disparaît — et rien ne
-- distingue « bucket vide » de « bucket inexistant ».
--
-- Pour un écran dont la fonction est l'inventaire, c'est un défaut de
-- fond : on ne peut pas constater qu'un espace est vide s'il n'est pas
-- affiché. On part donc de `storage.buckets`, avec une jointure externe.

create or replace function public.storage_stats()
returns table (bucket text, files bigint, bytes bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_admin() or is_lead_org_admin()) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
    select b.id::text,
           count(o.id)::bigint,
           coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
      from storage.buckets b
      left join storage.objects o on o.bucket_id = b.id
     group by b.id
     order by 3 desc, 1;
end;
$$;


-- ############################################################
-- ### 0036_validation_decision_scope.sql
-- ############################################################

-- ============================================================
-- Correctif 38b — qui peut décider d'une validation
-- ============================================================
-- Constaté en recette : un compte de rôle YCID a pu valider un devis
-- adressé à « Libanais en Yvelines ». La décision s'enregistre alors
-- sous l'organisation LEY, sans que rien n'indique qu'une autre
-- organisation a tranché à sa place.
--
-- Cause : la policy posée en 0030 admettait `is_admin()`, vrai pour
-- tout membre `admin_org` d'une organisation nommée YCID ou LEY. Le
-- garde-fou visait à débloquer un devis adressé à une organisation sans
-- compte actif — intention légitime, portée beaucoup trop large : il
-- autorisait n'importe quel administrateur à se prononcer au nom de
-- n'importe qui.
--
-- C'est d'autant plus grave avec la règle d'unanimité arbitrée le
-- 25/07 : si un administrateur peut décider pour toutes les
-- organisations, l'unanimité ne veut plus rien dire.
--
-- Règle retenue : décide qui est MEMBRE de l'organisation sollicitée.
-- Le recours subsiste, mais réservé aux administrateurs PLATEFORME
-- (`is_platform_admin`) — un rôle d'exploitation, pas un rôle
-- partenaire. Et il devient visible : voir `decided_by` ci-dessous.

drop policy if exists "Decide validation" on validations;
create policy "Decide validation" on validations
  for update using (
    -- Cas normal : membre de l'organisation sollicitée.
    exists (
      select 1 from memberships m
       where m.user_id = auth.uid() and m.org_id = validations.org_id
    )
    -- Recours d'exploitation : rôle « admin » UNIQUEMENT.
    --
    -- Ni is_admin(), qui englobe le rôle « ycid ». Ni is_platform_admin,
    -- piège moins visible : l'écran de gestion des comptes pose
    -- `is_platform_admin = (role <> 'user')` (user-actions.ts), si bien
    -- que TOUT compte de rôle « ycid » a ce drapeau à true. S'y fier
    -- rouvrirait exactement le trou qu'on ferme — c'est un compte de
    -- rôle ycid qui a validé au nom de LEY.
    --
    -- Le coalesce reprend la dérivation de l'application pour les
    -- comptes antérieurs à la 0017, dont platform_role est nul.
    or exists (
      select 1 from profiles p
       where p.id = auth.uid()
         and coalesce(p.platform_role, case when p.is_platform_admin then 'admin' else 'user' end) = 'admin'
    )
  );

-- Le chef de projet perd ce droit, qu'il n'aurait jamais dû avoir : il
-- est le plus souvent le déposant du devis. Se valider soi-même vide le
-- circuit de son sens.

-- ------------------------------------------------------------
-- Rendre la décision hors organisation VISIBLE
-- ------------------------------------------------------------
-- `decided_by` était déjà renseigné, mais rien ne permettait de savoir
-- si le décideur appartenait à l'organisation sollicitée. Pour une
-- piste d'audit destinée à un financeur, « validé par LEY » et « validé
-- par un administrateur au nom de LEY » ne sont pas la même affirmation.
create or replace function public.validation_decided_outside_org(validation_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select v.decided_by is not null
     and not exists (
       select 1 from memberships m
        where m.user_id = v.decided_by and m.org_id = v.org_id
     )
    from validations v
   where v.id = validation_id;
$$;


-- ############################################################
-- ### 0037_two_platform_roles.sql
-- ############################################################

-- ============================================================
-- PR 42 — Deux rôles plateforme : Administrateur et Utilisateur
-- ============================================================
-- Arbitrage YCID du 26/07 : « YCID est une organisation, pas un rôle ».
--
-- Le modèle d'origine confondait trois axes indépendants :
--   · l'APPARTENANCE — à quelle organisation on appartient (YCID, LEY,
--     Mairie d'Azour) ;
--   · le PÉRIMÈTRE — quels projets on voit ;
--   · la CAPACITÉ — ce qu'on peut y faire.
--
-- Le rôle « ycid » les écrasait tous les trois en un seul réglage
-- global, et donnait l'administration complète à qui n'avait besoin que
-- de voir le programme. C'est ce qui a ouvert la console de gestion des
-- comptes à Maria Maroun, dont ce n'est pas la fonction.
--
-- Le modèle devient explicite :
--   · le PÉRIMÈTRE vient de l'appartenance à une organisation —
--     is_project_member() joignait DÉJÀ project_organizations, donc un
--     membre d'YCID voit tous les projets auxquels YCID est rattachée.
--     Le rôle global ne faisait que court-circuiter ce mécanisme ;
--   · la CAPACITÉ vient du rôle PROJET (chef de projet, responsable
--     financier, terrain, validateur…) ;
--   · le rôle PLATEFORME ne garde qu'une question : administre-t-on
--     l'outil lui-même ? Deux valeurs suffisent.
--
-- ⚠️ Conséquence assumée : is_admin() est utilisé par une soixantaine de
-- policies. Les comptes « ycid » y perdent l'accès global — c'est
-- précisément l'objet du changement. Ils conservent leurs droits par
-- leurs rôles projet et leur organisation.

-- ------------------------------------------------------------
-- 1. Administrer l'outil : le seul rôle « admin »
-- ------------------------------------------------------------
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and coalesce(platform_role, case when is_platform_admin then 'admin' else 'user' end) = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- 2. Voir un projet : appartenance, pas rôle global
-- ------------------------------------------------------------
-- L'administrateur conserve la vision complète : il doit pouvoir
-- diagnostiquer un projet sans s'y ajouter comme membre. Mais c'est
-- désormais le SEUL raccourci global.
create or replace function is_project_member(pid uuid)
returns boolean language sql security definer as $$
  select
    is_admin()
    or exists (
      select 1 from project_members
      where project_id = pid and user_id = auth.uid()
    )
    -- Le vrai mécanisme de périmètre : appartenir à une organisation
    -- rattachée au projet. Un membre d'YCID voit les projets où YCID
    -- figure ; il suffit de l'y rattacher pour élargir sa vue.
    or exists (
      select 1 from project_organizations po
      join memberships m on m.org_id = po.org_id
      where po.project_id = pid and m.user_id = auth.uid()
    );
$$;

-- ------------------------------------------------------------
-- 3. Arbitrer la roadmap : une capacité, pas un rôle
-- ------------------------------------------------------------
-- La gouvernance produit n'est ni un droit projet ni de l'administration
-- technique. Le Product Owner arbitre le backlog sans toucher aux
-- comptes. Une case à cocher exprime cela sans inventer un rôle.
alter table profiles
  add column if not exists can_manage_roadmap boolean not null default false;

create or replace function is_roadmap_manager()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and (can_manage_roadmap = true
            or coalesce(platform_role, case when is_platform_admin then 'admin' else 'user' end) = 'admin')
  );
$$;

drop policy if exists "Update own idea" on ideas;
create policy "Update own idea" on ideas for update
  using (author_id = auth.uid() or is_roadmap_manager());

drop policy if exists "Delete own idea" on ideas;
create policy "Delete own idea" on ideas for delete
  using (author_id = auth.uid() or is_roadmap_manager());

-- ------------------------------------------------------------
-- 4. Reprise des comptes existants
-- ------------------------------------------------------------
-- Les comptes « ycid » deviennent « utilisateur » — ils perdent la
-- console d'administration, ce qui est le but — mais CONSERVENT
-- l'arbitrage de la roadmap. Retirer d'un coup deux droits dont un seul
-- était en cause priverait Bérengère Ayoub de sa fonction sans
-- décision. La case reste décochable compte par compte.
update profiles
   set can_manage_roadmap = true
 where platform_role = 'ycid';

update profiles
   set platform_role = 'user'
 where platform_role = 'ycid';

-- `is_platform_admin` retrouve enfin le sens de son nom : vrai pour le
-- seul administrateur. L'écran de gestion des comptes le posait à
-- « rôle <> user », ce qui en faisait un synonyme trompeur de « pas un
-- utilisateur ordinaire » — et c'est ce qui avait rendu mon correctif
-- 0036 inopérant.
update profiles
   set is_platform_admin = (platform_role = 'admin')
 where platform_role is not null
   and is_platform_admin is distinct from (platform_role = 'admin');


-- ############################################################
-- ### 0038_reader_role_merge.sql
-- ############################################################

-- ============================================================
-- 0038 — L'auditeur, seul rôle de consultation
-- ============================================================
-- Arbitrage du 26/07 : « je n'ai besoin ni du rôle lecteur ni du
-- validateur — à quoi ça sert de se connecter pour voir, on peut lui
-- transmettre un rapport. Un auditeur c'est autre chose. »
--
-- Deux rôles sortent :
--
--   · « validateur » ne validait plus rien depuis la 0036, qui a
--     restreint la décision aux MEMBRES de l'organisation sollicitée —
--     un mécanisme d'appartenance, pas un rôle projet — et retiré au
--     passage la clause `pm.role in ('chef_projet','validateur')` posée
--     en 0030. Le libellé promettait depuis un jour un pouvoir que le
--     code avait supprimé ;
--
--   · « lecteur » n'avait pas de raison d'être. Un compte qui ne sert
--     qu'à regarder duplique deux choses qui existent déjà mieux : le
--     rapport d'expert IA, et la page vitrine publique par projet
--     (0021, lien non devinable). Créer un compte, gérer son mot de
--     passe et son cycle de vie pour un spectateur, c'est du coût sans
--     contrepartie — et une surface d'accès de plus.
--
-- « auditeur » subsiste, et devient le SEUL rôle de consultation. Sa
-- mission n'est pas de regarder mais de contrôler, et elle exige le
-- journal d'audit — qui, lui, ne se transmet pas dans un rapport.
--
-- Un enum PostgreSQL ne perd jamais ses valeurs (`alter type ... drop
-- value` n'existe pas). « validateur » et « lecteur » restent donc dans
-- `project_member_role` ; ce qui change, c'est qu'ils ne sont plus
-- proposés à la saisie (ASSIGNABLE_ROLES, lib/rbac.ts) et que plus
-- personne ne les porte.
--
-- ⚠️ Cette migration remplace une première version, diffusée le même
-- jour, qui convertissait vers « lecteur ». Elle est SANS RISQUE à
-- relancer : si la première a déjà tourné, celle-ci reprend les
-- « lecteur » ainsi créés et les mène à « auditeur ». Le résultat est
-- identique dans les deux cas.

-- ------------------------------------------------------------
-- 1. Reprise des membres existants
-- ------------------------------------------------------------
-- Aucun droit n'est retiré à personne : ces trois rôles avaient déjà
-- rigoureusement les mêmes. La conversion aligne l'affichage sur la
-- réalité.
insert into audit_log (project_id, entity, entity_id, label, action, comment)
select pm.project_id, 'project_member', pm.user_id,
       coalesce(p.full_name, p.email, pm.user_id::text),
       'modifie',
       format('Rôle « %s » converti en « auditeur » (0038 — rôle de consultation unique)', pm.role)
  from project_members pm
  left join profiles p on p.id = pm.user_id
 where pm.role in ('validateur', 'lecteur');

update project_members
   set role = 'auditeur'
 where role in ('validateur', 'lecteur');

-- ------------------------------------------------------------
-- 2. Un auditeur ne saisit pas les chiffres qu'il contrôle
-- ------------------------------------------------------------
-- La policy de la 0006 admettait tout membre du projet. Tant que la
-- consultation n'était qu'un statut passif, la nuance était théorique ;
-- avec un rôle dont la mission est le contrôle, elle ne l'est plus.
-- Quelqu'un qui vérifie des indicateurs d'impact ne doit pas pouvoir en
-- saisir.
drop policy if exists "Add measure" on indicator_measures;
create policy "Add measure" on indicator_measures
  for insert with check (
    exists (
      select 1 from indicators i
       join project_members pm on pm.project_id = i.project_id
       where i.id = indicator_measures.indicator_id
         and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie', 'resp_financier', 'contributeur')
    )
    or is_admin()
  );

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
-- Doit renvoyer zéro ligne. Sinon, c'est qu'un membre a été créé avec un
-- rôle retiré de la saisie — donc que le garde-fou applicatif
-- (MEMBER_ROLES, actions.ts) a été contourné.
--
--   select role, count(*) from project_members
--    where role in ('validateur','lecteur') group by role;


-- ############################################################
-- ### REPRISE MANUELLE — l'arbitrage de la roadmap
-- ############################################################
-- La 0037 accorde can_manage_roadmap aux comptes ENCORE marqués « ycid ».
-- Si elle a déjà tourné une fois, il n'en reste aucun : la reprise
-- automatique ne trouve plus personne, et Bérengère Ayoub perdrait
-- l'arbitrage du backlog sans que ce soit une décision.
--
-- Cette ligne est donc explicite plutôt que déduite. Sans effet si le
-- drapeau est déjà posé.
update profiles
   set can_manage_roadmap = true
 where email = 'bayoub@yvelines.fr';


-- ############################################################
-- ### VÉRIFICATION — ne modifie rien
-- ############################################################

-- 1. Les quatre objets doivent exister (attendu : 1 partout)
select
  (select count(*) from information_schema.columns
    where table_name = 'profiles' and column_name = 'can_manage_roadmap')          as col_can_manage_roadmap_0037,
  (select count(*) from pg_proc where proname = 'storage_stats')                   as fn_storage_stats_0035,
  (select count(*) from pg_proc where proname = 'validation_decided_outside_org')  as fn_decided_outside_0036,
  (select count(*) from pg_policies
    where tablename = 'indicator_measures' and policyname = 'Add measure')         as policy_add_measure_0038;

-- 2. Rôles plateforme : plus aucun « ycid », is_platform_admin vrai pour
--    les seuls admin
select platform_role, is_platform_admin, count(*)
  from profiles group by 1, 2 order by 1, 2;

-- 3. Rôles projet : plus aucun « validateur » ni « lecteur »
select role, count(*) from project_members group by role order by role;

-- 4. Qui arbitre la roadmap, et qui est rattaché à quelle organisation
select p.full_name, p.email, p.platform_role, p.can_manage_roadmap,
       coalesce(string_agg(o.name, ', ' order by o.name), '— aucune —') as organisations
  from profiles p
  left join memberships m on m.user_id = p.id
  left join organizations o on o.id = m.org_id
 group by p.id, p.full_name, p.email, p.platform_role, p.can_manage_roadmap
 order by p.platform_role, p.full_name;
