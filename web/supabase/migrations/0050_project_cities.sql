-- ============================================================
-- MIGRATION 0050 — Les villes des projets
-- ============================================================
-- Constat du 28/07, captures à l'appui : le travail est ENTRE des
-- villes — une en Yvelines et une au Liban (les triades), parfois deux
-- villes libanaises (échanges). Le modèle du lot 3 (un projet = un
-- point lat/lng) ne sait pas le dire : les deux triades placées côté
-- Liban, le panneau Yvelines affichait « 0 projet ».
--
-- Décision produit (28/07) :
--  · les villes se renseignent AU NIVEAU DU PROJET — plusieurs par
--    projet — et se listent sur la fiche ;
--  · la carte du tableau de bord affiche les VILLES ; cliquer une
--    ville montre les projets qui l'impliquent ;
--  · sans droit sur un projet, on VOIT le repère de la ville et QU'UN
--    travail existe (un simple nombre), on n'ACCÈDE à rien — ni nom,
--    ni fiche. La visibilité des noms reste celle des policies
--    projets : la recette (« la Triade Jouy ne doit pas apparaître »)
--    reste vraie.
--
-- projects.lat / projects.lng restent en place : l'ancien code s'en
-- sert tant que cette migration n'est pas passée, le nouveau les
-- ignore dès qu'elle l'est. Aucune colonne supprimée (règle n°4).

-- 1. Référentiel des villes (nom, pays, position)
create table if not exists cities (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  country text not null,
  lat numeric not null check (lat between -90 and 90),
  lng numeric not null check (lng between -180 and 180),
  created_at timestamptz not null default now(),
  unique (name, country)
);

-- 2. Les villes d'un projet
create table if not exists project_cities (
  project_id uuid not null references projects(id) on delete cascade,
  city_id uuid not null references cities(id) on delete cascade,
  primary key (project_id, city_id)
);

alter table cities enable row level security;
alter table project_cities enable row level security;

-- Villes : référentiel géographique, sans donnée de projet — lisible
-- par tout connecté (même règle que les organisations), créable par
-- tout connecté (précédent : « Auth users create orgs », 0001).
-- Correction et suppression : admins seulement — corriger une ville
-- déplace les repères de TOUS les projets qui la portent.
create policy "Authenticated read cities" on cities
  for select using (auth.uid() is not null);
create policy "Authenticated create cities" on cities
  for insert with check (auth.uid() is not null);
create policy "Admins update cities" on cities
  for update using (is_admin() or is_lead_org_admin());
create policy "Admins delete cities" on cities
  for delete using (is_admin() or is_lead_org_admin());

-- Lien projet ↔ ville : LISIBLE par tout connecté. C'est l'arbitrage
-- « visualiser sans accéder » : le repère d'une ville et le NOMBRE de
-- projets qui l'impliquent sont visibles de tous dans l'application ;
-- les noms et les fiches restent derrière les policies projets — le
-- lien n'expose qu'un identifiant opaque. Géré par ceux qui tiennent
-- la fiche : mêmes rôles que la gestion des phases, plus les admins
-- (0011).
create policy "Authenticated read project cities" on project_cities
  for select using (auth.uid() is not null);
create policy "Editors manage project cities" on project_cities
  for all using (
    is_admin() or is_lead_org_admin()
    or exists (
      select 1 from project_members pm
      where pm.project_id = project_cities.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('chef_projet', 'referent_mairie')
    )
  )
  with check (
    is_admin() or is_lead_org_admin()
    or exists (
      select 1 from project_members pm
      where pm.project_id = project_cities.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('chef_projet', 'referent_mairie')
    )
  );

-- 3. Amorçage : les quatre communes du 28/07, puis les liens des deux
--    triades — rattrapage par le nom, idempotent.
insert into cities (name, country, lat, lng) values
  ('Villepreux', 'France', 48.8344, 2.0130),
  ('Jouy-en-Josas', 'France', 48.7703, 2.1670),
  ('Azour', 'Liban', 33.5595, 35.5352),
  ('Jeïta', 'Liban', 33.9439, 35.6441)
on conflict (name, country) do nothing;

insert into project_cities (project_id, city_id)
select p.id, c.id from projects p, cities c
 where (p.name ilike '%villepreux%' and c.name = 'Villepreux')
    or (p.name ilike '%azour%'      and c.name = 'Azour')
    or (p.name ilike '%jouy%'       and c.name = 'Jouy-en-Josas')
    or ((p.name ilike '%jeita%' or p.name ilike '%jeïta%') and c.name = 'Jeïta')
on conflict do nothing;

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select c.name, c.country, count(pc.project_id) as projets
--     from cities c left join project_cities pc on pc.city_id = c.id
--    group by c.id order by c.country, c.name;
