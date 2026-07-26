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
