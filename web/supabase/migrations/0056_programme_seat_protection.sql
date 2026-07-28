-- ============================================================
-- MIGRATION 0056 — Le siège de directeur de programme est protégé
-- ============================================================
-- Précision du 28/07 au soir, dans la foulée de la 0055 : nommée
-- directrice, elle doit APPARAÎTRE « directrice de programme » sur les
-- projets — pas « chef de projet » — et PERSONNE ne peut la retirer à
-- part l'admin. C'est le motif de l'auditeur (0047), appliqué au
-- siège programme : un pouvoir donné d'en haut s'affiche pour ce
-- qu'il est et ne se retire pas d'en bas — un chef de projet ne peut
-- pas écarter de son projet la directrice du programme qui le
-- gouverne.
--
-- Côté base, le siège est la ligne project_members marquée
-- via_programme (0055) : des policies RESTRICTIVES la verrouillent —
-- une policy ordinaire s'ajoute par OU et n'aurait rien restreint
-- (leçon de la 0047). Les déclencheurs de la 0055 (SECURITY DEFINER)
-- continuent de poser et retirer les sièges au rythme des nominations.
-- Côté écran, le rôle AFFICHÉ vient de la provenance : badge
-- « Dir. de programme », sans sélecteur de rôle ni bouton de retrait
-- pour les non-admins. En droits, un directeur reste un chef de
-- projet sur chaque projet du programme — c'est le contrat voulu, et
-- aucune des policies existantes n'a besoin de changer.

create policy "Programme seat update is admin-only" on project_members
  as restrictive for update
  using (via_programme = false or is_admin())
  with check (via_programme = false or is_admin());

create policy "Programme seat delete is admin-only" on project_members
  as restrictive for delete
  using (via_programme = false or is_admin());

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select polname, polcmd, polpermissive from pg_policy
--    where polrelid = 'project_members'::regclass order by polname;
