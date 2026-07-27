-- ============================================================
-- 0047 — Le contrôlé ne choisit pas son contrôleur
-- ============================================================
-- Constat de recette, 27/07 : connectée en chef de projet, Maria voyait
-- les rôles de TOUS les membres en liste déroulante, auditeurs compris,
-- avec le bouton de retrait à côté.
--
-- Deux défauts, l'un de conception, l'autre de contrôle.
--
-- 1. La gestion des membres était adossée à `phases.manage`. La même
--    autorisation servait donc à créer une phase et à décider qui a
--    accès au projet. Ce sont deux pouvoirs de nature différente,
--    confondus par commodité : une capacité `membres.manage` les
--    sépare désormais côté application.
--
-- 2. Et surtout : un chef de projet pouvait retirer les auditeurs de
--    son propre projet. L'audité congédiait son auditeur. Pour un
--    dispositif qui rend compte à un financeur public, c'est le
--    contrôle lui-même qui saute — et rien ne l'aurait signalé, sinon
--    une ligne au journal que personne ne relit.
--
-- C'est la symétrie exacte de la 0038, qui a retiré à l'auditeur le
-- droit de saisir les mesures : un auditeur ne saisit pas les chiffres
-- qu'il contrôle, et le contrôlé ne nomme pas celui qui le contrôle.
--
-- Arbitrage du 27/07 : ajouter un contributeur ou changer un rôle
-- opérationnel reste au chef de projet — c'est son travail quotidien.
-- Nommer ou retirer un AUDITEUR revient à l'administrateur plateforme.

-- ------------------------------------------------------------
-- Des policies RESTRICTIVES
-- ------------------------------------------------------------
-- Les policies ordinaires sont permissives : elles s'ajoutent les unes
-- aux autres par OU. En ajouter une ici n'aurait rien restreint — elle
-- se serait contentée d'ouvrir une voie de plus. `as restrictive` se
-- combine par ET : la règle s'impose à toutes les autorisations
-- existantes, quelles qu'elles soient, présentes et à venir.
--
-- Restreint uniquement l'ÉCRITURE. Une restriction en lecture masquerait
-- les auditeurs à tout le monde sauf aux administrateurs : le projet
-- ignorerait qui le contrôle, ce qui est le contraire du but recherché.

drop policy if exists "Auditor seat add" on project_members;
create policy "Auditor seat add" on project_members
  as restrictive for insert
  with check (role <> 'auditeur' or is_admin());

-- `using` juge la ligne AVANT, `with check` la ligne APRÈS. Les deux
-- sont nécessaires : sans la première on rétrograderait un auditeur en
-- contributeur, sans la seconde on promouvrait quelqu'un auditeur.
drop policy if exists "Auditor seat change" on project_members;
create policy "Auditor seat change" on project_members
  as restrictive for update
  using (role <> 'auditeur' or is_admin())
  with check (role <> 'auditeur' or is_admin());

drop policy if exists "Auditor seat remove" on project_members;
create policy "Auditor seat remove" on project_members
  as restrictive for delete
  using (role <> 'auditeur' or is_admin());

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select policyname, permissive, cmd
--     from pg_policies
--    where tablename = 'project_members'
--      and policyname like 'Auditor seat%'
--    order by policyname;
--
-- Les trois lignes doivent porter `permissive = 'RESTRICTIVE'`. Une
-- seule qui reviendrait à `PERMISSIVE` annulerait la règle en silence,
-- en ouvrant une voie au lieu d'en fermer une.
--
-- Essai réel, en chef de projet non administrateur : retirer un
-- auditeur doit échouer. Retirer un contributeur doit réussir.
