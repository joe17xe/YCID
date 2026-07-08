-- ============================================================
-- SOLID'PILOT — YCID — Données de démonstration CEM Liban
-- Programme CEM Liban-Yvelines (3 projets, budget 106 200 €)
-- À exécuter dans le SQL Editor Supabase APRÈS schema.sql
-- ============================================================

-- Nettoyage (au cas où on relance)
delete from indicator_measures;
delete from indicators;
delete from decisions;
delete from meetings;
delete from budget_lines;
delete from tasks;
delete from phases;
delete from project_organizations;
delete from projects;
delete from organizations;

-- Org UUIDs   : ...0001 à ...0009
-- Project UUID: ...00a1 à ...00a3
-- Phase UUID  : ...00b1 à ...00b8
-- Indic UUID  : ...00c1 à ...00c9
-- Meeting UUID: ...00d1

-- ============================================================
-- ORGANISATIONS
-- ============================================================
insert into organizations (id, name, type, country, email, status) values
('00000000-0000-0000-0000-000000000001', 'YCID', 'financeur_public', 'France', 'bayoub@yvelines.fr', 'active'),
('00000000-0000-0000-0000-000000000002', 'Libanais en Yvelines (LEY)', 'association', 'France', 'president@ley.fr', 'active'),
('00000000-0000-0000-0000-000000000003', 'Comité de Jumelage de Jouy-en-Josas', 'association', 'France', 'contact@jumelage-jouy.fr', 'active'),
('00000000-0000-0000-0000-000000000004', 'Commune de Villepreux', 'collectivite', 'France', 'c.beaucaire@villepreux.fr', 'active'),
('00000000-0000-0000-0000-000000000005', 'Commune de Jouy-en-Josas', 'collectivite', 'France', 'c.neveu@jouy-en-josas.fr', 'active'),
('00000000-0000-0000-0000-000000000006', 'Département des Yvelines (CD78)', 'collectivite', 'France', 'j.morice@yvelines.fr', 'active'),
('00000000-0000-0000-0000-000000000007', 'MEAE', 'financeur_public', 'France', 'dctciv@diplomatie.gouv.fr', 'active'),
('00000000-0000-0000-0000-000000000008', 'Municipalité d''Azour', 'partenaire_local', 'Liban', 'mairie@azour.gov.lb', 'active'),
('00000000-0000-0000-0000-000000000009', 'Municipalité de Jeïta', 'partenaire_local', 'Liban', 'mairie@jeitavillage.com', 'active');

-- ============================================================
-- PROJETS
-- ============================================================
insert into projects (id, name, description, country, zone, lat, lng, start_date, end_date, status, budget, currency, lead_org_id) values
('00000000-0000-0000-0000-0000000000a1',
 'CEM Liban — Triade Villepreux · Azour · LEY',
 'Valorisation du patrimoine naturel d''Azour (site du Shir, sentiers, camping), mobilisation des jeunes, formations de guides et trail annuel. LEY maître d''œuvre, transfert progressif à la municipalité d''Azour.',
 'Liban', 'Azour (Jezzine)', 33.53, 35.57, '2025-09-01', '2027-01-31', 'en_cours', 48650, 'EUR', '00000000-0000-0000-0000-000000000002'),
('00000000-0000-0000-0000-0000000000a2',
 'CEM Liban — Triade Jouy-en-Josas · Jeïta · Comité de Jumelage',
 'Sécurisation et signalétique des parcours vers la grotte de Jeïta, chantiers-jeunes, formations de guides et diagnostic pour un office de tourisme local. Comité de Jumelage maître d''œuvre, transfert progressif à la municipalité de Jeïta.',
 'Liban', 'Jeïta (Kesrouan)', 33.96, 35.64, '2025-09-01', '2027-10-31', 'en_cours', 28850, 'EUR', '00000000-0000-0000-0000-000000000003'),
('00000000-0000-0000-0000-0000000000a3',
 'CEM Liban — Coordination et actions communes',
 'Coordination YCID, COPIL, missions d''immersion croisées France-Liban, communication et capitalisation, sensibilisation grand public en Yvelines. Commun aux deux triades.',
 'France / Liban', 'Yvelines', 48.80, 2.13, '2025-09-01', '2027-10-31', 'en_cours', 28200, 'EUR', '00000000-0000-0000-0000-000000000001');

