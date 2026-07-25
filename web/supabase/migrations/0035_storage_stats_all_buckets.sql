-- ============================================================
-- Correctif PR 41 — lister TOUS les espaces de stockage
-- ============================================================
-- Constaté en recette : l'écran Stockage n'affichait qu'un seul espace
-- (« Pièces des projets ») au lieu des trois. Cause : la fonction
-- agrégeait `storage.objects` en groupant par bucket_id. Un bucket sans
-- aucun objet ne produit aucune ligne, donc disparaît — et rien ne
-- distingue « bucket vide » de « bucket inexistant ».
--
-- Pour un écran dont la fonction est l'inventaire, c'est un défaut de
-- fond : on ne peut pas constater qu'un espace est vide s'il n'est pas
-- affiché. On part donc de `storage.buckets`, avec une jointure externe.

create or replace function public.storage_stats()
returns table (bucket text, files bigint, bytes bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_admin() or is_lead_org_admin()) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
    select b.id::text,
           count(o.id)::bigint,
           coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
      from storage.buckets b
      left join storage.objects o on o.bucket_id = b.id
     group by b.id
     order by 3 desc, 1;
end;
$$;
