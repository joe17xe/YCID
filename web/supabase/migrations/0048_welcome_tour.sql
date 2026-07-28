-- ============================================================
-- 0048 — Visite guidée de première connexion
-- ============================================================
-- Demande du 27/07 : « lors de la première connexion il faut faire un
-- tour d'application et montrer les choses à savoir pour un nouveau
-- venu ».
--
-- Le marqueur vit en BASE, pas dans le navigateur : un compte se
-- connecte au bureau puis au téléphone, et une visite qui se rejoue à
-- chaque appareil apprend surtout à cliquer « Passer ». Une date plutôt
-- qu'un booléen : elle dit aussi QUAND la visite a été vue, donc quelle
-- version de l'application elle décrivait.
--
-- Écriture par l'intéressé lui-même, via la policy « Own profile »
-- (0001) — même chemin que la photo de profil. Le trigger
-- protect_profile_flags ne s'y oppose pas : il ne garde que les
-- colonnes de pouvoir, et savoir si quelqu'un a vu la visite n'en est
-- pas un.

alter table profiles
  add column if not exists tour_seen_at timestamptz;

comment on column profiles.tour_seen_at is
  'Visite guidée de première connexion : vue (ou passée) à cette date. Nul = jamais montrée.';

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select count(*) filter (where tour_seen_at is null) as jamais_vue,
--          count(*)                                     as comptes
--     from profiles;
--
-- Après application, tous les comptes existants ont `jamais_vue` : les
-- utilisateurs déjà rodés verront la visite UNE fois à leur prochaine
-- connexion. C'est voulu — elle décrit un écran qui vient de changer
-- (pouls, pastilles, file « À valider »), et ils ne le connaissent pas
-- davantage qu'un nouveau.
