-- ============================================================
-- Roadmap — l'idée Kit de communication passe en « livrée » (28/07, nuit)
-- ============================================================
-- Dernier chantier de la file priorisée du 28/07 (« le kit de com à la
-- fin »), lancé sur « Tu peux aller sur le kit » et livré le soir même :
-- page /kit (supports en URL signées, dépôt admin), logo par
-- organisation téléversé sur sa fiche et affiché dans la liste comme
-- sur la fiche projet (migration 0057).
--
-- À passer APRÈS la migration 0057 et après avoir constaté le
-- déploiement. Le kit lui-même se fabrique chez Canva (décision du
-- 28/07) : ce qui est livré, c'est l'hébergement et la distribution.
-- L'exposition des logos sur la vitrine publique reste une extension
-- NON livrée, notée dans la description.
--
-- Idempotent, et autonome : si le seed d'entrée du 28/07 n'a pas
-- encore été passé, l'idée est d'abord insérée, puis marquée livrée.
-- La description passe au récit « LIVRÉ » dans les deux cas (le seed
-- d'entrée porte la spécification longue, devenue historique) — d'où
-- le même bloc `values` répété : un `with` ne porte que sur la
-- requête qui le suit.

with auteur as (
  select id from profiles where lower(email) = 'joe.abinader@gmail.com' limit 1
),
nouvelles(title, description, status, priority, difficulty, tags) as (
  values
  ('Kit de communication : logos des organisations et supports à télécharger',
   E'Demande du 28/07 : les éléments de communication — le logo de CHAQUE organisation et un kit de com à télécharger — définis par un designer et disponibles pour tout le monde.\n\nLIVRÉ le 28/07 (migration 0057) :\n- page « Kit de com » (menu Suivi) pour tout compte connecté : supports listés avec nom, taille et date, téléchargés en URL signée 1 h (bucket privé « communication ») ;\n- dépôt (25 Mo max) et retrait réservés aux admins — l''application HÉBERGE le kit, il se fabrique chez Canva ;\n- logo par organisation : téléversement sur la fiche de l''organisation (bucket branding/org-logos), affiché dans la liste des organisations et sur la carte Organisations de la fiche projet.\n\nEXTENSION non comprise, à re-proposer en idée propre le jour venu :\n- logos et kit sur la vitrine publique (exposition sans compte) : +0,5 j, à décider avec l''enrichissement de la vitrine.',
   'idee', 'haute', 3, array['communication','organisations','design'])
)
insert into ideas (title, description, status, priority, difficulty, tags, author_id)
select n.title, n.description, n.status, n.priority, n.difficulty, n.tags, a.id
  from nouvelles n
  cross join auteur a
 where not exists (select 1 from ideas i where i.title = n.title);

with nouvelles(title, description) as (
  values
  ('Kit de communication : logos des organisations et supports à télécharger',
   E'Demande du 28/07 : les éléments de communication — le logo de CHAQUE organisation et un kit de com à télécharger — définis par un designer et disponibles pour tout le monde.\n\nLIVRÉ le 28/07 (migration 0057) :\n- page « Kit de com » (menu Suivi) pour tout compte connecté : supports listés avec nom, taille et date, téléchargés en URL signée 1 h (bucket privé « communication ») ;\n- dépôt (25 Mo max) et retrait réservés aux admins — l''application HÉBERGE le kit, il se fabrique chez Canva ;\n- logo par organisation : téléversement sur la fiche de l''organisation (bucket branding/org-logos), affiché dans la liste des organisations et sur la carte Organisations de la fiche projet.\n\nEXTENSION non comprise, à re-proposer en idée propre le jour venu :\n- logos et kit sur la vitrine publique (exposition sans compte) : +0,5 j, à décider avec l''enrichissement de la vitrine.'
  )
)
update ideas i
   set status = 'livree', description = n.description, updated_at = now()
  from nouvelles n
 where i.title = n.title
   and (i.status <> 'livree' or i.description <> n.description);

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select title, status from ideas where title like 'Kit de communication%';
