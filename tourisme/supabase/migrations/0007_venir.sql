-- Visit Azour — « Préparer sa venue ».
--
-- Comment on arrive, d'où, en combien de temps, et pourquoi faire la
-- route : c'est du contenu de territoire, donc deux colonnes jsonb et
-- pas une page écrite en dur. Un autre village remplit les siennes.

alter table territoires add column if not exists presentation jsonb;
alter table territoires add column if not exists acces jsonb;

comment on column territoires.presentation is
  'Éditorial d''accueil : {"pourquoi":{fr,ar,en},"region":{fr,ar,en}}.';
comment on column territoires.acces is
  'Arrivée et trajets : {"arrivee":{"nom":{…},"geom":[lon,lat]},'
  '"depuis":[{"ville":{…},"distance_km":63,"duree_minutes":105,"note":{…}}],'
  '"stationnement":{…},"transports":{…}}. Distances et durées indicatives,'
  ' tenues par la municipalité.';

-- Les nouvelles colonnes se posent EN FIN de liste : « create or replace
-- view » sait allonger une vue, pas réordonner ses colonnes.
create or replace view territoires_publics as
select
  t.slug, t.nom, t.marque, t.slogan, t.actif, t.langues, t.langue_defaut,
  t.photo_accueil, t.contact_tel, t.contact_whatsapp, t.contact_email,
  t.urgences, t.etat_acces, t.zoom_defaut,
  st_asgeojson(t.centre)::jsonb as centre_geojson,
  t.id,
  t.presentation,
  t.acces
from territoires t
where t.actif;
