import React, { useState, useMemo } from "react";
import Papa from "papaparse";
import {
  LayoutDashboard, FolderKanban, Building2, Upload, Search, LogOut, Download,
  Plus, ChevronDown, ChevronRight, ChevronLeft, FileText, Camera, Receipt, Package,
  ClipboardList, AlertTriangle, X, Check, Wallet, ShieldCheck, ThumbsDown, Users, Eye, Lock, FileSignature, StickyNote, BadgeCheck
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
  observateur: { label: "Observateur", bg: "#EEF0EE", fg: "#66716B" },
  partenaire_terrain: { label: "Partenaire terrain", bg: "#F5EFE2", fg: "#8A6A1F" },
  partenaire_medical: { label: "Partenaire médical", bg: "#E7F1F4", fg: "#2C6B7E" },
};
const ACCESS_ROLES = {
  chef_projet: { label: "Chef de projet · Comité", short: "Comité", fg: "#0E6B5C", bg: "#E4F0EC" },
  resp_financier: { label: "Responsable financier", short: "Finances", fg: "#3B5488", bg: "#E8ECF5" },
  contributeur: { label: "Contributeur · Terrain", short: "Terrain", fg: "#8A6A1F", bg: "#F5EFE2" },
  lecteur: { label: "Lecteur / Financeur", short: "Lecteur", fg: "#6B4A8C", bg: "#F0E9F5" },
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
const DEVIS_STATE = {
  en_attente: { label: "En attente", fg: C.warn, bg: C.warnSoft },
  valide: { label: "Validé", fg: C.accent, bg: C.accentSoft },
  refuse: { label: "Refusé", fg: C.danger, bg: C.dangerSoft },
};
const VALIDATOR_ROLES = ["porteur", "financeur", "partenaire", "partenaire_medical"];
/* PHASE 2 : catégories et statuts des lignes budgétaires (paramétrables en prod) */
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

/* ============================================================
   DONNÉES DE DÉMONSTRATION
   ============================================================ */
const seedUsers = [
  { id: "u1", name: "Claire Morel", email: "claire@eau-avenir.org", orgId: "o1", isOrgAdmin: true },
  { id: "u2", name: "Amadou Diallo", email: "a.diallo@sahelsante.org", orgId: "o3", isOrgAdmin: true },
  { id: "u3", name: "Julie Perret", email: "j.perret@ville-lyon.fr", orgId: "o2", isOrgAdmin: false },
  { id: "u4", name: "Pierre Fontaine", email: "p.fontaine@afd.fr", orgId: "o4", isOrgAdmin: false },
];
const seedOrgs = [
  { id: "o1", name: "Eau & Avenir", type: "association", country: "France", email: "contact@eau-avenir.org", status: "active" },
  { id: "o2", name: "Ville de Lyon", type: "collectivite", country: "France", email: "cooperation@ville-lyon.fr", status: "active" },
  { id: "o3", name: "Sahel Santé", type: "partenaire_medical", country: "Mali", email: "info@sahelsante.org", status: "active" },
  { id: "o4", name: "AFD", type: "financeur_public", country: "France", email: "projets@afd.fr", status: "active" },
];
const seedProjects = [
  {
    id: "p1", name: "Accès à l'eau — Région de Kayes",
    description: "Réalisation de 6 forages, formation des comités de gestion de l'eau et sensibilisation à l'hygiène dans 4 villages.",
    country: "Mali", zone: "Kayes", start: "2026-01-15", end: "2027-06-30",
    status: "en_cours", leadOrgId: "o1", budget: 250000, currency: "EUR",
    orgs: [
      { orgId: "o1", role: "porteur" }, { orgId: "o2", role: "partenaire" },
      { orgId: "o3", role: "partenaire_terrain" }, { orgId: "o4", role: "financeur" },
    ],
    validationRoles: ["porteur", "financeur"],
  },
  {
    id: "p2", name: "Santé maternelle — Cercle de Nioro",
    description: "Équipement de 2 centres de santé et formation de 30 sages-femmes.",
    country: "Mali", zone: "Nioro du Sahel", start: "2026-03-01", end: "2026-12-15",
    status: "en_preparation", leadOrgId: "o3", budget: 95000, currency: "EUR",
    orgs: [
      { orgId: "o3", role: "porteur" }, { orgId: "o1", role: "partenaire_terrain" },
      { orgId: "o4", role: "financeur" },
    ],
    validationRoles: ["porteur", "financeur"],
  },
];
const seedMembers = [
  { projectId: "p1", userId: "u1", role: "chef_projet" },
  { projectId: "p1", userId: "u2", role: "contributeur" },
  { projectId: "p1", userId: "u3", role: "resp_financier" },
  { projectId: "p1", userId: "u4", role: "lecteur" },
  { projectId: "p2", userId: "u2", role: "chef_projet" },
  { projectId: "p2", userId: "u1", role: "contributeur" },
  { projectId: "p2", userId: "u4", role: "lecteur" },
];
const seedPhases = [
  { id: "ph1", projectId: "p1", name: "Études et diagnostics", budget: 30000, start: "2026-01-15", end: "2026-03-31", status: "terminee" },
  { id: "ph2", projectId: "p1", name: "Travaux de forage", budget: 160000, start: "2026-04-01", end: "2026-11-30", status: "en_cours" },
  { id: "ph3", projectId: "p1", name: "Formation et sensibilisation", budget: 45000, start: "2026-09-01", end: "2027-05-31", status: "a_venir" },
  { id: "ph4", projectId: "p2", name: "Cadrage et achats", budget: 60000, start: "2026-03-01", end: "2026-06-30", status: "en_cours" },
];
const seedTasks = [
  { id: "t1", phaseId: "ph1", title: "Étude hydrogéologique", description: "Cartographie des nappes sur les 4 villages.", assigneeId: "u2", start: "2026-01-20", end: "2026-02-28", status: "terminee", progress: 100, comment: "Rapport validé par le comité.", createdBy: "u2" },
  { id: "t3", phaseId: "ph2", title: "Forage village de Diéma", description: "Forage + pompe manuelle.", assigneeId: "u2", start: "2026-04-10", end: "2026-06-15", status: "en_cours", progress: 60, comment: "Retard lié à la saison des pluies.", createdBy: "u2" },
  { id: "t4", phaseId: "ph2", title: "Forage village de Séro", description: "", assigneeId: "u1", start: "2026-05-01", end: "2026-06-30", status: "bloquee", progress: 20, comment: "Attente autorisation locale.", createdBy: "u1" },
  { id: "t5", phaseId: "ph2", title: "Réception des devis entreprises", description: "", assigneeId: "u1", start: "2026-06-20", end: "2026-07-10", status: "en_cours", progress: 40, comment: "", createdBy: "u1" },
  { id: "t6", phaseId: "ph3", title: "Programme de formation des comités", description: "", assigneeId: "u3", start: "2026-09-01", end: "2026-10-15", status: "a_faire", progress: 0, comment: "", createdBy: "u1" },
  { id: "t7", phaseId: "ph4", title: "Liste des équipements médicaux", description: "", assigneeId: "u2", start: "2026-03-10", end: "2026-04-30", status: "en_cours", progress: 75, comment: "", createdBy: "u2" },
];
/* PHASE 2 : lignes budgétaires (montants engagé/payé CALCULÉS depuis les pièces) */
const seedBudgetLines = [
  { id: "l1", projectId: "p1", phaseId: "ph2", poste: "Forages et pompes (6 ouvrages)", description: "Travaux entreprise + fournitures", category: "investissement", funderOrgId: "o4", ownerOrgId: "o3", year: 2026, planned: 120000, valorisation: false, status: "active", comment: "" },
  { id: "l2", projectId: "p1", phaseId: "ph1", poste: "Études hydrogéologiques", description: "Cabinet d'études local", category: "projet", funderOrgId: "o2", ownerOrgId: "o1", year: 2026, planned: 25000, valorisation: false, status: "cloturee", comment: "Terminé, rapport livré." },
  { id: "l3", projectId: "p1", phaseId: "ph3", poste: "Formation des comités de gestion", description: "Formateurs + logistique", category: "fonctionnement", funderOrgId: "o2", ownerOrgId: "o3", year: 2027, planned: 30000, valorisation: false, status: "prevue", comment: "" },
  { id: "l4", projectId: "p1", phaseId: null, poste: "Coordination locale (mise à disposition)", description: "Temps agent Sahel Santé valorisé", category: "fonctionnement", funderOrgId: "o3", ownerOrgId: "o3", year: 2026, planned: 15000, valorisation: true, status: "active", comment: "Contribution en nature." },
  { id: "l5", projectId: "p1", phaseId: "ph3", poste: "Sensibilisation hygiène (4 villages)", description: "", category: "projet", funderOrgId: "o4", ownerOrgId: "o3", year: 2027, planned: 20000, valorisation: false, status: "prevue", comment: "" },
];
/* Une pièce se rattache à une tâche (taskId) ET/OU à une ligne budgétaire (lineId) */
const seedDocs = [
  { id: "d1", taskId: "t1", lineId: "l2", type: "rapport", filename: "rapport-hydro-kayes.pdf", amount: null, by: "u2", date: "2026-03-02" },
  { id: "d2", taskId: "t3", lineId: "l1", type: "devis", filename: "devis-forage-diema.pdf", amount: 42000, by: "u2", date: "2026-04-15" },
  { id: "d4", taskId: "t5", lineId: "l1", type: "devis", filename: "devis-entreprise-B.pdf", amount: 38500, by: "u1", date: "2026-06-25" },
  { id: "d5", taskId: "t3", lineId: "l1", type: "facture", filename: "facture-acompte-diema.pdf", amount: 21000, paid: true, by: "u2", date: "2026-05-20" },
  { id: "d6", taskId: null, lineId: "l2", type: "facture", filename: "facture-cabinet-etudes.pdf", amount: 24500, paid: true, by: "u1", date: "2026-04-02" },
  { id: "d7", taskId: null, lineId: "l2", type: "devis", filename: "devis-cabinet-etudes.pdf", amount: 24500, by: "u1", date: "2026-01-25" },
  { id: "d8", taskId: null, lineId: "l1", type: "convention", filename: "convention-afd-2026.pdf", amount: null, by: "u3", date: "2026-02-10" },
];
const seedValidations = [
  { id: "v1", docId: "d2", orgId: "o1", role: "porteur", decision: "valide", date: "2026-04-18", comment: "" },
  { id: "v2", docId: "d2", orgId: "o4", role: "financeur", decision: "valide", date: "2026-04-22", comment: "" },
  { id: "v3", docId: "d4", orgId: "o1", role: "porteur", decision: "valide", date: "2026-06-27", comment: "" },
  { id: "v4", docId: "d4", orgId: "o4", role: "financeur", decision: "en_attente", date: "", comment: "" },
  { id: "v5", docId: "d7", orgId: "o1", role: "porteur", decision: "valide", date: "2026-01-28", comment: "" },
  { id: "v6", docId: "d7", orgId: "o4", role: "financeur", decision: "valide", date: "2026-02-01", comment: "" },
];

/* ============================================================
   HELPERS
   ============================================================ */
const TODAY = "2026-07-05";
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtDate = (d) => { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const fmtMoney = (n, cur = "EUR") =>
  n == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
const isLate = (t) => t.status !== "terminee" && t.end && t.end < TODAY;
const devisState = (docId, validations) => {
  const vs = validations.filter((v) => v.docId === docId);
  if (!vs.length) return "en_attente";
  if (vs.some((v) => v.decision === "refuse")) return "refuse";
  if (vs.every((v) => v.decision === "valide")) return "valide";
  return "en_attente";
};
/* Engagé = devis validés · Payé = reçus + factures payées */
const lineFinance = (lineId, docs, validations) => {
  const lDocs = docs.filter((d) => d.lineId === lineId);
  const engaged = lDocs.filter((d) => d.type === "devis" && devisState(d.id, validations) === "valide")
    .reduce((s, d) => s + (d.amount || 0), 0);
  const paid = lDocs.filter((d) => d.type === "recu" || (d.type === "facture" && d.paid))
    .reduce((s, d) => s + (d.amount || 0), 0);
  return { engaged, paid };
};

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

/* Barre triple : payé (foncé) < engagé (moyen) < prévisionnel */
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
   CONNEXION
   ============================================================ */
function Login({ onLogin }) {
  const [email, setEmail] = useState("claire@eau-avenir.org");
  const [pwd, setPwd] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ backgroundColor: C.bg, fontFamily: FONT_BODY }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3" style={{ backgroundColor: C.accent }}>
            <FolderKanban size={24} color="#fff" />
          </div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: FONT_HEAD, color: C.ink }}>Solid'Pilot</h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>Pilotage de projets de solidarité internationale</p>
        </div>
        <Card className="p-6">
          <button onClick={() => onLogin("google")}
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
            <Btn full onClick={() => onLogin("email")}>Se connecter</Btn>
          </div>
          <p className="text-xs mt-4 text-center" style={{ color: C.muted }}>Prototype — la connexion est simulée.</p>
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

  const [orgs, setOrgs] = useState(seedOrgs);
  const [projects, setProjects] = useState(seedProjects);
  const [members, setMembers] = useState(seedMembers);
  const [phases, setPhases] = useState(seedPhases);
  const [tasks, setTasks] = useState(seedTasks);
  const [docs, setDocs] = useState(seedDocs);
  const [budgetLines, setBudgetLines] = useState(seedBudgetLines);
  const [validations, setValidations] = useState(seedValidations);
  const users = seedUsers;
  const user = users.find((u) => u.id === userId);

  const accessRole = (projectId, uId = userId) =>
    members.find((m) => m.projectId === projectId && m.userId === uId)?.role || null;
  const perms = (projectId) => {
    const r = accessRole(projectId);
    return {
      role: r,
      manage: r === "chef_projet",
      finance: r === "chef_projet" || r === "resp_financier",
      contribute: r === "chef_projet" || r === "contributeur",
      read: r !== null,
    };
  };
  const canCreateProjects = user?.isOrgAdmin;
  const visibleProjects = projects.filter((p) =>
    members.some((m) => m.projectId === p.id && m.userId === userId) ||
    p.orgs.some((po) => po.orgId === user?.orgId)
  );

  const helpers = { orgs, projects: visibleProjects, allProjects: projects, members, phases, tasks, docs, budgetLines, users, validations, user, accessRole, perms, setOrgs, setProjects, setMembers, setPhases, setTasks, setDocs, setBudgetLines, setValidations };

  const projectProgress = (pId) => {
    const phIds = phases.filter((p) => p.projectId === pId).map((p) => p.id);
    const ts = tasks.filter((t) => phIds.includes(t.phaseId));
    if (!ts.length) return 0;
    return Math.round(ts.reduce((s, t) => s + t.progress, 0) / ts.length);
  };
  /* KPI financiers projet, calculés depuis les lignes budgétaires */
  const projectKpis = (pId) => {
    const lines = budgetLines.filter((l) => l.projectId === pId);
    let planned = 0, valorisations = 0, engaged = 0, paid = 0;
    lines.forEach((l) => {
      const f = lineFinance(l.id, docs, validations);
      if (l.valorisation) valorisations += l.planned || 0;
      else planned += l.planned || 0;
      engaged += f.engaged; paid += f.paid;
    });
    return { planned, valorisations, engaged, paid, toCommit: planned - engaged, toPay: engaged - paid, lines };
  };

  const fonts = <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');
    * { -webkit-tap-highlight-color: transparent; }
  `}</style>;

  if (!user) return <>{fonts}<Login onLogin={() => setUserId("u1")} /></>;

  const NAV = [
    { id: "dashboard", label: "Accueil", Icon: LayoutDashboard },
    { id: "projects", label: "Projets", Icon: FolderKanban },
    { id: "orgs", label: "Orgas", labelFull: "Organisations", Icon: Building2 },
    { id: "import", label: "Import", Icon: Upload },
  ];
  const goto = (p) => { setPage(p); setSelectedProjectId(null); };
  const inProjects = page === "projects";

  const UserSwitcher = ({ compact }) => (
    <select value={userId} onChange={(e) => { setUserId(e.target.value); setSelectedProjectId(null); }}
      className="text-xs rounded-lg font-medium outline-none"
      style={{ border: `1px solid ${C.border}`, color: C.ink, backgroundColor: C.surface, padding: compact ? "6px 8px" : "8px 10px", maxWidth: compact ? 150 : "100%" }}>
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
          <div className="px-2">
            <div className="text-xs mb-1" style={{ color: C.muted }}>Voir en tant que (démo)</div>
            <UserSwitcher />
          </div>
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ backgroundColor: C.accentSoft, color: C.accent }}>
              {user.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{user.name}</div>
              <div className="text-xs truncate" style={{ color: C.muted }}>{orgs.find((o) => o.id === user.orgId)?.name}</div>
            </div>
            <button onClick={() => setUserId(null)} aria-label="Se déconnecter"><LogOut size={15} color={C.muted} /></button>
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
          <div className="lg:hidden"><UserSwitcher compact /></div>
          <span className="text-xs hidden lg:block" style={{ color: C.muted }}>05/07/2026</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto"
          style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom))" }}>
          {page === "dashboard" && <Dashboard {...helpers} projectProgress={projectProgress} projectKpis={projectKpis} openProject={(id) => { setPage("projects"); setSelectedProjectId(id); }} />}
          {inProjects && !selectedProjectId && <ProjectsList {...helpers} canCreateProjects={canCreateProjects} projectProgress={projectProgress} projectKpis={projectKpis} openProject={setSelectedProjectId} />}
          {inProjects && selectedProjectId && <ProjectDetail {...helpers} projectId={selectedProjectId} projectProgress={projectProgress} projectKpis={projectKpis} back={() => setSelectedProjectId(null)} />}
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
    </div>
  );
}

/* ============================================================
   TABLEAU DE BORD
   ============================================================ */
function Dashboard({ projects, phases, tasks, docs, users, orgs, validations, user, accessRole, projectProgress, projectKpis, openProject }) {
  const visiblePhaseIds = phases.filter((ph) => projects.some((p) => p.id === ph.projectId)).map((ph) => ph.id);
  const visibleTasks = tasks.filter((t) => visiblePhaseIds.includes(t.phaseId));
  const lateTasks = visibleTasks.filter(isLate);
  const myPendingValidations = validations.filter((v) => v.decision === "en_attente" && v.orgId === user.orgId);
  const projectOfTask = (t) => {
    const ph = phases.find((p) => p.id === t.phaseId);
    return projects.find((pr) => pr.id === ph?.projectId);
  };

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
          { label: "À valider par moi", value: myPendingValidations.length, warn: myPendingValidations.length > 0 },
        ].map((s) => (
          <Card key={s.label} className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-semibold tabular-nums" style={{ fontFamily: FONT_HEAD, color: s.warn ? C.warn : C.ink }}>{s.value}</div>
            <div className="text-xs sm:text-sm mt-0.5 leading-tight" style={{ color: C.muted }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {myPendingValidations.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <ShieldCheck size={15} color={C.warn} />
            <h2 className="text-sm font-semibold">Devis en attente de votre validation</h2>
          </div>
          <ul className="space-y-2.5">
            {myPendingValidations.map((v) => {
              const d = docs.find((x) => x.id === v.docId);
              const t = tasks.find((x) => x.id === d?.taskId);
              const pr = t ? projectOfTask(t) : projects.find((p) => p.id === "p1");
              return (
                <li key={v.id}>
                  <button className="w-full text-left" onClick={() => pr && openProject(pr.id)}>
                    <div className="text-sm font-medium leading-snug">{d?.filename} · {fmtMoney(d?.amount, pr?.currency)}</div>
                    <div className="text-xs mt-0.5" style={{ color: C.warn }}>{pr?.name} → ouvrir pour décider</div>
                  </button>
                </li>
              );
            })}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} color={C.warn} />
            <h2 className="text-sm font-semibold">Tâches en retard</h2>
          </div>
          {lateTasks.length === 0 && <p className="text-sm" style={{ color: C.muted }}>Aucune tâche en retard.</p>}
          <ul className="space-y-3">
            {lateTasks.map((t) => (
              <li key={t.id} className="text-sm">
                <div className="font-medium leading-snug">{t.title}</div>
                <div className="text-xs mt-0.5" style={{ color: C.warn }}>Échéance {fmtDate(t.end)} · {projectOfTask(t)?.name}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={15} color={C.accent} />
            <h2 className="text-sm font-semibold">Derniers documents</h2>
          </div>
          <ul className="space-y-3">
            {[...docs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((d) => {
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
    </div>
  );
}

/* ============================================================
   LISTE PROJETS (inchangée sauf barre financière)
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
            <input style={inputStyle} type="number" min="0" inputMode="numeric" value={f.budget}
              onChange={(e) => set("budget", e.target.value)} placeholder="ex. 250000" />
          </Field>
          <Field label="Devise du projet">
            <select style={inputStyle} value={f.currency} onChange={(e) => set("currency", e.target.value)}>
              <option value="EUR">€ Euro</option><option value="XOF">FCFA</option><option value="USD">$ Dollar</option>
            </select>
          </Field>
        </div>
        <Field label="Statut">
          <select style={inputStyle} value={f.status} onChange={(e) => set("status", e.target.value)}>
            {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
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
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={15} color={C.accent} />
            <span className="text-sm font-medium">Circuit de validation des devis</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
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
   PHASE 2 — FORMULAIRE LIGNE BUDGÉTAIRE
   ============================================================ */
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
        <Field label="Poste *"><input style={inputStyle} value={f.poste} onChange={(e) => set("poste", e.target.value)} placeholder="ex. Forages et pompes" /></Field>
        <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 55 }} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
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
          <Field label={`Montant prévisionnel (${project.currency}) *`}>
            <input style={inputStyle} type="number" min="0" inputMode="numeric" value={f.planned}
              onChange={(e) => set("planned", e.target.value)} placeholder="ex. 30000" />
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
          <input type="checkbox" checked={f.valorisation} onChange={(e) => set("valorisation", e.target.checked)}
            className="w-4 h-4" style={{ accentColor: C.accent }} />
          Valorisation (contribution en nature, bénévolat — hors trésorerie)
        </label>
        <Field label="Commentaire"><textarea style={{ ...inputStyle, minHeight: 50 }} value={f.comment} onChange={(e) => set("comment", e.target.value)} /></Field>
        <p className="text-xs flex items-center gap-1.5" style={{ color: C.muted }}>
          <Lock size={11} /> Engagé et payé sont calculés depuis les devis validés et les factures/reçus, pas saisis.
        </p>
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

/* Justificatif financier sur une ligne */
function FinDocForm({ currency, validatorOrgs, onSave, onClose }) {
  const finTypes = ["devis", "facture", "recu", "justificatif", "convention", "note"];
  const [type, setType] = useState("facture");
  const [filename, setFilename] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState(false);
  const needsAmount = DOC_TYPES[type].hasAmount;
  return (
    <Sheet title="Ajouter un justificatif" onClose={onClose}>
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
            <input style={inputStyle} type="number" min="0" inputMode="numeric" value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="ex. 12000" />
          </Field>
        )}
        {type === "facture" && (
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="w-4 h-4" style={{ accentColor: C.accent }} />
            Facture payée (compte dans le « payé »)
          </label>
        )}
        {type === "devis" && (
          <div className="rounded-xl p-3.5 text-xs" style={{ backgroundColor: C.warnSoft, color: C.warn }}>
            <div className="flex items-center gap-1.5 font-medium mb-1"><ShieldCheck size={13} /> Validation requise</div>
            Ce devis devra être validé par : {validatorOrgs.map((o) => o.name).join(", ")}. Il comptera dans l'engagé une fois validé.
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

/* ============================================================
   PHASE 2 — MODULE BUDGET (KPI, vues, lignes)
   ============================================================ */
function BudgetModule({ project, budgetLines, orgs, phases, docs, validations, P, setBudgetLines, setDocs, setValidations, user, validatorOrgs }) {
  const [view, setView] = useState("lignes");
  const [lineModal, setLineModal] = useState(null);   // {line?} ou true
  const [docModal, setDocModal] = useState(null);     // lineId
  const [openLine, setOpenLine] = useState(null);     // lineId déplié
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

  const exportCsv = () => {
    const header = "poste;description;categorie;financeur;organisation_responsable;phase;annee;devise;previsionnel;engage;paye;reste_a_engager;reste_a_payer;valorisation;statut;commentaire";
    const rows = enriched.map((l) => [
      l.poste, l.description, LINE_CATEGORIES[l.category]?.label,
      orgs.find((o) => o.id === l.funderOrgId)?.name || "", orgs.find((o) => o.id === l.ownerOrgId)?.name || "",
      phases.find((p) => p.id === l.phaseId)?.name || "", l.year, cur,
      l.planned, l.engaged, l.paid, (l.planned || 0) - l.engaged, l.engaged - l.paid,
      l.valorisation ? "oui" : "non", LINE_STATUS[l.status]?.label, l.comment,
    ].map((v) => String(v ?? "").replace(/;/g, ",")).join(";"));
    const blob = new Blob(["\ufeff" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `budget-${project.name.slice(0, 30)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet size={15} color={C.accent} />
          <h2 className="text-sm font-semibold">Budget détaillé</h2>
        </div>
        <div className="flex items-center gap-2">
          {(P.finance || P.role === "lecteur") && (
            <button className="text-xs font-medium inline-flex items-center gap-1" style={{ color: C.accent }} onClick={exportCsv}>
              <Download size={13} /> Export CSV
            </button>
          )}
          {P.finance && <button className="text-sm font-medium" style={{ color: C.accent }} onClick={() => setLineModal(true)}>+ Ligne</button>}
        </div>
      </div>

      {/* KPI */}
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
      {project.budget != null && (
        <p className="text-xs mb-4" style={{ color: (planned + valorisations) > project.budget ? C.danger : C.muted }}>
          Enveloppe globale du projet : {fmtMoney(project.budget, cur)} · lignes saisies : {fmtMoney(planned + valorisations, cur)}
          {(planned + valorisations) > project.budget && " — dépassement !"}
        </p>
      )}

      {/* Sélecteur de vue */}
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

      {/* VUE LIGNES */}
      {view === "lignes" && (
        <div className="space-y-2.5">
          {enriched.length === 0 && (
            <p className="text-sm text-center py-6" style={{ color: C.muted }}>
              Aucune ligne budgétaire. {P.finance ? "Créez la première ligne ou importez un budget Excel." : ""}
            </p>
          )}
          {enriched.map((l) => {
            const lDocs = docs.filter((d) => d.lineId === l.id);
            const open = openLine === l.id;
            return (
              <div key={l.id} className="rounded-xl border" style={{ borderColor: C.border }}>
                <button className="w-full p-3.5 text-left" onClick={() => setOpenLine(open ? null : l.id)}>
                  <div className="flex items-center gap-2">
                    {open ? <ChevronDown size={15} color={C.muted} className="flex-shrink-0" /> : <ChevronRight size={15} color={C.muted} className="flex-shrink-0" />}
                    <span className="font-medium text-sm flex-1 min-w-0 truncate">{l.poste}</span>
                    {l.valorisation && <Badge label="Valorisation" fg={C.purple} bg={C.purpleSoft} />}
                    <Badge {...LINE_CATEGORIES[l.category]} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 ml-6 text-xs" style={{ color: C.muted }}>
                    <span>{orgs.find((o) => o.id === l.funderOrgId)?.name}</span>
                    <span>·</span><span>{l.year}</span>
                    {l.phaseId && <><span>·</span><span>{phases.find((p) => p.id === l.phaseId)?.name}</span></>}
                    <Badge {...LINE_STATUS[l.status]} />
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
                    {l.description && <p className="text-sm" style={{ color: C.muted }}>{l.description}</p>}
                    {l.comment && <p className="text-xs italic" style={{ color: C.muted }}>« {l.comment} »</p>}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg p-2" style={{ backgroundColor: C.bg }}>
                        <span style={{ color: C.muted }}>Reste à engager</span>
                        <div className="font-semibold tabular-nums" style={{ color: (l.planned - l.engaged) < 0 ? C.danger : C.ink }}>{fmtMoney(l.planned - l.engaged, cur)}</div>
                      </div>
                      <div className="rounded-lg p-2" style={{ backgroundColor: C.bg }}>
                        <span style={{ color: C.muted }}>Reste à payer</span>
                        <div className="font-semibold tabular-nums">{fmtMoney(l.engaged - l.paid, cur)}</div>
                      </div>
                    </div>
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
                                      onClick={() => setDocs((ds) => ds.map((x) => x.id === d.id ? { ...x, paid: true } : x))}>
                                      Marquer payée
                                    </button>
                                  : <Badge label="À payer" fg={C.warn} bg={C.warnSoft} />)}
                              {!state && d.type !== "facture" && <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>{label}</span>}
                            </div>
                          );
                        })}
                        {(P.finance || P.contribute) && (
                          <button className="text-sm font-medium py-0.5" style={{ color: C.accent }} onClick={() => setDocModal(l.id)}>
                            + Justificatif
                          </button>
                        )}
                      </div>
                    </div>
                    {P.finance && (
                      <Btn variant="ghost" small onClick={() => setLineModal({ line: l })}>Modifier la ligne</Btn>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* VUES AGRÉGÉES */}
      {view !== "lignes" && groups && (
        <div className="space-y-3">
          {groups.map(([k, g]) => {
            const total = g.planned + g.valorisations;
            return (
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
                {g.valorisations > 0 && (
                  <p className="text-xs mt-1.5" style={{ color: C.purple }}>+ {fmtMoney(g.valorisations, cur)} de valorisations</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!P.finance && (
        <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: C.muted }}>
          <Lock size={11} /> Lignes gérées par le chef de projet et le responsable financier.
        </p>
      )}

      {/* MODALES */}
      {lineModal && P.finance && (
        <LineForm project={project} orgs={orgs} phases={phases}
          initial={lineModal.line || null}
          onClose={() => setLineModal(null)}
          onSave={(f) => {
            if (lineModal.line) setBudgetLines((ls) => ls.map((x) => x.id === lineModal.line.id ? { ...x, ...f } : x));
            else setBudgetLines((ls) => [...ls, { ...f, id: uid(), projectId: project.id }]);
            setLineModal(null);
          }} />
      )}
      {docModal && (
        <FinDocForm currency={cur} validatorOrgs={validatorOrgs}
          onClose={() => setDocModal(null)}
          onSave={({ type, filename, amount, paid }) => {
            const docId = uid();
            setDocs((ds) => [...ds, { id: docId, taskId: null, lineId: docModal, type, filename, amount, paid, by: user.id, date: TODAY }]);
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
   DÉTAIL PROJET
   ============================================================ */
function TaskForm({ users, docs, validations, currency, taskId, initial, canEdit, canAddDoc, onSave, onClose, onAddDoc }) {
  const [f, setF] = useState(initial || {
    title: "", description: "", assigneeId: "", start: "", end: "",
    status: "a_faire", progress: 0, comment: "",
  });
  const set = (k, v) => setF({ ...f, [k]: v });
  const tDocs = taskId ? docs.filter((d) => d.taskId === taskId) : [];
  return (
    <Sheet title={initial ? (canEdit ? "Tâche" : "Tâche (lecture seule)") : "Nouvelle tâche"} onClose={onClose}>
      <fieldset disabled={!canEdit} style={{ border: "none", padding: 0, margin: 0 }}>
        <div className="space-y-4">
          <Field label="Titre *"><input style={inputStyle} value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 60 }} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
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
          <Field label="Commentaire"><textarea style={{ ...inputStyle, minHeight: 50 }} value={f.comment} onChange={(e) => set("comment", e.target.value)} /></Field>
        </div>
      </fieldset>
      {taskId && (
        <div className="mt-4">
          <span className="block text-xs font-medium mb-2" style={{ color: C.muted }}>Documents</span>
          <div className="space-y-1.5">
            {tDocs.map((d) => {
              const { label, Icon } = DOC_TYPES[d.type];
              const state = d.type === "devis" ? devisState(d.id, validations) : null;
              return (
                <div key={d.id} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: C.bg }}>
                  <Icon size={14} color={C.muted} className="flex-shrink-0" />
                  <span className="truncate flex-1 min-w-0">{d.filename}</span>
                  {d.amount != null && <span className="text-xs font-medium tabular-nums">{fmtMoney(d.amount, currency)}</span>}
                  {state ? <Badge {...DEVIS_STATE[state]} /> : <span className="text-xs" style={{ color: C.muted }}>{label}</span>}
                </div>
              );
            })}
            {canAddDoc && <button className="text-sm font-medium py-1" style={{ color: C.accent }} onClick={onAddDoc}>+ Ajouter un document</button>}
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

function PhaseForm({ currency, onSave, onClose }) {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  return (
    <Sheet title="Nouvelle phase" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nom de la phase *"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label={`Enveloppe de la phase (${currency})`}>
          <input style={inputStyle} type="number" min="0" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Btn variant="ghost" full onClick={onClose}>Annuler</Btn>
          <Btn full disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), budget: budget === "" ? null : Number(budget) })}>
            <Check size={15} /> Créer
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
          <p><strong style={{ color: C.ink }}>Comité</strong> : projet, budgets, phases, membres, circuit de validation.</p>
          <p><strong style={{ color: C.ink }}>Resp. financier</strong> : lignes budgétaires, justificatifs, factures payées, export/import budget.</p>
          <p><strong style={{ color: C.ink }}>Terrain</strong> : tâches et dépôt de pièces.</p>
          <p><strong style={{ color: C.ink }}>Lecteur</strong> : consultation ; validation des devis si son organisation est validatrice.</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" full onClick={onClose}>Annuler</Btn>
          <Btn full disabled={!userId} onClick={() => onSave({ userId, role })}><Check size={15} /> Ajouter</Btn>
        </div>
      </div>
    </Sheet>
  );
}

function ProjectDetail({ projectId, allProjects, orgs, members, phases, tasks, docs, budgetLines, users, validations, user, perms, setPhases, setTasks, setDocs, setBudgetLines, setValidations, setProjects, setMembers, projectProgress, back }) {
  const project = allProjects.find((p) => p.id === projectId);
  const projectPhases = phases.filter((p) => p.projectId === projectId);
  const [tab, setTab] = useState("suivi"); // suivi | budget
  const [openPhases, setOpenPhases] = useState(() => new Set(projectPhases.map((p) => p.id)));
  const [taskModal, setTaskModal] = useState(null);
  const [docModal, setDocModal] = useState(null);
  const [phaseModal, setPhaseModal] = useState(false);
  const [editProject, setEditProject] = useState(false);
  const [memberModal, setMemberModal] = useState(false);
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
  };
  const canEditTask = (t) => P.manage || (P.contribute && (t.createdBy === user.id || t.assigneeId === user.id));

  return (
    <div className="space-y-4">
      <button onClick={back} className="inline-flex items-center gap-1 text-sm font-medium py-1" style={{ color: C.accent }}>
        <ChevronLeft size={16} /> Projets
      </button>

      <div className="flex items-center gap-2 text-xs px-3.5 py-2.5 rounded-xl"
        style={{ backgroundColor: P.role ? ACCESS_ROLES[P.role].bg : "#EEF0EE", color: P.role ? ACCESS_ROLES[P.role].fg : C.muted }}>
        {P.manage ? <ShieldCheck size={14} /> : P.finance ? <Wallet size={14} /> : P.contribute ? <Users size={14} /> : <Eye size={14} />}
        <span className="font-medium">
          {P.role ? `Votre accès : ${ACCESS_ROLES[P.role].label}` : "Consultation via votre organisation"}
        </span>
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

      {/* ONGLETS SUIVI / BUDGET */}
      <div className="flex rounded-xl p-1" style={{ backgroundColor: "#EAEDEA" }}>
        {[["suivi", "Suivi opérationnel"], ["budget", "Budget et finances"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: tab === k ? C.surface : "transparent", color: tab === k ? C.ink : C.muted, boxShadow: tab === k ? "0 1px 2px rgba(0,0,0,.06)" : "none" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "budget" && (
        <BudgetModule project={project} budgetLines={budgetLines} orgs={orgs} phases={phases}
          docs={docs} validations={validations} P={P} user={user} validatorOrgs={validatorOrgs}
          setBudgetLines={setBudgetLines} setDocs={setDocs} setValidations={setValidations} />
      )}

      {tab === "budget" && (
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck size={15} color={C.accent} />
            <h2 className="text-sm font-semibold">Validation des devis</h2>
          </div>
          <p className="text-xs mb-3" style={{ color: C.muted }}>
            Circuit : {validatorOrgs.map((o) => `${o.name} (${PROJECT_ROLES[o.role].label})`).join(" et ")}.
          </p>
          {projectDevis.length === 0 && <p className="text-sm" style={{ color: C.muted }}>Aucun devis déposé.</p>}
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
                      const canDecide = v.decision === "en_attente" && v.orgId === user.orgId;
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
      )}

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
            {P.manage
              ? <button className="text-sm font-medium py-1" style={{ color: C.accent }} onClick={() => setPhaseModal(true)}>+ Phase</button>
              : <span className="text-xs flex items-center gap-1" style={{ color: C.muted }}><Lock size={11} /> phases définies par le comité</span>}
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
                        const tDocs = docs.filter((d) => d.taskId === t.id);
                        const late = isLate(t);
                        return (
                          <button key={t.id} className="w-full text-left py-3 border-b last:border-b-0"
                            style={{ borderColor: C.border }} onClick={() => setTaskModal({ phaseId: ph.id, task: t })}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-sm leading-snug flex-1 min-w-0">{t.title}</span>
                              <Badge {...TASK_STATUS[t.status]} />
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>
                                {users.find((u) => u.id === t.assigneeId)?.name || "Non assignée"}
                              </span>
                              <ProgressBar value={t.progress} />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                              {late && <span className="text-xs font-medium" style={{ color: C.warn }}>⚠ En retard · {fmtDate(t.end)}</span>}
                              {!late && t.end && <span className="text-xs" style={{ color: C.muted }}>Échéance {fmtDate(t.end)}</span>}
                              {tDocs.length > 0 && <span className="text-xs" style={{ color: C.muted }}>📎 {tDocs.length} doc{tDocs.length > 1 ? "s" : ""}</span>}
                            </div>
                          </button>
                        );
                      })}
                      {P.contribute && (
                        <div className="pt-3">
                          <button className="text-sm font-medium py-1" style={{ color: C.accent }}
                            onClick={() => setTaskModal({ phaseId: ph.id })}>+ Tâche</button>
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
      {phaseModal && P.manage && (
        <PhaseForm currency={project.currency} onClose={() => setPhaseModal(false)}
          onSave={({ name, budget }) => {
            setPhases((ps) => [...ps, { id: uid(), projectId, name, budget, start: "", end: "", status: "a_venir" }]);
            setPhaseModal(false);
          }} />
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
          taskId={taskModal.task?.id} initial={taskModal.task}
          canEdit={taskModal.task ? canEditTask(taskModal.task) : P.contribute}
          canAddDoc={P.contribute}
          onClose={() => setTaskModal(null)}
          onAddDoc={() => setDocModal(taskModal.task.id)}
          onSave={(f) => {
            if (taskModal.task) setTasks((ts) => ts.map((t) => t.id === taskModal.task.id ? { ...t, ...f } : t));
            else setTasks((ts) => [...ts, { ...f, id: uid(), phaseId: taskModal.phaseId, createdBy: user.id }]);
            setTaskModal(null);
          }} />
      )}
      {docModal && P.contribute && (
        <FinDocForm currency={project.currency} validatorOrgs={validatorOrgs}
          onClose={() => setDocModal(null)}
          onSave={({ type, filename, amount, paid }) => {
            const docId = uid();
            setDocs((ds) => [...ds, { id: docId, taskId: docModal, lineId: null, type, filename, amount, paid, by: user.id, date: TODAY }]);
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
                onChange={(e) => setRejectComment(e.target.value)} placeholder="ex. Montant supérieur à l'enveloppe prévue" autoFocus />
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
      <div className="space-y-2.5 lg:hidden">
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
      <Card className="hidden lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: C.muted }}>
              {["Nom", "Type", "Pays", "Email", "Statut"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium border-b" style={{ borderColor: C.border }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-b last:border-b-0" style={{ borderColor: C.border }}>
                <td className="px-4 py-3 font-medium">{o.name}</td>
                <td className="px-4 py-3" style={{ color: C.muted }}>{ORG_TYPES[o.type]}</td>
                <td className="px-4 py-3" style={{ color: C.muted }}>{o.country}</td>
                <td className="px-4 py-3" style={{ color: C.muted }}>{o.email}</td>
                <td className="px-4 py-3">
                  <Badge label={o.status === "active" ? "Active" : "Inactive"}
                    fg={o.status === "active" ? C.accent : C.muted} bg={o.status === "active" ? C.accentSoft : "#EEF0EE"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
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
   IMPORT — projets, phases, tâches, BUDGET
   ============================================================ */
const IMPORT_SPECS = {
  projets: {
    label: "Projets",
    required: ["nom", "organisation_porteuse"],
    optional: ["description", "pays", "zone", "date_debut", "date_fin", "statut", "budget", "devise"],
    example: "nom;description;pays;zone;date_debut;date_fin;statut;organisation_porteuse;budget;devise\nÉcoles de Ségou;Construction de 3 salles de classe;Mali;Ségou;2026-09-01;2027-08-31;en_preparation;Eau & Avenir;120000;EUR",
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
  budget: {
    label: "Budget",
    required: ["projet", "poste", "categorie", "montant_previsionnel"],
    optional: ["description", "financeur", "organisation_responsable", "phase", "annee", "valorisation", "statut", "commentaire"],
    example: "projet;poste;categorie;montant_previsionnel;description;financeur;organisation_responsable;phase;annee;valorisation;statut;commentaire\nAccès à l'eau — Région de Kayes;Pompes manuelles;investissement;18000;Fourniture et pose;AFD;Sahel Santé;Travaux de forage;2026;non;prevue;",
  },
};

function ImportPage({ allProjects, orgs, phases, users, user, accessRole, setProjects, setMembers, setPhases, setTasks, setBudgetLines }) {
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
    if (type === "budget") return role === "chef_projet" || role === "resp_financier";
    return role === "chef_projet" || role === "contributeur";
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
      if (r.categorie && !LINE_CATEGORIES[r.categorie.trim()]) errors.push("catégorie inconnue (investissement/fonctionnement/projet/autre)");
      if (r.montant_previsionnel && isNaN(Number(r.montant_previsionnel))) errors.push("montant invalide");
      if (r.financeur && !orgs.find((o) => o.name === r.financeur.trim())) errors.push("financeur inconnu");
    }
    if (r.budget && isNaN(Number(r.budget))) errors.push("budget invalide");
    if (!canImportRow(r)) errors.push("droits insuffisants sur ce projet");
    return errors;
  };

  const validated = useMemo(() => rows ? rows.map((r) => ({ row: r, errors: validateRow(r) })) : [], [rows, type, orgs, projects, phases, user]);
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
          comment: r.commentaire || "",
        };
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
          createdBy: user.id,
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
        <Lock size={12} /> Vos droits s'appliquent ligne par ligne : projets (admin org), phases (comité), budget (comité ou resp. financier), tâches (comité ou terrain).
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
          <p>Séparateur point-virgule ou virgule, dates AAAA-MM-JJ, montants en nombres sans espaces, valorisation oui/non.</p>
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
              <span>Colonnes obligatoires manquantes : {missingCols.join(", ")}. Corrigez le fichier puis réessayez.</span>
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
                  {validRows.length} valide{validRows.length > 1 ? "s" : ""} · {validated.length - validRows.length} en erreur (exclue{validated.length - validRows.length > 1 ? "s" : ""})
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
