-- Visit Azour — plusieurs photos par lieu.
--
-- Une seule image ne suffit pas à raconter une maison d'hôtes ou un
-- belvédère. Chaque POI porte donc une GALERIE ordonnée : la première
-- sert de couverture (listes, en-tête, vignettes), les suivantes se
-- déroulent sur la fiche.
--
-- Forme : [{"src":"/photos/beit-mrad-1.jpg",
--           "credit":"Municipalité d'Azour",
--           "legende":{"fr":"…","ar":"…","en":"…"}}]
-- Le crédit est un champ à part, pas une note perdue dans la légende :
-- une photo d'établissement appartient à quelqu'un.

alter table pois add column if not exists photos jsonb not null default '[]'::jsonb;

-- Une galerie est un TABLEAU d'objets — sans quoi la couverture serait
-- lue au hasard et l'app afficherait n'importe quoi.
alter table pois drop constraint if exists pois_photos_tableau;
alter table pois add constraint pois_photos_tableau
  check (jsonb_typeof(photos) = 'array');

comment on column pois.photos is
  'Galerie ordonnée. La première photo sert de couverture quand la colonne photo est vide.';

-- Les nouvelles colonnes se posent EN FIN de liste : « create or replace
-- view » sait allonger une vue, pas réordonner ses colonnes.
create or replace view pois_publics as
select
  p.slug, p.nom, p.type, p.panneau_no, p.texte, p.photo, p.audio_url,
  p.contact, p.statut, p.ordre,
  st_asgeojson(p.geom)::jsonb as geom_geojson,
  p.services,
  p.sur_reservation,
  p.photos
from pois p
where p.statut = 'publie';

create or replace view admin_pois with (security_invoker = true) as
select o.id, o.territoire_id, o.slug, o.nom, o.type, o.panneau_no,
       o.statut, o.ordre, st_x(o.geom) as lon, st_y(o.geom) as lat,
       o.services,
       o.sur_reservation,
       o.photo,
       o.photos
from pois o;
