-- ============================================================
-- MIGRATION 0022 — Fix création de comptes : search_path des triggers
-- ============================================================
-- Incident du 25/07/2026 : POST /admin/users → 500 unexpected_failure.
-- Cause : handle_new_user() s'exécute dans la session de GoTrue, dont le
-- search_path ne contient PAS le schéma public. « insert into profiles »
-- (non préfixé) → relation introuvable → trigger en échec → GoTrue
-- annule la création et renvoie 500.
-- Correctif : set search_path = public + tables préfixées, et
-- on conflict do nothing pour rendre le trigger ré-exécutable.
-- protect_profile_flags est durci de la même façon (la règle
-- « auth.uid() NULL = contexte privilégié » du correctif final est
-- conservée).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.protect_profile_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if TG_OP = 'INSERT' then
    if new.is_platform_admin and not is_admin() then
      raise exception 'is_platform_admin ne peut être attribué que par un administrateur';
    end if;
  elsif new.is_platform_admin is distinct from old.is_platform_admin and not is_admin() then
    raise exception 'is_platform_admin ne peut être modifié que par un administrateur';
  end if;
  return new;
end;
$$;
