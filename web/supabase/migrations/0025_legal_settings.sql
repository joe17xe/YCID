-- ============================================================
-- MIGRATION 0025 — Mentions légales administrables (RGPD)
-- ============================================================
-- Rapport de test du 25/07/2026, point 21 : les pages légales
-- contenaient encore « [adresse à compléter] » et « [email de contact à
-- compléter] » EN PRODUCTION. Plutôt que de figer ces valeurs dans le
-- code, elles deviennent paramétrables par un administrateur.
--
-- Ces informations sont PUBLIQUES par nature (mentions légales) : elles
-- rejoignent donc platform_settings, dont la lecture est publique et
-- l'écriture réservée aux administrateurs.

alter table platform_settings add column if not exists legal_entity text
  not null default 'YCID — Yvelines Coopération Internationale et Développement';
alter table platform_settings add column if not exists legal_address text;
alter table platform_settings add column if not exists legal_publisher text;
alter table platform_settings add column if not exists legal_email text;
alter table platform_settings add column if not exists legal_retention text;
