"use client";
import React, { useState, useMemo, useEffect } from "react";
import { supabase, DEMO } from "../lib/supabaseClient";
import { usePersistedList, useProfiles } from "../lib/data";
import Papa from "papaparse";
import {
  LayoutDashboard, FolderKanban, Building2, Upload, Search, LogOut, Download, Bell,
  Plus, ChevronDown, ChevronRight, ChevronLeft, FileText, Camera, Receipt, Package,
  ClipboardList, AlertTriangle, X, Check, Wallet, ShieldCheck, ThumbsDown, Users, Eye, Lock,
  FileSignature, StickyNote, BadgeCheck, Send, History, PieChart, CalendarClock, HelpCircle, BookOpen
} from "lucide-react";

/* ============================================================
   DESIGN TOKENS
   ============================================================ */
const C = {
  bg: "#F5F6F4", surface: "#FFFFFF", ink: "#17211D", muted: "#66716B",
  border: "#E3E6E2", accent: "#0E6B5C", accentSoft: "#E4F0EC",
  warn: "#B4690E", warnSoft: "#F7EDDD", danger: "#A3342C", dangerSoft: "#F6E7E5",
  blue: "#3B5488", blueSoft: "#E8ECF5", purple: "#6B4A8C", purpleSoft: "#F0E9F5",
};
const FONT_HEAD = "'Sora', sans-serif";
const FONT_BODY = "'Inter', sans-serif";

const ORG_TYPES = {
  association: "Association", collectivite: "Collectivité",
  partenaire_local: "Partenaire local", partenaire_medical: "Partenaire médical",
  financeur: "Financeur", financeur_public: "Financeur public", mecene: "Mécène", autre: "Autre",
};
const PROJECT_ROLES = {
  porteur: { label: "Porteur", bg: "#E4F0EC", fg: "#0E6B5C" },
  partenaire: { label: "Partenaire", bg: "#E8ECF5", fg: "#3B5488" },
  financeur: { label: "Financeur", bg: "#F0E9F5", fg: "#6B4A8C" },
  beneficiaire: { label: "Bénéficiaire", bg: "#FBEFE6", fg: "#B4690E" },
  observateur: { label: "Observateur", bg: "#EEF0EE", fg: "#66716B" },
  partenaire_terrain: { label: "Partenaire terrain", bg: "#F5EFE2", fg: "#8A6A1F" },
  partenaire_medical: { label: "Partenaire médical", bg: "#E7F1F4", fg: "#2C6B7E" },
};
const ACCESS_ROLES = {
  chef_projet: { label: "Chef de projet · Comité", short: "Comité", fg: "#0E6B5C", bg: "#E4F0EC" },
  resp_financier: { label: "Responsable financier", short: "Finances", fg: "#3B5488", bg: "#E8ECF5" },
  contributeur: { label: "Contributeur · Terrain", short: "Terrain", fg: "#8A6A1F", bg: "#F5EFE2" },
  validateur: { label: "Validateur / Financeur", short: "Validateur", fg: "#6B4A8C", bg: "#F0E9F5" },
  auditeur: { label: "Auditeur", short: "Auditeur", fg: "#2C6B7E", bg: "#E7F1F4" },
  lecteur: { label: "Lecteur", short: "Lecteur", fg: "#66716B", bg: "#EEF0EE" },
};
const PROJECT_STATUS = {
  en_preparation: { label: "En préparation", fg: "#66716B", bg: "#EEF0EE" },
  en_cours: { label: "En cours", fg: "#0E6B5C", bg: "#E4F0EC" },
  suspendu: { label: "Suspendu", fg: "#B4690E", bg: "#F7EDDD" },
  termine: { label: "Terminé", fg: "#3B5488", bg: "#E8ECF5" },
};
const TASK_STATUS = {
  a_faire: { label: "À faire", fg: "#66716B", bg: "#EEF0EE" },
  en_cours: { label: "En cours", fg: "#0E6B5C", bg: "#E4F0EC" },
  terminee: { label: "Terminée", fg: "#3B5488", bg: "#E8ECF5" },
  bloquee: { label: "Bloquée", fg: "#A3342C", bg: "#F6E7E5" },
};
const DOC_TYPES = {
  devis: { label: "Devis", Icon: ClipboardList, hasAmount: true },
  facture: { label: "Facture", Icon: Receipt, hasAmount: true, payable: true },
  recu: { label: "Reçu", Icon: BadgeCheck, hasAmount: true },
  justificatif: { label: "Justificatif", Icon: FileText, hasAmount: false },
  convention: { label: "Convention", Icon: FileSignature, hasAmount: false },
  note: { label: "Note", Icon: StickyNote, hasAmount: false },
  etude: { label: "Étude", Icon: Search, hasAmount: false },
  photo: { label: "Photo", Icon: Camera, hasAmount: false },
  livrable: { label: "Livrable", Icon: Package, hasAmount: false },
  rapport: { label: "Rapport", Icon: FileText, hasAmount: false },
};
/* PHASE 3 : états de revue unifiés */
const REVIEW_STATES = {
  brouillon: { label: "Brouillon", fg: "#66716B", bg: "#EEF0EE" },
  soumis: { label: "Soumis", fg: "#B4690E", bg: "#F7EDDD" },
  en_revue: { label: "En revue", fg: "#3B5488", bg: "#E8ECF5" },
  valide: { label: "Validé", fg: "#0E6B5C", bg: "#E4F0EC" },
  rejete: { label: "Rejeté", fg: "#A3342C", bg: "#F6E7E5" },
};
const DEVIS_STATE = {
  en_attente: { label: "En attente", fg: C.warn, bg: C.warnSoft },
  valide: { label: "Validé", fg: C.accent, bg: C.accentSoft },
  refuse: { label: "Refusé", fg: C.danger, bg: C.dangerSoft },
};
const VALIDATOR_ROLES = ["porteur", "financeur", "partenaire", "partenaire_medical"];
const LINE_CATEGORIES = {
  investissement: { label: "Investissement", fg: "#3B5488", bg: "#E8ECF5" },
  fonctionnement: { label: "Fonctionnement", fg: "#8A6A1F", bg: "#F5EFE2" },
  projet: { label: "Projet", fg: "#0E6B5C", bg: "#E4F0EC" },
  autre: { label: "Autre", fg: "#66716B", bg: "#EEF0EE" },
};
const LINE_STATUS = {
  prevue: { label: "Prévue", fg: "#66716B", bg: "#EEF0EE" },
  active: { label: "Active", fg: "#0E6B5C", bg: "#E4F0EC" },
  cloturee: { label: "Clôturée", fg: "#3B5488", bg: "#E8ECF5" },
};
/* PHASE 4 : indicateurs, réunions, décisions */
const PERIODICITY = { mensuel: "Mensuel", trimestriel: "Trimestriel", annuel: "Annuel", ponctuel: "Ponctuel" };
const IND_KINDS = {
  quantitatif: { label: "Quantitatif", fg: "#3B5488", bg: "#E8ECF5" },
  qualitatif: { label: "Qualitatif", fg: "#6B4A8C", bg: "#F0E9F5" },
};
const IND_SOURCES = { manuelle: "Saisie manuelle", taches: "Tâches terminées (auto)", import: "Import CSV", document: "Justificatif" };
const MEETING_KINDS = {
  copil: { label: "COPIL", fg: "#0E6B5C", bg: "#E4F0EC" },
  technique: { label: "Comité technique", fg: "#3B5488", bg: "#E8ECF5" },
  terrain: { label: "Réunion terrain", fg: "#8A6A1F", bg: "#F5EFE2" },
};
const DECISION_STATUS = {
  a_faire: { label: "À faire", fg: "#66716B", bg: "#EEF0EE" },
  en_cours: { label: "En cours", fg: "#B4690E", bg: "#F7EDDD" },
  fait: { label: "Fait", fg: "#0E6B5C", bg: "#E4F0EC" },
};

/* ============================================================
   DONNÉES DE DÉMONSTRATION
   ============================================================ */
