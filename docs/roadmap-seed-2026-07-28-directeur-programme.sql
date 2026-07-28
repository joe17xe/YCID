-- ============================================================
-- Roadmap — Rôle « Directeur / Directrice de programme » (28/07 soir)
-- ============================================================
-- Demande du 28/07 : Bérengère Ayoub dirige TOUT le programme CEM au
-- YCID — un rôle « directeur de programme », tous droits sur tous les
-- projets du programme. Challenge et arbitrage d'attente ci-dessous ;
-- à passer une fois dans le SQL Editor (donnée, pas migration).
-- Idempotent.

with auteur as (
  select id from profiles where lower(email) = 'joe.abinader@gmail.com' limit 1
),
nouvelles(title, description, status, priority, difficulty, tags) as (
  values
  ('Rôle « Directeur de programme » : tous droits sur les projets d''un programme',
   E'Demande du 28/07 : Bérengère Ayoub est responsable de TOUT le programme CEM au YCID — il lui faut tous les droits sur tous les projets du programme.\n\nRÉPONSE IMMÉDIATE (sans ce chantier, appliquée le 28/07) :\n- rôle plateforme ADMINISTRATEUR : le seul pouvoir transverse « tous projets » existant, cohérent écran + serveur + base ;\n- retrait de ses sièges d''AUDITRICE — on n''audite pas ce qu''on dirige (même logique que 0038/0047) ; le siège de contrôle CD78 devient vacant, à confier à quelqu''un du Département le jour venu ;\n- ajoutée MEMBRE (Responsable projet) des projets CEM pour être invitable aux réunions et dans les pastilles d''organisation.\nCoût accepté : l''admin plateforme donne aussi l''administration de l''outil (comptes, marque, stockage) — acceptable pour la n°2 de l''opération, tant que l''organisation est ce qu''elle est.\n\nCE CHANTIER (à lancer LE JOUR OÙ le coût ci-dessus ne passe plus — plusieurs programmes, plusieurs directeurs, ou un directeur qui ne doit PAS toucher à l''outil) :\n- une nouvelle DIMENSION de droits : par PROGRAMME (projects.programme, 0020), pas par projet — « directeur du programme CEM » = tous les projets dont programme = CEM, y compris les futurs, sans geste d''ajout ;\n- matrice lib/rbac.ts + policies SQL modifiées ENSEMBLE (une fonction is_programme_director(programme) en RLS), CI check:rbac étendue ;\n- tous les droits opérationnels d''un chef de projet, PLUS la gestion des membres — SANS l''administration de l''outil ni la nomination des auditeurs (le contrôlé ne choisit pas son contrôleur, inchangé) ;\n- écran : le rôle se donne dans Admin ▸ Utilisateurs (par programme), et s''affiche partout où les rôles apparaissent.\n\nEstimation : 2 à 3 jours — c''est une dimension de sécurité nouvelle, pas une ligne de matrice. Le principe du code reste : « piloter un programme ne veut pas dire configurer l''outil » (lib/permissions.ts) — ce chantier est précisément ce qui permettra un jour de séparer les deux.',
   'idee', 'moyenne', 4, array['roles','rbac','programme'])
)
insert into ideas (title, description, status, priority, difficulty, tags, author_id)
select n.title, n.description, n.status, n.priority, n.difficulty, n.tags, a.id
  from nouvelles n cross join auteur a
 where not exists (select 1 from ideas i where i.title = n.title);

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select title, status from ideas where title like 'Rôle « Directeur%';