-- ============================================================
-- ORGANISATIONS DES PROJETS (rôles)
-- ============================================================
insert into project_organizations (project_id, org_id, role) values
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000002', 'porteur'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000004', 'partenaire'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000008', 'beneficiaire'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000007', 'financeur'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'financeur'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000006', 'financeur'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000003', 'porteur'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000005', 'partenaire'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000009', 'beneficiaire'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000007', 'financeur'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000001', 'financeur'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000001', 'porteur'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000004', 'partenaire'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000005', 'partenaire'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000002', 'partenaire'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000003', 'partenaire'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000007', 'financeur'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000006', 'financeur'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000008', 'observateur'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000009', 'observateur');

-- ============================================================
-- PHASES
-- ============================================================
insert into phases (id, project_id, name, position, start_date, end_date, status, budget) values
('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Action 1 — Aménagements et patrimoine (Azour)', 1, '2025-09-01', '2027-01-31', 'en_cours', 31100),
('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'Action 2 — Sensibilisation des jeunes', 2, '2026-01-01', '2027-10-31', 'en_cours', 4550),
('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a1', 'Action 3 — Trails et sport nature', 3, '2026-03-01', '2027-09-30', 'a_venir', 8000),
('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000a2', 'Action 1 — Aménagements et patrimoine (Jeïta)', 1, '2025-09-01', '2027-01-31', 'en_cours', 22300),
('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000a2', 'Action 2 — Sensibilisation des jeunes', 2, '2026-01-01', '2027-10-31', 'a_venir', 4550),
('00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-0000000000a2', 'Action 3 — Sensibilisation scolaire et sport', 3, '2026-03-01', '2027-09-30', 'a_venir', 1000),
('00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-0000000000a3', 'Missions et échanges de pratiques', 1, '2025-09-01', '2027-10-31', 'en_cours', 23100),
('00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-0000000000a3', 'Gouvernance, communication et reporting', 2, '2025-09-01', '2027-10-31', 'en_cours', 5100);

-- ============================================================
-- TÂCHES
-- ============================================================
insert into tasks (phase_id, title, description, start_date, end_date, status, progress, comment) values
('00000000-0000-0000-0000-0000000000b1', 'Diagnostic terrain et conception des maquettes', 'Site du Shir et sentiers d''Azour.', '2025-10-01', '2025-12-15', 'terminee', 100, 'Maquettes livrées et partagées avec la municipalité.'),
('00000000-0000-0000-0000-0000000000b1', 'Sélection et contractualisation du paysagiste', '', '2026-05-01', '2026-07-17', 'en_cours', 60, 'Devis reçu, en validation.'),
('00000000-0000-0000-0000-0000000000b1', 'Chantier jeunes — défrichage du Shir', 'Jeunes du Club Sportif encadrés par les employés municipaux.', '2026-07-15', '2026-08-15', 'a_faire', 0, ''),
('00000000-0000-0000-0000-0000000000b2', 'Programme des sessions de sensibilisation été 2026', '3 sessions à Azour, 20 jeunes locaux + 20 de Jeïta par session.', '2026-05-15', '2026-07-01', 'en_cours', 40, 'En attente des disponibilités du spéléologue.'),
('00000000-0000-0000-0000-0000000000b3', 'Préparation du trail d''Azour 2027', 'Appui du Lebanon Mountain Trail, implication du club de basket féminin.', '2026-09-01', '2027-03-31', 'a_faire', 0, ''),
('00000000-0000-0000-0000-0000000000b4', 'Convention d''encadrement des chantiers-jeunes', '', '2025-11-01', '2026-01-31', 'terminee', 100, ''),
('00000000-0000-0000-0000-0000000000b4', 'Travaux de défrichage et terrassement (Jeïta)', 'Jeunes + ouvriers municipaux, parcours vers la grotte.', '2026-04-01', '2026-09-30', 'en_cours', 45, ''),
('00000000-0000-0000-0000-0000000000b4', 'Diagnostic pour l''office de tourisme local', '', '2026-09-01', '2026-12-15', 'a_faire', 0, ''),
('00000000-0000-0000-0000-0000000000b7', 'Rapport succinct d''activités au MEAE', 'Condition du versement de la subvention.', '2026-01-05', '2026-02-28', 'terminee', 100, 'Transmis à la DCTCIV.'),
('00000000-0000-0000-0000-0000000000b7', 'Rapport intermédiaire MEAE (narratif + financier)', 'Volet narratif + justificatifs de dépenses.', '2026-07-01', '2026-09-30', 'en_cours', 20, ''),
('00000000-0000-0000-0000-0000000000b7', 'Organisation de l''immersion yvelinoise au Liban', 'Élus et agents de Villepreux, Jouy et YCID.', '2026-06-01', '2026-10-15', 'en_cours', 50, ''),
('00000000-0000-0000-0000-0000000000b8', 'Points bimensuels des triades', 'Villepreux/Azour/LEY et Jouy/Jeïta/Comité, animés par YCID.', '2025-12-01', '2027-10-31', 'en_cours', 50, '');

-- ============================================================
-- LIGNES BUDGÉTAIRES (rapport détaillé 2025-2027, 106 200 €)
-- ============================================================
insert into budget_lines (project_id, phase_id, poste, description, category, funder_org_id, owner_org_id, year, planned_amount, is_valorisation, status) values
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Diagnostic terrain et maquettes', '', 'projet', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 2025, 3000, false, 'cloturee'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Aménagement du site principal du Shir', '', 'investissement', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', 2026, 8200, false, 'active'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Équipement de sensibilisation (panneaux, tablettes)', '', 'investissement', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 2026, 3200, false, 'active'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Main d''œuvre et suivi du paysagiste', '', 'fonctionnement', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 2026, 1000, false, 'active'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Sécurisation du chemin Shir el Joub', '', 'investissement', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 2026, 1100, false, 'active'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Sentier vers la vallée du Bisri', 'Aires de repos, panneaux', 'investissement', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', 2026, 2750, false, 'active'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Site de camping El Abo - Le Cave', '', 'investissement', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', 2026, 2950, false, 'active'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'Formations de jeunes guides (Azour)', '', 'projet', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 2026, 4500, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Structuration de l''offre de randonnée', 'Cartographie, topographie', 'projet', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 2026, 2900, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Cérémonie et randonnée d''inauguration (Azour)', '', 'projet', '00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000002', 2027, 1500, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'Échanges jeunes Jeïta→Azour : animation, hébergement', '', 'projet', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 2026, 2700, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'Échanges jeunes Azour→Jeïta : transport', '', 'projet', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 2026, 900, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'Visites de terrain par un spécialiste (part Azour)', 'Spéléologue Habib Helou pressenti', 'projet', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 2026, 450, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'Rénovation de sentier par le CMJ de Villepreux', '', 'projet', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 2026, 500, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b3', 'Trail annuel à Azour', 'Organisation, logistique, communication', 'projet', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 2027, 4000, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b3', 'Trail annuel à Villepreux et Jouy-en-Josas', '', 'projet', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 2026, 2000, false, 'active'),
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b3', 'Participation d''une délégation libanaise au trail yvelinois', 'Édition octobre 2026', 'projet', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 2026, 2000, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a1', null, 'Mise à disposition — Commune de Villepreux', 'Temps de travail, ressources', 'fonctionnement', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 2026, 2000, true, 'active'),
('00000000-0000-0000-0000-0000000000a1', null, 'Mise à disposition — Libanais en Yvelines', 'Temps de travail, ressources, déplacements', 'fonctionnement', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 2026, 3000, true, 'active'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b4', 'Coordination et encadrement technique des chantiers-jeunes', '', 'fonctionnement', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', 2026, 3000, false, 'active'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b4', 'Travaux d''aménagement Jeïta (part YCID)', 'Défrichage, nettoyage, terrassement', 'investissement', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 2026, 6700, false, 'active'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b4', 'Travaux d''aménagement Jeïta (part Jouy-en-Josas)', '', 'investissement', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 2026, 2000, false, 'active'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b4', 'Travaux d''aménagement (complément)', '', 'investissement', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 2026, 100, false, 'active'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b4', 'Formations de jeunes guides (Jeïta)', '', 'projet', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', 2026, 6000, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b4', 'Cérémonie et randonnée d''inauguration (Jeïta)', '', 'projet', '00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000003', 2027, 1500, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b4', 'Diagnostic pour la création d''un office de tourisme', '', 'projet', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', 2026, 3000, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b5', 'Échanges jeunes Jeïta→Azour : transport', '', 'projet', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 2026, 900, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b5', 'Échanges jeunes Azour→Jeïta : animation, hébergement', '', 'projet', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', 2026, 2700, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b5', 'Visites de terrain par un spécialiste (part Jeïta)', '', 'projet', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', 2026, 450, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b5', 'Rénovation de sentier par le CMJ de Jouy-en-Josas', '', 'projet', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000005', 2026, 500, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b6', 'Sensibilisation scolaire en Yvelines (complément)', '', 'projet', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 2026, 1000, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a2', null, 'Mise à disposition — Comité de Jumelage', 'Temps de travail, ressources', 'fonctionnement', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 2026, 1500, true, 'active'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b7', 'Immersion des partenaires yvelinois au Liban', '', 'fonctionnement', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 2026, 8000, false, 'active'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b7', 'Immersion des partenaires libanais en France', '', 'fonctionnement', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 2026, 8000, false, 'prevue'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b7', 'Mission de suivi et accompagnement des communes (YCID)', '', 'fonctionnement', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 2026, 7100, false, 'active'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b8', 'Réunions de travail et COPIL (défraiements)', '', 'fonctionnement', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 2026, 1100, false, 'active'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b8', 'Communication (photo, vidéo, documentaire)', '', 'projet', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 2026, 3000, false, 'active'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b8', 'Actions de sensibilisation grand public en Yvelines', '', 'projet', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 2026, 1000, false, 'prevue');

-- ============================================================
-- INDICATEURS (résultats attendus MEAE)
-- ============================================================
insert into indicators (id, project_id, name, kind, unit, periodicity, source, baseline, target) values
('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Kilomètres de sentiers restaurés (Azour)', 'quantitatif', 'km', 'trimestriel', 'manuelle', 0, 7),
('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'Jeunes mobilisés sur les chantiers (Azour)', 'quantitatif', 'jeunes', 'trimestriel', 'manuelle', 0, 50),
('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1', 'Participants au trail d''Azour', 'quantitatif', 'participants', 'ponctuel', 'manuelle', 0, 250),
('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000a2', 'Jeunes mobilisés sur les chantiers (Jeïta)', 'quantitatif', 'jeunes', 'trimestriel', 'manuelle', 0, 50),
('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000a2', 'Jeunes formés guides (Jeïta)', 'quantitatif', 'jeunes', 'trimestriel', 'manuelle', 0, 30),
('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000a3', 'Jeunes sensibilisés lors des sessions croisées', 'quantitatif', 'jeunes', 'trimestriel', 'manuelle', 0, 240),
('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000a3', 'COPIL tenus', 'quantitatif', 'COPIL', 'trimestriel', 'manuelle', 0, 4),
('00000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-0000000000a3', 'Missions de terrain réalisées', 'quantitatif', 'missions', 'trimestriel', 'manuelle', 0, 4),
('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000a3', 'Qualité de la coopération entre triades', 'qualitatif', 'score /5', 'annuel', 'manuelle', 2, 4);

-- ============================================================
-- MESURES D'INDICATEURS
-- ============================================================
insert into indicator_measures (indicator_id, period, value, comment) values
('00000000-0000-0000-0000-0000000000c1', '2026-T2', 1.5, 'Premier tronçon du Shir défriché'),
('00000000-0000-0000-0000-0000000000c2', '2026-T2', 12, 'Jeunes du Club Sportif d''Azour'),
('00000000-0000-0000-0000-0000000000c4', '2026-T2', 18, ''),
('00000000-0000-0000-0000-0000000000c7', '2025-T4', 1, 'COPIL de lancement du 26/11/2025'),
('00000000-0000-0000-0000-0000000000c8', '2026-T2', 1, 'Première mission projet réalisée'),
('00000000-0000-0000-0000-0000000000c9', '2026', 3, 'Gouvernance RACI appropriée, points bimensuels réguliers');

-- ============================================================
-- RÉUNIONS COPIL
-- ============================================================
insert into meetings (id, project_id, title, kind, date, minutes) values
('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a3', 'COPIL de lancement', 'copil', '2025-11-26', 'Matrice RACI adoptée. Validation du plan de travail des deux triades et du calendrier des immersions croisées.');

-- ============================================================
-- DÉCISIONS
-- ============================================================
insert into decisions (project_id, meeting_id, text, due_date, status) values
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000d1', 'Nommer un référent par triade avant fin janvier 2026', '2026-01-31', 'fait'),
('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000d1', 'Planifier la première mission d''immersion au Liban', '2026-10-15', 'en_cours');
