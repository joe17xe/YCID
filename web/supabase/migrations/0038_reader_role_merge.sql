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
