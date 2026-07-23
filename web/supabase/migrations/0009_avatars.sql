-- ============================================================
-- MIGRATION 0009 — Photo de profil (page Préférences)
-- ============================================================
-- Colonne avatar sur profiles + bucket Storage public « avatars ».
-- Chaque utilisateur ne peut écrire que dans son propre dossier
-- (avatars/<uid>/...), lecture publique (images de profil).

alter table profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar read" on storage.objects;
create policy "Avatar read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Avatar upload" on storage.objects;
create policy "Avatar upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatar update" on storage.objects;
create policy "Avatar update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatar delete" on storage.objects;
create policy "Avatar delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
