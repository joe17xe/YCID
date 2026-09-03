-- Visit Azour — « sur réservation ».
--
-- Une table de village n'est pas un restaurant de ville : beaucoup ne
-- servent que si l'on a prévenu. L'information est vitale pour le
-- visiteur (arriver sans appeler, c'est trouver porte close) et elle ne
-- se déduit d'aucun autre champ — d'où sa propre colonne, cochable au
-- back-office comme les services.

alter table pois add column if not exists sur_reservation boolean not null default false;

comment on column pois.sur_reservation is
  'L''établissement ne sert que sur réservation préalable. Affiché à côté des services.';

-- Les nouvelles colonnes se posent EN FIN de liste : « create or replace
-- view » sait allonger une vue, pas réordonner ses colonnes.
create or replace view pois_publics as
select
  p.slug, p.nom, p.type, p.panneau_no, p.texte, p.photo, p.audio_url,
  p.contact, p.statut, p.ordre,
  st_asgeojson(p.geom)::jsonb as geom_geojson,
  p.services,
  p.sur_reservation
from pois p
where p.statut = 'publie';

create or replace view admin_pois with (security_invoker = true) as
select o.id, o.territoire_id, o.slug, o.nom, o.type, o.panneau_no,
       o.statut, o.ordre, st_x(o.geom) as lon, st_y(o.geom) as lat,
       o.services,
       o.sur_reservation
from pois o;
