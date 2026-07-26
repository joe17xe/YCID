-- ============================================================
-- 0038 — Un seul rôle de consultation
-- ============================================================
-- Arbitrage du 26/07 : « validateur / lecteur ensemble — donner le droit
-- de visualiser sans rien pouvoir modifier ».
--
-- Les trois rôles de consultation étaient déjà indistinguables, sans que
-- ce soit une décision :
--
--   · « validateur » ne validait plus rien depuis la 0036. Cette
--     migration a restreint la décision aux MEMBRES de l'organisation
--     sollicitée — un mécanisme d'appartenance, pas un rôle projet — et
--     a retiré au passage la clause `pm.role in ('chef_projet',
--     'validateur')` posée en 0030. Le libellé promettait donc depuis
--     un jour un pouvoir que le code avait supprimé ;
--   · « auditeur » et « lecteur » n'étaient distingués par AUCUNE policy
--     ni aucun contrôle applicatif. Deux libellés, un comportement.
--
-- Un enum PostgreSQL ne perd jamais ses valeurs (`alter type ... drop
-- value` n'existe pas). Les deux valeurs restent donc dans
-- `project_member_role` ; ce qui change, c'est qu'elles ne sont plus
-- proposées à la saisie (ASSIGNABLE_ROLES, lib/rbac.ts) et que plus
-- personne ne les porte.

-- ------------------------------------------------------------
-- Reprise des membres existants
-- ------------------------------------------------------------
-- Aucun droit n'est retiré : ces trois rôles avaient déjà exactement les
-- mêmes. La conversion aligne l'affichage sur la réalité.
insert into audit_log (project_id, entity, entity_id, label, action, comment)
select pm.project_id, 'project_member', pm.user_id,
       coalesce(p.full_name, p.email, pm.user_id::text),
       'modifie',
       format('Rôle « %s » converti en « lecteur » (0038 — fusion des rôles de consultation)', pm.role)
  from project_members pm
  left join profiles p on p.id = pm.user_id
 where pm.role in ('validateur', 'auditeur');

update project_members
   set role = 'lecteur'
 where role in ('validateur', 'auditeur');

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
-- Doit renvoyer zéro ligne. Si ce n'est pas le cas, c'est qu'un membre a
-- été créé entre-temps avec un rôle retiré de la saisie — donc que le
-- garde-fou applicatif a été contourné.
--
--   select role, count(*) from project_members
--    where role in ('validateur','auditeur') group by role;
