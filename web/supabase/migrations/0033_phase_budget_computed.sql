-- ============================================================
-- PR 39 — Le budget de phase devient calculé
-- ============================================================
-- Cadrage YCID du 25/07/2026 : « on peut bouger un budget d'une
-- activité vers une autre ; le montant total ne devrait pas changer,
-- c'est un financement déjà voté ».
--
-- Cette règle tranche une question laissée ouverte depuis la 0001 :
-- l'invariant est l'ENVELOPPE, pas la ligne. D'où deux conséquences
-- opposées sur deux colonnes qui se ressemblaient :
--
--   · `projects.budget` CONSERVÉ, et change de sens : ce n'est pas un
--     doublon de la somme des lignes, c'est le MONTANT VOTÉ — la
--     référence contractuelle contre laquelle on compare la répartition.
--     Le seul chiffre qui ne doit pas bouger.
--
--   · `phases.budget` SUPPRIMÉ : lui n'était relié à rien. Saisi à la
--     main, jamais confronté aux lignes, il produisait des divergences
--     silencieuses — constatées en production sur le projet CEM Liban :
--     31 100 € déclarés contre 26 600 € de lignes sur une phase,
--     4 550 € contre 9 050 € sur une autre. Garder deux montants
--     modifiables pour la même chose ne fabrique que de l'écart.
--     Le budget d'une phase est désormais la somme de ses lignes.

-- Les valeurs saisies traduisaient une intention, même fausse : on les
-- archive au journal d'audit avant de supprimer la colonne, plutôt que
-- de les effacer sans trace.
insert into audit_log (project_id, entity, entity_id, label, action, user_id, comment)
select ph.project_id, 'phase', ph.id, ph.name, 'modifie', null,
       'Budget de phase archivé avant suppression du champ (PR 39) : ' || ph.budget || ' €'
  from phases ph
 where ph.budget is not null;

alter table phases drop column if exists budget;
