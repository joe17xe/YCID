-- ============================================================
-- 0052 — Point de contrôle des sauvegardes
-- ============================================================
-- Arbitrage du 28/07 : l'offre Supabase reste Free tant que l'adoption
-- ne justifie pas de payer — donc AUCUNE sauvegarde automatique côté
-- hébergeur. La copie de référence se fait sur le VPS
-- (scripts/backup.sh : base par pg_dump + fichiers du Storage) — une
-- copie séparée, hors de l'infrastructure Supabase, qui survivrait à
-- une suppression, une corruption ou la perte du compte.
--
-- Cette colonne est le point de contrôle : le script l'horodate à
-- chaque sauvegarde réussie (base ET fichiers — jamais l'une sans
-- l'autre), et l'écran Administration ▸ Stockage l'affiche. Une date
-- qui vieillit se voit — une sauvegarde qui s'arrête en silence est
-- LE mode de panne classique.

alter table platform_settings
  add column if not exists backup_last_at timestamptz;

comment on column platform_settings.backup_last_at is
  'Dernière sauvegarde VPS réussie (base + Storage), horodatée par scripts/backup.sh.';

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select backup_last_at from platform_settings;