const seedUsers = [
  { id: "u1", name: "Bérengère Ayoub", email: "bayoub@yvelines.fr", orgId: "o1", isOrgAdmin: true },
  { id: "u2", name: "Président LEY (à nommer)", email: "president@ley.fr", orgId: "o2", isOrgAdmin: true },
  { id: "u3", name: "Clara Beaucaire", email: "c.beaucaire@villepreux.fr", orgId: "o4", isOrgAdmin: false },
  { id: "u4", name: "Céline Neveu", email: "c.neveu@jouy-en-josas.fr", orgId: "o5", isOrgAdmin: false },
  { id: "u5", name: "Nour Azoury", email: "nourazoury@gmail.com", orgId: "o8", isOrgAdmin: false },
  { id: "u6", name: "Mirna Seaibi", email: "mirna.seaibi@jeitavillage.com", orgId: "o9", isOrgAdmin: false },
  { id: "u7", name: "Maria (experte locale)", email: "maria@cem-liban.org", orgId: "o8", isOrgAdmin: false },
  { id: "u8", name: "Jordan Morice", email: "j.morice@yvelines.fr", orgId: "o6", isOrgAdmin: false },
  { id: "u9", name: "Référent Comité de Jumelage (à nommer)", email: "contact@jumelage-jouy.fr", orgId: "o3", isOrgAdmin: false },
];
const seedOrgs = [
  { id: "o1", name: "YCID", type: "financeur_public", country: "France", email: "bayoub@yvelines.fr", status: "active" },
  { id: "o2", name: "Libanais en Yvelines (LEY)", type: "association", country: "France", email: "president@ley.fr", status: "active" },
  { id: "o3", name: "Comité de Jumelage de Jouy-en-Josas", type: "association", country: "France", email: "contact@jumelage-jouy.fr", status: "active" },
  { id: "o4", name: "Commune de Villepreux", type: "collectivite", country: "France", email: "c.beaucaire@villepreux.fr", status: "active" },
  { id: "o5", name: "Commune de Jouy-en-Josas", type: "collectivite", country: "France", email: "c.neveu@jouy-en-josas.fr", status: "active" },
  { id: "o6", name: "Département des Yvelines (CD78)", type: "collectivite", country: "France", email: "j.morice@yvelines.fr", status: "active" },
  { id: "o7", name: "MEAE", type: "financeur_public", country: "France", email: "dctciv@diplomatie.gouv.fr", status: "active" },
  { id: "o8", name: "Municipalité d'Azour", type: "partenaire_local", country: "Liban", email: "mairie@azour.gov.lb", status: "active" },
  { id: "o9", name: "Municipalité de Jeïta", type: "partenaire_local", country: "Liban", email: "mairie@jeitavillage.com", status: "active" },
];
const seedProjects = [
  {
    id: "p1", name: "CEM Liban — Triade Villepreux · Azour · LEY",
    description: "Valorisation du patrimoine naturel d'Azour (site du Shir, sentiers, camping), mobilisation des jeunes, formations de guides et trail annuel. LEY maître d'œuvre, transfert progressif à la municipalité d'Azour.",
    country: "Liban", zone: "Azour (Jezzine)", lat: 33.53, lng: 35.57, start: "2025-09-01", end: "2027-01-31",
    status: "en_cours", leadOrgId: "o2", budget: 48650, currency: "EUR",
    orgs: [
      { orgId: "o2", role: "porteur" }, { orgId: "o4", role: "partenaire" },
      { orgId: "o8", role: "beneficiaire" }, { orgId: "o7", role: "financeur" },
      { orgId: "o1", role: "financeur" }, { orgId: "o6", role: "financeur" },
    ],
    validationRoles: ["porteur"],
  },
  {
    id: "p2", name: "CEM Liban — Triade Jouy-en-Josas · Jeïta · Comité de Jumelage",
    description: "Sécurisation et signalétique des parcours vers la grotte de Jeïta, chantiers-jeunes, formations de guides et diagnostic pour un office de tourisme local. Comité de Jumelage maître d'œuvre, transfert progressif à la municipalité de Jeïta.",
    country: "Liban", zone: "Jeïta (Kesrouan)", lat: 33.96, lng: 35.64, start: "2025-09-01", end: "2027-10-31",
    status: "en_cours", leadOrgId: "o3", budget: 28850, currency: "EUR",
    orgs: [
      { orgId: "o3", role: "porteur" }, { orgId: "o5", role: "partenaire" },
      { orgId: "o9", role: "beneficiaire" }, { orgId: "o7", role: "financeur" },
      { orgId: "o1", role: "financeur" },
    ],
    validationRoles: ["porteur"],
  },
  {
    id: "p3", name: "CEM Liban — Coordination et actions communes",
    description: "Coordination YCID, COPIL, missions d'immersion croisées France-Liban, communication et capitalisation, sensibilisation grand public en Yvelines. Commun aux deux triades.",
    country: "France / Liban", zone: "Yvelines", lat: 48.80, lng: 2.13, start: "2025-09-01", end: "2027-10-31",
    status: "en_cours", leadOrgId: "o1", budget: 28200, currency: "EUR",
    orgs: [
      { orgId: "o1", role: "porteur" }, { orgId: "o4", role: "partenaire" },
      { orgId: "o5", role: "partenaire" }, { orgId: "o2", role: "partenaire" },
      { orgId: "o3", role: "partenaire" }, { orgId: "o7", role: "financeur" },
      { orgId: "o6", role: "financeur" }, { orgId: "o8", role: "observateur" },
      { orgId: "o9", role: "observateur" },
    ],
    validationRoles: ["porteur"],
  },
];
const seedMembers = [
  { projectId: "p1", userId: "u3", role: "chef_projet" },
  { projectId: "p1", userId: "u2", role: "resp_financier" },
  { projectId: "p1", userId: "u7", role: "contributeur" },
  { projectId: "p1", userId: "u5", role: "contributeur" },
  { projectId: "p1", userId: "u1", role: "validateur" },
  { projectId: "p1", userId: "u8", role: "lecteur" },
  { projectId: "p2", userId: "u4", role: "chef_projet" },
  { projectId: "p2", userId: "u9", role: "resp_financier" },
  { projectId: "p2", userId: "u6", role: "contributeur" },
  { projectId: "p2", userId: "u1", role: "validateur" },
  { projectId: "p2", userId: "u8", role: "lecteur" },
  { projectId: "p3", userId: "u1", role: "chef_projet" },
  { projectId: "p3", userId: "u3", role: "contributeur" },
  { projectId: "p3", userId: "u4", role: "contributeur" },
  { projectId: "p3", userId: "u2", role: "contributeur" },
  { projectId: "p3", userId: "u9", role: "contributeur" },
  { projectId: "p3", userId: "u8", role: "validateur" },
];
const seedPhases = [
  { id: "ph1", projectId: "p1", name: "Action 1 — Aménagements et patrimoine (Azour)", budget: 31100, start: "2025-09-01", end: "2027-01-31", status: "en_cours" },
  { id: "ph2", projectId: "p1", name: "Action 2 — Sensibilisation des jeunes", budget: 4550, start: "2026-01-01", end: "2027-10-31", status: "en_cours" },
  { id: "ph3", projectId: "p1", name: "Action 3 — Trails et sport nature", budget: 8000, start: "2026-03-01", end: "2027-09-30", status: "a_venir" },
  { id: "ph4", projectId: "p2", name: "Action 1 — Aménagements et patrimoine (Jeïta)", budget: 22300, start: "2025-09-01", end: "2027-01-31", status: "en_cours" },
  { id: "ph5", projectId: "p2", name: "Action 2 — Sensibilisation des jeunes", budget: 4550, start: "2026-01-01", end: "2027-10-31", status: "a_venir" },
  { id: "ph6", projectId: "p2", name: "Action 3 — Sensibilisation scolaire et sport", budget: 1000, start: "2026-03-01", end: "2027-09-30", status: "a_venir" },
  { id: "ph7", projectId: "p3", name: "Missions et échanges de pratiques", budget: 23100, start: "2025-09-01", end: "2027-10-31", status: "en_cours" },
  { id: "ph8", projectId: "p3", name: "Gouvernance, communication et reporting", budget: 5100, start: "2025-09-01", end: "2027-10-31", status: "en_cours" },
];
const seedTasks = [
  { id: "t1", phaseId: "ph1", title: "Diagnostic terrain et conception des maquettes", description: "Site du Shir et sentiers d'Azour.", assigneeId: "u7", start: "2025-10-01", end: "2025-12-15", status: "terminee", progress: 100, comment: "Maquettes livrées et partagées avec la municipalité.", createdBy: "u2", review: "valide" },
  { id: "t2", phaseId: "ph1", title: "Sélection et contractualisation du paysagiste", description: "", assigneeId: "u2", start: "2026-05-01", end: "2026-07-17", status: "en_cours", progress: 60, comment: "Devis reçu, en validation.", createdBy: "u2", review: "soumis" },
  { id: "t3", phaseId: "ph1", title: "Chantier jeunes — défrichage du Shir", description: "Jeunes du Club Sportif encadrés par les employés municipaux.", assigneeId: "u7", start: "2026-07-15", end: "2026-08-15", status: "a_faire", progress: 0, comment: "", createdBy: "u3", review: "brouillon" },
  { id: "t4", phaseId: "ph2", title: "Programme des sessions de sensibilisation été 2026", description: "3 sessions à Azour, 20 jeunes locaux + 20 de Jeïta par session.", assigneeId: "u5", start: "2026-05-15", end: "2026-07-01", status: "en_cours", progress: 40, comment: "En attente des disponibilités du spéléologue.", createdBy: "u3", review: "brouillon" },
  { id: "t5", phaseId: "ph3", title: "Préparation du trail d'Azour 2027", description: "Appui du Lebanon Mountain Trail, implication du club de basket féminin.", assigneeId: "u5", start: "2026-09-01", end: "2027-03-31", status: "a_faire", progress: 0, comment: "", createdBy: "u3", review: "brouillon" },
  { id: "t6", phaseId: "ph4", title: "Convention d'encadrement des chantiers-jeunes", description: "", assigneeId: "u9", start: "2025-11-01", end: "2026-01-31", status: "terminee", progress: 100, comment: "", createdBy: "u4", review: "valide" },
  { id: "t7", phaseId: "ph4", title: "Travaux de défrichage et terrassement (Jeïta)", description: "Jeunes + ouvriers municipaux, parcours vers la grotte.", assigneeId: "u6", start: "2026-04-01", end: "2026-09-30", status: "en_cours", progress: 45, comment: "", createdBy: "u4", review: "soumis" },
  { id: "t8", phaseId: "ph4", title: "Diagnostic pour l'office de tourisme local", description: "", assigneeId: "u6", start: "2026-09-01", end: "2026-12-15", status: "a_faire", progress: 0, comment: "", createdBy: "u4", review: "brouillon" },
  { id: "t9", phaseId: "ph7", title: "Rapport succinct d'activités au MEAE", description: "Condition du versement de la subvention.", assigneeId: "u1", start: "2026-01-05", end: "2026-02-28", status: "terminee", progress: 100, comment: "Transmis à la DCTCIV.", createdBy: "u1", review: "valide" },
  { id: "t10", phaseId: "ph7", title: "Rapport intermédiaire MEAE (narratif + financier)", description: "Volet narratif + justificatifs de dépenses.", assigneeId: "u1", start: "2026-07-01", end: "2026-09-30", status: "en_cours", progress: 20, comment: "", createdBy: "u1", review: "brouillon" },
  { id: "t11", phaseId: "ph7", title: "Organisation de l'immersion yvelinoise au Liban", description: "Élus et agents de Villepreux, Jouy et YCID.", assigneeId: "u1", start: "2026-06-01", end: "2026-10-15", status: "en_cours", progress: 50, comment: "", createdBy: "u1", review: "brouillon" },
  { id: "t12", phaseId: "ph8", title: "Points bimensuels des triades", description: "Villepreux/Azour/LEY et Jouy/Jeïta/Comité, animés par YCID.", assigneeId: "u1", start: "2025-12-01", end: "2027-10-31", status: "en_cours", progress: 50, comment: "", createdBy: "u1", review: "brouillon" },
];
/* Lignes budgétaires réelles — rapport détaillé 2025-2027 (106 200 € au total) */
const seedBudgetLines = [
  { id: "l1", projectId: "p1", phaseId: "ph1", poste: "Diagnostic terrain et maquettes", description: "", category: "projet", funderOrgId: "o2", ownerOrgId: "o2", year: 2025, planned: 3000, valorisation: false, status: "cloturee", comment: "", review: "valide" },
  { id: "l2", projectId: "p1", phaseId: "ph1", poste: "Aménagement du site principal du Shir", description: "", category: "investissement", funderOrgId: "o6", ownerOrgId: "o2", year: 2026, planned: 8200, valorisation: false, status: "active", comment: "", review: "valide" },
  { id: "l3", projectId: "p1", phaseId: "ph1", poste: "Équipement de sensibilisation (panneaux, tablettes)", description: "", category: "investissement", funderOrgId: "o1", ownerOrgId: "o2", year: 2026, planned: 3200, valorisation: false, status: "active", comment: "", review: "valide" },
  { id: "l4", projectId: "p1", phaseId: "ph1", poste: "Main d'œuvre et suivi du paysagiste", description: "", category: "fonctionnement", funderOrgId: "o7", ownerOrgId: "o2", year: 2026, planned: 1000, valorisation: false, status: "active", comment: "", review: "valide" },
  { id: "l5", projectId: "p1", phaseId: "ph1", poste: "Sécurisation du chemin Shir el Joub", description: "", category: "investissement", funderOrgId: "o4", ownerOrgId: "o2", year: 2026, planned: 1100, valorisation: false, status: "active", comment: "", review: "valide" },
  { id: "l6", projectId: "p1", phaseId: "ph1", poste: "Sentier vers la vallée du Bisri", description: "Aires de repos, panneaux", category: "investissement", funderOrgId: "o6", ownerOrgId: "o2", year: 2026, planned: 2750, valorisation: false, status: "active", comment: "", review: "soumis" },
  { id: "l7", projectId: "p1", phaseId: "ph1", poste: "Site de camping El Abo - Le Cave", description: "", category: "investissement", funderOrgId: "o6", ownerOrgId: "o2", year: 2026, planned: 2950, valorisation: false, status: "active", comment: "", review: "soumis" },
  { id: "l8", projectId: "p1", phaseId: "ph2", poste: "Formations de jeunes guides (Azour)", description: "", category: "projet", funderOrgId: "o7", ownerOrgId: "o2", year: 2026, planned: 4500, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l9", projectId: "p1", phaseId: "ph1", poste: "Structuration de l'offre de randonnée", description: "Cartographie, topographie", category: "projet", funderOrgId: "o7", ownerOrgId: "o2", year: 2026, planned: 2900, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l10", projectId: "p1", phaseId: "ph1", poste: "Cérémonie et randonnée d'inauguration (Azour)", description: "", category: "projet", funderOrgId: "o8", ownerOrgId: "o2", year: 2027, planned: 1500, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l11", projectId: "p1", phaseId: "ph2", poste: "Échanges jeunes Jeïta→Azour : animation, hébergement", description: "", category: "projet", funderOrgId: "o7", ownerOrgId: "o2", year: 2026, planned: 2700, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l12", projectId: "p1", phaseId: "ph2", poste: "Échanges jeunes Azour→Jeïta : transport", description: "", category: "projet", funderOrgId: "o4", ownerOrgId: "o2", year: 2026, planned: 900, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l13", projectId: "p1", phaseId: "ph2", poste: "Visites de terrain par un spécialiste (part Azour)", description: "Spéléologue Habib Helou pressenti", category: "projet", funderOrgId: "o7", ownerOrgId: "o2", year: 2026, planned: 450, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l14", projectId: "p1", phaseId: "ph2", poste: "Rénovation de sentier par le CMJ de Villepreux", description: "", category: "projet", funderOrgId: "o4", ownerOrgId: "o4", year: 2026, planned: 500, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l15", projectId: "p1", phaseId: "ph3", poste: "Trail annuel à Azour", description: "Organisation, logistique, communication", category: "projet", funderOrgId: "o7", ownerOrgId: "o2", year: 2027, planned: 4000, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l16", projectId: "p1", phaseId: "ph3", poste: "Trail annuel à Villepreux et Jouy-en-Josas", description: "", category: "projet", funderOrgId: "o4", ownerOrgId: "o4", year: 2026, planned: 2000, valorisation: false, status: "active", comment: "", review: "valide" },
  { id: "l17", projectId: "p1", phaseId: "ph3", poste: "Participation d'une délégation libanaise au trail yvelinois", description: "Édition octobre 2026", category: "projet", funderOrgId: "o4", ownerOrgId: "o4", year: 2026, planned: 2000, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l18", projectId: "p1", phaseId: null, poste: "Mise à disposition — Commune de Villepreux", description: "Temps de travail, ressources", category: "fonctionnement", funderOrgId: "o4", ownerOrgId: "o4", year: 2026, planned: 2000, valorisation: true, status: "active", comment: "", review: "valide" },
  { id: "l19", projectId: "p1", phaseId: null, poste: "Mise à disposition — Libanais en Yvelines", description: "Temps de travail, ressources, déplacements", category: "fonctionnement", funderOrgId: "o2", ownerOrgId: "o2", year: 2026, planned: 3000, valorisation: true, status: "active", comment: "", review: "valide" },
  { id: "l20", projectId: "p2", phaseId: "ph4", poste: "Coordination et encadrement technique des chantiers-jeunes", description: "", category: "fonctionnement", funderOrgId: "o7", ownerOrgId: "o3", year: 2026, planned: 3000, valorisation: false, status: "active", comment: "", review: "valide" },
  { id: "l21", projectId: "p2", phaseId: "ph4", poste: "Travaux d'aménagement Jeïta (part YCID)", description: "Défrichage, nettoyage, terrassement", category: "investissement", funderOrgId: "o1", ownerOrgId: "o3", year: 2026, planned: 6700, valorisation: false, status: "active", comment: "Cofinancement : ligne scindée YCID / Jouy", review: "valide" },
  { id: "l22", projectId: "p2", phaseId: "ph4", poste: "Travaux d'aménagement Jeïta (part Jouy-en-Josas)", description: "", category: "investissement", funderOrgId: "o5", ownerOrgId: "o3", year: 2026, planned: 2000, valorisation: false, status: "active", comment: "", review: "valide" },
  { id: "l23", projectId: "p2", phaseId: "ph4", poste: "Travaux d'aménagement (complément)", description: "", category: "investissement", funderOrgId: "o3", ownerOrgId: "o3", year: 2026, planned: 100, valorisation: false, status: "active", comment: "", review: "valide" },
  { id: "l24", projectId: "p2", phaseId: "ph4", poste: "Formations de jeunes guides (Jeïta)", description: "", category: "projet", funderOrgId: "o7", ownerOrgId: "o3", year: 2026, planned: 6000, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l25", projectId: "p2", phaseId: "ph4", poste: "Cérémonie et randonnée d'inauguration (Jeïta)", description: "", category: "projet", funderOrgId: "o9", ownerOrgId: "o3", year: 2027, planned: 1500, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l26", projectId: "p2", phaseId: "ph4", poste: "Diagnostic pour la création d'un office de tourisme", description: "", category: "projet", funderOrgId: "o7", ownerOrgId: "o3", year: 2026, planned: 3000, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l27", projectId: "p2", phaseId: "ph5", poste: "Échanges jeunes Jeïta→Azour : transport", description: "", category: "projet", funderOrgId: "o3", ownerOrgId: "o3", year: 2026, planned: 900, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l28", projectId: "p2", phaseId: "ph5", poste: "Échanges jeunes Azour→Jeïta : animation, hébergement", description: "", category: "projet", funderOrgId: "o7", ownerOrgId: "o3", year: 2026, planned: 2700, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l29", projectId: "p2", phaseId: "ph5", poste: "Visites de terrain par un spécialiste (part Jeïta)", description: "", category: "projet", funderOrgId: "o7", ownerOrgId: "o3", year: 2026, planned: 450, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l30", projectId: "p2", phaseId: "ph5", poste: "Rénovation de sentier par le CMJ de Jouy-en-Josas", description: "", category: "projet", funderOrgId: "o7", ownerOrgId: "o5", year: 2026, planned: 500, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l31", projectId: "p2", phaseId: "ph6", poste: "Sensibilisation scolaire en Yvelines (complément)", description: "", category: "projet", funderOrgId: "o5", ownerOrgId: "o3", year: 2026, planned: 1000, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l32", projectId: "p2", phaseId: null, poste: "Mise à disposition — Comité de Jumelage", description: "Temps de travail, ressources", category: "fonctionnement", funderOrgId: "o3", ownerOrgId: "o3", year: 2026, planned: 1500, valorisation: true, status: "active", comment: "", review: "valide" },
  { id: "l33", projectId: "p3", phaseId: "ph7", poste: "Immersion des partenaires yvelinois au Liban", description: "", category: "fonctionnement", funderOrgId: "o7", ownerOrgId: "o1", year: 2026, planned: 8000, valorisation: false, status: "active", comment: "", review: "valide" },
  { id: "l34", projectId: "p3", phaseId: "ph7", poste: "Immersion des partenaires libanais en France", description: "", category: "fonctionnement", funderOrgId: "o7", ownerOrgId: "o1", year: 2026, planned: 8000, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
  { id: "l35", projectId: "p3", phaseId: "ph7", poste: "Mission de suivi et accompagnement des communes (YCID)", description: "", category: "fonctionnement", funderOrgId: "o1", ownerOrgId: "o1", year: 2026, planned: 7100, valorisation: false, status: "active", comment: "", review: "valide" },
  { id: "l36", projectId: "p3", phaseId: "ph8", poste: "Réunions de travail et COPIL (défraiements)", description: "", category: "fonctionnement", funderOrgId: "o6", ownerOrgId: "o1", year: 2026, planned: 1100, valorisation: false, status: "active", comment: "", review: "valide" },
  { id: "l37", projectId: "p3", phaseId: "ph8", poste: "Communication (photo, vidéo, documentaire)", description: "", category: "projet", funderOrgId: "o7", ownerOrgId: "o1", year: 2026, planned: 3000, valorisation: false, status: "active", comment: "", review: "soumis" },
  { id: "l38", projectId: "p3", phaseId: "ph8", poste: "Actions de sensibilisation grand public en Yvelines", description: "", category: "projet", funderOrgId: "o7", ownerOrgId: "o1", year: 2026, planned: 1000, valorisation: false, status: "prevue", comment: "", review: "brouillon" },
];
const seedDocs = [
  { id: "d1", taskId: "t2", lineId: "l2", type: "devis", filename: "devis-paysagiste-shir.pdf", amount: 7900, by: "u2", date: "2026-06-20" },
  { id: "d2", taskId: "t7", lineId: "l21", type: "devis", filename: "devis-signaletique-jeita.pdf", amount: 2400, by: "u6", date: "2026-06-28" },
  { id: "d3", taskId: "t1", lineId: "l1", type: "facture", filename: "facture-diagnostic-maquettes.pdf", amount: 3000, paid: true, by: "u2", date: "2026-01-15", review: "valide" },
  { id: "d4", taskId: null, lineId: "l33", type: "convention", filename: "convention-partenariat-2025.pdf", amount: null, by: "u1", date: "2025-12-19", review: "valide" },
  { id: "d5", taskId: null, lineId: "l36", type: "rapport", filename: "cr-copil-lancement-2025-11-26.pdf", amount: null, by: "u1", date: "2025-12-02", review: "valide" },
  { id: "d6", taskId: "t1", lineId: null, type: "livrable", filename: "maquettes-amenagement-shir.pdf", amount: null, by: "u7", date: "2025-12-15", review: "valide" },
  { id: "d7", taskId: "t9", lineId: null, type: "livrable", filename: "rapport-succinct-meae-2026.pdf", amount: null, by: "u1", date: "2026-02-25", review: "valide" },
];
const seedValidations = [
  { id: "v1", docId: "d1", orgId: "o2", role: "porteur", decision: "en_attente", date: "", comment: "" },
  { id: "v2", docId: "d2", orgId: "o3", role: "porteur", decision: "valide", date: "2026-07-02", comment: "" },
];
const seedAudit = [
  { id: "a1", projectId: "p3", entity: "reunion", entityId: "mt1", label: "COPIL de lancement", action: "cree", by: "u1", at: "2025-11-26 18:05", comment: "Matrice RACI adoptée" },
  { id: "a2", projectId: "p1", entity: "document", entityId: "d6", label: "Livrable maquettes-amenagement-shir.pdf", action: "valide", by: "u1", at: "2026-01-08 11:20", comment: "" },
  { id: "a3", projectId: "p3", entity: "tache", entityId: "t9", label: "Tâche Rapport succinct MEAE", action: "valide", by: "u8", at: "2026-03-05 09:40", comment: "Condition du versement remplie" },
  { id: "a4", projectId: "p1", entity: "document", entityId: "d1", label: "Devis devis-paysagiste-shir.pdf", action: "soumis", by: "u2", at: "2026-06-20 16:12", comment: "" },
  { id: "a5", projectId: "p2", entity: "document", entityId: "d2", label: "Devis devis-signaletique-jeita.pdf", action: "valide", by: "u9", at: "2026-07-02 10:30", comment: "" },
  { id: "a6", projectId: "p1", entity: "tache", entityId: "t2", label: "Tâche Sélection du paysagiste", action: "soumis", by: "u2", at: "2026-06-21 08:50", comment: "" },
];

/* Indicateurs tirés des résultats attendus du dossier MEAE */
const seedIndicators = [
  { id: "i1", projectId: "p1", name: "Kilomètres de sentiers restaurés (Azour)", kind: "quantitatif", unit: "km", periodicity: "trimestriel", source: "manuelle", baseline: 0, target: 7, phaseId: null },
  { id: "i2", projectId: "p1", name: "Jeunes mobilisés sur les chantiers (Azour)", kind: "quantitatif", unit: "jeunes", periodicity: "trimestriel", source: "manuelle", baseline: 0, target: 50, phaseId: null },
  { id: "i3", projectId: "p1", name: "Participants au trail d'Azour", kind: "quantitatif", unit: "participants", periodicity: "ponctuel", source: "manuelle", baseline: 0, target: 250, phaseId: null },
  { id: "i4", projectId: "p2", name: "Jeunes mobilisés sur les chantiers (Jeïta)", kind: "quantitatif", unit: "jeunes", periodicity: "trimestriel", source: "manuelle", baseline: 0, target: 50, phaseId: null },
  { id: "i5", projectId: "p2", name: "Jeunes formés guides (Jeïta)", kind: "quantitatif", unit: "jeunes", periodicity: "trimestriel", source: "manuelle", baseline: 0, target: 30, phaseId: null },
  { id: "i6", projectId: "p3", name: "Jeunes sensibilisés lors des sessions croisées", kind: "quantitatif", unit: "jeunes", periodicity: "trimestriel", source: "manuelle", baseline: 0, target: 240, phaseId: null },
  { id: "i7", projectId: "p3", name: "COPIL tenus", kind: "quantitatif", unit: "COPIL", periodicity: "trimestriel", source: "manuelle", baseline: 0, target: 4, phaseId: null },
  { id: "i8", projectId: "p3", name: "Missions de terrain réalisées", kind: "quantitatif", unit: "missions", periodicity: "trimestriel", source: "manuelle", baseline: 0, target: 4, phaseId: null },
  { id: "i9", projectId: "p3", name: "Qualité de la coopération entre triades", kind: "qualitatif", unit: "score /5", periodicity: "annuel", source: "manuelle", baseline: 2, target: 4, phaseId: null },
];
const seedMeasures = [
  { id: "me1", indicatorId: "i1", period: "2026-T2", value: 1.5, comment: "Premier tronçon du Shir défriché", by: "u7", at: "2026-07-01" },
  { id: "me2", indicatorId: "i2", period: "2026-T2", value: 12, comment: "Jeunes du Club Sportif d'Azour", by: "u7", at: "2026-07-01" },
  { id: "me3", indicatorId: "i4", period: "2026-T2", value: 18, comment: "", by: "u6", at: "2026-07-01" },
  { id: "me4", indicatorId: "i7", period: "2025-T4", value: 1, comment: "COPIL de lancement du 26/11/2025", by: "u1", at: "2025-12-01" },
  { id: "me5", indicatorId: "i8", period: "2026-T2", value: 1, comment: "Mission LEY à Azour (mai 2025) comptée hors projet ; 1re mission projet réalisée", by: "u1", at: "2026-06-30" },
  { id: "me6", indicatorId: "i9", period: "2026", value: 3, comment: "Gouvernance RACI appropriée, points bimensuels réguliers", by: "u1", at: "2026-06-30" },
];
/* Réunions et décisions de COPIL */
const seedMeetings = [
  { id: "mt1", projectId: "p3", title: "COPIL de lancement", kind: "copil", date: "2025-11-26", attendees: "YCID, CD78, Villepreux, Jouy-en-Josas, LEY, Comité de Jumelage, Azour, Jeïta", minutes: "Adoption de la matrice RACI (rôles et responsabilités par tâche), validation du calendrier général et de la gouvernance : 2 COPIL par an, points bimensuels par triade animés par YCID, associations maîtresses d'œuvre avec transfert progressif aux municipalités libanaises." },
  { id: "mt2", projectId: "p1", title: "Point triade Villepreux · Azour · LEY", kind: "technique", date: "2026-06-10", attendees: "Clara Beaucaire, Président LEY, Nour Azoury, Maria, YCID", minutes: "Revue des devis paysagiste, préparation du chantier jeunes de juillet et du programme de sensibilisation de l'été." },
];
const seedDecisions = [
  { id: "dc1", meetingId: "mt1", projectId: "p3", text: "Signer la convention de partenariat (déclenche les premiers versements)", ownerId: "u1", due: "2025-12-31", status: "fait" },
  { id: "dc2", meetingId: "mt1", projectId: "p3", text: "Soumettre le rapport succinct d'activités au MEAE", ownerId: "u1", due: "2026-02-28", status: "fait" },
  { id: "dc3", meetingId: "mt1", projectId: "p3", text: "Préparer le rapport intermédiaire de septembre (narratif + financier)", ownerId: "u1", due: "2026-09-30", status: "en_cours" },
  { id: "dc4", meetingId: "mt2", projectId: "p1", text: "Retenir le paysagiste et faire valider le devis par LEY", ownerId: "u2", due: "2026-07-10", status: "en_cours" },
];

/* ============================================================
   HELPERS
   ============================================================ */
const TODAY = "2026-07-05";
const NOW = "2026-07-05 15:30";
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtDate = (d) => { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const fmtMoney = (n, cur = "EUR") =>
  n == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
const isLate = (t) => t.status !== "terminee" && t.end && t.end < TODAY;
const isSoon = (t) => t.status !== "terminee" && t.end && t.end >= TODAY && t.end <= "2026-07-19";
const devisState = (docId, validations) => {
  const vs = validations.filter((v) => v.docId === docId);
  if (!vs.length) return "en_attente";
  if (vs.some((v) => v.decision === "refuse")) return "refuse";
  if (vs.every((v) => v.decision === "valide")) return "valide";
  return "en_attente";
};
/* État de revue d'un document : les devis dérivent du circuit multi-orgs */
const docReview = (d, validations) => {
  if (d.type === "devis") {
    const s = devisState(d.id, validations);
    return s === "valide" ? "valide" : s === "refuse" ? "rejete" : "soumis";
  }
  return d.review || "brouillon";
};
const lineFinance = (lineId, docs, validations) => {
  const lDocs = docs.filter((d) => d.lineId === lineId);
  const engaged = lDocs.filter((d) => d.type === "devis" && devisState(d.id, validations) === "valide")
    .reduce((s, d) => s + (d.amount || 0), 0);
  const paid = lDocs.filter((d) => d.type === "recu" || (d.type === "facture" && d.paid))
    .reduce((s, d) => s + (d.amount || 0), 0);
  return { engaged, paid };
};
/* PHASE 4 : valeur courante et taux d'atteinte d'un indicateur */
const indMeasures = (indId, measures) => measures.filter((m) => m.indicatorId === indId);
const indValue = (ind, measures, tasks) => {
  if (ind.source === "taches") return tasks.filter((t) => t.phaseId === ind.phaseId && t.status === "terminee").length;
  const ms = indMeasures(ind.id, measures);
  return ms.length ? ms[ms.length - 1].value : ind.baseline;
};
const indPct = (ind, value) => {
  if (ind.target === ind.baseline) return null;
  return Math.max(0, Math.round(((value - ind.baseline) / (ind.target - ind.baseline)) * 100));
};
const ACTION_LABELS = { cree: "créé", modifie: "modifié", soumis: "soumis", en_revue: "passé en revue", valide: "validé", rejete: "rejeté", paye: "payé" };

/* ============================================================
   COMPOSANTS DE BASE
   ============================================================ */
const Badge = ({ label, fg, bg }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
    style={{ color: fg, backgroundColor: bg, fontFamily: FONT_BODY }}>{label}</span>
);
const ProgressBar = ({ value }) => (
  <div className="flex items-center gap-2 min-w-0 flex-1">
    <div className="h-1.5 rounded-full flex-1 overflow-hidden" style={{ backgroundColor: C.border }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, backgroundColor: value >= 100 ? C.blue : C.accent }} />
    </div>
    <span className="text-xs tabular-nums w-9 text-right flex-shrink-0" style={{ color: C.muted }}>{Math.round(value)}%</span>
  </div>
);
const TriBar = ({ planned, engaged, paid }) => {
  const pctE = planned ? Math.min(100, (engaged / planned) * 100) : 0;
  const pctP = planned ? Math.min(100, (paid / planned) * 100) : 0;
  const over = planned && engaged > planned;
  return (
    <div className="h-2 rounded-full overflow-hidden relative" style={{ backgroundColor: C.border }}>
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pctE}%`, backgroundColor: over ? C.danger : "#8FB8AE" }} />
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pctP}%`, backgroundColor: C.accent }} />
    </div>
  );
};
const Sparkline = ({ values, max }) => {
  const m = Math.max(max || 0, ...values, 1);
  return (
    <div className="flex items-end gap-1 h-9 mt-2">
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-t"
          style={{ height: `${Math.max(8, (v / m) * 100)}%`, backgroundColor: C.accent, opacity: 0.35 + 0.65 * ((i + 1) / values.length), minWidth: 5, maxWidth: 26 }} />
      ))}
    </div>
  );
};

