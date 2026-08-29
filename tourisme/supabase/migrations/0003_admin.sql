-- Back-office léger : ce que PostgREST ne sait pas faire proprement sur
-- les colonnes geometry passe par des fonctions (security invoker : les
-- RLS des tables s'appliquent — seuls les éditeurs du territoire passent)
-- et des vues d'administration qui exposent lon/lat en clair.

-- Écrire une trace depuis un GeoJSON (import GPX du back-office)
create or replace function admin_set_trace(p_id uuid, p_geojson jsonb, p_statut text)
returns void
language sql
security invoker
set search_path = public
as $$
  update parcours
  set trace = st_setsrid(st_geomfromgeojson(p_geojson::text), 4326),
      trace_statut = p_statut
  where id = p_id;
$$;

-- Déplacer un POI (coordonnées collées ou « ma position »)
create or replace function admin_set_poi_geom(p_id uuid, p_lon float8, p_lat float8)
returns void
language sql
security invoker
set search_path = public
as $$
  update pois
  set geom = st_setsrid(st_makepoint(p_lon, p_lat), 4326)
  where id = p_id;
$$;

-- Vues d'administration (security_invoker : RLS des tables respectées —
-- un éditeur voit ses brouillons, un anonyme ne voit rien de plus)
create or replace view admin_parcours with (security_invoker = true) as
select p.id, p.territoire_id, p.slug, p.nom, p.type, p.difficulte,
       p.acces_guide, p.trace_statut, p.statut, p.distance_m,
       p.denivele_pos_m, p.denivele_neg_m, p.version, p.updated_at,
       (p.trace is not null) as a_une_trace,
       case when p.trace is not null
            then round(st_length(p.trace::geography))::integer end as trace_longueur_m
from parcours p;

create or replace view admin_pois with (security_invoker = true) as
select o.id, o.territoire_id, o.slug, o.nom, o.type, o.panneau_no,
       o.statut, o.ordre, st_x(o.geom) as lon, st_y(o.geom) as lat
from pois o;
