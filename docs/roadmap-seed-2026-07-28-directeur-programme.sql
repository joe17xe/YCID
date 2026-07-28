-- ============================================================
-- Roadmap — Programmes et « Directeur de programme » (28/07 soir)
-- ============================================================
-- Demande du 28/07, PRÉCISÉE dans la foulée : Bérengère Ayoub dirige
-- le programme CEM actuel — mais d'autres programmes CEM viendront,
-- sur d'autres villes, avec D'AUTRES directeurs. Le droit ne peut donc
-- pas s'accrocher à l'étiquette « CEM » (ils la porteront tous) : il
-- faut un vrai NIVEAU « programme » dans le modèle. Les trois projets
-- d'aujourd'hui (deux triades + coordination) forment UN programme.
--
-- À passer une fois dans le SQL Editor (donnée, pas migration).
-- Idempotent, et il RÉÉCRIT la description si l'idée existe déjà
-- (version précédente du même soir, avant la précision).

with auteur as (
  select id from profiles where lower(email) = 'joe.abinader@gmail.com' limit 1
),
nouvelles(title, description, status, priority, difficulty, tags) as (
  values
  ('Programmes : un niveau au-dessus des projets, avec son directeur',
   E'Demande du 28/07, précisée le soir même : Bérengère Ayoub dirige le programme CEM ACTUEL — mais d''autres programmes CEM viendront, sur d''autres villes, avec d''AUTRES directeurs. Le droit ne peut donc pas s''accrocher à l''étiquette « CEM » : il faut un vrai niveau « programme ». Les trois projets d''aujourd''hui (Triade Villepreux, Triade Jouy, Coordination) forment UN programme.\n\nRÉPONSE IMMÉDIATE (appliquée le 28/07, sans ce chantier) :\n- Bérengère : rôle plateforme ADMINISTRATEUR (seul pouvoir transverse existant) + retrait de ses sièges d''auditrice (on n''audite pas ce qu''on dirige ; le siège CD78 devient vacant) + membre Responsable projet des projets CEM pour rester invitable aux réunions.\n- Coût nommé et accepté : l''admin donne aussi l''outil. Le jour où un directeur ne doit PAS l''avoir, ce chantier est la réponse.\n\nLE CHANTIER :\n1. Table `programmes` (nom, description) et `projects.programme_id` — l''étiquette texte `projects.programme` (0020) est CONSERVÉE en repli (règle n°4). Reprise : créer le programme « CEM — Triades Villepreux & Jouy » et y rattacher les trois projets existants.\n2. `programme_directors` (programme, compte) — plusieurs directeurs possibles, nommés par l''ADMIN SEUL (même logique que les auditeurs : un pouvoir d''échelon supérieur ne se donne pas depuis l''échelon qu''il gouverne).\n3. RLS : `is_programme_director(programme_id)` — tous les droits opérationnels d''un chef de projet sur TOUS les projets du programme, y compris les FUTURS rattachés, sans geste d''ajout. SANS l''administration de l''outil, SANS la nomination des auditeurs. Matrice lib/rbac.ts + policies modifiées ENSEMBLE, CI check:rbac étendue.\n4. Écrans : créer un programme, y rattacher un projet (à la création du projet et depuis sa fiche), nommer les directeurs (Admin) ; le programme s''affiche sur la fiche et devient un regroupement possible du Pilotage (extension).\n\nEstimation : ~3 jours — une entité nouvelle ET une dimension de droits nouvelle. Le principe du code reste : « piloter un programme ne veut pas dire configurer l''outil » — ce chantier est ce qui permettra de séparer les deux proprement.',
   'idee', 'moyenne', 4, array['roles','rbac','programme'])
)
insert into ideas (title, description, status, priority, difficulty, tags, author_id)
select n.title, n.description, n.status, n.priority, n.difficulty, n.tags, a.id
  from nouvelles n cross join auteur a
 where not exists (select 1 from ideas i where i.title = n.title);

-- L'idée du même soir, avant la précision « plusieurs programmes,
-- plusieurs directeurs » : si elle a été insérée, elle est remplacée
-- par celle-ci — une roadmap ne garde pas deux versions de la même
-- décision.
delete from ideas
 where title = 'Rôle « Directeur de programme » : tous droits sur les projets d''un programme'
   and exists (select 1 from ideas where title = 'Programmes : un niveau au-dessus des projets, avec son directeur');

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select title, status from ideas where title like 'Programmes%';
