-- ============================================================
-- PR 41 — Écran Stockage (Admin) : inventaire et nettoyage
-- ============================================================
-- Besoin apparu avec les PR 38a → 38e : les pièces s'accumulent — les
-- photos de chantier arrivent en HEIC depuis des iPhone, 3 à 5 Mo
-- l'unité — et personne ne voit le quota se remplir.
--
-- Deuxième besoin, créé par la 38a : `deleteDocument` retire la ligne
-- puis le fichier ; si le second échoue, l'échec est journalisé sans
-- bloquer (bon choix : l'utilisateur ne doit pas rester avec une ligne
-- qu'il croit supprimée). Mais rien ne remonte les fichiers orphelins
-- qui en résultent.
--
-- Pourquoi du SQL plutôt qu'un parcours de bucket : `storage.list()`
-- est paginé et ne descend que d'un niveau. Inventorier
-- projets/<projet>/<phase>/<fichier> imposerait des dizaines d'appels,
-- et le rapprochement avec la table `documents` — c'est-à-dire la
-- détection des orphelins — se ferait de toute façon mieux ici.

-- ------------------------------------------------------------
-- 1. Occupation par bucket
-- ------------------------------------------------------------
create or replace function public.storage_stats()
returns table (bucket text, files bigint, bytes bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ces fonctions lisent TOUT le stockage, tous projets confondus :
  -- réservées aux administrateurs, contrôle à l'intérieur puisqu'une
  -- fonction security definer contourne la RLS par construction.
  if not (is_admin() or is_lead_org_admin()) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
    select o.bucket_id::text,
           count(*)::bigint,
           coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
      from storage.objects o
     group by o.bucket_id
     order by 3 desc;
end;
$$;

-- ------------------------------------------------------------
-- 2. Fichiers orphelins du bucket « documents »
-- ------------------------------------------------------------
-- Présents dans le bucket, sans ligne correspondante en base : ils
-- consomment du quota et ne sont atteignables par aucun écran.
create or replace function public.storage_orphans()
returns table (path text, bytes bigint, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_admin() or is_lead_org_admin()) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
    select o.name::text,
           coalesce((o.metadata->>'size')::bigint, 0)::bigint,
           o.created_at
      from storage.objects o
     where o.bucket_id = 'documents'
       and not exists (select 1 from documents d where d.storage_path = o.name)
     order by o.created_at;
end;
$$;

-- ------------------------------------------------------------
-- 3. Occupation par projet
-- ------------------------------------------------------------
-- Le projet se lit dans le chemin projets/<project_id>/… : passer par
-- la table `documents` raterait précisément les orphelins, qu'on veut
-- justement voir peser.
create or replace function public.storage_by_project()
returns table (project_id uuid, project_name text, files bigint, bytes bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_admin() or is_lead_org_admin()) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
    select p.id, p.name::text, count(*)::bigint,
           coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
      from storage.objects o
      join projects p
        on p.id = public.document_path_project_id(o.name)
     where o.bucket_id = 'documents'
     group by p.id, p.name
     order by 4 desc;
end;
$$;
