-- ============================================================
-- Rattrapage : les lignes budgétaires sans financeur
-- ============================================================
-- Contexte (28/08) : l'onglet Budget d'un projet affiche « Non affecté —
-- lignes sans financeur renseigné » pour la totalité du prévu, alors que
-- le fichier source porte bien un bailleur sur chaque dépense. La cause
-- est en base : `budget_lines.funder_org_id` est NULL.
--
-- Deux conséquences, et la seconde est la plus coûteuse :
--   · la « Répartition par financeur » — la vue du compte rendu — ne
--     dit plus rien à personne ;
--   · les APPELS DE FONDS ne se comparent au budget que par financeur
--     ET par année. Sans financeur, l'écart entre ce qui est promis et
--     ce qui est budgété reste vide, quoi qu'on saisisse.
--
-- À exécuter dans le SQL Editor Supabase. EN DEUX TEMPS : l'étape 1 ne
-- modifie rien et montre ce que l'étape 2 ferait. On ne lance la 2 que
-- si la 1 dit ce qu'on attend.

-- ------------------------------------------------------------
-- ÉTAPE 0 — de quoi parle-t-on
-- ------------------------------------------------------------
-- Les organisations existantes, avec leur nom EXACT. C'est ce nom-là
-- que l'import compare à la colonne « financeur » du CSV : « CD78 » ne
-- vaut pas « Département des Yvelines (CD78) ».
select id, name, type, status from organizations order by name;

-- Les lignes sans financeur, projet par projet.
select p.name as projet, count(*) as lignes, sum(bl.planned_amount) as montant
  from budget_lines bl
  join projects p on p.id = bl.project_id
 where bl.funder_org_id is null
 group by p.name
 order by montant desc;

-- Le détail : le libellé de chaque ligne orpheline. C'est ici qu'on
-- vérifie l'hypothèse — si les postes s'appellent « CD78 »,
-- « Villepreux », « MEAE », le nom du bailleur a été saisi dans le
-- LIBELLÉ de la ligne au lieu de la colonne financeur.
select bl.id, bl.poste, bl.year, bl.planned_amount, bl.is_valorisation, ph.name as phase
  from budget_lines bl
  left join phases ph on ph.id = bl.phase_id
 where bl.funder_org_id is null
   and bl.project_id = '<< IDENTIFIANT DU PROJET >>'
 order by ph.name nulls last, bl.poste;

-- ------------------------------------------------------------
-- ÉTAPE 1 — ce que le rattrapage FERAIT (aucune écriture)
-- ------------------------------------------------------------
-- La correspondance est établie sur un ALIAS cherché dans le libellé de
-- la ligne. Elle est délibérément explicite plutôt qu'astucieuse : une
-- règle qu'on relit vaut mieux qu'une règle qui devine.
with alias(cle, motif) as (
  values
    ('cd78',        '%CD78%'),
    ('meae',        '%MEAE%'),
    ('ycid',        '%YCID%'),
    ('villepreux',  '%Villepreux%'),
    ('ley',         '%Yvelines (LEY)%'),
    ('azour',       '%Azour%')
),
cible as (
  select a.cle, o.id as org_id, o.name as org_name
    from alias a
    join organizations o
      on (a.cle = 'cd78'       and o.name ilike '%CD78%')
      or (a.cle = 'meae'       and o.name ilike '%MEAE%')
      or (a.cle = 'ycid'       and o.name ilike 'YCID%')
      or (a.cle = 'villepreux' and o.name ilike '%Villepreux%')
      or (a.cle = 'ley'        and o.name ilike '%Libanais en Yvelines%')
      or (a.cle = 'azour'      and o.name ilike '%Azour%')
)
select bl.id, bl.poste, bl.year, bl.planned_amount,
       c.org_name as financeur_propose
  from budget_lines bl
  join cible c
    on bl.poste ilike '%' || c.cle || '%'
 where bl.funder_org_id is null
   and bl.project_id = '<< IDENTIFIANT DU PROJET >>'
 order by bl.poste;

-- ------------------------------------------------------------
-- ÉTAPE 2 — l'écriture
-- ------------------------------------------------------------
-- À ne lancer QUE si l'étape 1 propose exactement le bon bailleur sur
-- chaque ligne. Une ligne que l'étape 1 n'a pas listée restera sans
-- financeur : c'est voulu — il vaut mieux la corriger à la main dans
-- l'application que de lui en attribuer un au jugé.
--
-- `and funder_org_id is null` : la requête ne touche que les orphelines,
-- même relancée deux fois. Rien de ce qui est déjà renseigné ne bouge.
--
-- update budget_lines bl
--    set funder_org_id = c.org_id
--   from (
--     -- recopier ici le bloc « cible » de l'étape 1
--   ) c
--  where bl.poste ilike '%' || c.cle || '%'
--    and bl.funder_org_id is null
--    and bl.project_id = '<< IDENTIFIANT DU PROJET >>';
--
-- Décommenter après relecture. Le journal d'audit du projet ne verra
-- PAS cette correction — elle est faite hors application, c'est le prix
-- d'un rattrapage en base. Si la traçabilité compte davantage que la
-- rapidité, corrigez les lignes une à une dans l'écran Budget : une
-- vingtaine de lignes, et chaque modification est tracée.
