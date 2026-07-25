-- ============================================================
-- MIGRATION 0021 — Page vitrine publique par projet (PR 28)
-- ============================================================
-- Un projet peut être partagé en lecture seule via /p/<jeton>.
-- Opt-in : public_token NULL = pas de page publique (défaut).
-- Le jeton (UUID aléatoire) rend l'URL non devinable ; la page est
-- servie côté serveur via la clé service, aucune policy anon requise.

alter table projects add column if not exists public_token uuid;
create unique index if not exists projects_public_token_idx
  on projects(public_token) where public_token is not null;
