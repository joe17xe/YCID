-- ============================================================
-- MIGRATION 0054 — Le lien visio d'une réunion
-- ============================================================
-- Demande du 28/07 au soir : « il faudra aussi pouvoir joindre le
-- lien pour la réunion Teams ou Google Meet ». Une colonne dédiée,
-- séparée du lieu : une réunion peut avoir les deux — « Mairie de
-- Villepreux » ET un lien pour ceux qui suivent à distance, le cas
-- normal d'une coopération Yvelines–Liban.
--
-- Arbitrage « réunion instantanée » : PAS d'intégration native Meet ou
-- Teams — elle exigerait un compte Google/Microsoft relié par
-- organisateur (OAuth, consentements, quotas) pour gagner dix
-- secondes, car meet.new crée déjà une réunion instantanée dont on
-- colle le lien. L'application STOCKE le lien et le met sous le bon
-- pouce (fiche + email d'invitation) ; elle ne crée pas la visio.

alter table meetings add column if not exists video_url text;

comment on column meetings.video_url is
  'Lien de visioconférence (Teams, Meet…), collé par l''organisateur — jamais généré par l''application.';

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select title, video_url from meetings order by date desc;
