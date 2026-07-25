-- ============================================================
-- MIGRATION 0023 — Configuration IA administrable (PR 31)
-- ============================================================
-- Permet de configurer le fournisseur IA depuis Admin ▸ Configuration
-- au lieu d'éditer .env.local sur le serveur.
--
-- SÉCURITÉ : la clé API est un secret. Cette table est donc SÉPARÉE de
-- platform_settings (qui est en lecture PUBLIQUE pour la marque) et
-- n'est lisible QUE par les administrateurs plateforme. Côté serveur,
-- la lecture passe par la clé service ; la clé API n'est jamais
-- renvoyée au navigateur (seul un booléen « configurée » l'est).

create table if not exists ai_settings (
  id boolean primary key default true check (id),
  provider text not null default 'gemini'
    check (provider in ('gemini', 'groq', 'openrouter', 'kimi', 'openai', 'autre')),
  base_url text not null default 'https://generativelanguage.googleapis.com/v1beta/openai',
  model text not null default 'gemini-2.5-flash',
  api_key text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

insert into ai_settings (id) values (true) on conflict (id) do nothing;

alter table ai_settings enable row level security;

-- Lecture ET écriture réservées aux administrateurs plateforme.
-- (Aucune policy pour les autres rôles : la table leur est invisible.)
drop policy if exists "Admins read ai settings" on ai_settings;
create policy "Admins read ai settings" on ai_settings
  for select using (is_admin());

drop policy if exists "Admins update ai settings" on ai_settings;
create policy "Admins update ai settings" on ai_settings
  for update using (is_admin()) with check (is_admin());