const Card = ({ children, className = "", onClick }) => (
  <div onClick={onClick}
    className={`rounded-xl border ${onClick ? "cursor-pointer active:opacity-80 hover:shadow-sm transition-all" : ""} ${className}`}
    style={{ backgroundColor: C.surface, borderColor: C.border }}>
    {children}
  </div>
);
const Field = ({ label, children }) => (
  <label className="block">
    <span className="block text-xs font-medium mb-1.5" style={{ color: C.muted }}>{label}</span>
    {children}
  </label>
);
const inputStyle = {
  width: "100%", padding: "11px 12px", borderRadius: 10, fontSize: 15,
  border: `1px solid ${C.border}`, backgroundColor: C.surface, color: C.ink,
  fontFamily: FONT_BODY, outline: "none",
};
const Btn = ({ children, onClick, variant = "primary", disabled, full, small }) => {
  const styles = {
    primary: { backgroundColor: C.accent, color: "#fff", border: "1px solid transparent" },
    ghost: { backgroundColor: "transparent", color: C.ink, border: `1px solid ${C.border}` },
    danger: { backgroundColor: "transparent", color: C.danger, border: `1px solid ${C.border}` },
  }[variant];
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-medium disabled:opacity-40 ${full ? "w-full" : ""} ${small ? "px-3 text-xs" : "px-4 text-sm"}`}
      style={{ ...styles, fontFamily: FONT_BODY, minHeight: small ? 34 : 44 }}>
      {children}
    </button>
  );
};
const Sheet = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
    style={{ backgroundColor: "rgba(23,33,29,0.45)" }} onClick={onClose}>
    <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col"
      style={{ backgroundColor: C.surface, maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
      <div className="sm:hidden pt-2.5 pb-1 flex justify-center flex-shrink-0">
        <div className="w-9 h-1 rounded-full" style={{ backgroundColor: C.border }} />
      </div>
      <div className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0" style={{ borderColor: C.border }}>
        <h3 className="text-base font-semibold" style={{ fontFamily: FONT_HEAD, color: C.ink }}>{title}</h3>
        <button onClick={onClose} aria-label="Fermer" className="p-1.5 -m-1.5"><X size={19} color={C.muted} /></button>
      </div>
      <div className="p-5 overflow-y-auto" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>{children}</div>
    </div>
  </div>
);
const Fab = ({ onClick, label }) => (
  <button onClick={onClick} aria-label={label}
    className="lg:hidden fixed right-4 z-30 w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
    style={{ backgroundColor: C.accent, bottom: "calc(76px + env(safe-area-inset-bottom))" }}>
    <Plus size={24} color="#fff" />
  </button>
);

/* ============================================================
   PHASE 3 — WORKFLOW DE REVUE (brouillon → soumis → en revue → validé/rejeté)
   ============================================================ */
function ReviewActions({ state, P, onTransition, compact }) {
  const [rejectFor, setRejectFor] = useState(null); // "soumis"|"en_revue"
  const [comment, setComment] = useState("");
  const actions = [];
  if ((state === "brouillon" || state === "rejete") && P.contribute)
    actions.push({ label: state === "rejete" ? "Soumettre à nouveau" : "Soumettre", icon: <Send size={13} />, to: "soumis" });
  if (state === "soumis" && P.manage) {
    actions.push({ label: "Passer en revue", icon: <Eye size={13} />, to: "en_revue" });
    actions.push({ label: "Rejeter", icon: <ThumbsDown size={13} />, to: "rejete", danger: true, needComment: true });
  }
  if (state === "en_revue" && P.validate) {
    actions.push({ label: "Valider", icon: <Check size={13} />, to: "valide" });
    actions.push({ label: "Rejeter", icon: <ThumbsDown size={13} />, to: "rejete", danger: true, needComment: true });
  }
  if (!actions.length) return null;
  return (
    <div className={compact ? "flex flex-wrap gap-1.5" : "flex flex-wrap gap-2"}>
      {actions.map((a) => (
        <Btn key={a.to + a.label} small variant={a.danger ? "danger" : "primary"}
          onClick={() => a.needComment ? setRejectFor(a.to) : onTransition(a.to, "")}>
          {a.icon} {a.label}
        </Btn>
      ))}
      {rejectFor && (
        <Sheet title="Motif du rejet" onClose={() => setRejectFor(null)}>
          <div className="space-y-4">
            <Field label="Commentaire (visible dans l'historique)">
              <textarea style={{ ...inputStyle, minHeight: 70 }} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus
                placeholder="ex. Pièce illisible, merci de re-déposer" />
            </Field>
            <div className="flex gap-2">
              <Btn variant="ghost" full onClick={() => setRejectFor(null)}>Annuler</Btn>
              <Btn full onClick={() => { onTransition("rejete", comment.trim()); setRejectFor(null); setComment(""); }}>
                <ThumbsDown size={14} /> Confirmer le rejet
              </Btn>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

const ReviewBadge = ({ state }) => <Badge {...REVIEW_STATES[state || "brouillon"]} />;

/* ============================================================
   CONNEXION
   ============================================================ */
function Login({ onLogin }) {
  const [email, setEmail] = useState(DEMO ? "bayoub@yvelines.fr" : "");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const doGoogle = () => {
    if (DEMO) return onLogin("google");
    supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  };
  const doEmail = async () => {
    if (DEMO) return onLogin("email");
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) setErr("Connexion impossible. Vérifiez vos identifiants.");
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ backgroundColor: C.bg, fontFamily: FONT_BODY }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3" style={{ backgroundColor: C.accent }}>
            <FolderKanban size={24} color="#fff" />
          </div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: FONT_HEAD, color: C.ink }}>Solid'Pilot</h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>Pilotage du programme CEM Liban-Yvelines</p>
        </div>
        <Card className="p-6">
          <button onClick={doGoogle}
            className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-medium mb-4"
            style={{ border: `1px solid ${C.border}`, color: C.ink, minHeight: 46 }}>
            <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.16-3.16C17.45 1.4 14.97.36 12 .36 7.7.36 3.99 2.83 2.18 6.42l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75z"/></svg>
            Continuer avec Google
          </button>
          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1" style={{ backgroundColor: C.border }} />
            <span className="text-xs" style={{ color: C.muted }}>ou</span>
            <div className="h-px flex-1" style={{ backgroundColor: C.border }} />
          </div>
          <div className="space-y-3">
            <Field label="Email"><input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Mot de passe"><input style={inputStyle} type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" /></Field>
            {err && <p className="text-xs" style={{ color: C.danger }}>{err}</p>}
            <Btn full onClick={doEmail}>Se connecter</Btn>
          </div>
          <p className="text-xs mt-4 text-center" style={{ color: C.muted }}>
            {DEMO ? "Mode démo — la connexion est simulée." : "Accès réservé aux membres du programme. Les comptes sont créés par YCID."}
          </p>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   APPLICATION
   ============================================================ */
export default function App() {
  const [userId, setUserId] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showNotifs, setShowNotifs] = useState(false);

  const [orgs, setOrgs] = usePersistedList("organizations", seedOrgs);
  const [projects, setProjects] = usePersistedList("projects", seedProjects);
  const [members, setMembers] = usePersistedList("project_members", seedMembers);
  const [phases, setPhases] = usePersistedList("phases", seedPhases);
  const [tasks, setTasks] = usePersistedList("tasks", seedTasks);
  const [docs, setDocs] = usePersistedList("documents", seedDocs);
  const [budgetLines, setBudgetLines] = usePersistedList("budget_lines", seedBudgetLines);
  const [validations, setValidations] = usePersistedList("validations", seedValidations);
  const [audit, setAudit] = usePersistedList("audit_log", seedAudit);
  const [indicators, setIndicators] = usePersistedList("indicators", seedIndicators);
  const [measures, setMeasures] = usePersistedList("indicator_measures", seedMeasures);
  const [meetings, setMeetings] = usePersistedList("meetings", seedMeetings);
  const [decisions, setDecisions] = usePersistedList("decisions", seedDecisions);
  const users = useProfiles(seedUsers);
  const user = users.find((u) => u.id === userId);

  /* Authentification réelle : la session Supabase est reliée au profil
     par email (le lien serveur auth_user_id est posé par trigger SQL). */
  useEffect(() => {
    if (DEMO) return;
    const bind = (session) => {
      if (!session) { setUserId(null); return; }
      const prof = users.find((u) => (u.email || "").toLowerCase() === session.user.email.toLowerCase());
      setUserId(prof ? prof.id : "__no_profile__");
    };
    supabase.auth.getSession().then(({ data }) => bind(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => bind(session));
    return () => sub.subscription.unsubscribe();
  }, [users]);

  const accessRole = (projectId, uId = userId) =>
    members.find((m) => m.projectId === projectId && m.userId === uId)?.role || null;
  const perms = (projectId) => {
    const r = accessRole(projectId);
    const hasValidator = members.some((m) => m.projectId === projectId && m.role === "validateur");
    return {
      role: r,
      manage: r === "chef_projet",
      finance: r === "chef_projet" || r === "resp_financier",
      contribute: r === "chef_projet" || r === "contributeur" || r === "resp_financier",
      validate: r === "validateur" || (r === "chef_projet" && !hasValidator),
      audit: r === "auditeur",
      read: r !== null,
    };
  };
  const canCreateProjects = user?.isOrgAdmin;
  const visibleProjects = projects.filter((p) =>
    members.some((m) => m.projectId === p.id && m.userId === userId) ||
    p.orgs.some((po) => po.orgId === user?.orgId)
  );

  /* Journal d'audit : toute transition écrit qui / quoi / quand / commentaire */
  const log = (projectId, entity, entityId, label, action, comment = "") =>
    setAudit((a) => [{ id: uid(), projectId, entity, entityId, label, action, by: userId, at: NOW, comment }, ...a]);

  const projectProgress = (pId) => {
    const phIds = phases.filter((p) => p.projectId === pId).map((p) => p.id);
    const ts = tasks.filter((t) => phIds.includes(t.phaseId));
    if (!ts.length) return 0;
    return Math.round(ts.reduce((s, t) => s + t.progress, 0) / ts.length);
  };
  const projectKpis = (pId) => {
    const lines = budgetLines.filter((l) => l.projectId === pId);
    let planned = 0, valorisations = 0, engaged = 0, paid = 0;
    lines.forEach((l) => {
      const f = lineFinance(l.id, docs, validations);
      if (l.valorisation) valorisations += l.planned || 0; else planned += l.planned || 0;
      engaged += f.engaged; paid += f.paid;
    });
    return { planned, valorisations, engaged, paid, toCommit: planned - engaged, toPay: engaged - paid, lines };
  };

  /* NOTIFICATIONS calculées pour l'utilisateur courant */
  const notifications = useMemo(() => {
    if (!user) return [];
    const items = [];
    visibleProjects.forEach((p) => {
      const P = perms(p.id);
      const phIds = phases.filter((ph) => ph.projectId === p.id).map((ph) => ph.id);
      const pTasks = tasks.filter((t) => phIds.includes(t.phaseId));
      const pLines = budgetLines.filter((l) => l.projectId === p.id);
      const pDocs = docs.filter((d) => pTasks.some((t) => t.id === d.taskId) || pLines.some((l) => l.id === d.lineId));
      if (P.manage) {
        pTasks.filter((t) => t.review === "soumis").forEach((t) => items.push({ icon: Send, color: C.warn, text: `Tâche soumise à vérifier : ${t.title}`, sub: p.name, pid: p.id }));
        pDocs.filter((d) => d.type !== "devis" && docReview(d, validations) === "soumis").forEach((d) => items.push({ icon: Send, color: C.warn, text: `Document soumis : ${d.filename}`, sub: p.name, pid: p.id }));
        pLines.filter((l) => l.review === "soumis").forEach((l) => items.push({ icon: Send, color: C.warn, text: `Ligne budgétaire soumise : ${l.poste}`, sub: p.name, pid: p.id }));
      }
      if (P.validate) {
        pTasks.filter((t) => t.review === "en_revue").forEach((t) => items.push({ icon: ShieldCheck, color: C.blue, text: `Tâche à valider : ${t.title}`, sub: p.name, pid: p.id }));
        pDocs.filter((d) => d.type !== "devis" && docReview(d, validations) === "en_revue").forEach((d) => items.push({ icon: ShieldCheck, color: C.blue, text: `Document à valider : ${d.filename}`, sub: p.name, pid: p.id }));
        pLines.filter((l) => l.review === "en_revue").forEach((l) => items.push({ icon: ShieldCheck, color: C.blue, text: `Ligne à valider : ${l.poste}`, sub: p.name, pid: p.id }));
      }
      validations.filter((v) => v.decision === "en_attente" && v.orgId === user.orgId).forEach((v) => {
        const d = docs.find((x) => x.id === v.docId);
        if (d && pDocs.includes(d)) items.push({ icon: Wallet, color: C.purple, text: `Dépense à valider : ${d.filename} (${fmtMoney(d.amount, p.currency)})`, sub: p.name, pid: p.id });
      });
      if (P.contribute) {
        pTasks.filter((t) => t.review === "rejete" && (t.createdBy === user.id || t.assigneeId === user.id))
          .forEach((t) => items.push({ icon: ThumbsDown, color: C.danger, text: `Rejeté : ${t.title}`, sub: p.name, pid: p.id }));
        pDocs.filter((d) => d.by === user.id && docReview(d, validations) === "rejete")
          .forEach((d) => items.push({ icon: ThumbsDown, color: C.danger, text: `Document rejeté : ${d.filename}`, sub: p.name, pid: p.id }));
      }
      decisions.filter((d) => d.projectId === p.id && d.status !== "fait" && d.due && d.due < TODAY && (P.manage || d.ownerId === user.id))
        .forEach((d) => items.push({ icon: CalendarClock, color: C.danger, text: `Décision en retard : ${d.text}`, sub: `${p.name} · échéance ${fmtDate(d.due)}`, pid: p.id }));
      pTasks.filter(isLate).forEach((t) => items.push({ icon: AlertTriangle, color: C.warn, text: `Tâche en retard : ${t.title}`, sub: `${p.name} · échéance ${fmtDate(t.end)}`, pid: p.id }));
      pTasks.filter(isSoon).forEach((t) => items.push({ icon: CalendarClock, color: C.muted, text: `Échéance proche : ${t.title}`, sub: `${p.name} · ${fmtDate(t.end)}`, pid: p.id }));
    });
    return items;
  }, [user, visibleProjects, tasks, docs, budgetLines, validations, phases, members, decisions]);

  const helpers = { orgs, projects: visibleProjects, allProjects: projects, members, phases, tasks, docs, budgetLines, users, validations, audit, indicators, measures, meetings, decisions, user, accessRole, perms, log, setOrgs, setProjects, setMembers, setPhases, setTasks, setDocs, setBudgetLines, setValidations, setIndicators, setMeasures, setMeetings, setDecisions };

  const fonts = <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');
    * { -webkit-tap-highlight-color: transparent; }
  `}</style>;

  if (!DEMO && userId === "__no_profile__") return <>{fonts}<NoAccess />{null}</>;
  if (!user) return <>{fonts}<Login onLogin={() => setUserId("u1")} /></>;

  const NAV = [
    { id: "dashboard", label: "Accueil", Icon: LayoutDashboard },
    { id: "projects", label: "Projets", Icon: FolderKanban },
    { id: "pilotage", label: "Pilotage", Icon: PieChart },
    { id: "aide", label: "Aide", Icon: HelpCircle },
    { id: "orgs", label: "Orgas", labelFull: "Organisations", Icon: Building2 },
    { id: "import", label: "Import", Icon: Upload },
  ];
  const goto = (p) => { setPage(p); setSelectedProjectId(null); };
  const inProjects = page === "projects";

  const UserSwitcher = ({ compact }) => DEMO && (
    <select value={userId} onChange={(e) => { setUserId(e.target.value); setSelectedProjectId(null); }}
      className="text-xs rounded-lg font-medium outline-none"
      style={{ border: `1px solid ${C.border}`, color: C.ink, backgroundColor: C.surface, padding: compact ? "6px 8px" : "8px 10px", maxWidth: compact ? 140 : "100%" }}>
      {users.map((u) => (
        <option key={u.id} value={u.id}>{u.name} — {orgs.find((o) => o.id === u.orgId)?.name}</option>
      ))}
    </select>
  );

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: C.bg, fontFamily: FONT_BODY, color: C.ink }}>
      {fonts}

      <aside className="hidden lg:flex w-60 flex-shrink-0 flex-col border-r sticky top-0 h-screen"
        style={{ backgroundColor: C.surface, borderColor: C.border }}>
        <div className="flex items-center gap-2.5 px-5 h-16 border-b" style={{ borderColor: C.border }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: C.accent }}>
            <FolderKanban size={16} color="#fff" />
          </div>
          <span className="font-semibold" style={{ fontFamily: FONT_HEAD }}>Solid'Pilot</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ id, label, labelFull, Icon }) => {
            const active = page === id;
            return (
              <button key={id} onClick={() => goto(id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left"
                style={{ backgroundColor: active ? C.accentSoft : "transparent", color: active ? C.accent : C.muted }}>
                <Icon size={17} /> {labelFull || label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t space-y-2" style={{ borderColor: C.border }}>
          {DEMO && (
            <div className="px-2">
              <div className="text-xs mb-1" style={{ color: C.muted }}>Voir en tant que (démo)</div>
              <UserSwitcher />
            </div>
          )}
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ backgroundColor: C.accentSoft, color: C.accent }}>
              {user.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{user.name}</div>
              <div className="text-xs truncate" style={{ color: C.muted }}>{orgs.find((o) => o.id === user.orgId)?.name}</div>
            </div>
            <button onClick={() => (DEMO ? setUserId(null) : supabase.auth.signOut())} aria-label="Se déconnecter"><LogOut size={15} color={C.muted} /></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 lg:h-16 flex items-center gap-3 px-4 sm:px-6 border-b sticky top-0 z-20"
          style={{ backgroundColor: C.surface, borderColor: C.border, paddingTop: "env(safe-area-inset-top)" }}>
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: C.accent }}>
              <FolderKanban size={14} color="#fff" />
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 flex-1 max-w-md px-3 py-2 rounded-lg" style={{ backgroundColor: C.bg }}>
            <Search size={15} color={C.muted} />
            <input placeholder="Rechercher…" className="bg-transparent text-sm flex-1 outline-none" style={{ color: C.ink }} />
          </div>
          <div className="flex-1 sm:hidden" />
          <button className="relative p-1.5" onClick={() => setShowNotifs(true)} aria-label="Notifications">
            <Bell size={19} color={C.muted} />
            {notifications.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-white flex items-center justify-center font-semibold"
                style={{ backgroundColor: C.danger, fontSize: 9.5 }}>
                {notifications.length}
              </span>
            )}
          </button>
          <div className="lg:hidden"><UserSwitcher compact /></div>
          <span className="text-xs hidden lg:block" style={{ color: C.muted }}>05/07/2026</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto"
          style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom))" }}>
          {page === "dashboard" && <Dashboard {...helpers} notifications={notifications} projectProgress={projectProgress} projectKpis={projectKpis} openProject={(id) => { setPage("projects"); setSelectedProjectId(id); }} />}
          {inProjects && !selectedProjectId && <ProjectsList {...helpers} canCreateProjects={canCreateProjects} projectProgress={projectProgress} projectKpis={projectKpis} openProject={setSelectedProjectId} />}
          {inProjects && selectedProjectId && <ProjectDetail {...helpers} projectId={selectedProjectId} projectProgress={projectProgress} projectKpis={projectKpis} back={() => setSelectedProjectId(null)} />}
          {page === "pilotage" && <PilotagePage {...helpers} projectProgress={projectProgress} projectKpis={projectKpis} openProject={(id) => { setPage("projects"); setSelectedProjectId(id); }} />}
          {page === "aide" && <HelpPage user={user} accessRole={accessRole} projects={visibleProjects} />}
          {page === "orgs" && <Organizations {...helpers} />}
          {page === "import" && <ImportPage {...helpers} />}
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t flex"
        style={{ backgroundColor: C.surface, borderColor: C.border, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.map(({ id, label, Icon }) => {
          const active = page === id;
          return (
            <button key={id} onClick={() => goto(id)}
              className="flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1.5"
              style={{ color: active ? C.accent : C.muted, minHeight: 56 }}>
              <Icon size={21} strokeWidth={active ? 2.4 : 2} />
              <span className="font-medium" style={{ fontSize: 10.5 }}>{label}</span>
            </button>
          );
        })}
      </nav>

      {showNotifs && (
        <Sheet title={`Notifications (${notifications.length})`} onClose={() => setShowNotifs(false)}>
          {notifications.length === 0 && <p className="text-sm" style={{ color: C.muted }}>Rien à signaler. 🎉</p>}
          <div className="space-y-3">
            {notifications.map((n, i) => {
              const Icon = n.icon;
              return (
                <button key={i} className="w-full flex items-start gap-3 text-left"
                  onClick={() => { setShowNotifs(false); setPage("projects"); setSelectedProjectId(n.pid); }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: C.bg }}>
                    <Icon size={15} color={n.color} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-snug">{n.text}</div>
                    <div className="text-xs mt-0.5" style={{ color: C.muted }}>{n.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs mt-4" style={{ color: C.muted }}>
            Prototype : notifications calculées à l'affichage. En production, elles sont stockées et envoyées aussi par email.
          </p>
        </Sheet>
      )}
    </div>
  );
}

/* ============================================================
   TABLEAU DE BORD
   ============================================================ */
function Dashboard({ projects, phases, tasks, docs, orgs, validations, user, accessRole, notifications, projectProgress, projectKpis, openProject }) {
  const visiblePhaseIds = phases.filter((ph) => projects.some((p) => p.id === ph.projectId)).map((ph) => ph.id);
  const visibleTasks = tasks.filter((t) => visiblePhaseIds.includes(t.phaseId));
  const lateTasks = visibleTasks.filter(isLate);
  const actionable = notifications.filter((n) => [Send, ShieldCheck, Wallet].includes(n.icon)).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold" style={{ fontFamily: FONT_HEAD }}>Bonjour {user.name.split(" ")[0]}</h1>
        <p className="text-sm mt-0.5" style={{ color: C.muted }}>
          {orgs.find((o) => o.id === user.orgId)?.name} · Dimanche 5 juillet 2026
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {[
          { label: "Mes projets", value: projects.length },
          { label: "En retard", value: lateTasks.length, warn: lateTasks.length > 0 },
          { label: "Actions attendues", value: actionable, warn: actionable > 0 },
        ].map((s) => (
          <Card key={s.label} className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-semibold tabular-nums" style={{ fontFamily: FONT_HEAD, color: s.warn ? C.warn : C.ink }}>{s.value}</div>
            <div className="text-xs sm:text-sm mt-0.5 leading-tight" style={{ color: C.muted }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {actionable > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <ShieldCheck size={15} color={C.warn} />
            <h2 className="text-sm font-semibold">En attente de votre action</h2>
          </div>
          <ul className="space-y-2.5">
            {notifications.filter((n) => [Send, ShieldCheck, Wallet].includes(n.icon)).slice(0, 6).map((n, i) => (
              <li key={i}>
                <button className="w-full text-left" onClick={() => openProject(n.pid)}>
                  <div className="text-sm font-medium leading-snug">{n.text}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>{n.sub}</div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section>
        <h2 className="text-xs font-semibold mb-2.5 tracking-wide" style={{ color: C.muted }}>MES PROJETS</h2>
        <div className="space-y-2.5">
          {projects.map((p) => {
            const k = projectKpis(p.id);
            const myRole = accessRole(p.id);
            return (
              <Card key={p.id} className="p-4" onClick={() => openProject(p.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm sm:text-base leading-snug">{p.name}</div>
                    <div className="text-xs mt-1" style={{ color: C.muted }}>
                      {p.country} · porté par {orgs.find((o) => o.id === p.leadOrgId)?.name}
                    </div>
                  </div>
                  {myRole && <Badge {...ACCESS_ROLES[myRole]} label={ACCESS_ROLES[myRole].short} />}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <Badge {...PROJECT_STATUS[p.status]} />
                  <ProgressBar value={projectProgress(p.id)} />
                </div>
                {k.planned > 0 && (
                  <div className="mt-3">
                    <div className="flex items-baseline justify-between text-xs mb-1" style={{ color: C.muted }}>
                      <span>Engagé <strong style={{ color: C.ink }}>{fmtMoney(k.engaged, p.currency)}</strong> / {fmtMoney(k.planned, p.currency)}</span>
                      <span>Payé {fmtMoney(k.paid, p.currency)}</span>
                    </div>
                    <TriBar planned={k.planned} engaged={k.engaged} paid={k.paid} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   LISTE PROJETS + FORMULAIRE PROJET
   ============================================================ */
function ProjectForm({ orgs, initial, onSave, onClose }) {
  const [f, setF] = useState(initial || {
    name: "", description: "", country: "", zone: "", start: "", end: "",
    status: "en_preparation", leadOrgId: orgs[0]?.id || "", orgs: [],
    budget: "", currency: "EUR", validationRoles: ["porteur", "financeur"],
  });
  const set = (k, v) => setF({ ...f, [k]: v });
  const partnerRoles = Object.keys(PROJECT_ROLES).filter((r) => r !== "porteur");
  const togglePartner = (orgId) => {
    const exists = f.orgs.find((x) => x.orgId === orgId);
    set("orgs", exists ? f.orgs.filter((x) => x.orgId !== orgId) : [...f.orgs, { orgId, role: "partenaire" }]);
  };
  const toggleValidator = (role) => {
    set("validationRoles", f.validationRoles.includes(role)
      ? f.validationRoles.filter((r) => r !== role) : [...f.validationRoles, role]);
  };
  return (
    <Sheet title={initial ? "Modifier le projet" : "Nouveau projet"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nom du projet *"><input style={inputStyle} value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 70 }} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pays"><input style={inputStyle} value={f.country} onChange={(e) => set("country", e.target.value)} /></Field>
          <Field label="Zone"><input style={inputStyle} value={f.zone} onChange={(e) => set("zone", e.target.value)} /></Field>
          <Field label="Début"><input style={inputStyle} type="date" value={f.start} onChange={(e) => set("start", e.target.value)} /></Field>
          <Field label="Fin"><input style={inputStyle} type="date" value={f.end} onChange={(e) => set("end", e.target.value)} /></Field>
          <Field label="Enveloppe globale">
            <input style={inputStyle} type="number" min="0" inputMode="numeric" value={f.budget} onChange={(e) => set("budget", e.target.value)} />
          </Field>
          <Field label="Devise du projet">
            <select style={inputStyle} value={f.currency} onChange={(e) => set("currency", e.target.value)}>
              <option value="EUR">€ Euro</option><option value="XOF">FCFA</option><option value="USD">$ Dollar</option>
            </select>
          </Field>
        </div>
        <Field label="Organisation porteuse *">
          <select style={inputStyle} value={f.leadOrgId} onChange={(e) => set("leadOrgId", e.target.value)}>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name} ({ORG_TYPES[o.type]})</option>)}
          </select>
        </Field>
        <div>
          <span className="block text-xs font-medium mb-2" style={{ color: C.muted }}>Organisations partenaires et rôles</span>
          <div className="space-y-2.5">
            {orgs.filter((o) => o.id !== f.leadOrgId).map((o) => {
              const entry = f.orgs.find((x) => x.orgId === o.id);
              return (
                <div key={o.id} className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={!!entry} onChange={() => togglePartner(o.id)} className="w-4 h-4 flex-shrink-0" style={{ accentColor: C.accent }} />
                  <span className="flex-1 min-w-0 truncate">{o.name}</span>
                  {entry && (
                    <select style={{ ...inputStyle, width: 160, padding: "7px 8px", fontSize: 13 }} value={entry.role}
                      onChange={(e) => set("orgs", f.orgs.map((x) => x.orgId === o.id ? { ...x, role: e.target.value } : x))}>
                      {partnerRoles.map((r) => <option key={r} value={r}>{PROJECT_ROLES[r].label}</option>)}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl p-3.5" style={{ backgroundColor: C.bg }}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={15} color={C.accent} />
            <span className="text-sm font-medium">Circuit de validation des devis</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {VALIDATOR_ROLES.map((r) => {
              const on = f.validationRoles.includes(r);
              return (
                <button key={r} onClick={() => toggleValidator(r)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: on ? C.accentSoft : C.surface, color: on ? C.accent : C.muted, border: `1px solid ${on ? C.accent : C.border}` }}>
                  {on ? "✓ " : ""}{PROJECT_ROLES[r].label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Btn variant="ghost" full onClick={onClose}>Annuler</Btn>
          <Btn full disabled={!f.name || !f.leadOrgId} onClick={() => {
            const withLead = [{ orgId: f.leadOrgId, role: "porteur" }, ...f.orgs.filter((x) => x.orgId !== f.leadOrgId)];
            onSave({ ...f, budget: f.budget === "" ? null : Number(f.budget), orgs: withLead });
          }}><Check size={15} /> Enregistrer</Btn>
        </div>
      </div>
    </Sheet>
  );
}

function ProjectsList({ projects, orgs, user, accessRole, canCreateProjects, setProjects, setMembers, projectProgress, projectKpis, openProject }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ fontFamily: FONT_HEAD }}>Projets</h1>
        {canCreateProjects && <div className="hidden lg:block"><Btn onClick={() => setShowForm(true)}><Plus size={15} /> Nouveau projet</Btn></div>}
      </div>
      <div className="space-y-2.5">
        {projects.map((p) => {
          const k = projectKpis(p.id);
          const myRole = accessRole(p.id);
          return (
            <Card key={p.id} className="p-4" onClick={() => openProject(p.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-snug">{p.name}</div>
                  <p className="text-sm mt-1 line-clamp-2" style={{ color: C.muted }}>{p.description}</p>
                </div>
                {myRole ? <Badge {...ACCESS_ROLES[myRole]} label={ACCESS_ROLES[myRole].short} /> : <Badge label="Via mon orga" fg={C.muted} bg="#EEF0EE" />}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <Badge {...PROJECT_STATUS[p.status]} />
                <ProgressBar value={projectProgress(p.id)} />
              </div>
              {k.planned > 0 && (
                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-xs mb-1" style={{ color: C.muted }}>
                    <span>Engagé <strong style={{ color: C.ink }}>{fmtMoney(k.engaged, p.currency)}</strong> / {fmtMoney(k.planned, p.currency)}</span>
                    <span>Payé {fmtMoney(k.paid, p.currency)}</span>
                  </div>
                  <TriBar planned={k.planned} engaged={k.engaged} paid={k.paid} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
      {canCreateProjects && <Fab onClick={() => setShowForm(true)} label="Nouveau projet" />}
      {showForm && (
        <ProjectForm orgs={orgs} onClose={() => setShowForm(false)}
          onSave={(f) => {
            const id = uid();
            setProjects((ps) => [...ps, { ...f, id }]);
            setMembers((ms) => [...ms, { projectId: id, userId: user.id, role: "chef_projet" }]);
            setShowForm(false);
          }} />
      )}
    </div>
  );
}

/* ============================================================
   RAPPORTS EXPORTABLES
   ============================================================ */
function downloadFile(filename, content, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["\ufeff" + content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function ReportsCard({ project, phases, tasks, docs, budgetLines, orgs, users, validations, audit, projectProgress, projectKpis, indicators, measures, decisions }) {
  const cur = project.currency;
  const k = projectKpis(project.id);
  const pPhases = phases.filter((p) => p.projectId === project.id);
  const pTasks = tasks.filter((t) => pPhases.some((ph) => ph.id === t.phaseId));
  const uName = (id) => users.find((u) => u.id === id)?.name || "";
  const oName = (id) => orgs.find((o) => o.id === id)?.name || "";
  const clean = (v) => String(v ?? "").replace(/;/g, ",");

  const reports = [
    {
      label: "Rapport consolidé", ext: "txt", build: () => {
        const inds = indicators.filter((i) => i.projectId === project.id);
        const decs = decisions.filter((d) => d.projectId === project.id);
        return [
          `RAPPORT CONSOLIDÉ — ${project.name}`, `Généré le ${NOW}`, "",
          "== AVANCEMENT ==",
          `Global : ${projectProgress(project.id)} % · Tâches : ${pTasks.length} (${pTasks.filter((t) => t.status === "terminee").length} terminées, ${pTasks.filter(isLate).length} en retard)`, "",
          "== BUDGET ==",
          `Prévisionnel ${fmtMoney(k.planned, cur)} · Engagé ${fmtMoney(k.engaged, cur)} · Payé ${fmtMoney(k.paid, cur)} · Valorisations ${fmtMoney(k.valorisations, cur)}`, "",
          "== VALIDATIONS ==",
          `Tâches validées : ${pTasks.filter((t) => t.review === "valide").length}/${pTasks.length} · en attente de revue/validation : ${pTasks.filter((t) => ["soumis", "en_revue"].includes(t.review)).length}`, "",
          "== IMPACT ==",
          ...inds.map((i) => {
            const v = indValue(i, measures, tasks);
            const pct = indPct(i, v);
            return `- ${i.name} : ${v} / ${i.target} ${i.unit || ""} (${pct == null ? "—" : pct + " %"})`;
          }), "",
          "== LIVRABLES ==",
          ...docs.filter((d) => d.type === "livrable" && pTasks.some((t) => t.id === d.taskId))
            .map((d) => `- ${d.filename} (${REVIEW_STATES[docReview(d, validations)].label})`), "",
          "== DÉCISIONS DE COMITÉ ==",
          ...decs.map((d) => `- ${d.text} — ${uName(d.ownerId)} — échéance ${fmtDate(d.due)} — ${DECISION_STATUS[d.status].label}`),
        ].join("\n");
      },
    },
    {
      label: "Rapport synthétique projet", ext: "txt", build: () => [
        `RAPPORT SYNTHÉTIQUE — ${project.name}`, `Généré le ${NOW}`, "",
        `Description : ${project.description}`,
        `Zone : ${project.country} / ${project.zone} · Période : ${fmtDate(project.start)} → ${fmtDate(project.end)} · Statut : ${PROJECT_STATUS[project.status].label}`,
        `Partenaires : ${project.orgs.map((po) => `${oName(po.orgId)} (${PROJECT_ROLES[po.role].label})`).join(", ")}`, "",
        `Avancement global : ${projectProgress(project.id)} %`,
        `Budget prévisionnel : ${fmtMoney(k.planned, cur)} (+ ${fmtMoney(k.valorisations, cur)} valorisations)`,
        `Engagé : ${fmtMoney(k.engaged, cur)} · Payé : ${fmtMoney(k.paid, cur)}`,
        `Reste à engager : ${fmtMoney(k.toCommit, cur)} · Reste à payer : ${fmtMoney(k.toPay, cur)}`, "",
        `Tâches : ${pTasks.length} dont ${pTasks.filter((t) => t.status === "terminee").length} terminées, ${pTasks.filter(isLate).length} en retard`,
        `Livrables remis : ${docs.filter((d) => d.type === "livrable" && pTasks.some((t) => t.id === d.taskId)).length}`,
      ].join("\n"),
    },
    {
      label: "Rapport d'avancement", ext: "csv", build: () => [
        "phase;tache;responsable;debut;fin;statut;avancement;etat_revue;en_retard",
        ...pTasks.map((t) => [
          pPhases.find((p) => p.id === t.phaseId)?.name, t.title, uName(t.assigneeId),
          t.start, t.end, TASK_STATUS[t.status].label, t.progress + "%", REVIEW_STATES[t.review || "brouillon"].label, isLate(t) ? "oui" : "non",
        ].map(clean).join(";")),
      ].join("\n"),
    },
    {
      label: "Rapport budgétaire", ext: "csv", build: () => [
        "poste;categorie;financeur;organisation;annee;previsionnel;engage;paye;reste_a_engager;reste_a_payer;valorisation;etat_revue",
        ...budgetLines.filter((l) => l.projectId === project.id).map((l) => {
          const f = lineFinance(l.id, docs, validations);
          return [l.poste, LINE_CATEGORIES[l.category]?.label, oName(l.funderOrgId), oName(l.ownerOrgId), l.year,
            l.planned, f.engaged, f.paid, (l.planned || 0) - f.engaged, f.engaged - f.paid,
            l.valorisation ? "oui" : "non", REVIEW_STATES[l.review || "brouillon"].label].map(clean).join(";");
        }),
      ].join("\n"),
    },
    {
      label: "Liste des livrables", ext: "csv", build: () => [
        "fichier;tache;depose_par;date;etat_revue",
        ...docs.filter((d) => d.type === "livrable" && (pTasks.some((t) => t.id === d.taskId) || budgetLines.some((l) => l.id === d.lineId && l.projectId === project.id)))
          .map((d) => [d.filename, pTasks.find((t) => t.id === d.taskId)?.title || "", uName(d.by), d.date, REVIEW_STATES[docReview(d, validations)].label].map(clean).join(";")),
      ].join("\n"),
    },
    {
      label: "État des validations (journal)", ext: "csv", build: () => [
        "date_heure;objet;libelle;action;par;commentaire",
        ...audit.filter((a) => a.projectId === project.id)
          .map((a) => [a.at, a.entity, a.label, ACTION_LABELS[a.action] || a.action, uName(a.by), a.comment].map(clean).join(";")),
      ].join("\n"),
    },
  ];

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <PieChart size={15} color={C.accent} />
        <h2 className="text-sm font-semibold">Rapports</h2>
      </div>
      <div className="space-y-2">
        {reports.map((r) => (
          <button key={r.label} className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left text-sm font-medium"
            style={{ borderColor: C.border }}
            onClick={() => downloadFile(`${r.label.toLowerCase().replace(/[' ]/g, "-")}.${r.ext}`, r.build(), r.ext === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8")}>
            <Download size={15} color={C.accent} />
            <span className="flex-1">{r.label}</span>
            <span className="text-xs uppercase" style={{ color: C.muted }}>.{r.ext}</span>
          </button>
        ))}
      </div>
      <p className="text-xs mt-3" style={{ color: C.muted }}>V3 : exports CSV/texte. Le PDF mis en forme arrive avec la génération serveur.</p>
    </Card>
  );
}

/* ============================================================
   VUE FINANCEUR
   ============================================================ */
function FunderView({ project, phases, tasks, docs, budgetLines, orgs, users, validations, audit, user, projectProgress, indicators, measures }) {
  const pInds = indicators.filter((i) => i.projectId === project.id);
  const cur = project.currency;
  /* Si l'organisation de l'utilisateur finance des lignes → filtre sur SES lignes, sinon tout */
  const myLines = budgetLines.filter((l) => l.projectId === project.id && l.funderOrgId === user.orgId);
  const scopeLines = myLines.length ? myLines : budgetLines.filter((l) => l.projectId === project.id);
  const scoped = myLines.length > 0;
  let planned = 0, engaged = 0, paid = 0;
  scopeLines.forEach((l) => {
    const f = lineFinance(l.id, docs, validations);
    if (!l.valorisation) planned += l.planned || 0;
    engaged += f.engaged; paid += f.paid;
  });
  const lineIds = scopeLines.map((l) => l.id);
  const expenses = docs.filter((d) => lineIds.includes(d.lineId) && (d.type === "facture" || d.type === "recu"));
  const justifs = docs.filter((d) => lineIds.includes(d.lineId));
  const pPhases = phases.filter((p) => p.projectId === project.id);
  const pTasks = tasks.filter((t) => pPhases.some((ph) => ph.id === t.phaseId));
  const livrables = docs.filter((d) => d.type === "livrable" && pTasks.some((t) => t.id === d.taskId));
  const events = audit.filter((a) => a.projectId === project.id).slice(0, 6);
  const uName = (id) => users.find((u) => u.id === id)?.name || "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs px-3.5 py-2.5 rounded-xl" style={{ backgroundColor: C.purpleSoft, color: C.purple }}>
        <Wallet size={14} />
        <span className="font-medium">
          {scoped ? `Vue filtrée sur les financements de ${orgs.find((o) => o.id === user.orgId)?.name}` : "Vue financeur — ensemble du projet"}
        </span>
      </div>

      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-semibold mb-2">Avancement global</h2>
        <ProgressBar value={projectProgress(project.id)} />
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: scoped ? "Budget lié" : "Prévisionnel", value: planned },
            { label: "Engagé", value: engaged },
            { label: "Payé", value: paid },
          ].map((s) => (
            <div key={s.label} className="rounded-lg py-2.5 px-1.5 text-center" style={{ backgroundColor: C.bg }}>
              <div className="text-xs sm:text-sm font-semibold tabular-nums" style={{ fontFamily: FONT_HEAD }}>{fmtMoney(s.value, cur)}</div>
              <div className="mt-0.5" style={{ color: C.muted, fontSize: 10 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3"><TriBar planned={planned} engaged={engaged} paid={paid} /></div>
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-semibold mb-2.5">Lignes financées</h2>
        <div className="space-y-2.5">
          {scopeLines.map((l) => {
            const f = lineFinance(l.id, docs, validations);
            return (
              <div key={l.id} className="rounded-xl border p-3" style={{ borderColor: C.border }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm flex-1 min-w-0 truncate">{l.poste}</span>
                  <ReviewBadge state={l.review} />
                </div>
                <div className="flex items-baseline justify-between text-xs mb-1" style={{ color: C.muted }}>
                  <span>Engagé <strong style={{ color: C.ink }}>{fmtMoney(f.engaged, cur)}</strong> / {fmtMoney(l.planned, cur)}</span>
                  <span>Payé {fmtMoney(f.paid, cur)}</span>
                </div>
                <TriBar planned={l.planned} engaged={f.engaged} paid={f.paid} />
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-2.5">Dépenses liées</h2>
          {expenses.length === 0 && <p className="text-sm" style={{ color: C.muted }}>Aucune dépense enregistrée.</p>}
          <ul className="space-y-2.5">
            {expenses.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-sm min-w-0">
                <Receipt size={14} color={C.muted} className="flex-shrink-0" />
                <span className="truncate flex-1">{d.filename}</span>
                <span className="text-xs font-medium tabular-nums">{fmtMoney(d.amount, cur)}</span>
                {d.paid ? <Badge label="Payée" fg={C.accent} bg={C.accentSoft} /> : <Badge label="À payer" fg={C.warn} bg={C.warnSoft} />}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-2.5">Justificatifs ({justifs.length})</h2>
          <ul className="space-y-2.5">
            {justifs.slice(0, 6).map((d) => {
              const { label, Icon } = DOC_TYPES[d.type];
              return (
                <li key={d.id} className="flex items-center gap-2 text-sm min-w-0">
                  <Icon size={14} color={C.muted} className="flex-shrink-0" />
                  <span className="truncate flex-1">{d.filename}</span>
                  <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>{label}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-semibold mb-2.5">Livrables remis</h2>
        {livrables.length === 0 && <p className="text-sm" style={{ color: C.muted }}>Aucun livrable pour l'instant.</p>}
        <ul className="space-y-2.5">
          {livrables.map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-sm min-w-0">
              <Package size={14} color={C.muted} className="flex-shrink-0" />
              <span className="truncate flex-1">{d.filename}</span>
              <span className="text-xs" style={{ color: C.muted }}>{fmtDate(d.date)}</span>
              <ReviewBadge state={docReview(d, validations)} />
            </li>
          ))}
        </ul>
      </Card>

      {pInds.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold mb-2.5">Impact</h2>
          <div className="space-y-3">
            {pInds.map((ind) => {
              const v = indValue(ind, measures, tasks);
              const pct = indPct(ind, v);
              return (
                <div key={ind.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium flex-1 min-w-0 truncate">{ind.name}</span>
                    <span className="tabular-nums text-xs" style={{ color: C.muted }}>
                      <strong style={{ color: C.ink, fontSize: 13 }}>{v}</strong> / {ind.target} {ind.unit}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: C.border }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct ?? 0)}%`, backgroundColor: (pct ?? 0) >= 100 ? C.blue : C.accent }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2.5">
          <History size={15} color={C.accent} />
          <h2 className="text-sm font-semibold">Derniers événements</h2>
        </div>
        <ul className="space-y-2.5">
          {events.map((a) => (
            <li key={a.id} className="text-sm">
              <span className="font-medium">{a.label}</span> — {ACTION_LABELS[a.action] || a.action} par {uName(a.by)}
              <div className="text-xs mt-0.5" style={{ color: C.muted }}>{a.at}{a.comment && ` · « ${a.comment} »`}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ============================================================
   JOURNAL D'AUDIT
   ============================================================ */
function AuditCard({ project, audit, users }) {
  const entries = audit.filter((a) => a.projectId === project.id);
  const uName = (id) => users.find((u) => u.id === id)?.name || "";
  const actionColor = { valide: C.accent, rejete: C.danger, soumis: C.warn, en_revue: C.blue, paye: C.purple };
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <History size={15} color={C.accent} />
        <h2 className="text-sm font-semibold">Journal d'audit</h2>
      </div>
      <p className="text-xs mb-3" style={{ color: C.muted }}>
        Toutes les soumissions, revues, validations et rejets — qui, quoi, quand. En lecture seule, jamais modifiable.
      </p>
      <div className="space-y-3">
        {entries.map((a) => (
          <div key={a.id} className="flex items-start gap-2.5 text-sm">
            <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: actionColor[a.action] || C.muted }} />
            <div className="min-w-0">
              <div className="leading-snug">
                <span className="font-medium">{a.label}</span>{" "}
                <span style={{ color: actionColor[a.action] || C.ink }}>{ACTION_LABELS[a.action] || a.action}</span> par {uName(a.by)}
              </div>
              <div className="text-xs mt-0.5" style={{ color: C.muted }}>{a.at}{a.comment && ` · « ${a.comment} »`}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ============================================================
   FORMULAIRES (tâche avec workflow, doc, ligne, phase, membre)
   ============================================================ */
function TaskForm({ users, docs, validations, currency, task, P, user, onSave, onClose, onAddDoc, onReview, onDocReview }) {
  const initial = task || null;
  const [f, setF] = useState(initial || {
    title: "", description: "", assigneeId: "", start: "", end: "",
    status: "a_faire", progress: 0, comment: "",
  });
  const canEdit = task
    ? (P.manage || (P.contribute && (task.createdBy === user.id || task.assigneeId === user.id))) && task.review !== "valide"
    : P.contribute;
  const set = (k, v) => setF({ ...f, [k]: v });
  const tDocs = task ? docs.filter((d) => d.taskId === task.id) : [];
  return (
    <Sheet title={task ? "Tâche" : "Nouvelle tâche"} onClose={onClose}>
      {task && (
        <div className="flex items-center justify-between gap-2 mb-4 pb-4 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: C.muted }}>État de revue :</span>
            <ReviewBadge state={task.review} />
          </div>
          <ReviewActions state={task.review || "brouillon"} P={P} compact
            onTransition={(to, comment) => onReview(task, to, comment)} />
        </div>
      )}
      <fieldset disabled={!canEdit} style={{ border: "none", padding: 0, margin: 0 }}>
        <div className="space-y-4">
          <Field label="Titre *"><input style={inputStyle} value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 55 }} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Responsable">
              <select style={inputStyle} value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
                <option value="">Non assignée</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Statut">
              <select style={inputStyle} value={f.status} onChange={(e) => set("status", e.target.value)}>
                {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Début"><input style={inputStyle} type="date" value={f.start} onChange={(e) => set("start", e.target.value)} /></Field>
            <Field label="Fin"><input style={inputStyle} type="date" value={f.end} onChange={(e) => set("end", e.target.value)} /></Field>
          </div>
          <Field label={`Avancement — ${f.progress}%`}>
            <input type="range" min="0" max="100" step="5" value={f.progress}
              onChange={(e) => set("progress", Number(e.target.value))} className="w-full" style={{ accentColor: C.accent, height: 28 }} />
          </Field>
        </div>
      </fieldset>
      {task && (
        <div className="mt-4">
          <span className="block text-xs font-medium mb-2" style={{ color: C.muted }}>Documents et livrables</span>
          <div className="space-y-2">
            {tDocs.map((d) => {
              const { label, Icon } = DOC_TYPES[d.type];
              const rv = docReview(d, validations);
              const reviewable = d.type !== "devis" && d.type !== "facture" && d.type !== "recu";
              return (
                <div key={d.id} className="px-3 py-2 rounded-lg space-y-1.5" style={{ backgroundColor: C.bg }}>
                  <div className="flex items-center gap-2 text-sm">
                    <Icon size={14} color={C.muted} className="flex-shrink-0" />
                    <span className="truncate flex-1 min-w-0">{d.filename}</span>
                    {d.amount != null && <span className="text-xs font-medium tabular-nums">{fmtMoney(d.amount, currency)}</span>}
                    <span className="text-xs" style={{ color: C.muted }}>{label}</span>
                    <ReviewBadge state={rv} />
                  </div>
                  {reviewable && (
                    <ReviewActions state={rv} P={P} compact onTransition={(to, comment) => onDocReview(d, to, comment)} />
                  )}
                </div>
              );
            })}
            {P.contribute && <button className="text-sm font-medium py-1" style={{ color: C.accent }} onClick={onAddDoc}>+ Ajouter un document</button>}
          </div>
        </div>
      )}
      <div className="flex gap-2 pt-4">
        <Btn variant="ghost" full onClick={onClose}>{canEdit ? "Annuler" : "Fermer"}</Btn>
        {canEdit && <Btn full disabled={!f.title} onClick={() => onSave(f)}><Check size={15} /> Enregistrer</Btn>}
      </div>
    </Sheet>
  );
}

function FinDocForm({ currency, validatorOrgs, onSave, onClose }) {
  const finTypes = ["devis", "facture", "recu", "livrable", "rapport", "etude", "photo", "justificatif", "convention", "note"];
  const [type, setType] = useState("facture");
  const [filename, setFilename] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState(false);
  const needsAmount = DOC_TYPES[type].hasAmount;
  return (
    <Sheet title="Ajouter un document" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Type de pièce">
          <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
            {finTypes.map((k) => <option key={k} value={k}>{DOC_TYPES[k].label}</option>)}
          </select>
        </Field>
        <Field label="Fichier">
          <input type="file" style={inputStyle} onChange={(e) => setFilename(e.target.files?.[0]?.name || "")} />
        </Field>
        {needsAmount && (
          <Field label={`Montant (${currency}) *`}>
            <input style={inputStyle} type="number" min="0" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        )}
        {type === "facture" && (
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="w-4 h-4" style={{ accentColor: C.accent }} />
            Facture payée
          </label>
        )}
        {type === "devis" && (
          <div className="rounded-xl p-3.5 text-xs" style={{ backgroundColor: C.warnSoft, color: C.warn }}>
            <div className="flex items-center gap-1.5 font-medium mb-1"><ShieldCheck size={13} /> Validation requise</div>
            À valider par : {validatorOrgs.map((o) => o.name).join(", ")}.
          </div>
        )}
        <div className="flex gap-2">
          <Btn variant="ghost" full onClick={onClose}>Annuler</Btn>
          <Btn full disabled={!filename || (needsAmount && !amount)}
            onClick={() => onSave({ type, filename, amount: needsAmount ? Number(amount) : null, paid: type === "facture" ? paid : type === "recu" })}>
            <Check size={15} /> Ajouter
          </Btn>
        </div>
      </div>
    </Sheet>
  );
}

function LineForm({ project, orgs, phases, initial, onSave, onClose }) {
  const projectOrgs = project.orgs.map((po) => orgs.find((o) => o.id === po.orgId)).filter(Boolean);
  const [f, setF] = useState(initial || {
    poste: "", description: "", category: "investissement",
    funderOrgId: projectOrgs.find((o) => o.type.startsWith("financeur") || o.type === "mecene")?.id || projectOrgs[0]?.id || "",
    ownerOrgId: project.leadOrgId, phaseId: "", year: 2026,
    planned: "", valorisation: false, status: "prevue", comment: "",
  });
  const set = (k, v) => setF({ ...f, [k]: v });
  const projectPhases = phases.filter((p) => p.projectId === project.id);
  return (
    <Sheet title={initial ? "Ligne budgétaire" : "Nouvelle ligne budgétaire"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Poste *"><input style={inputStyle} value={f.poste} onChange={(e) => set("poste", e.target.value)} /></Field>
        <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 50 }} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Catégorie *">
            <select style={inputStyle} value={f.category} onChange={(e) => set("category", e.target.value)}>
              {Object.entries(LINE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Année">
            <input style={inputStyle} type="number" min="2020" max="2040" value={f.year} onChange={(e) => set("year", Number(e.target.value))} />
          </Field>
          <Field label="Financeur">
            <select style={inputStyle} value={f.funderOrgId} onChange={(e) => set("funderOrgId", e.target.value)}>
              {projectOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Organisation responsable">
            <select style={inputStyle} value={f.ownerOrgId} onChange={(e) => set("ownerOrgId", e.target.value)}>
              {projectOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label={`Prévisionnel (${project.currency}) *`}>
            <input style={inputStyle} type="number" min="0" inputMode="numeric" value={f.planned} onChange={(e) => set("planned", e.target.value)} />
          </Field>
          <Field label="Statut">
            <select style={inputStyle} value={f.status} onChange={(e) => set("status", e.target.value)}>
              {Object.entries(LINE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Phase rattachée (optionnel)">
          <select style={inputStyle} value={f.phaseId || ""} onChange={(e) => set("phaseId", e.target.value || null)}>
            <option value="">— Aucune —</option>
            {projectPhases.map((ph) => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={f.valorisation} onChange={(e) => set("valorisation", e.target.checked)} className="w-4 h-4" style={{ accentColor: C.accent }} />
          Valorisation (contribution en nature)
        </label>
        <div className="flex gap-2">
          <Btn variant="ghost" full onClick={onClose}>Annuler</Btn>
          <Btn full disabled={!f.poste || f.planned === ""} onClick={() => onSave({ ...f, planned: Number(f.planned) })}>
            <Check size={15} /> Enregistrer
          </Btn>
        </div>
      </div>
    </Sheet>
  );
}

function MemberForm({ users, existing, onSave, onClose }) {
  const available = users.filter((u) => !existing.includes(u.id));
  const [userId, setUserId] = useState(available[0]?.id || "");
  const [role, setRole] = useState("contributeur");
  return (
    <Sheet title="Ajouter un membre" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Utilisateur">
          <select style={inputStyle} value={userId} onChange={(e) => setUserId(e.target.value)}>
            {available.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
          </select>
        </Field>
        <Field label="Profil d'accès sur ce projet">
          <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)}>
            {Object.entries(ACCESS_ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <div className="text-xs space-y-1 rounded-xl p-3.5" style={{ backgroundColor: C.bg, color: C.muted }}>
          <p><strong style={{ color: C.ink }}>Comité</strong> : tout gérer ; vérifie les soumissions (étape « en revue »).</p>
          <p><strong style={{ color: C.ink }}>Resp. financier</strong> : lignes, justificatifs, paiements, exports.</p>
          <p><strong style={{ color: C.ink }}>Terrain</strong> : tâches, pièces, soumissions.</p>
          <p><strong style={{ color: C.ink }}>Validateur</strong> : validation finale des éléments en revue + devis.</p>
          <p><strong style={{ color: C.ink }}>Auditeur</strong> : lecture seule intégrale + journal d'audit.</p>
          <p><strong style={{ color: C.ink }}>Lecteur</strong> : consultation.</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" full onClick={onClose}>Annuler</Btn>
          <Btn full disabled={!userId} onClick={() => onSave({ userId, role })}><Check size={15} /> Ajouter</Btn>
        </div>
      </div>
    </Sheet>
  );
}

/* ============================================================
   MODULE BUDGET (avec revue des lignes)
   ============================================================ */
function BudgetModule({ project, budgetLines, orgs, phases, docs, validations, P, setBudgetLines, setDocs, setValidations, user, validatorOrgs, log }) {
  const [view, setView] = useState("lignes");
  const [lineModal, setLineModal] = useState(null);
  const [docModal, setDocModal] = useState(null);
  const [openLine, setOpenLine] = useState(null);
  const cur = project.currency;
  const lines = budgetLines.filter((l) => l.projectId === project.id);

  let planned = 0, valorisations = 0, engaged = 0, paid = 0;
  const enriched = lines.map((l) => {
    const f = lineFinance(l.id, docs, validations);
    if (l.valorisation) valorisations += l.planned || 0; else planned += l.planned || 0;
    engaged += f.engaged; paid += f.paid;
    return { ...l, ...f };
  });

  const VIEWS = { lignes: "Lignes", category: "Catégorie", funder: "Financeur", year: "Année", owner: "Organisation" };
  const groupKey = { category: (l) => l.category, funder: (l) => l.funderOrgId, year: (l) => String(l.year), owner: (l) => l.ownerOrgId }[view];
  const groupLabel = {
    category: (k) => LINE_CATEGORIES[k]?.label || k,
    funder: (k) => orgs.find((o) => o.id === k)?.name || "—",
    year: (k) => k,
    owner: (k) => orgs.find((o) => o.id === k)?.name || "—",
  }[view];
  const groups = useMemo(() => {
    if (view === "lignes") return null;
    const map = {};
    enriched.forEach((l) => {
      const k = groupKey(l) || "—";
      if (!map[k]) map[k] = { planned: 0, valorisations: 0, engaged: 0, paid: 0, count: 0 };
      if (l.valorisation) map[k].valorisations += l.planned || 0; else map[k].planned += l.planned || 0;
      map[k].engaged += l.engaged; map[k].paid += l.paid; map[k].count++;
    });
    return Object.entries(map).sort((a, b) => (b[1].planned + b[1].valorisations) - (a[1].planned + a[1].valorisations));
  }, [view, enriched]);

  const lineReview = (l, to, comment) => {
    setBudgetLines((ls) => ls.map((x) => x.id === l.id ? { ...x, review: to } : x));
    log(project.id, "ligne", l.id, `Ligne ${l.poste}`, to, comment);
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet size={15} color={C.accent} />
          <h2 className="text-sm font-semibold">Budget détaillé</h2>
        </div>
        {P.finance && <button className="text-sm font-medium" style={{ color: C.accent }} onClick={() => setLineModal(true)}>+ Ligne</button>}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        {[
          { label: "Prévisionnel", value: planned },
          { label: "Engagé", value: engaged },
          { label: "Payé", value: paid },
          { label: "Reste à engager", value: planned - engaged, warn: planned - engaged < 0 },
          { label: "Reste à payer", value: engaged - paid },
          { label: "Valorisations", value: valorisations },
        ].map((s) => (
          <div key={s.label} className="rounded-lg py-2 px-1.5 text-center" style={{ backgroundColor: C.bg }}>
            <div className="text-xs sm:text-sm font-semibold tabular-nums leading-tight" style={{ fontFamily: FONT_HEAD, color: s.warn ? C.danger : C.ink }}>
              {fmtMoney(s.value, cur)}
            </div>
            <div className="mt-0.5 leading-tight" style={{ color: C.muted, fontSize: 10 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
        {Object.entries(VIEWS).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)}
            className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0"
            style={{
              backgroundColor: view === k ? C.accentSoft : "transparent",
              color: view === k ? C.accent : C.muted,
              border: `1px solid ${view === k ? C.accent : C.border}`,
            }}>
            {label}
          </button>
        ))}
      </div>

      {view === "lignes" && (
        <div className="space-y-2.5">
          {enriched.map((l) => {
            const lDocs = docs.filter((d) => d.lineId === l.id);
            const open = openLine === l.id;
            return (
              <div key={l.id} className="rounded-xl border" style={{ borderColor: C.border }}>
                <button className="w-full p-3.5 text-left" onClick={() => setOpenLine(open ? null : l.id)}>
                  <div className="flex items-center gap-2">
                    {open ? <ChevronDown size={15} color={C.muted} className="flex-shrink-0" /> : <ChevronRight size={15} color={C.muted} className="flex-shrink-0" />}
                    <span className="font-medium text-sm flex-1 min-w-0 truncate">{l.poste}</span>
                    <ReviewBadge state={l.review} />
                    <Badge {...LINE_CATEGORIES[l.category]} />
                  </div>
                  <div className="ml-6 mt-2">
                    <div className="flex items-baseline justify-between text-xs mb-1" style={{ color: C.muted }}>
                      <span>Engagé <strong style={{ color: C.ink }}>{fmtMoney(l.engaged, cur)}</strong> / {fmtMoney(l.planned, cur)}</span>
                      <span>Payé {fmtMoney(l.paid, cur)}</span>
                    </div>
                    <TriBar planned={l.planned} engaged={l.engaged} paid={l.paid} />
                  </div>
                </button>
                {open && (
                  <div className="border-t px-3.5 pb-3.5 pt-3 space-y-3" style={{ borderColor: C.border }}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: C.muted }}>
                      <span>Financeur : {orgs.find((o) => o.id === l.funderOrgId)?.name}</span>
                      <span>·</span><span>Resp. : {orgs.find((o) => o.id === l.ownerOrgId)?.name}</span>
                      <span>·</span><span>{l.year}</span>
                      {l.valorisation && <Badge label="Valorisation" fg={C.purple} bg={C.purpleSoft} />}
                    </div>
                    <ReviewActions state={l.review || "brouillon"} P={P} compact
                      onTransition={(to, comment) => lineReview(l, to, comment)} />
                    <div>
                      <span className="block text-xs font-medium mb-1.5" style={{ color: C.muted }}>Justificatifs ({lDocs.length})</span>
                      <div className="space-y-1.5">
                        {lDocs.map((d) => {
                          const { label, Icon } = DOC_TYPES[d.type];
                          const state = d.type === "devis" ? devisState(d.id, validations) : null;
                          return (
                            <div key={d.id} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: C.bg }}>
                              <Icon size={14} color={C.muted} className="flex-shrink-0" />
                              <span className="truncate flex-1 min-w-0 text-xs sm:text-sm">{d.filename}</span>
                              {d.amount != null && <span className="text-xs font-medium tabular-nums">{fmtMoney(d.amount, cur)}</span>}
                              {state && <Badge {...DEVIS_STATE[state]} />}
                              {d.type === "facture" && (d.paid
                                ? <Badge label="Payée" fg={C.accent} bg={C.accentSoft} />
                                : P.finance
                                  ? <button className="text-xs font-medium" style={{ color: C.accent }}
                                      onClick={() => { setDocs((ds) => ds.map((x) => x.id === d.id ? { ...x, paid: true } : x)); log(project.id, "document", d.id, `Facture ${d.filename}`, "paye"); }}>
                                      Marquer payée
                                    </button>
                                  : <Badge label="À payer" fg={C.warn} bg={C.warnSoft} />)}
                              {!state && d.type !== "facture" && <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>{label}</span>}
                            </div>
                          );
                        })}
                        {(P.finance || P.contribute) && (
                          <button className="text-sm font-medium py-0.5" style={{ color: C.accent }} onClick={() => setDocModal(l.id)}>+ Justificatif</button>
                        )}
                      </div>
                    </div>
                    {P.finance && <Btn variant="ghost" small onClick={() => setLineModal({ line: l })}>Modifier la ligne</Btn>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view !== "lignes" && groups && (
        <div className="space-y-3">
          {groups.map(([k, g]) => (
            <div key={k} className="rounded-xl border p-3.5" style={{ borderColor: C.border }}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-medium text-sm truncate">{groupLabel(k)}</span>
                <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>{g.count} ligne{g.count > 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-baseline justify-between text-xs mb-1" style={{ color: C.muted }}>
                <span>Engagé <strong style={{ color: C.ink }}>{fmtMoney(g.engaged, cur)}</strong> / {fmtMoney(g.planned, cur)}</span>
                <span>Payé {fmtMoney(g.paid, cur)}</span>
              </div>
              <TriBar planned={g.planned} engaged={g.engaged} paid={g.paid} />
              {g.valorisations > 0 && <p className="text-xs mt-1.5" style={{ color: C.purple }}>+ {fmtMoney(g.valorisations, cur)} de valorisations</p>}
            </div>
          ))}
        </div>
      )}

      {lineModal && P.finance && (
        <LineForm project={project} orgs={orgs} phases={phases} initial={lineModal.line || null}
          onClose={() => setLineModal(null)}
          onSave={(f) => {
            if (lineModal.line) {
              setBudgetLines((ls) => ls.map((x) => x.id === lineModal.line.id ? { ...x, ...f } : x));
              log(project.id, "ligne", lineModal.line.id, `Ligne ${f.poste}`, "modifie");
            } else {
              const id = uid();
              setBudgetLines((ls) => [...ls, { ...f, id, projectId: project.id, review: "brouillon" }]);
              log(project.id, "ligne", id, `Ligne ${f.poste}`, "cree");
            }
            setLineModal(null);
          }} />
      )}
      {docModal && (
        <FinDocForm currency={cur} validatorOrgs={validatorOrgs}
          onClose={() => setDocModal(null)}
          onSave={({ type, filename, amount, paid }) => {
            const docId = uid();
            setDocs((ds) => [...ds, { id: docId, taskId: null, lineId: docModal, type, filename, amount, paid, by: user.id, date: TODAY, review: "brouillon" }]);
            log(project.id, "document", docId, `${DOC_TYPES[type].label} ${filename}`, "cree");
            if (type === "devis") {
              setValidations((vs) => [...vs, ...validatorOrgs.map((o) => ({
                id: uid(), docId, orgId: o.id, role: o.role, decision: "en_attente", date: "", comment: "",
              }))]);
            }
            setDocModal(null);
          }} />
      )}
    </Card>
  );
}

/* ============================================================
   DÉTAIL PROJET — 3 onglets : Suivi / Budget / Vue financeur
   ============================================================ */
function ProjectDetail({ projectId, allProjects, orgs, members, phases, tasks, docs, budgetLines, users, validations, audit, indicators, measures, meetings, decisions, setIndicators, setMeasures, setMeetings, setDecisions, user, perms, log, setPhases, setTasks, setDocs, setBudgetLines, setValidations, setProjects, setMembers, projectProgress, projectKpis, back }) {
  const project = allProjects.find((p) => p.id === projectId);
  const projectPhases = phases.filter((p) => p.projectId === projectId);
  const [tab, setTab] = useState("suivi");
  const [openPhases, setOpenPhases] = useState(() => new Set(projectPhases.map((p) => p.id)));
  const [taskModal, setTaskModal] = useState(null);
  const [docModal, setDocModal] = useState(null);
  const [phaseName, setPhaseName] = useState(null);
  const [memberModal, setMemberModal] = useState(false);
  const [editProject, setEditProject] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [rejectComment, setRejectComment] = useState("");

  if (!project) return null;
  const P = perms(project.id);
  const projectMembers = members.filter((m) => m.projectId === project.id);
  const togglePhase = (id) => setOpenPhases((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const phaseProgress = (phId) => {
    const ts = tasks.filter((t) => t.phaseId === phId);
    return ts.length ? Math.round(ts.reduce((s, t) => s + t.progress, 0) / ts.length) : 0;
  };

  const validatorOrgs = project.orgs
    .filter((po) => (project.validationRoles || []).includes(po.role))
    .map((po) => ({ ...orgs.find((o) => o.id === po.orgId), role: po.role }));

  const projectLineIds = budgetLines.filter((l) => l.projectId === projectId).map((l) => l.id);
  const projectTaskIds = tasks.filter((t) => projectPhases.some((ph) => ph.id === t.phaseId)).map((t) => t.id);
  const projectDevis = docs.filter((d) => d.type === "devis" && (projectTaskIds.includes(d.taskId) || projectLineIds.includes(d.lineId)));

  const decide = (validationId, decision, comment = "") => {
    setValidations((vs) => vs.map((v) => v.id === validationId ? { ...v, decision, date: TODAY, comment } : v));
    const v = validations.find((x) => x.id === validationId);
    const d = docs.find((x) => x.id === v?.docId);
    if (d) log(project.id, "document", d.id, `Devis ${d.filename}`, decision === "valide" ? "valide" : "rejete", comment);
  };
  const taskReview = (t, to, comment) => {
    setTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, review: to } : x));
    log(project.id, "tache", t.id, `Tâche ${t.title}`, to, comment);
  };
  const docReviewAction = (d, to, comment) => {
    setDocs((ds) => ds.map((x) => x.id === d.id ? { ...x, review: to } : x));
    log(project.id, "document", d.id, `${DOC_TYPES[d.type].label} ${d.filename}`, to, comment);
  };

  const TABS = [["suivi", "Suivi"], ["budget", "Budget"], ["impact", "Impact"], ["copil", "Copil"], ["financeur", "Financeur"]];
  const kpiHelpers = { projectProgress, projectKpis };

  return (
    <div className="space-y-4">
      <button onClick={back} className="inline-flex items-center gap-1 text-sm font-medium py-1" style={{ color: C.accent }}>
        <ChevronLeft size={16} /> Projets
      </button>

      <div className="flex items-center gap-2 text-xs px-3.5 py-2.5 rounded-xl"
        style={{ backgroundColor: P.role ? ACCESS_ROLES[P.role].bg : "#EEF0EE", color: P.role ? ACCESS_ROLES[P.role].fg : C.muted }}>
        {P.manage ? <ShieldCheck size={14} /> : P.validate ? <BadgeCheck size={14} /> : P.audit ? <History size={14} /> : P.finance ? <Wallet size={14} /> : P.contribute ? <Users size={14} /> : <Eye size={14} />}
        <span className="font-medium">{P.role ? `Votre accès : ${ACCESS_ROLES[P.role].label}` : "Consultation via votre organisation"}</span>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-semibold leading-snug" style={{ fontFamily: FONT_HEAD }}>{project.name}</h1>
          {P.manage && <button className="text-sm font-medium flex-shrink-0" style={{ color: C.accent }} onClick={() => setEditProject(true)}>Modifier</button>}
        </div>
        <p className="text-sm mt-1.5" style={{ color: C.muted }}>{project.description}</p>
        <div className="text-xs mt-2" style={{ color: C.muted }}>
          {project.country} · {project.zone} · {fmtDate(project.start)} → {fmtDate(project.end)}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Badge {...PROJECT_STATUS[project.status]} />
          <ProgressBar value={projectProgress(project.id)} />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t" style={{ borderColor: C.border }}>
          {project.orgs.map((po) => (
            <Badge key={po.orgId} label={`${orgs.find((o) => o.id === po.orgId)?.name} · ${PROJECT_ROLES[po.role].label}`} {...PROJECT_ROLES[po.role]} />
          ))}
        </div>
      </Card>

      <div className="flex rounded-xl p-1 overflow-x-auto" style={{ backgroundColor: "#EAEDEA" }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className="flex-1 min-w-max px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap"
            style={{ backgroundColor: tab === k ? C.surface : "transparent", color: tab === k ? C.ink : C.muted, boxShadow: tab === k ? "0 1px 2px rgba(0,0,0,.06)" : "none" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ===== VUE FINANCEUR ===== */}
      {tab === "financeur" && (
        <>
          <FunderView project={project} phases={phases} tasks={tasks} docs={docs} budgetLines={budgetLines}
            orgs={orgs} users={users} validations={validations} audit={audit} user={user} projectProgress={projectProgress}
            indicators={indicators} measures={measures} />
          <ReportsCard project={project} phases={phases} tasks={tasks} docs={docs} budgetLines={budgetLines}
            orgs={orgs} users={users} validations={validations} audit={audit} {...kpiHelpers}
            indicators={indicators} measures={measures} decisions={decisions} />
        </>
      )}

      {/* ===== IMPACT ===== */}
      {tab === "impact" && (
        <ImpactTab project={project} indicators={indicators} measures={measures} tasks={tasks} phases={phases}
          P={P} user={user} setIndicators={setIndicators} setMeasures={setMeasures} log={log} />
      )}

      {/* ===== COPIL ===== */}
      {tab === "copil" && (
        <CopilTab project={project} meetings={meetings} decisions={decisions} users={users}
          P={P} user={user} setMeetings={setMeetings} setDecisions={setDecisions} log={log} />
      )}

      {/* ===== BUDGET ===== */}
      {tab === "budget" && (
        <>
          <BudgetModule project={project} budgetLines={budgetLines} orgs={orgs} phases={phases}
            docs={docs} validations={validations} P={P} user={user} validatorOrgs={validatorOrgs} log={log}
            setBudgetLines={setBudgetLines} setDocs={setDocs} setValidations={setValidations} />

          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck size={15} color={C.accent} />
              <h2 className="text-sm font-semibold">Validation des devis (dépenses)</h2>
            </div>
            <p className="text-xs mb-3" style={{ color: C.muted }}>
              Circuit multi-organisations : {validatorOrgs.map((o) => `${o.name} (${PROJECT_ROLES[o.role].label})`).join(" et ")}.
            </p>
            <div className="space-y-3">
              {projectDevis.map((d) => {
                const state = devisState(d.id, validations);
                const dVals = validations.filter((v) => v.docId === d.id);
                const task = tasks.find((t) => t.id === d.taskId);
                const line = budgetLines.find((l) => l.id === d.lineId);
                return (
                  <div key={d.id} className="rounded-xl border p-3.5" style={{ borderColor: C.border }}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-medium text-sm flex-1 min-w-40 truncate">{d.filename}</span>
                      <span className="text-sm font-semibold tabular-nums">{fmtMoney(d.amount, project.currency)}</span>
                      <Badge {...DEVIS_STATE[state]} />
                    </div>
                    <div className="text-xs mt-1" style={{ color: C.muted }}>
                      {line ? `Ligne : ${line.poste}` : task ? `Tâche : ${task.title}` : ""} · déposé par {users.find((u) => u.id === d.by)?.name}
                    </div>
                    <div className="mt-2.5 space-y-2">
                      {dVals.map((v) => {
                        const org = orgs.find((o) => o.id === v.orgId);
                        const canDecide = v.decision === "en_attente" && v.orgId === user.orgId && !P.audit;
                        return (
                          <div key={v.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="flex-1 min-w-32">{org?.name} <span className="text-xs" style={{ color: C.muted }}>({PROJECT_ROLES[v.role].label})</span></span>
                            {v.decision === "valide" && <span className="text-xs font-medium" style={{ color: C.accent }}>✓ Validé le {fmtDate(v.date)}</span>}
                            {v.decision === "refuse" && <span className="text-xs font-medium" style={{ color: C.danger }}>✕ Refusé{v.comment ? ` — ${v.comment}` : ""}</span>}
                            {v.decision === "en_attente" && canDecide && (
                              <div className="flex gap-1.5">
                                <Btn small onClick={() => decide(v.id, "valide")}><Check size={13} /> Valider</Btn>
                                <Btn small variant="danger" onClick={() => { setRejecting(v.id); setRejectComment(""); }}><ThumbsDown size={13} /> Refuser</Btn>
                              </div>
                            )}
                            {v.decision === "en_attente" && !canDecide && <span className="text-xs" style={{ color: C.warn }}>En attente</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <AuditCard project={project} audit={audit} users={users} />
        </>
      )}

      {/* ===== SUIVI ===== */}
      {tab === "suivi" && (
        <>
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users size={15} color={C.accent} />
                <h2 className="text-sm font-semibold">Membres et accès</h2>
              </div>
              {P.manage && <button className="text-sm font-medium" style={{ color: C.accent }} onClick={() => setMemberModal(true)}>+ Membre</button>}
            </div>
            <div className="space-y-2.5">
              {projectMembers.map((m) => {
                const u = users.find((x) => x.id === m.userId);
                const org = orgs.find((o) => o.id === u?.orgId);
                return (
                  <div key={m.userId} className="flex items-center gap-3 text-sm">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: C.accentSoft, color: C.accent }}>
                      {u?.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{u?.name}</div>
                      <div className="text-xs truncate" style={{ color: C.muted }}>{org?.name}</div>
                    </div>
                    {P.manage ? (
                      <select value={m.role}
                        onChange={(e) => setMembers((ms) => ms.map((x) => x.projectId === project.id && x.userId === m.userId ? { ...x, role: e.target.value } : x))}
                        className="text-xs rounded-lg outline-none flex-shrink-0"
                        style={{ border: `1px solid ${C.border}`, padding: "6px 8px", color: C.ink, backgroundColor: C.surface }}>
                        {Object.entries(ACCESS_ROLES).map(([k, v]) => <option key={k} value={k}>{v.short}</option>)}
                      </select>
                    ) : (
                      <Badge {...ACCESS_ROLES[m.role]} label={ACCESS_ROLES[m.role].short} />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide" style={{ color: C.muted }}>PHASES ET TÂCHES</h2>
            {P.manage && <button className="text-sm font-medium py-1" style={{ color: C.accent }} onClick={() => setPhaseName("")}>+ Phase</button>}
          </div>

          <div className="space-y-2.5">
            {projectPhases.map((ph) => {
              const phTasks = tasks.filter((t) => t.phaseId === ph.id);
              const open = openPhases.has(ph.id);
              return (
                <Card key={ph.id}>
                  <button className="w-full p-4 text-left" onClick={() => togglePhase(ph.id)}>
                    <div className="flex items-center gap-2.5">
                      {open ? <ChevronDown size={16} color={C.muted} className="flex-shrink-0" /> : <ChevronRight size={16} color={C.muted} className="flex-shrink-0" />}
                      <span className="font-medium text-sm flex-1 min-w-0 truncate">{ph.name}</span>
                      <div className="w-24 sm:w-32 flex-shrink-0"><ProgressBar value={phaseProgress(ph.id)} /></div>
                    </div>
                  </button>
                  {open && (
                    <div className="border-t px-4 pb-4" style={{ borderColor: C.border }}>
                      {phTasks.map((t) => {
                        const late = isLate(t);
                        return (
                          <button key={t.id} className="w-full text-left py-3 border-b last:border-b-0"
                            style={{ borderColor: C.border }} onClick={() => setTaskModal({ phaseId: ph.id, task: t })}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-sm leading-snug flex-1 min-w-0">{t.title}</span>
                              <ReviewBadge state={t.review} />
                              <Badge {...TASK_STATUS[t.status]} />
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>
                                {users.find((u) => u.id === t.assigneeId)?.name || "Non assignée"}
                              </span>
                              <ProgressBar value={t.progress} />
                            </div>
                            {late && <div className="text-xs font-medium mt-1.5" style={{ color: C.warn }}>⚠ En retard · {fmtDate(t.end)}</div>}
                          </button>
                        );
                      })}
                      {P.contribute && (
                        <div className="pt-3">
                          <button className="text-sm font-medium py-1" style={{ color: C.accent }} onClick={() => setTaskModal({ phaseId: ph.id })}>+ Tâche</button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* MODALES */}
      {phaseName !== null && P.manage && (
        <Sheet title="Nouvelle phase" onClose={() => setPhaseName(null)}>
          <div className="space-y-4">
            <Field label="Nom de la phase *">
              <input style={inputStyle} value={phaseName} onChange={(e) => setPhaseName(e.target.value)} autoFocus />
            </Field>
            <div className="flex gap-2">
              <Btn variant="ghost" full onClick={() => setPhaseName(null)}>Annuler</Btn>
              <Btn full disabled={!phaseName.trim()} onClick={() => {
                setPhases((ps) => [...ps, { id: uid(), projectId, name: phaseName.trim(), budget: null, start: "", end: "", status: "a_venir" }]);
                setPhaseName(null);
              }}><Check size={15} /> Créer</Btn>
            </div>
          </div>
        </Sheet>
      )}
      {editProject && P.manage && (
        <ProjectForm orgs={orgs} initial={{ ...project, orgs: project.orgs.filter((x) => x.role !== "porteur") }}
          onClose={() => setEditProject(false)}
          onSave={(f) => { setProjects((ps) => ps.map((p) => p.id === project.id ? { ...p, ...f } : p)); setEditProject(false); }} />
      )}
      {memberModal && P.manage && (
        <MemberForm users={users} existing={projectMembers.map((m) => m.userId)}
          onClose={() => setMemberModal(false)}
          onSave={({ userId, role }) => { setMembers((ms) => [...ms, { projectId: project.id, userId, role }]); setMemberModal(false); }} />
      )}
      {taskModal && (
        <TaskForm users={users} docs={docs} validations={validations} currency={project.currency}
          task={taskModal.task || null} P={P} user={user}
          onClose={() => setTaskModal(null)}
          onAddDoc={() => setDocModal(taskModal.task.id)}
          onReview={(t, to, comment) => { taskReview(t, to, comment); setTaskModal(null); }}
          onDocReview={(d, to, comment) => { docReviewAction(d, to, comment); }}
          onSave={(f) => {
            if (taskModal.task) {
              setTasks((ts) => ts.map((t) => t.id === taskModal.task.id ? { ...t, ...f } : t));
              log(project.id, "tache", taskModal.task.id, `Tâche ${f.title}`, "modifie");
            } else {
              const id = uid();
              setTasks((ts) => [...ts, { ...f, id, phaseId: taskModal.phaseId, createdBy: user.id, review: "brouillon" }]);
              log(project.id, "tache", id, `Tâche ${f.title}`, "cree");
            }
            setTaskModal(null);
          }} />
      )}
      {docModal && P.contribute && (
        <FinDocForm currency={project.currency} validatorOrgs={validatorOrgs}
          onClose={() => setDocModal(null)}
          onSave={({ type, filename, amount, paid }) => {
            const docId = uid();
            setDocs((ds) => [...ds, { id: docId, taskId: docModal, lineId: null, type, filename, amount, paid, by: user.id, date: TODAY, review: "brouillon" }]);
            log(project.id, "document", docId, `${DOC_TYPES[type].label} ${filename}`, "cree");
            if (type === "devis") {
              setValidations((vs) => [...vs, ...validatorOrgs.map((o) => ({
                id: uid(), docId, orgId: o.id, role: o.role, decision: "en_attente", date: "", comment: "",
              }))]);
            }
            setDocModal(null);
          }} />
      )}
      {rejecting && (
        <Sheet title="Refuser le devis" onClose={() => setRejecting(null)}>
          <div className="space-y-4">
            <Field label="Motif du refus">
              <textarea style={{ ...inputStyle, minHeight: 70 }} value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)} autoFocus />
            </Field>
            <div className="flex gap-2">
              <Btn variant="ghost" full onClick={() => setRejecting(null)}>Annuler</Btn>
              <Btn full onClick={() => { decide(rejecting, "refuse", rejectComment.trim()); setRejecting(null); }}>
                <ThumbsDown size={14} /> Confirmer le refus
              </Btn>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ============================================================
   ORGANISATIONS
   ============================================================ */
function Organizations({ orgs, user, setOrgs }) {
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({ name: "", type: "association", country: "", email: "", status: "active" });
  const canCreate = user.isOrgAdmin;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ fontFamily: FONT_HEAD }}>Organisations</h1>
        {canCreate && <div className="hidden lg:block"><Btn onClick={() => setShowForm(true)}><Plus size={15} /> Nouvelle organisation</Btn></div>}
      </div>
      <div className="space-y-2.5">
        {orgs.map((o) => (
          <Card key={o.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">{o.name}</div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>{ORG_TYPES[o.type]} · {o.country}</div>
                <div className="text-xs mt-0.5 truncate" style={{ color: C.muted }}>{o.email}</div>
              </div>
              <Badge label={o.status === "active" ? "Active" : "Inactive"}
                fg={o.status === "active" ? C.accent : C.muted} bg={o.status === "active" ? C.accentSoft : "#EEF0EE"} />
            </div>
          </Card>
        ))}
      </div>
      {canCreate && <Fab onClick={() => setShowForm(true)} label="Nouvelle organisation" />}
      {showForm && (
        <Sheet title="Nouvelle organisation" onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <Field label="Nom *"><input style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select style={inputStyle} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                  {Object.entries(ORG_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Pays"><input style={inputStyle} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></Field>
            </div>
            <Field label="Email"><input style={inputStyle} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <div className="flex gap-2">
              <Btn variant="ghost" full onClick={() => setShowForm(false)}>Annuler</Btn>
              <Btn full disabled={!f.name} onClick={() => {
                setOrgs((os) => [...os, { ...f, id: uid() }]);
                setF({ name: "", type: "association", country: "", email: "", status: "active" });
                setShowForm(false);
              }}><Check size={15} /> Créer</Btn>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ============================================================
   IMPORT
   ============================================================ */
const IMPORT_SPECS = {
  projets: {
    label: "Projets",
    required: ["nom", "organisation_porteuse"],
    optional: ["description", "pays", "zone", "date_debut", "date_fin", "statut", "budget", "devise"],
    example: "nom;description;pays;zone;date_debut;date_fin;statut;organisation_porteuse;budget;devise\nÉcoles de Ségou;Construction de 3 salles;Mali;Ségou;2026-09-01;2027-08-31;en_preparation;Eau & Avenir;120000;EUR",
  },
  phases: {
    label: "Phases",
    required: ["projet", "phase"],
    optional: ["date_debut", "date_fin", "statut", "budget"],
    example: "projet;phase;date_debut;date_fin;statut;budget\nAccès à l'eau — Région de Kayes;Réception des ouvrages;2027-01-01;2027-03-31;a_venir;15000",
  },
  taches: {
    label: "Tâches",
    required: ["projet", "phase", "titre"],
    optional: ["description", "responsable_email", "date_debut", "date_fin", "statut", "avancement", "commentaire"],
    example: "projet;phase;titre;description;responsable_email;date_debut;date_fin;statut;avancement;commentaire\nAccès à l'eau — Région de Kayes;Travaux de forage;Forage village de Lakamané;;a.diallo@sahelsante.org;2026-08-01;2026-09-30;a_faire;0;",
  },
  indicateurs: {
    label: "Indicateurs",
    required: ["projet", "nom", "type", "cible"],
    optional: ["unite", "periodicite", "valeur_initiale", "source", "phase"],
    example: "projet;nom;type;cible;unite;periodicite;valeur_initiale;source;phase\nAppui santé municipal — Jdeideh (Liban);Dépistages diabète réalisés;quantitatif;500;dépistages;mensuel;0;manuelle;",
  },
  resultats: {
    label: "Résultats",
    required: ["projet", "indicateur", "periode", "valeur"],
    optional: ["commentaire"],
    example: "projet;indicateur;periode;valeur;commentaire\nAppui santé municipal — Jdeideh (Liban);Consultations médicales réalisées;2026-07;390;",
  },
  budget: {
    label: "Budget",
    required: ["projet", "poste", "categorie", "montant_previsionnel"],
    optional: ["description", "financeur", "organisation_responsable", "phase", "annee", "valorisation", "statut", "commentaire"],
    example: "projet;poste;categorie;montant_previsionnel;description;financeur;organisation_responsable;phase;annee;valorisation;statut;commentaire\nAccès à l'eau — Région de Kayes;Pompes manuelles;investissement;18000;Fourniture et pose;AFD;Sahel Santé;Travaux de forage;2026;non;prevue;",
  },
};

function ImportPage({ allProjects, orgs, phases, users, user, accessRole, indicators, setProjects, setMembers, setPhases, setTasks, setBudgetLines, setIndicators, setMeasures }) {
  const [type, setType] = useState("projets");
  const [rows, setRows] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [done, setDone] = useState(null);
  const spec = IMPORT_SPECS[type];
  const projects = allProjects;

  const canImportRow = (r) => {
    if (type === "projets") return user.isOrgAdmin;
    const proj = projects.find((p) => p.name === (r.projet || "").trim());
    if (!proj) return true;
    const role = accessRole(proj.id);
    if (type === "phases") return role === "chef_projet";
    if (type === "budget" || type === "indicateurs" || type === "resultats") return role === "chef_projet" || role === "resp_financier";
    return ["chef_projet", "contributeur", "resp_financier"].includes(role);
  };

  const parse = (text) => {
    const res = Papa.parse(text.trim(), { header: true, delimiter: "", skipEmptyLines: true });
    setHeaders(res.meta.fields || []);
    setRows(res.data);
    setDone(null);
  };

  const missingCols = spec.required.filter((c) => !headers.includes(c));

  const validateRow = (r) => {
    const errors = [];
    spec.required.forEach((c) => { if (!r[c]?.trim()) errors.push(`« ${c} » manquant`); });
    if (type === "projets" && r.organisation_porteuse && !orgs.find((o) => o.name === r.organisation_porteuse.trim()))
      errors.push("organisation porteuse inconnue");
    if (type !== "projets" && r.projet && !projects.find((p) => p.name === r.projet.trim()))
      errors.push("projet inconnu");
    if (type === "taches" && r.projet && r.phase) {
      const proj = projects.find((p) => p.name === r.projet.trim());
      if (proj && !phases.find((ph) => ph.projectId === proj.id && ph.name === r.phase.trim()))
        errors.push("phase inconnue dans ce projet");
    }
    if (type === "budget") {
      if (r.categorie && !LINE_CATEGORIES[r.categorie.trim()]) errors.push("catégorie inconnue");
      if (r.montant_previsionnel && isNaN(Number(r.montant_previsionnel))) errors.push("montant invalide");
      if (r.financeur && !orgs.find((o) => o.name === r.financeur.trim())) errors.push("financeur inconnu");
    }
    if (type === "indicateurs") {
      if (r.type && !["quantitatif", "qualitatif"].includes(r.type.trim())) errors.push("type inconnu (quantitatif|qualitatif)");
      if (r.cible && isNaN(Number(r.cible))) errors.push("cible invalide");
    }
    if (type === "resultats") {
      const proj = projects.find((x) => x.name === (r.projet || "").trim());
      if (proj && r.indicateur && !indicators.find((i) => i.projectId === proj.id && i.name === r.indicateur.trim()))
        errors.push("indicateur inconnu dans ce projet");
      if (r.valeur && isNaN(Number(r.valeur))) errors.push("valeur invalide");
    }
    if (r.budget && isNaN(Number(r.budget))) errors.push("budget invalide");
    if (!canImportRow(r)) errors.push("droits insuffisants sur ce projet");
    return errors;
  };

  const validated = useMemo(() => rows ? rows.map((r) => ({ row: r, errors: validateRow(r) })) : [], [rows, type, orgs, projects, phases, user, indicators]);
  const validRows = validated.filter((v) => v.errors.length === 0);

  const doImport = () => {
    if (type === "projets") {
      const newProjects = validRows.map(({ row: r }) => {
        const lead = orgs.find((o) => o.name === r.organisation_porteuse.trim());
        return {
          id: uid(), name: r.nom.trim(), description: r.description || "", country: r.pays || "",
          zone: r.zone || "", start: r.date_debut || "", end: r.date_fin || "",
          status: PROJECT_STATUS[r.statut] ? r.statut : "en_preparation",
          leadOrgId: lead.id, orgs: [{ orgId: lead.id, role: "porteur" }],
          budget: r.budget ? Number(r.budget) : null, currency: r.devise || "EUR",
          validationRoles: ["porteur", "financeur"],
        };
      });
      setProjects((ps) => [...ps, ...newProjects]);
      setMembers((ms) => [...ms, ...newProjects.map((p) => ({ projectId: p.id, userId: user.id, role: "chef_projet" }))]);
    } else if (type === "phases") {
      setPhases((ps) => [...ps, ...validRows.map(({ row: r }) => {
        const proj = projects.find((p) => p.name === r.projet.trim());
        return { id: uid(), projectId: proj.id, name: r.phase.trim(), budget: r.budget ? Number(r.budget) : null, start: r.date_debut || "", end: r.date_fin || "", status: r.statut || "a_venir" };
      })]);
    } else if (type === "budget") {
      setBudgetLines((ls) => [...ls, ...validRows.map(({ row: r }) => {
        const proj = projects.find((p) => p.name === r.projet.trim());
        const funder = orgs.find((o) => o.name === (r.financeur || "").trim());
        const owner = orgs.find((o) => o.name === (r.organisation_responsable || "").trim());
        const ph = phases.find((x) => x.projectId === proj.id && x.name === (r.phase || "").trim());
        return {
          id: uid(), projectId: proj.id, phaseId: ph?.id || null,
          poste: r.poste.trim(), description: r.description || "",
          category: LINE_CATEGORIES[r.categorie.trim()] ? r.categorie.trim() : "autre",
          funderOrgId: funder?.id || proj.leadOrgId, ownerOrgId: owner?.id || proj.leadOrgId,
          year: r.annee ? Number(r.annee) : 2026,
          planned: Number(r.montant_previsionnel),
          valorisation: (r.valorisation || "").trim().toLowerCase() === "oui",
          status: LINE_STATUS[r.statut] ? r.statut : "prevue",
          comment: r.commentaire || "", review: "brouillon",
        };
      })]);
    } else if (type === "indicateurs") {
      setIndicators((is) => [...is, ...validRows.map(({ row: r }) => {
        const proj = projects.find((p) => p.name === r.projet.trim());
        const ph = phases.find((x) => x.projectId === proj.id && x.name === (r.phase || "").trim());
        return {
          id: uid(), projectId: proj.id, name: r.nom.trim(),
          kind: r.type.trim(), unit: r.unite || "",
          periodicity: PERIODICITY[r.periodicite] ? r.periodicite : "ponctuel",
          source: IND_SOURCES[r.source] ? r.source : "manuelle",
          baseline: r.valeur_initiale ? Number(r.valeur_initiale) : 0,
          target: Number(r.cible), phaseId: ph?.id || null,
        };
      })]);
    } else if (type === "resultats") {
      setMeasures((ms) => [...ms, ...validRows.map(({ row: r }) => {
        const proj = projects.find((p) => p.name === r.projet.trim());
        const ind = indicators.find((i) => i.projectId === proj.id && i.name === r.indicateur.trim());
        return { id: uid(), indicatorId: ind.id, period: r.periode.trim(), value: Number(r.valeur), comment: r.commentaire || "", by: user.id, at: TODAY };
      })]);
    } else {
      setTasks((ts) => [...ts, ...validRows.map(({ row: r }) => {
        const proj = projects.find((p) => p.name === r.projet.trim());
        const ph = phases.find((x) => x.projectId === proj.id && x.name === r.phase.trim());
        const assignee = users.find((u) => u.email === (r.responsable_email || "").trim());
        return {
          id: uid(), phaseId: ph.id, title: r.titre.trim(), description: r.description || "",
          assigneeId: assignee?.id || "", start: r.date_debut || "", end: r.date_fin || "",
          status: TASK_STATUS[r.statut] ? r.statut : "a_faire",
          progress: Math.min(100, Math.max(0, Number(r.avancement) || 0)), comment: r.commentaire || "",
          createdBy: user.id, review: "brouillon",
        };
      })]);
    }
    setDone(validRows.length);
    setRows(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" style={{ fontFamily: FONT_HEAD }}>Import Excel / CSV</h1>
      <p className="text-xs flex items-center gap-1.5" style={{ color: C.muted }}>
        <Lock size={12} /> Vos droits s'appliquent ligne par ligne. Tout import est tracé dans le journal d'audit.
      </p>

      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {Object.entries(IMPORT_SPECS).map(([k, v]) => (
            <button key={k} onClick={() => { setType(k); setRows(null); setDone(null); }}
              className="flex-1 sm:flex-none px-3.5 rounded-xl text-sm font-medium"
              style={{
                minHeight: 42,
                backgroundColor: type === k ? C.accentSoft : "transparent",
                color: type === k ? C.accent : C.muted,
                border: `1px solid ${type === k ? C.accent : C.border}`,
              }}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="text-xs space-y-1" style={{ color: C.muted }}>
          <p>Colonnes obligatoires : <strong style={{ color: C.ink }}>{spec.required.join(", ")}</strong></p>
          <p>Colonnes optionnelles : {spec.optional.join(", ")}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 items-start">
          <Field label="Fichier CSV">
            <input type="file" accept=".csv,.txt" style={inputStyle}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => parse(String(reader.result));
                reader.readAsText(file);
              }} />
          </Field>
          <Field label="Ou coller le contenu">
            <textarea style={{ ...inputStyle, minHeight: 76, fontFamily: "monospace", fontSize: 12 }}
              placeholder={spec.example} onBlur={(e) => e.target.value.trim() && parse(e.target.value)} />
          </Field>
        </div>
        <button className="text-sm font-medium py-1" style={{ color: C.accent }} onClick={() => parse(spec.example)}>
          Charger l'exemple
        </button>
      </Card>

      {done !== null && (
        <Card className="p-4 flex items-center gap-2 text-sm">
          <Check size={16} color={C.accent} /> {done} ligne{done > 1 ? "s" : ""} importée{done > 1 ? "s" : ""} avec succès.
        </Card>
      )}

      {rows && (
        <Card className="p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-semibold">Aperçu avant import — {rows.length} ligne{rows.length > 1 ? "s" : ""}</h2>
          {missingCols.length > 0 ? (
            <div className="flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg" style={{ backgroundColor: C.dangerSoft, color: C.danger }}>
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
              <span>Colonnes obligatoires manquantes : {missingCols.join(", ")}.</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border -mx-1" style={{ borderColor: C.border }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left" style={{ color: C.muted, backgroundColor: C.bg }}>
                      <th className="px-3 py-2 font-medium">État</th>
                      {headers.map((h) => <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}{spec.required.includes(h) && " *"}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {validated.slice(0, 20).map(({ row, errors }, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: C.border, backgroundColor: errors.length ? C.dangerSoft : "transparent" }}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {errors.length
                            ? <span style={{ color: C.danger }}>✕ {errors.join(" · ")}</span>
                            : <span style={{ color: C.accent }}>✓ OK</span>}
                        </td>
                        {headers.map((h) => <td key={h} className="px-3 py-2 whitespace-nowrap max-w-56 truncate">{row[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-sm" style={{ color: C.muted }}>
                  {validRows.length} valide{validRows.length > 1 ? "s" : ""} · {validated.length - validRows.length} en erreur
                </span>
                <div className="flex gap-2">
                  <Btn variant="ghost" onClick={() => setRows(null)}>Annuler</Btn>
                  <Btn disabled={validRows.length === 0} onClick={doImport}>
                    <Upload size={14} /> Importer {validRows.length} ligne{validRows.length > 1 ? "s" : ""}
                  </Btn>
                </div>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   PHASE 4 — ONGLET IMPACT (indicateurs et mesures)
   ============================================================ */
function IndicatorForm({ project, phases, initial, onSave, onClose }) {
  const [f, setF] = useState(initial || {
    name: "", kind: "quantitatif", unit: "", periodicity: "trimestriel",
    source: "manuelle", baseline: 0, target: "", phaseId: "",
  });
  const set = (k, v) => setF({ ...f, [k]: v });
  const projectPhases = phases.filter((p) => p.projectId === project.id);
  return (
    <Sheet title={initial ? "Indicateur" : "Nouvel indicateur"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nom *"><input style={inputStyle} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="ex. Nombre de bénéficiaires" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select style={inputStyle} value={f.kind} onChange={(e) => set("kind", e.target.value)}>
              {Object.entries(IND_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Unité">
            <input style={inputStyle} value={f.unit} onChange={(e) => set("unit", e.target.value)} placeholder={f.kind === "qualitatif" ? "score /5" : "ex. personnes"} />
          </Field>
          <Field label="Périodicité">
            <select style={inputStyle} value={f.periodicity} onChange={(e) => set("periodicity", e.target.value)}>
              {Object.entries(PERIODICITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Source">
            <select style={inputStyle} value={f.source} onChange={(e) => set("source", e.target.value)}>
              {Object.entries(IND_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Valeur initiale">
            <input style={inputStyle} type="number" value={f.baseline} onChange={(e) => set("baseline", Number(e.target.value))} />
          </Field>
          <Field label="Cible *">
            <input style={inputStyle} type="number" value={f.target} onChange={(e) => set("target", e.target.value)} placeholder="ex. 3000" />
          </Field>
        </div>
        {f.source === "taches" && (
          <Field label="Phase liée (compte les tâches terminées) *">
            <select style={inputStyle} value={f.phaseId || ""} onChange={(e) => set("phaseId", e.target.value)}>
              <option value="">— Choisir —</option>
              {projectPhases.map((ph) => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
            </select>
          </Field>
        )}
        <p className="text-xs" style={{ color: C.muted }}>
          Une cible inférieure à la valeur initiale suit une réduction (ex. baisse d'un problème identifié).
          Les indicateurs qualitatifs se mesurent sur une échelle 1-5 avec commentaire.
        </p>
        <div className="flex gap-2">
          <Btn variant="ghost" full onClick={onClose}>Annuler</Btn>
          <Btn full disabled={!f.name || f.target === "" || (f.source === "taches" && !f.phaseId)}
            onClick={() => onSave({ ...f, target: Number(f.target) })}>
            <Check size={15} /> Enregistrer
          </Btn>
        </div>
      </div>
    </Sheet>
  );
}

function MeasureForm({ indicator, onSave, onClose }) {
  const placeholders = { mensuel: "2026-07", trimestriel: "2026-T3", annuel: "2026", ponctuel: "2026-07-05" };
  const [period, setPeriod] = useState("");
  const [value, setValue] = useState("");
  const [comment, setComment] = useState("");
  const quali = indicator.kind === "qualitatif";
  return (
    <Sheet title={`Mesure — ${indicator.name}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label={`Période (${PERIODICITY[indicator.periodicity]})`}>
          <input style={inputStyle} value={period} onChange={(e) => setPeriod(e.target.value)} placeholder={placeholders[indicator.periodicity]} autoFocus />
        </Field>
        <Field label={quali ? "Score (1 à 5) *" : `Valeur (${indicator.unit || "nombre"}) *`}>
          <input style={inputStyle} type="number" min={quali ? 1 : 0} max={quali ? 5 : undefined} inputMode="numeric"
            value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Field label={quali ? "Commentaire (appréciation qualitative)" : "Commentaire"}>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Btn variant="ghost" full onClick={onClose}>Annuler</Btn>
          <Btn full disabled={!period.trim() || value === ""} onClick={() => onSave({ period: period.trim(), value: Number(value), comment: comment.trim() })}>
            <Check size={15} /> Enregistrer
          </Btn>
        </div>
      </div>
    </Sheet>
  );
}

function ImpactTab({ project, indicators, measures, tasks, phases, P, user, setIndicators, setMeasures, log }) {
  const [indModal, setIndModal] = useState(null);   // true | { ind }
  const [measureFor, setMeasureFor] = useState(null); // indicateur
  const inds = indicators.filter((i) => i.projectId === project.id);
  const canDefine = P.finance;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PieChart size={15} color={C.accent} />
          <h2 className="text-sm font-semibold">Indicateurs d'impact</h2>
        </div>
        {canDefine && <button className="text-sm font-medium" style={{ color: C.accent }} onClick={() => setIndModal(true)}>+ Indicateur</button>}
      </div>
      {inds.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: C.muted }}>
          Aucun indicateur défini. {canDefine ? "Créez le premier indicateur ou importez-les depuis Excel." : ""}
        </p>
      )}
      <div className="space-y-3">
        {inds.map((ind) => {
          const ms = indMeasures(ind.id, measures);
          const value = indValue(ind, measures, tasks);
          const pct = indPct(ind, value);
          const series = ind.source === "taches" ? [] : ms.map((m) => m.value);
          const last = ms[ms.length - 1];
          return (
            <div key={ind.id} className="rounded-xl border p-3.5" style={{ borderColor: C.border }}>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm flex-1 min-w-0">{ind.name}</span>
                <Badge {...IND_KINDS[ind.kind]} />
                <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>{PERIODICITY[ind.periodicity]}</span>
              </div>
              <div className="flex items-end justify-between gap-3 mt-2">
                <div>
                  <span className="text-xl font-semibold tabular-nums" style={{ fontFamily: FONT_HEAD }}>{value}</span>
                  <span className="text-xs ml-1" style={{ color: C.muted }}>{ind.unit}</span>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>Cible : {ind.target} · initial : {ind.baseline}</div>
                </div>
                {pct != null && (
                  <span className="text-sm font-semibold tabular-nums" style={{ color: pct >= 100 ? C.blue : pct < 40 ? C.warn : C.accent }}>
                    {Math.min(pct, 999)} %
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ backgroundColor: C.border }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct ?? 0)}%`, backgroundColor: (pct ?? 0) >= 100 ? C.blue : C.accent }} />
              </div>
              {series.length > 1 && <Sparkline values={series} max={ind.target} />}
              {last?.comment && <p className="text-xs italic mt-2" style={{ color: C.muted }}>« {last.comment} » — {last.period}</p>}
              <div className="flex items-center justify-between gap-2 mt-2.5">
                <span className="text-xs" style={{ color: C.muted }}>
                  {IND_SOURCES[ind.source]}
                  {ind.source === "taches" && ` · ${phases.find((p) => p.id === ind.phaseId)?.name || "—"}`}
                </span>
                <div className="flex gap-3">
                  {P.contribute && ind.source !== "taches" && (
                    <button className="text-xs font-medium" style={{ color: C.accent }} onClick={() => setMeasureFor(ind)}>+ Mesure</button>
                  )}
                  {canDefine && (
                    <button className="text-xs font-medium" style={{ color: C.muted }} onClick={() => setIndModal({ ind })}>Modifier</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: C.muted }}>
        <Lock size={11} /> Indicateurs définis par le comité et le responsable financier ; mesures saisies par le terrain.
      </p>

      {indModal && canDefine && (
        <IndicatorForm project={project} phases={phases} initial={indModal.ind || null}
          onClose={() => setIndModal(null)}
          onSave={(f) => {
            if (indModal.ind) {
              setIndicators((is) => is.map((x) => x.id === indModal.ind.id ? { ...x, ...f } : x));
              log(project.id, "indicateur", indModal.ind.id, `Indicateur ${f.name}`, "modifie");
            } else {
              const id = uid();
              setIndicators((is) => [...is, { ...f, id, projectId: project.id }]);
              log(project.id, "indicateur", id, `Indicateur ${f.name}`, "cree");
            }
            setIndModal(null);
          }} />
      )}
      {measureFor && (
        <MeasureForm indicator={measureFor}
          onClose={() => setMeasureFor(null)}
          onSave={({ period, value, comment }) => {
            setMeasures((ms) => [...ms, { id: uid(), indicatorId: measureFor.id, period, value, comment, by: user.id, at: TODAY }]);
            log(project.id, "indicateur", measureFor.id, `Indicateur ${measureFor.name}`, "modifie", `Mesure ${period} = ${value}`);
            setMeasureFor(null);
          }} />
      )}
    </Card>
  );
}

/* ============================================================
   PHASE 4 — ONGLET COPIL (réunions, comptes rendus, décisions)
   ============================================================ */
function MeetingForm({ onSave, onClose }) {
  const [f, setF] = useState({ title: "", kind: "copil", date: TODAY, attendees: "", minutes: "" });
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <Sheet title="Nouvelle réunion" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Titre *"><input style={inputStyle} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="ex. COPIL n°3" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select style={inputStyle} value={f.kind} onChange={(e) => set("kind", e.target.value)}>
              {Object.entries(MEETING_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Date"><input style={inputStyle} type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
        </div>
        <Field label="Participants"><input style={inputStyle} value={f.attendees} onChange={(e) => set("attendees", e.target.value)} placeholder="Organisations et personnes présentes" /></Field>
        <Field label="Compte rendu"><textarea style={{ ...inputStyle, minHeight: 100 }} value={f.minutes} onChange={(e) => set("minutes", e.target.value)} placeholder="Points abordés, arbitrages…" /></Field>
        <div className="flex gap-2">
          <Btn variant="ghost" full onClick={onClose}>Annuler</Btn>
          <Btn full disabled={!f.title.trim()} onClick={() => onSave(f)}><Check size={15} /> Enregistrer</Btn>
        </div>
      </div>
    </Sheet>
  );
}

function DecisionForm({ users, onSave, onClose }) {
  const [text, setText] = useState("");
  const [ownerId, setOwnerId] = useState(users[0]?.id || "");
  const [due, setDue] = useState("");
  return (
    <Sheet title="Nouvelle décision" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Décision *"><textarea style={{ ...inputStyle, minHeight: 60 }} value={text} onChange={(e) => setText(e.target.value)} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Responsable">
            <select style={inputStyle} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Échéance"><input style={inputStyle} type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" full onClick={onClose}>Annuler</Btn>
          <Btn full disabled={!text.trim()} onClick={() => onSave({ text: text.trim(), ownerId, due })}><Check size={15} /> Ajouter</Btn>
        </div>
      </div>
    </Sheet>
  );
}

function CopilTab({ project, meetings, decisions, users, P, user, setMeetings, setDecisions, log }) {
  const [meetingModal, setMeetingModal] = useState(false);
  const [decisionFor, setDecisionFor] = useState(null); // meetingId
  const ms = meetings.filter((m) => m.projectId === project.id).sort((a, b) => b.date.localeCompare(a.date));
  const uName = (id) => users.find((u) => u.id === id)?.name || "";

  const setDecisionStatus = (d, status) => {
    setDecisions((ds) => ds.map((x) => x.id === d.id ? { ...x, status } : x));
    log(project.id, "decision", d.id, `Décision : ${d.text.slice(0, 60)}`, status === "fait" ? "valide" : "modifie", `Statut → ${DECISION_STATUS[status].label}`);
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={15} color={C.accent} />
          <h2 className="text-sm font-semibold">Réunions et comité de pilotage</h2>
        </div>
        {P.manage && <button className="text-sm font-medium" style={{ color: C.accent }} onClick={() => setMeetingModal(true)}>+ Réunion</button>}
      </div>
      {ms.length === 0 && <p className="text-sm text-center py-6" style={{ color: C.muted }}>Aucune réunion enregistrée.</p>}
      <div className="space-y-3">
        {ms.map((m) => {
          const mDecs = decisions.filter((d) => d.meetingId === m.id);
          return (
            <div key={m.id} className="rounded-xl border p-3.5" style={{ borderColor: C.border }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm flex-1 min-w-40">{m.title}</span>
                <Badge {...MEETING_KINDS[m.kind]} />
                <span className="text-xs" style={{ color: C.muted }}>{fmtDate(m.date)}</span>
              </div>
              {m.attendees && <div className="text-xs mt-1" style={{ color: C.muted }}>Participants : {m.attendees}</div>}
              {m.minutes && (
                <p className="text-sm mt-2 px-3 py-2.5 rounded-lg leading-relaxed" style={{ backgroundColor: C.bg, color: C.ink }}>{m.minutes}</p>
              )}
              <div className="mt-3">
                <span className="block text-xs font-medium mb-2" style={{ color: C.muted }}>
                  Décisions et suivi ({mDecs.filter((d) => d.status === "fait").length}/{mDecs.length} faites)
                </span>
                <div className="space-y-2.5">
                  {mDecs.map((d) => {
                    const overdue = d.status !== "fait" && d.due && d.due < TODAY;
                    const canUpdate = P.manage || d.ownerId === user.id;
                    return (
                      <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                        <span className="flex-1 min-w-44 leading-snug">{d.text}</span>
                        <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>{uName(d.ownerId)}</span>
                        <span className="text-xs flex-shrink-0" style={{ color: overdue ? C.danger : C.muted }}>
                          {overdue ? "⚠ " : ""}{fmtDate(d.due)}
                        </span>
                        {canUpdate ? (
                          <select value={d.status} onChange={(e) => setDecisionStatus(d, e.target.value)}
                            className="text-xs rounded-lg outline-none flex-shrink-0"
                            style={{ border: `1px solid ${C.border}`, padding: "5px 7px", color: C.ink, backgroundColor: C.surface }}>
                            {Object.entries(DECISION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        ) : (
                          <Badge {...DECISION_STATUS[d.status]} />
                        )}
                      </div>
                    );
                  })}
                  {P.manage && (
                    <button className="text-sm font-medium py-0.5" style={{ color: C.accent }} onClick={() => setDecisionFor(m.id)}>+ Décision</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs mt-3" style={{ color: C.muted }}>
        Une décision qui devient opérationnelle se transforme en tâche classique dans l'onglet Suivi (pas de double système).
      </p>

      {meetingModal && P.manage && (
        <MeetingForm onClose={() => setMeetingModal(false)}
          onSave={(f) => {
            const id = uid();
            setMeetings((mm) => [...mm, { ...f, id, projectId: project.id }]);
            log(project.id, "reunion", id, `Réunion ${f.title}`, "cree");
            setMeetingModal(false);
          }} />
      )}
      {decisionFor && P.manage && (
        <DecisionForm users={users}
          onClose={() => setDecisionFor(null)}
          onSave={({ text, ownerId, due }) => {
            const id = uid();
            setDecisions((ds) => [...ds, { id, meetingId: decisionFor, projectId: project.id, text, ownerId, due, status: "a_faire" }]);
            log(project.id, "decision", id, `Décision : ${text.slice(0, 60)}`, "cree");
            setDecisionFor(null);
          }} />
      )}
    </Card>
  );
}

/* ============================================================
   PHASE 4 — PAGE PILOTAGE (vue direction / COPIL, portefeuille)
   ============================================================ */
function PilotagePage({ projects, phases, tasks, budgetLines, docs, validations, indicators, measures, decisions, orgs, accessRole, projectProgress, projectKpis, openProject }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ fontFamily: FONT_HEAD }}>Pilotage</h1>
        <p className="text-sm mt-0.5" style={{ color: C.muted }}>Vue direction et comité de pilotage — santé du portefeuille de projets.</p>
      </div>

      <ProjectsMap projects={projects} phases={phases} tasks={tasks} indicators={indicators}
        measures={measures} decisions={decisions} projectProgress={projectProgress} openProject={openProject} />
      <div className="space-y-2.5">
        {projects.map((p) => {
          const k = projectKpis(p.id);
          const phIds = phases.filter((ph) => ph.projectId === p.id).map((ph) => ph.id);
          const pTasks = tasks.filter((t) => phIds.includes(t.phaseId));
          const late = pTasks.filter(isLate).length;
          const inds = indicators.filter((i) => i.projectId === p.id);
          const done = inds.filter((i) => (indPct(i, indValue(i, measures, tasks)) ?? 0) >= 100).length;
          const risky = inds.filter((i) => { const pct = indPct(i, indValue(i, measures, tasks)); return pct != null && pct < 40; }).length;
          const openDec = decisions.filter((d) => d.projectId === p.id && d.status !== "fait").length;
          const overdueDec = decisions.filter((d) => d.projectId === p.id && d.status !== "fait" && d.due && d.due < TODAY).length;
          return (
            <Card key={p.id} className="p-4" onClick={() => openProject(p.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-snug">{p.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                    Porté par {orgs.find((o) => o.id === p.leadOrgId)?.name} · {p.country}
                  </div>
                </div>
                <Badge {...PROJECT_STATUS[p.status]} />
              </div>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs w-20 flex-shrink-0" style={{ color: C.muted }}>Avancement</span>
                <ProgressBar value={projectProgress(p.id)} />
              </div>
              {k.planned > 0 && (
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs w-20 flex-shrink-0" style={{ color: C.muted }}>Budget</span>
                  <div className="flex-1"><TriBar planned={k.planned} engaged={k.engaged} paid={k.paid} /></div>
                  <span className="text-xs tabular-nums flex-shrink-0" style={{ color: C.muted }}>
                    {k.planned ? Math.round((k.engaged / k.planned) * 100) : 0} % engagé
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {inds.length > 0 && <Badge label={`${done}/${inds.length} indicateurs atteints`} fg={C.blue} bg={C.blueSoft} />}
                {risky > 0 && <Badge label={`${risky} à risque`} fg={C.warn} bg={C.warnSoft} />}
                {openDec > 0 && <Badge label={`${openDec} décision${openDec > 1 ? "s" : ""} ouverte${openDec > 1 ? "s" : ""}`} fg={C.purple} bg={C.purpleSoft} />}
                {overdueDec > 0 && <Badge label={`${overdueDec} décision${overdueDec > 1 ? "s" : ""} en retard`} fg={C.danger} bg={C.dangerSoft} />}
                {late > 0 && <Badge label={`${late} tâche${late > 1 ? "s" : ""} en retard`} fg={C.warn} bg={C.warnSoft} />}
                {late === 0 && risky === 0 && overdueDec === 0 && <Badge label="✓ Sur les rails" fg={C.accent} bg={C.accentSoft} />}
              </div>
            </Card>
          );
        })}
      </div>
      <p className="text-xs" style={{ color: C.muted }}>
        Touchez un projet pour ouvrir ses onglets Impact, Copil et Vue financeur. Les rapports consolidés s'exportent depuis l'onglet Financeur du projet.
      </p>
    </div>
  );
}

/* ============================================================
   PAGE AIDE — guide d'utilisation, workflow, FAQ
   Contenu PARAMÉTRABLE : tout est dans HELP_CONTENT.
   En production, ce contenu vit en base (table help_articles)
   et s'édite depuis l'outil par l'administrateur (YCID).
   ============================================================ */
const HELP_CONTENT = {
  intro: "Solid'Pilot est l'outil de pilotage du programme CEM Liban-Yvelines. Chaque triade suit son projet, YCID coordonne, et chacun ne voit que les projets auxquels il participe.",
  security: "Chacun accède uniquement à ses projets, avec un profil qui définit ses droits (voir ci-dessous). En production, la connexion est sécurisée (Google ou email + mot de passe) et les droits sont appliqués côté serveur : impossible de contourner les règles depuis le navigateur.",
  roles: [
    { role: "chef_projet", desc: "Définit le projet, les phases, le budget, les membres. Vérifie les éléments soumis (étape « en revue »)." },
    { role: "resp_financier", desc: "Gère les lignes budgétaires, les justificatifs, marque les factures payées, importe et exporte le budget." },
    { role: "contributeur", desc: "Crée des tâches, dépose des pièces et livrables, saisit les mesures d'indicateurs, soumet à validation." },
    { role: "validateur", desc: "Validation finale des éléments en revue et des devis (YCID, CD78 selon le projet)." },
    { role: "auditeur", desc: "Lecture seule intégrale, y compris le journal d'audit." },
    { role: "lecteur", desc: "Consultation du projet, des rapports et de la vue financeur." },
  ],
  steps: [
    { title: "1. Suivre l'avancement", text: "Ouvrez votre projet depuis Accueil ou Projets. L'onglet Suivi liste les phases (les 4 actions du dossier MEAE) et les tâches. Touchez une tâche pour la mettre à jour : statut, avancement, commentaire, documents." },
    { title: "2. Gérer le budget", text: "L'onglet Budget affiche les lignes du dossier avec leur financeur (MEAE, YCID, CD78, communes, associations). L'engagé se calcule depuis les devis validés, le payé depuis les factures marquées payées. Déposez les justificatifs directement sur la ligne concernée." },
    { title: "3. Faire valider", text: "Déposez un devis : il part automatiquement en validation (voir le circuit ci-dessous). Soumettez une tâche ou un livrable : le chef de projet le passe en revue, puis le validateur tranche. Tout est tracé dans le journal d'audit." },
    { title: "4. Mesurer l'impact", text: "L'onglet Impact suit les indicateurs du dossier (jeunes mobilisés, km de sentiers, participants aux trails…). Saisissez une mesure par période — c'est ce qui alimente les rapports au MEAE." },
    { title: "5. Piloter et rendre compte", text: "L'onglet Copil garde les comptes rendus et le suivi des décisions. La page Pilotage donne la santé des 3 projets. L'onglet Financeur génère les rapports : avancement, budgétaire, consolidé — la base du rapport intermédiaire de septembre 2026." },
  ],
  faq: [
    { q: "Qui voit quoi ?", a: "Villepreux, Azour et LEY voient la triade Villepreux · Azour · LEY. Jouy-en-Josas, Jeïta et le Comité de Jumelage voient la leur. Le projet Coordination est commun. YCID et le CD78 ont accès aux trois." },
    { q: "Comment déposer un devis et le faire valider ?", a: "Ouvrez la ligne budgétaire concernée (onglet Budget) → + Justificatif → type Devis. L'association maîtresse d'œuvre (LEY ou Comité de Jumelage) le valide, conformément à la matrice RACI. Une fois validé, il compte dans l'engagé." },
    { q: "Une dépense a été payée, comment l'enregistrer ?", a: "Déposez la facture sur la ligne, puis le responsable financier la marque « payée ». Le reste-à-payer se met à jour automatiquement." },
    { q: "Mon élément a été rejeté, que faire ?", a: "Le motif est visible sur l'élément et dans le journal. Corrigez puis « Soumettre à nouveau »." },
    { q: "Comment préparer le rapport intermédiaire MEAE ?", a: "Onglet Financeur → Rapports → Rapport consolidé (avancement + budget + validations + impact + livrables + décisions). Complétez avec l'export budgétaire pour le volet financier." },
    { q: "Peut-on importer nos tableaux Excel existants ?", a: "Oui : page Import, formats Projets, Phases, Tâches, Budget, Indicateurs et Résultats. Aperçu avant import, lignes en erreur exclues, droits vérifiés ligne par ligne." },
    { q: "Qui peut modifier cette page d'aide ?", a: "Son contenu est paramétrable : en production, l'administrateur (YCID) l'édite directement depuis l'outil pour l'adapter au programme." },
    { q: "Les accès sont-ils sécurisés ?", a: "Oui. Chaque compte est personnel, chaque droit est limité au projet et au profil. En production les règles sont appliquées côté serveur (RLS) et toutes les actions sensibles sont tracées dans un journal d'audit inaltérable." },
  ],
};

function HelpPage({ user, accessRole, projects }) {
  const [openFaq, setOpenFaq] = useState(null);
  const myRoles = projects.map((p) => ({ p, r: accessRole(p.id) })).filter((x) => x.r);
  const FLOW = ["brouillon", "soumis", "en_revue", "valide"];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ fontFamily: FONT_HEAD }}>Aide et prise en main</h1>
        <p className="text-sm mt-1" style={{ color: C.muted }}>{HELP_CONTENT.intro}</p>
      </div>

      {myRoles.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-2">Vos accès</h2>
          <div className="space-y-1.5">
            {myRoles.map(({ p, r }) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 min-w-0 truncate">{p.name}</span>
                <Badge {...ACCESS_ROLES[r]} label={ACCESS_ROLES[r].short} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={15} color={C.accent} />
          <h2 className="text-sm font-semibold">Premiers pas</h2>
        </div>
        <div className="space-y-3.5">
          {HELP_CONTENT.steps.map((st) => (
            <div key={st.title}>
              <div className="text-sm font-medium">{st.title}</div>
              <p className="text-sm mt-0.5 leading-relaxed" style={{ color: C.muted }}>{st.text}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={15} color={C.accent} />
          <h2 className="text-sm font-semibold">Le workflow de validation</h2>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FLOW.map((st, i) => (
            <React.Fragment key={st}>
              <Badge {...REVIEW_STATES[st]} />
              {i < FLOW.length - 1 && <ChevronRight size={13} color={C.muted} />}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-xs" style={{ color: C.muted }}>À chaque étape, un rejet renvoie en</span>
          <Badge {...REVIEW_STATES.rejete} />
          <span className="text-xs" style={{ color: C.muted }}>avec un motif, puis re-soumission.</span>
        </div>
        <p className="text-xs mt-3 leading-relaxed" style={{ color: C.muted }}>
          Le contributeur <strong style={{ color: C.ink }}>soumet</strong>, le chef de projet <strong style={{ color: C.ink }}>passe en revue</strong>, le validateur <strong style={{ color: C.ink }}>valide</strong>. Les devis suivent le circuit d'organisations défini par projet (conforme à la matrice RACI adoptée au COPIL du 26/11/2025). Ce circuit est paramétrable projet par projet dans « Modifier le projet ».
        </p>
        <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: C.border }}>
          {HELP_CONTENT.roles.map(({ role, desc }) => (
            <div key={role} className="flex items-start gap-2 text-sm">
              <div className="flex-shrink-0 mt-0.5"><Badge {...ACCESS_ROLES[role]} label={ACCESS_ROLES[role].short} /></div>
              <span className="text-xs leading-relaxed" style={{ color: C.muted }}>{desc}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle size={15} color={C.accent} />
          <h2 className="text-sm font-semibold">Questions fréquentes</h2>
        </div>
        <div className="space-y-1">
          {HELP_CONTENT.faq.map((f, i) => (
            <div key={i} className="border-b last:border-b-0" style={{ borderColor: C.border }}>
              <button className="w-full flex items-center gap-2 py-3 text-left" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span className="text-sm font-medium flex-1">{f.q}</span>
                {openFaq === i ? <ChevronDown size={15} color={C.muted} /> : <ChevronRight size={15} color={C.muted} />}
              </button>
              {openFaq === i && <p className="text-sm pb-3 leading-relaxed" style={{ color: C.muted }}>{f.a}</p>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Lock size={14} color={C.accent} />
          <h2 className="text-sm font-semibold">Sécurité des accès</h2>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{HELP_CONTENT.security}</p>
      </Card>

      <p className="text-xs" style={{ color: C.muted }}>
        Contenu paramétrable par l'administrateur du programme (YCID). Besoin d'aide supplémentaire ? Contactez la coordination : bayoub@yvelines.fr.
      </p>
    </div>
  );
}

/* ============================================================
   CARTE DES PROJETS — pilotage géographique du portefeuille
   Marqueurs positionnés en lat/lng réels (projection équirectangulaire,
   cadrage automatique). Couleur = santé du projet. Arcs = coopérations
   depuis le siège. En production : fond OpenStreetMap (Leaflet/MapLibre),
   ce composant fournit déjà les coordonnées et la logique de santé.
   ============================================================ */
const HQ = { name: "YCID — Versailles", lat: 48.80, lng: 2.13 };

function ProjectsMap({ projects, phases, tasks, indicators, measures, decisions, projectProgress, openProject }) {
  const [selected, setSelected] = useState(null);
  const located = projects.filter((p) => p.lat != null && p.lng != null);
  if (!located.length) return null;

  const health = (p) => {
    const phIds = phases.filter((ph) => ph.projectId === p.id).map((ph) => ph.id);
    const late = tasks.filter((t) => phIds.includes(t.phaseId) && isLate(t)).length;
    const risky = indicators.filter((i) => {
      if (i.projectId !== p.id) return false;
      const pct = indPct(i, indValue(i, measures, tasks));
      return pct != null && pct < 40;
    }).length;
    const overdue = decisions.filter((d) => d.projectId === p.id && d.status !== "fait" && d.due && d.due < TODAY).length;
    if (late > 0 && (overdue > 0 || risky > 1)) return { color: C.danger, label: "Alerte" };
    if (late > 0 || overdue > 0 || risky > 0) return { color: C.warn, label: "À surveiller" };
    return { color: C.accent, label: "Sur les rails" };
  };

  /* Projection équirectangulaire avec cadrage automatique sur les points */
  const W = 700, H = 340, PAD = 46;
  const pts = [...located.map((p) => ({ lat: p.lat, lng: p.lng })), { lat: HQ.lat, lng: HQ.lng }];
  const minLng = Math.min(...pts.map((p) => p.lng)) - 2, maxLng = Math.max(...pts.map((p) => p.lng)) + 2;
  const minLat = Math.min(...pts.map((p) => p.lat)) - 2, maxLat = Math.max(...pts.map((p) => p.lat)) + 2;
  const scale = Math.min((W - 2 * PAD) / (maxLng - minLng), (H - 2 * PAD) / (maxLat - minLat));
  const cx = (minLng + maxLng) / 2, cy = (minLat + maxLat) / 2;
  const X = (lng) => W / 2 + (lng - cx) * scale;
  const Y = (lat) => H / 2 - (lat - cy) * scale;

  /* Graticule adapté à l'étendue */
  const step = (maxLng - minLng) > 15 ? 5 : 1;
  const lngLines = [], latLines = [];
  for (let l = Math.ceil(minLng / step) * step; l <= maxLng; l += step) lngLines.push(l);
  for (let l = Math.ceil(minLat / step) * step; l <= maxLat; l += step) latLines.push(l);

  const hqX = X(HQ.lng), hqY = Y(HQ.lat);
  const selectedProject = located.find((p) => p.id === selected);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold">Carte des projets</h2>
        <div className="flex items-center gap-3">
          {[{ c: C.accent, l: "Sur les rails" }, { c: C.warn, l: "À surveiller" }, { c: C.danger, l: "Alerte" }].map((x) => (
            <span key={x.l} className="flex items-center gap-1" style={{ fontSize: 10.5, color: C.muted }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: x.c }} /> {x.l}
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs mb-2" style={{ color: C.muted }}>Touchez un marqueur pour ouvrir la fiche du projet.</p>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl" style={{ backgroundColor: "#EDF1EE", display: "block" }}>
        {/* Graticule */}
        {lngLines.map((l) => <line key={"g" + l} x1={X(l)} y1={0} x2={X(l)} y2={H} stroke="#DFE5E0" strokeWidth="1" />)}
        {latLines.map((l) => <line key={"h" + l} x1={0} y1={Y(l)} x2={W} y2={Y(l)} stroke="#DFE5E0" strokeWidth="1" />)}

        {/* Arcs de coopération depuis le siège */}
        {located.filter((p) => Math.abs(p.lng - HQ.lng) > 0.5 || Math.abs(p.lat - HQ.lat) > 0.5).map((p) => {
          const x2 = X(p.lng), y2 = Y(p.lat);
          const mx = (hqX + x2) / 2, my = Math.min(hqY, y2) - 55;
          return <path key={"arc" + p.id} d={`M ${hqX} ${hqY} Q ${mx} ${my} ${x2} ${y2}`}
            fill="none" stroke={C.accent} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />;
        })}

        {/* Siège */}
        <rect x={hqX - 5} y={hqY - 5} width="10" height="10" rx="2.5" fill={C.blue} stroke="#fff" strokeWidth="2" transform={`rotate(45 ${hqX} ${hqY})`} />
        <text x={hqX} y={hqY - 12} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={C.blue} fontFamily={FONT_BODY}>{HQ.name}</text>

        {/* Marqueurs projets */}
        {located.map((p, i) => {
          const x = X(p.lng), y = Y(p.lat);
          const h = health(p);
          const labelAbove = i % 2 === 0;
          const active = selected === p.id;
          return (
            <g key={p.id} onClick={() => setSelected(active ? null : p.id)} style={{ cursor: "pointer" }}>
              {active && <circle cx={x} cy={y} r="14" fill={h.color} opacity="0.18" />}
              <circle cx={x} cy={y} r="8" fill={h.color} stroke="#fff" strokeWidth="2.5" />
              <text x={x} y={y + 3.2} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#fff" fontFamily={FONT_BODY}>
                {projectProgress(p.id)}
              </text>
              <text x={x} y={labelAbove ? y - 14 : y + 22} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={C.ink} fontFamily={FONT_BODY}>
                {p.zone}
              </text>
            </g>
          );
        })}
      </svg>

      {selectedProject && (() => {
        const h = health(selectedProject);
        return (
          <div className="rounded-xl border p-3.5 mt-3" style={{ borderColor: C.border }}>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm flex-1 min-w-0 leading-snug">{selectedProject.name}</span>
              <Badge label={h.label} fg={h.color === C.accent ? C.accent : h.color === C.warn ? C.warn : C.danger}
                bg={h.color === C.accent ? C.accentSoft : h.color === C.warn ? C.warnSoft : C.dangerSoft} />
            </div>
            <div className="flex items-center gap-3 mt-2.5">
              <ProgressBar value={projectProgress(selectedProject.id)} />
              <Btn small onClick={() => openProject(selectedProject.id)}>Ouvrir</Btn>
            </div>
          </div>
        );
      })()}

      <p className="text-xs mt-3" style={{ color: C.muted }}>
        Le chiffre dans chaque marqueur est l'avancement (%). En production : fond de carte OpenStreetMap avec zoom, mêmes données.
      </p>
    </Card>
  );
}

function NoAccess() {
  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ backgroundColor: C.bg, fontFamily: FONT_BODY }}>
      <Card className="p-6 max-w-sm text-center">
        <Lock size={22} color={C.warn} className="mx-auto mb-3" />
        <h1 className="text-base font-semibold mb-2" style={{ fontFamily: FONT_HEAD }}>Compte non provisionné</h1>
        <p className="text-sm mb-4" style={{ color: C.muted }}>
          Votre connexion a réussi, mais aucun profil ne correspond à votre adresse email dans le programme.
          Contactez la coordination YCID (bayoub@yvelines.fr) pour être ajouté.
        </p>
        <Btn full onClick={() => supabase.auth.signOut()}>Se déconnecter</Btn>
      </Card>
    </div>
  );
}
