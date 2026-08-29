-- Vues publiques complémentaires : PostgREST renvoie les geometry en
-- WKB ; l'application lit du GeoJSON. Chaque vue expose la géométrie
-- convertie — c'est elles que consomme lib/content.ts en mode Supabase.

create or replace view territoires_publics as
select
  t.slug, t.nom, t.marque, t.slogan, t.actif, t.langues, t.langue_defaut,
  t.photo_accueil, t.contact_tel, t.contact_whatsapp, t.contact_email,
  t.urgences, t.etat_acces, t.zoom_defaut,
  st_asgeojson(t.centre)::jsonb as centre_geojson
from territoires t
where t.actif;

create or replace view pois_publics as
select
  p.slug, p.nom, p.type, p.panneau_no, p.texte, p.photo, p.audio_url,
  p.contact, p.statut, p.ordre,
  st_asgeojson(p.geom)::jsonb as geom_geojson
from pois p
where p.statut = 'publie';
