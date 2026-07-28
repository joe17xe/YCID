-- ============================================================
-- Coordonnées des communes — passe de saisie du 28/07/2026
-- ============================================================
-- Les valeurs fournies le 28/07 (décimales WGS84). Ce n'est PAS une
-- migration : c'est de la donnée, à passer une fois dans le SQL Editor
-- — le même geste que fiche projet ▸ Modifier ▸ latitude / longitude,
-- en SQL parce que les quatre communes arrivent d'un coup (règle n°5
-- des règles de livraison). La fiche projet reste le geste pour les
-- corrections ultérieures.
--
-- Le repère suit le PAYS du projet. Un projet « triade » porte les
-- deux communes dans son nom (« Triade Villepreux · Azour ») mais n'a
-- qu'un pays et n'apparaît que sur un panneau de la carte : il reçoit
-- les coordonnées de SA commune. Les conditions pays sont exclusives —
-- une seule mise à jour touche chaque ligne.
--
-- Prudent : ne remplit que les lat/lng encore vides. Ce qui a été
-- saisi dans l'application n'est jamais écrasé ; se rejoue sans effet.
-- L'altitude fournie n'a pas de colonne : la carte n'en a pas l'usage.
--
--   Azour / Aazour (Jezzine)  33.5595 / 35.5352
--   Jeïta (Kesrouan)          33.9439 / 35.6441
--   Villepreux                48.8344 /  2.0130
--   Jouy-en-Josas             48.7703 /  2.1670

-- Contrôle AVANT (ne modifie rien) : les projets candidats.
select id, name, country, zone, lat, lng from projects
 where name ilike any (array['%azour%','%jeita%','%jeïta%','%villepreux%','%jouy%'])
    or zone ilike any (array['%azour%','%jeita%','%jeïta%','%villepreux%','%jouy%'])
 order by name;

-- Liban — Azour (Jezzine)
update projects set lat = 33.5595, lng = 35.5352
 where (name ilike '%azour%' or zone ilike '%azour%')
   and trim(lower(country)) in ('liban','lebanon')
   and lat is null and lng is null;

-- Liban — Jeïta (Kesrouan)
update projects set lat = 33.9439, lng = 35.6441
 where (name ilike '%jeita%' or name ilike '%jeïta%'
     or zone ilike '%jeita%' or zone ilike '%jeïta%')
   and trim(lower(country)) in ('liban','lebanon')
   and lat is null and lng is null;

-- Yvelines — Villepreux
update projects set lat = 48.8344, lng = 2.0130
 where (name ilike '%villepreux%' or zone ilike '%villepreux%')
   and trim(lower(country)) in ('france','yvelines')
   and lat is null and lng is null;

-- Yvelines — Jouy-en-Josas
update projects set lat = 48.7703, lng = 2.1670
 where (name ilike '%jouy%' or zone ilike '%jouy%')
   and trim(lower(country)) in ('france','yvelines')
   and lat is null and lng is null;

-- ------------------------------------------------------------
-- Contrôle APRÈS : ce que la carte lira. Un projet resté sans
-- coordonnées après la passe (Coordination, ou un nom que les motifs
-- ci-dessus ne couvrent pas) se complète dans l'application.
-- ------------------------------------------------------------
--   select name, country, zone, lat, lng from projects
--    order by country, name;
