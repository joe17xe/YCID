-- ============================================================
-- Roadmap — Kit de communication et logos des organisations (28/07)
-- ============================================================
-- Demande du 28/07 soir, challengée et affinée — à passer une fois
-- dans le SQL Editor (donnée, pas migration). Idempotent.

with auteur as (
  select id from profiles where lower(email) = 'joe.abinader@gmail.com' limit 1
),
nouvelles(title, description, status, priority, difficulty, tags) as (
  values
  ('Kit de communication : logos des organisations et supports à télécharger',
   E'Demande du 28/07 : les éléments de communication — le logo de CHAQUE organisation et un kit de com à télécharger — définis par un designer et disponibles pour tout le monde.\n\nSPÉCIFICATION AFFINÉE (challenge du 28/07) :\n1. LOGO PAR ORGANISATION : colonne organizations.logo_url + téléversement sur la fiche de l''organisation (admins de l''organisation et admins plateforme — même mécanique que la marque, 0018/0049). Affiché partout où l''organisation apparaît : liste des organisations, partenaires d''un projet, et — extension — la vitrine publique.\n2. KIT DE COM : une page « Kit de communication » accessible à TOUT compte connecté, qui liste des fichiers à télécharger (pack de logos, charte, gabarits d''affiche et de présentation…) avec nom, taille et date. Le DÉPÔT est réservé aux admins : l''application HÉBERGE le kit, elle ne le crée pas — son contenu est l''affaire du designer. Bucket dédié « communication », URLs signées.\n\nARBITRAGES (complétés le 28/07 au soir) :\n- le kit se FABRIQUE CHEZ CANVA (décision utilisateur — compte Canva relié) : le designer y travaille, les exports (PDF, PNG, pack ZIP) se déposent dans la page Kit — l''application HÉBERGE le kit livré, elle ne le crée pas ;\n- les LOGOS ne sont PAS à créer : chaque organisation fournit le sien — le besoin applicatif se réduit au téléversement sur la fiche de l''organisation et à l''affichage ;\n- pas de gestion documentaire complète (versions, dossiers, droits fins) : un kit est un DOSSIER PLAT tenu par les admins — le jour où il déborde, on en reparle ;\n- « disponible pour tout le monde » = tout compte connecté en v1 ; l''exposition publique (vitrine) est une extension explicite, pas un défaut.\n\nEstimation : ~1,5 à 2 jours (migration logo_url + bucket 0,5 j ; téléversement et affichages 0,5 j ; page kit 0,5-1 j). Risque faible — tout le socle (storage, URLs signées, écrans d''admin) existe.',
   'idee', 'haute', 3, array['communication','organisations','design'])
)
insert into ideas (title, description, status, priority, difficulty, tags, author_id)
select n.title, n.description, n.status, n.priority, n.difficulty, n.tags, a.id
  from nouvelles n cross join auteur a
 where not exists (select 1 from ideas i where i.title = n.title);

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select title, status, priority from ideas where title like 'Kit de communication%';
