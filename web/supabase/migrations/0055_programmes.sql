-- ============================================================
-- MIGRATION 0055 — Les programmes : un niveau au-dessus des projets
-- ============================================================
-- Chantier lancé le 28/07 au soir (roadmap « Programmes : un niveau
-- au-dessus des projets, avec son directeur »). Le constat : d'autres
-- programmes CEM viendront, sur d'autres villes, avec d'AUTRES
-- directeurs — le droit ne peut pas s'accrocher à l'étiquette « CEM »,
-- que tous porteront. Les trois projets d'aujourd'hui forment UN
-- programme, repris plus bas.
--
-- L'ARCHITECTURE DES DROITS, arbitrée : pas de nouveau rôle dans les
-- policies. Nommer un directeur MATÉRIALISE son appartenance — des
-- lignes project_members (rôle chef_projet, marquées via_programme)
-- posées par déclencheur sur TOUS les projets du programme, y compris
-- ceux rattachés plus tard. Trois raisons :
--  · les droits opérationnels voulus sont EXACTEMENT ceux d'un chef de
--    projet — la machinerie existante (policies, matrice, CI) s'applique
--    telle quelle, aucune des ~15 policies n'est réécrite ;
--  · le directeur est VISIBLE dans la liste des membres, invitable aux
--    réunions, dans les pastilles d'organisation — un directeur
--    invisible aurait tous les droits et aucune existence à l'écran ;
--  · retirer le directeur retire SEULEMENT les lignes via_programme :
--    une appartenance posée à la main survit.
--
-- Ce que le déclencheur ne fait JAMAIS : toucher une ligne existante.
-- Bérengère, aujourd'hui auditrice, RESTE auditrice tant que l'admin
-- ne change pas son rôle à la main — un déclencheur qui écraserait un
-- siège d'auditeur contournerait la 0047.
--
-- Directeurs nommés par l'ADMIN SEUL : un pouvoir d'échelon supérieur
-- ne se donne pas depuis l'échelon qu'il gouverne (logique auditeurs).
-- L'étiquette texte projects.programme (0020) est CONSERVÉE (règle
-- n°4) : elle devient un repli d'affichage.

-- 1. Le niveau programme
create table if not exists programmes (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table projects add column if not exists programme_id uuid references programmes(id);

create table if not exists programme_directors (
  programme_id uuid not null references programmes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (programme_id, user_id)
);

alter table programmes enable row level security;
alter table programme_directors enable row level security;

-- Lire : tout connecté — le nom d'un programme et qui le dirige ne
-- sont pas des secrets, et les fiches les affichent. Écrire : admin
-- plateforme seul.
create policy "Authenticated read programmes" on programmes
  for select using (auth.uid() is not null);
create policy "Admins manage programmes" on programmes
  for all using (is_admin()) with check (is_admin());
create policy "Authenticated read programme directors" on programme_directors
  for select using (auth.uid() is not null);
create policy "Admins manage programme directors" on programme_directors
  for all using (is_admin()) with check (is_admin());

-- 2. La trace de provenance sur les appartenances
alter table project_members add column if not exists via_programme boolean not null default false;

-- 3. La synchronisation par déclencheurs (SECURITY DEFINER : elle
--    écrit project_members sous les policies restrictives de la 0047,
--    mais ne touche jamais une ligne existante — on conflict nothing).
create or replace function public.sync_director_added()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into project_members (project_id, user_id, role, via_programme)
  select p.id, new.user_id, 'chef_projet', true
    from projects p where p.programme_id = new.programme_id
  on conflict (project_id, user_id) do nothing;
  return new;
end $$;

create or replace function public.sync_director_removed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from project_members pm
   using projects p
   where pm.project_id = p.id
     and p.programme_id = old.programme_id
     and pm.user_id = old.user_id
     and pm.via_programme = true;
  return old;
end $$;

create or replace function public.sync_project_programme()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Le projet quitte son ancien programme : ses directeurs « via
  -- programme » sortent — sauf s'ils dirigent aussi le nouveau.
  if old.programme_id is not null then
    delete from project_members pm
     where pm.project_id = new.id
       and pm.via_programme = true
       and pm.user_id in (
         select user_id from programme_directors where programme_id = old.programme_id
       )
       and (new.programme_id is null or pm.user_id not in (
         select user_id from programme_directors where programme_id = new.programme_id
       ));
  end if;
  if new.programme_id is not null then
    insert into project_members (project_id, user_id, role, via_programme)
    select new.id, pd.user_id, 'chef_projet', true
      from programme_directors pd where pd.programme_id = new.programme_id
    on conflict (project_id, user_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_director_added on programme_directors;
create trigger trg_sync_director_added
  after insert on programme_directors
  for each row execute function public.sync_director_added();

drop trigger if exists trg_sync_director_removed on programme_directors;
create trigger trg_sync_director_removed
  after delete on programme_directors
  for each row execute function public.sync_director_removed();

drop trigger if exists trg_sync_project_programme on projects;
create trigger trg_sync_project_programme
  after insert or update of programme_id on projects
  for each row execute function public.sync_project_programme();

-- 4. Reprise : les trois projets d'aujourd'hui forment UN programme.
--    Idempotent — et le rattachement passe par UPDATE, donc les
--    déclencheurs poseront les appartenances des directeurs nommés
--    ensuite dans l'application.
insert into programmes (name, description)
values ('CEM — Triades Villepreux & Jouy',
        'Programme CEM 2026 : Triade Villepreux · Azour · LEY, Triade Jouy-en-Josas · Jeïta · Comité de Jumelage, et la coordination commune.')
on conflict (name) do nothing;

update projects set programme_id = (select id from programmes where name = 'CEM — Triades Villepreux & Jouy')
 where name ilike 'CEM Liban%'
   and programme_id is null;

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select pr.name, count(p.id) as projets,
--          (select count(*) from programme_directors pd where pd.programme_id = pr.id) as directeurs
--     from programmes pr left join projects p on p.programme_id = pr.id
--    group by pr.id;
