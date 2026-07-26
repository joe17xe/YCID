-- ============================================================
-- 0039 — Le droit de regard ne doit rien pouvoir écrire
-- ============================================================
-- Arbitrage du 26/07, énoncé par YCID :
--
--   « On ouvre un compte aux gens qui agissent. Mais quand on crée un
--     compte pour une organisation — Commune de Villepreux par exemple —
--     les gens ont accès aux informations des projets de la commune :
--     ils ont un droit de REGARD. Ce ne sont pas les gens opérationnels.
--     Un membre de la commune qui est chef de projet, lui, pourra agir :
--     créer une tâche, un devis, etc. »
--
-- Le modèle repose donc sur deux couches indépendantes :
--
--   · l'ORGANISATION donne le PÉRIMÈTRE — quels projets on voit.
--     is_project_member() joint project_organizations depuis la 0037 ;
--   · le RÔLE PROJET donne la CAPACITÉ — ce qu'on peut y faire.
--     lib/rbac.ts, et les policies nommant explicitement les rôles.
--
-- Le modèle ne tient que si AUCUNE règle d'écriture ne se contente de
-- l'appartenance. Vérification faite sur les policies encore en vigueur
-- (les réécritures successives en avaient neutralisé plusieurs) : deux
-- seulement s'appuyaient sur is_project_member() en écriture.
--
--   · audit_log « Insert audit » — LÉGITIME, et nécessaire. La trace est
--     écrite par celui qui agit, sous son propre identifiant
--     (`user_id = auth.uid()`). L'interdire empêcherait de tracer.
--     Inchangée.
--
--   · ai_reports « Create ai reports » — FUITE, corrigée ci-dessous.

-- ------------------------------------------------------------
-- Générer un rapport est une action, pas un regard
-- ------------------------------------------------------------
-- La 0024 ouvrait l'insertion à tout membre du projet. À l'époque, être
-- membre supposait un rôle : la nuance n'existait pas. Depuis la 0037,
-- l'appartenance à une organisation suffit à voir un projet — et donc,
-- par cette policy, à y générer un rapport.
--
-- Deux raisons de fermer, dont une qui ne se rattrape pas :
--   · la génération consomme la clé du fournisseur d'IA (0023) — un
--     droit de regard qui engage une dépense n'est plus un droit de
--     regard ;
--   · le rapport s'inscrit dans l'historique du projet, sous le nom de
--     qui l'a lancé.
--
-- La LECTURE reste ouverte à tout le périmètre : quelqu'un qui a le
-- droit de regard peut lire les rapports produits par d'autres. C'est
-- même le cœur de ce droit.
drop policy if exists "Create ai reports" on ai_reports;
create policy "Create ai reports" on ai_reports
  for insert with check (
    exists (
      select 1 from project_members pm
       where pm.project_id = ai_reports.project_id
         and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie', 'resp_financier', 'contributeur')
    )
    or is_admin()
    or is_lead_org_admin()
  );

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
-- Recense les policies d'écriture qui s'appuient encore sur la seule
-- appartenance. Attendu APRÈS cette migration : la seule ligne
-- `audit_log / Insert audit`.
--
--   select tablename, policyname, cmd
--     from pg_policies
--    where schemaname = 'public'
--      and cmd <> 'SELECT'
--      and coalesce(qual, '') || coalesce(with_check, '') like '%is_project_member%'
--    order by tablename, policyname;
