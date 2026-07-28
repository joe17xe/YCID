-- ============================================================
-- 0049 — Favicon paramétrable
-- ============================================================
-- Constat du 27/07, en téléversant les logos : « je n'ai pas l'endroit
-- pour paramétrer le favicon ». Exact — c'était un fichier figé dans le
-- code, invisible de l'écran Marque, donc impossible à changer sans
-- redéployer. Pour une application white-label (0018), l'icône d'onglet
-- fait partie de la marque au même titre que le logo et les couleurs.
--
-- Colonne séparée de logo_url : un logo est souvent horizontal
-- (marque + texte), un favicon doit être carré et lisible à 16 pixels.
-- Forcer l'un dans l'autre donnerait une icône d'onglet illisible.
-- Repli en cascade côté application : favicon dédié → logo → fichier
-- par défaut du dépôt.

alter table platform_settings
  add column if not exists favicon_url text;

comment on column platform_settings.favicon_url is
  'Icône d''onglet (favicon), carrée. Nulle = repli sur logo_url puis sur le fichier par défaut.';

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select logo_url, favicon_url from platform_settings;
