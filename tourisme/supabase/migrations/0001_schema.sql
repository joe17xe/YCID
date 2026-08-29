-- Visit Azour — schéma initial.
-- La règle produit : la carte n'affiche que des données, le code ne
-- connaît aucune coordonnée. Tout objet est paramétrable par territoire.
-- (docs/tourisme-azour/07-modele-de-donnees.md)

create extension if not exists postgis;

-- ————————————————————————————————————————————————————————————————
-- Territoires : l'unité de duplication. « Visit Azour » = une ligne ici.
-- ————————————————————————————————————————————————————————————————
create table territoires (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  nom jsonb not null,                       -- {"fr":"Azour","ar":"عازور","en":"Azour"}
  slogan jsonb,
  actif boolean not null default true,
  langues text[] not null default '{ar,fr,en}',
  langue_defaut text not null default 'fr',
  couleurs jsonb,                           -- surcharge éventuelle des tokens
  logo_url text,
  photo_accueil text,
  -- Le numéro d'information du kiosque est un PARAMÈTRE (cadrage 29/08) :
  -- saisi ici, il s'affiche partout (app, kiosque, panneaux réimprimés).
  contact_tel text,
  contact_whatsapp text,
  contact_email text,
  urgences jsonb,                           -- [{"nom":{...},"tel":"112"},…]
  -- Bandeau « état d'accès » daté — le manque identifié au benchmark :
  -- {"niveau":"ouvert|prudence|ferme","message":{fr,ar,en},"date":"2026-08-29"}
  etat_acces jsonb,
  centre geometry(Point, 4326),
  zoom_defaut numeric(4,2) default 13,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ————————————————————————————————————————————————————————————————
-- Parcours : la trace est une DONNÉE (import GPX/KML), jamais du code.
-- ————————————————————————————————————————————————————————————————
create table parcours (
  id uuid primary key default gen_random_uuid(),
  territoire_id uuid not null references territoires(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  nom jsonb not null,
  accroche jsonb,                           -- une phrase
  description jsonb,
  type text not null check (type in ('boucle','lineaire','guide')),
  difficulte text not null check (difficulte in ('facile','modere','difficile')),
  -- accès guidé (Hyrax Rock) : pas de GPX public, réservation via guide
  acces_guide boolean not null default false,
  trace geometry(LineString, 4326),
  -- provisoire = dessiné d'après l'étude, en attente du relevé officiel
  trace_statut text not null default 'provisoire' check (trace_statut in ('provisoire','verifie')),
  -- Valeurs OFFICIELLES (étude) ; si null, calculées depuis la trace
  distance_m integer check (distance_m > 0),
  denivele_pos_m integer,
  denivele_neg_m integer,
  duree_min_minutes integer,
  duree_max_minutes integer,
  saison jsonb,
  dangers jsonb,
  acces jsonb,                              -- venir, se garer
  depart geometry(Point, 4326),
  photo text,
  statut text not null default 'brouillon' check (statut in ('brouillon','publie','ferme')),
  ordre integer not null default 0,
  -- Versionnage des packs hors-ligne : toute modification incrémente,
  -- le service worker re-télécharge le pack concerné.
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (territoire_id, slug)
);

create index parcours_territoire_idx on parcours (territoire_id, statut, ordre);
create index parcours_trace_gix on parcours using gist (trace);

-- ————————————————————————————————————————————————————————————————
-- Points d'intérêt : chaque point saisi au back-office (coller,
-- cliquer sur la carte, ou « prendre ma position » sur le terrain).
-- ————————————————————————————————————————————————————————————————
create table pois (
  id uuid primary key default gen_random_uuid(),
  territoire_id uuid not null references territoires(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  nom jsonb not null,
  type text not null check (type in (
    'depart','belvedere','patrimoine','panneau','eau','ombre',
    'hebergement','restaurant','guide','camping','urgence','nature','autre')),
  geom geometry(Point, 4326) not null,
  panneau_no integer,                       -- le lien terrain ↔ app (QR)
  texte jsonb,
  photo text,
  audio_url text,                           -- izi.TRAVEL ou fichier
  contact jsonb,                            -- {"tel":…,"whatsapp":…,"site":…}
  statut text not null default 'brouillon' check (statut in ('brouillon','publie')),
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (territoire_id, slug)
);

create index pois_territoire_idx on pois (territoire_id, statut, type, ordre);
create index pois_geom_gix on pois using gist (geom);

-- Étapes d'un parcours = des POI ordonnés (numérotés comme les panneaux)
create table parcours_pois (
  parcours_id uuid not null references parcours(id) on delete cascade,
  poi_id uuid not null references pois(id) on delete cascade,
  ordre integer not null default 0,
  primary key (parcours_id, poi_id)
);

-- ————————————————————————————————————————————————————————————————
-- Agenda : trail annuel, randonnée d'inauguration, saisons naturelles
-- ————————————————————————————————————————————————————————————————
create table evenements (
  id uuid primary key default gen_random_uuid(),
  territoire_id uuid not null references territoires(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  nom jsonb not null,
  description jsonb,
  date_debut date,
  date_fin date,
  recurrent boolean not null default false, -- saisons (cigognes) sans année
  lien text,
  photo text,
  statut text not null default 'brouillon' check (statut in ('brouillon','publie')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (territoire_id, slug)
);

-- ————————————————————————————————————————————————————————————————
-- Éditeurs : les droits se donnent PAR TERRITOIRE (RLS)
-- ————————————————————————————————————————————————————————————————
create table territoire_editeurs (
  territoire_id uuid not null references territoires(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editeur' check (role in ('editeur','admin')),
  created_at timestamptz not null default now(),
  primary key (territoire_id, user_id)
);

-- ————————————————————————————————————————————————————————————————
-- Triggers : updated_at partout, version +1 sur les parcours modifiés
-- (l'invalidation des packs hors-ligne en découle)
-- ————————————————————————————————————————————————————————————————
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function bump_parcours_version() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end $$;

create trigger territoires_updated before update on territoires
  for each row execute function set_updated_at();
create trigger parcours_versioned before update on parcours
  for each row execute function bump_parcours_version();
create trigger pois_updated before update on pois
  for each row execute function set_updated_at();
create trigger evenements_updated before update on evenements
  for each row execute function set_updated_at();

-- ————————————————————————————————————————————————————————————————
-- Vue publique : stats calculées depuis la trace quand l'officiel
-- manque ; GeoJSON prêt à servir. C'est elle que lit l'application.
-- ————————————————————————————————————————————————————————————————
create or replace view parcours_publics as
select
  p.id, p.territoire_id, p.slug, p.nom, p.accroche, p.description,
  p.type, p.difficulte, p.acces_guide, p.trace_statut,
  coalesce(p.distance_m, round(st_length(p.trace::geography))::integer) as distance_m,
  p.denivele_pos_m, p.denivele_neg_m,
  p.duree_min_minutes, p.duree_max_minutes,
  p.saison, p.dangers, p.acces, p.photo, p.statut, p.ordre, p.version,
  p.updated_at,
  st_asgeojson(p.trace)::jsonb as trace_geojson,
  st_asgeojson(p.depart)::jsonb as depart_geojson
from parcours p
where p.statut in ('publie','ferme');

-- ————————————————————————————————————————————————————————————————
-- RLS : lecture publique du publié, écriture par éditeurs du territoire
-- ————————————————————————————————————————————————————————————————
alter table territoires enable row level security;
alter table parcours enable row level security;
alter table pois enable row level security;
alter table parcours_pois enable row level security;
alter table evenements enable row level security;
alter table territoire_editeurs enable row level security;

create or replace function est_editeur(t_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from territoire_editeurs e
    where e.territoire_id = t_id and e.user_id = auth.uid()
  );
$$;

-- Territoires : visibles si actifs ; modifiables par leurs éditeurs.
create policy territoires_lecture on territoires
  for select using (actif or est_editeur(id));
create policy territoires_ecriture on territoires
  for update using (est_editeur(id)) with check (est_editeur(id));

-- Parcours / POI / événements : le public lit le publié (et « fermé »,
-- qui doit rester visible avec son bandeau), les éditeurs voient tout.
create policy parcours_lecture on parcours
  for select using (statut in ('publie','ferme') or est_editeur(territoire_id));
create policy parcours_ecriture on parcours
  for all using (est_editeur(territoire_id)) with check (est_editeur(territoire_id));

create policy pois_lecture on pois
  for select using (statut = 'publie' or est_editeur(territoire_id));
create policy pois_ecriture on pois
  for all using (est_editeur(territoire_id)) with check (est_editeur(territoire_id));

create policy parcours_pois_lecture on parcours_pois
  for select using (true);
create policy parcours_pois_ecriture on parcours_pois
  for all using (
    exists (select 1 from parcours p where p.id = parcours_id and est_editeur(p.territoire_id))
  ) with check (
    exists (select 1 from parcours p where p.id = parcours_id and est_editeur(p.territoire_id))
  );

create policy evenements_lecture on evenements
  for select using (statut = 'publie' or est_editeur(territoire_id));
create policy evenements_ecriture on evenements
  for all using (est_editeur(territoire_id)) with check (est_editeur(territoire_id));

-- Chacun lit ses propres droits ; l'attribution se fait en SQL (admin).
create policy editeurs_lecture on territoire_editeurs
  for select using (user_id = auth.uid());
