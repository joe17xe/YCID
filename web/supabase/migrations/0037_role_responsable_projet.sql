-- ============================================================
-- PR 42 — Rôle plateforme « Responsable projet »
-- ============================================================
-- Arbitrage YCID du 26/07. Deux constats l'imposent :
--
--   · Maria Maroun portait le rôle « YCID » par erreur, ce qui lui
--     ouvrait toute la console d'administration — utilisateurs,
--     configuration, stockage — sans rapport avec sa fonction.
--   · Bérengère Ayoub, Product Owner, a besoin d'arbitrer la roadmap et
--     de suivre les trois projets du programme, mais n'a rien à faire
--     dans la gestion des comptes.
--
-- Il manquait un cran entre « Utilisateur » (ne voit que ses projets) et
-- « YCID » (voit et administre tout). D'où « Responsable projet » :
-- vision complète du portefeuille et arbitrage produit, sans console
-- d'administration.
--
-- ------------------------------------------------------------
-- Le piège à désamorcer d'abord
-- ------------------------------------------------------------
-- `is_platform_admin` ne veut pas dire ce que son nom dit : l'écran de
-- gestion des comptes le pose à `role <> 'user'` (user-actions.ts), donc
-- il est vrai pour tout rôle non ordinaire. Or is_project_member() ET
-- is_admin() s'appuient dessus. Ajouter un rôle sans toucher à ça lui
-- aurait accordé l'administration par la bande — exactement le défaut
-- qu'on cherche à corriger.
--
-- Les deux fonctions raisonnent désormais sur `platform_role`, avec un
-- repli sur `is_platform_admin` pour les comptes antérieurs à la 0017,
-- dont platform_role est nul.

-- ------------------------------------------------------------
-- 1. Qui voit tous les projets
-- ------------------------------------------------------------
create or replace function is_project_member(pid uuid)
returns boolean language sql security definer as $$
  select
    exists (
      select 1 from profiles
       where id = auth.uid()
         and coalesce(platform_role, case when is_platform_admin then 'admin' else 'user' end)
             in ('admin', 'ycid', 'responsable_projet')
    )
    or exists (
      select 1 from project_members
      where project_id = pid and user_id = auth.uid()
    )
    or exists (
      select 1 from project_organizations po
      join memberships m on m.org_id = po.org_id
      where po.project_id = pid and m.user_id = auth.uid()
    );
$$;

-- ------------------------------------------------------------
-- 2. Qui administre la plateforme
-- ------------------------------------------------------------
-- « Responsable projet » en est volontairement EXCLU : c'est tout
-- l'objet du nouveau rôle.
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and coalesce(platform_role, case when is_platform_admin then 'admin' else 'user' end)
           in ('admin', 'ycid')
  );
$$;

-- ------------------------------------------------------------
-- 3. Qui arbitre la roadmap
-- ------------------------------------------------------------
-- Le Product Owner arbitre le produit sans administrer la plateforme.
-- Ces deux droits étaient confondus parce qu'un seul rôle les portait.
create or replace function is_roadmap_manager()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and coalesce(platform_role, case when is_platform_admin then 'admin' else 'user' end)
           in ('admin', 'ycid', 'responsable_projet')
  );
$$;

drop policy if exists "Update own idea" on ideas;
create policy "Update own idea" on ideas for update
  using (author_id = auth.uid() or is_roadmap_manager() or is_lead_org_admin());

drop policy if exists "Delete own idea" on ideas;
create policy "Delete own idea" on ideas for delete
  using (author_id = auth.uid() or is_roadmap_manager() or is_lead_org_admin());

-- ------------------------------------------------------------
-- 4. Aligner le drapeau sur son nom
-- ------------------------------------------------------------
-- Désormais `is_platform_admin` ne vaut true que pour le rôle « admin ».
-- Les fonctions ci-dessus ne s'y fient plus, mais le laisser incohérent
-- ferait retomber dans le piège au prochain correctif qui s'y référerait.
update profiles
   set is_platform_admin = (platform_role = 'admin')
 where platform_role is not null
   and is_platform_admin is distinct from (platform_role = 'admin');
