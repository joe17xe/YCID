-- Visit Azour — la réservation, gérée localement.
--
-- Décision du 03/09/2026 : plus de lien avec le Lebanon Mountain Trail,
-- tout se traite au village. Le kiosque ne se contente donc plus
-- d'informer : il prend les demandes. Deux objets suffisent —
--   « formules » : ce qu'on propose (paramétrable, comme le reste) ;
--   « demandes » : ce que les visiteurs envoient.
-- Aucune formule n'est écrite dans le code : ce qui n'est pas dans
-- cette table n'existe pas dans l'app.

-- ————————————————————————————————————————————————————————————————
-- Formules : visite guidée, randonnée accompagnée, journée, groupes…
-- ————————————————————————————————————————————————————————————————
create table if not exists formules (
  id uuid primary key default gen_random_uuid(),
  territoire_id uuid not null references territoires(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  nom jsonb not null,
  accroche jsonb,                            -- une phrase
  description jsonb,
  categorie text not null default 'randonnee'
    check (categorie in ('visite','randonnee','aventure','journee','groupe')),
  duree_minutes integer check (duree_minutes > 0),
  participants_min integer check (participants_min > 0),
  participants_max integer check (participants_max > 0),
  -- Le tarif est un PARAMÈTRE, jamais une valeur codée. null = « à
  -- confirmer au kiosque » : c'est l'état de départ, la municipalité
  -- renseigne quand elle a tranché.
  prix_montant numeric(10,2) check (prix_montant >= 0),
  prix_devise text not null default 'USD',
  prix_unite text not null default 'personne' check (prix_unite in ('personne','groupe')),
  inclus jsonb,                              -- ce que la formule comprend
  niveau text check (niveau in ('facile','modere','difficile')),
  saison jsonb,
  langues text[] not null default '{ar,fr,en}',
  photo text,
  statut text not null default 'brouillon' check (statut in ('brouillon','publie')),
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (territoire_id, slug),
  constraint participants_coherents
    check (participants_min is null or participants_max is null
           or participants_min <= participants_max)
);

-- Une formule peut s'appuyer sur un ou plusieurs parcours existants —
-- ou sur aucun (la visite du village, les groupes sur mesure).
create table if not exists formules_parcours (
  formule_id uuid not null references formules(id) on delete cascade,
  parcours_id uuid not null references parcours(id) on delete cascade,
  primary key (formule_id, parcours_id)
);

-- ————————————————————————————————————————————————————————————————
-- Demandes : le registre du kiosque. Insérable par tout le monde
-- (c'est un formulaire public), lisible par les seuls éditeurs.
-- ————————————————————————————————————————————————————————————————
create table if not exists demandes (
  id uuid primary key default gen_random_uuid(),
  territoire_id uuid not null references territoires(id) on delete cascade,
  formule_id uuid references formules(id) on delete set null,
  -- Le nom de la formule est recopié : une formule retirée du catalogue
  -- ne doit pas effacer la trace de ce qui avait été demandé.
  formule_nom text,
  nom text not null check (length(btrim(nom)) between 2 and 120),
  telephone text not null check (length(btrim(telephone)) between 5 and 40),
  email text check (length(email) <= 160),
  date_souhaitee date,
  participants integer check (participants between 1 and 200),
  langue text not null default 'fr' check (langue in ('ar','fr','en')),
  message text check (length(message) <= 2000),
  canal text not null default 'formulaire' check (canal in ('formulaire','whatsapp','telephone','kiosque')),
  statut text not null default 'nouvelle'
    check (statut in ('nouvelle','vue','confirmee','annulee')),
  created_at timestamptz not null default now()
);

create index if not exists demandes_territoire_date on demandes (territoire_id, created_at desc);

-- ————————————————————————————————————————————————————————————————
-- RLS
-- ————————————————————————————————————————————————————————————————
alter table formules enable row level security;
alter table formules_parcours enable row level security;
alter table demandes enable row level security;

create policy formules_lecture on formules
  for select using (statut = 'publie' or est_editeur(territoire_id));
create policy formules_ecriture on formules
  for all using (est_editeur(territoire_id)) with check (est_editeur(territoire_id));

create policy formules_parcours_lecture on formules_parcours
  for select using (true);
create policy formules_parcours_ecriture on formules_parcours
  for all using (
    exists (select 1 from formules f where f.id = formule_id and est_editeur(f.territoire_id))
  ) with check (
    exists (select 1 from formules f where f.id = formule_id and est_editeur(f.territoire_id))
  );

-- Déposer une demande est public — c'est un formulaire de contact. La
-- LIRE ne l'est pas : rien ne remonte au visiteur, pas même la sienne.
create policy demandes_depot on demandes
  for insert with check (
    exists (select 1 from territoires t where t.id = territoire_id and t.actif)
  );
create policy demandes_lecture on demandes
  for select using (est_editeur(territoire_id));
create policy demandes_suivi on demandes
  for update using (est_editeur(territoire_id)) with check (est_editeur(territoire_id));

-- ————————————————————————————————————————————————————————————————
-- Vues
-- ————————————————————————————————————————————————————————————————
-- Publique : le catalogue, avec les parcours rattachés en tableau de
-- slugs — l'app n'a jamais besoin de faire la jointure elle-même.
create or replace view formules_publiques as
select f.id, f.slug, f.nom, f.accroche, f.description, f.categorie,
       f.duree_minutes, f.participants_min, f.participants_max,
       f.prix_montant, f.prix_devise, f.prix_unite,
       f.inclus, f.niveau, f.saison, f.langues, f.photo, f.ordre,
       coalesce(
         (select array_agg(p.slug order by p.ordre)
            from formules_parcours fp join parcours p on p.id = fp.parcours_id
           where fp.formule_id = f.id),
         '{}'
       ) as parcours_slugs
from formules f
where f.statut = 'publie';

-- Admin : security_invoker, donc la RLS de l'éditeur s'applique telle
-- quelle — pas de porte dérobée.
create or replace view admin_formules with (security_invoker = true) as
select f.id, f.territoire_id, f.slug, f.nom, f.categorie, f.duree_minutes,
       f.prix_montant, f.prix_devise, f.prix_unite, f.statut, f.ordre
from formules f;

create or replace view admin_demandes with (security_invoker = true) as
select d.id, d.territoire_id, d.formule_nom, d.nom, d.telephone, d.email,
       d.date_souhaitee, d.participants, d.langue, d.message, d.canal,
       d.statut, d.created_at
from demandes d;

-- Le formulaire de demande a besoin de l'identifiant du territoire pour
-- insérer : on l'ajoute EN FIN de vue (« create or replace view » sait
-- allonger une vue, pas réordonner ses colonnes). Un uuid de territoire
-- n'est pas un secret — la RLS, elle, ne bouge pas.
create or replace view territoires_publics as
select
  t.slug, t.nom, t.marque, t.slogan, t.actif, t.langues, t.langue_defaut,
  t.photo_accueil, t.contact_tel, t.contact_whatsapp, t.contact_email,
  t.urgences, t.etat_acces, t.zoom_defaut,
  st_asgeojson(t.centre)::jsonb as centre_geojson,
  t.id
from territoires t
where t.actif;
