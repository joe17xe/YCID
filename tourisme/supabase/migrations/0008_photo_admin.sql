-- Visit Azour — la photo au back-office.
--
-- Le champ existait en base et s'affichait sur le site, mais /admin ne
-- savait pas le renseigner : impossible d'illustrer un lieu sans passer
-- par un commit. On l'expose donc à l'éditeur.

-- Les nouvelles colonnes se posent EN FIN de liste : « create or replace
-- view » sait allonger une vue, pas réordonner ses colonnes.
create or replace view admin_pois with (security_invoker = true) as
select o.id, o.territoire_id, o.slug, o.nom, o.type, o.panneau_no,
       o.statut, o.ordre, st_x(o.geom) as lon, st_y(o.geom) as lat,
       o.services,
       o.sur_reservation,
       o.photo
from pois o;
