-- Shim de vérification LOCALE uniquement : simule le schéma auth de
-- Supabase pour rejouer les migrations sur un PostgreSQL nu.
-- NE PAS exécuter sur un vrai projet Supabase.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
