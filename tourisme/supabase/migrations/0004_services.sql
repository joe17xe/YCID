-- Un établissement peut nourrir sans être un restaurant : Beit Mrad est
-- une maison d'hôtes qui sert le petit-déjeuner, Pine View et Blue Jay
-- sont des hébergements avec table. Le TYPE dit ce qu'est le lieu ; les
-- SERVICES disent ce qu'on y trouve. La section restauration se construit
-- à partir des services, pas du type.
alter table pois add column if not exists services text[] not null default '{}';

comment on column pois.services is
  'Services rendus sur place : petit_dejeuner, restaurant, bar, epicerie, eau. Alimente la section restauration.';

-- Les nouvelles colonnes se posent EN FIN de liste : « create or replace
-- view » sait allonger une vue, pas réordonner ses colonnes.
create or replace view pois_publics as
select
  p.slug, p.nom, p.type, p.panneau_no, p.texte, p.photo, p.audio_url,
  p.contact, p.statut, p.ordre,
  st_asgeojson(p.geom)::jsonb as geom_geojson,
  p.services
from pois p
where p.statut = 'publie';

create or replace view admin_pois with (security_invoker = true) as
select o.id, o.territoire_id, o.slug, o.nom, o.type, o.panneau_no,
       o.statut, o.ordre, st_x(o.geom) as lon, st_y(o.geom) as lat,
       o.services
from pois o;
