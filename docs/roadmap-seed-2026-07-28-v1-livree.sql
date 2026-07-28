-- ============================================================
-- Roadmap — les trois lots V1 passent en « livrée » (28/07/2026)
-- ============================================================
-- Suite de docs/roadmap-seed-2026-07-28.sql, même règle : ce n'est PAS
-- une migration, c'est de la donnée, à passer une fois dans le SQL
-- Editor — APRÈS avoir constaté le déploiement (règle n°1 de
-- docs/regles-de-livraison.md : « en ligne » se vérifie, ne s'annonce
-- pas).
--
-- Les lots 1 à 3 de la feuille de route V1 (maquette du 27/07) sont
-- en ligne : barre latérale sombre dérivée de la marque, tableau des
-- projets enrichi, carte des interventions Yvelines–Liban. Le lot 4
-- (identité visuelle) n'a pas d'idée propre dans la roadmap — il vit
-- dans docs/feuille-de-route-v1-tableau-de-bord.md et reste bloqué sur
-- la décision logo, qui revient à l'utilisateur.
--
-- La carte affiche ses repères depuis projects.lat / projects.lng :
-- la passe de saisie des coordonnées (Azour, Jeïta, Villepreux,
-- Jouy-en-Josas…) se fait dans l'application, bouton « Modifier » de
-- la fiche projet — pas en SQL.
--
-- Idempotent : ne touche que les idées pas encore « livrée ».

update ideas set status = 'livree', updated_at = now()
 where title in (
   'V1 — Barre latérale sombre et groupée',
   'V1 — Tableau des projets enrichi (Pilotage)',
   'V1 — Carte des interventions Yvelines-Liban'
 )
   and status <> 'livree';

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select title, status, updated_at from ideas
--    where title like 'V1 —%' order by title;
