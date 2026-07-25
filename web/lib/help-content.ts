// Contenu de la page « Aide et prise en main » et des aides contextuelles.
// Porté du prototype (prototype-cem-liban.jsx) et adapté aux onglets réels.
// À terme (phase Configuration), ce contenu sera éditable par l'admin YCID.

export const HELP_INTRO =
  "Solid'Pilot est l'outil de pilotage des projets de solidarité internationale portés avec YCID. " +
  "Chaque partenaire suit ses projets, YCID coordonne, et chacun ne voit que les projets auxquels il participe."

export const HELP_SECURITY =
  "Chaque compte est personnel et chaque droit est limité au projet et au profil. Les règles sont appliquées " +
  "côté serveur (RLS) : impossible de les contourner depuis le navigateur. Toutes les actions sensibles sont " +
  "tracées dans un journal d'audit inaltérable."

export const HELP_ROLES: { role: string; desc: string }[] = [
  { role: "chef_projet", desc: "Définit le projet, les phases, le budget, les membres. Vérifie les éléments soumis." },
  { role: "resp_financier", desc: "Gère les lignes budgétaires et leur répartition sur les tâches, dépose devis et factures, marque les factures payées." },
  { role: "contributeur", desc: "Crée des tâches, dépose pièces et livrables sur les tâches, saisit les mesures d'indicateurs." },
  { role: "validateur", desc: "Validation finale des éléments en revue et des devis." },
  { role: "auditeur", desc: "Lecture seule intégrale, y compris le journal d'audit." },
  { role: "lecteur", desc: "Consultation du projet et des rapports." },
]

export const HELP_STEPS: { title: string; text: string }[] = [
  { title: "1. Suivre l'avancement", text: "Ouvrez votre projet depuis le Tableau de bord ou Projets. L'onglet Tâches liste les phases et les tâches : statut, avancement, échéances, documents." },
  { title: "2. Gérer le budget", text: "L'onglet Budget affiche les lignes avec leur financeur, les valorisations et les statuts. Chaque ligne se répartit sur les tâches qu'elle finance, et chaque tâche affiche le budget qui lui est affecté." },
  { title: "3. Faire valider", text: "Les justificatifs se déposent sur la tâche ou sur la ligne budgétaire concernée. Un devis déposé part automatiquement en validation ; une fois validé il compte comme engagé, et une facture marquée payée alimente le réalisé. Une tâche terminée ne se modifie plus sans double confirmation d'un administrateur." },
  { title: "4. Mesurer l'impact", text: "L'onglet Impact suit les indicateurs du projet (jeunes mobilisés, km de sentiers…). Une mesure par période — c'est ce qui alimente les rapports aux financeurs." },
  { title: "5. Rassembler les pièces", text: "L'onglet Documents réunit toutes les pièces du projet, quel que soit l'endroit où elles ont été déposées : filtrables par nature, par phase et par date, avec téléchargement groupé en archive." },
  { title: "6. Piloter et rendre compte", text: "L'onglet COPIL garde les comptes rendus et le suivi des décisions. La page Pilotage donne la santé de l'ensemble du portefeuille." },
]

export const HELP_FAQ: { q: string; a: string }[] = [
  { q: "Qui voit quoi ?", a: "Chaque organisation voit les projets auxquels elle participe. YCID et les administrateurs ont accès à l'ensemble." },
  { q: "Une tâche terminée peut-elle être corrigée ?", a: "Oui, mais uniquement par un administrateur YCID/LEY, après double confirmation et avec un motif obligatoire — la correction est tracée dans le Journal." },
  { q: "Une dépense a été payée, comment l'enregistrer ?", a: "Déposez la facture sur la ligne budgétaire, puis le responsable financier la marque « payée »." },
  { q: "Peut-on importer nos tableaux Excel existants ?", a: "Oui : page Import, formats Projets, Phases, Tâches et Budget (CSV, séparateur ;). Aperçu avant import, lignes en erreur exclues." },
  { q: "Qui peut modifier cette page d'aide ?", a: "Son contenu est paramétrable : à terme, l'administrateur YCID l'éditera directement depuis l'outil." },
  { q: "Les accès sont-ils sécurisés ?", a: HELP_SECURITY },
]

// Aides contextuelles par onglet de la fiche projet (clé = paramètre ?tab=)
export const TAB_HELP: Record<string, { title: string; anchor: string; excerpt: string }> = {
  apercu: {
    title: "Aperçu",
    anchor: "roles",
    excerpt: "Vue d'ensemble du projet : les organisations impliquées avec leur rôle (porteur, partenaire, financeur…) et les membres avec leur profil d'accès. Les droits de chacun découlent de ce profil.",
  },
  taches: {
    title: "Tâches",
    anchor: "premiers-pas",
    excerpt: "Les phases structurent le projet, les tâches portent l'avancement (statut, %, échéance, pièces justificatives). Une tâche déclarée terminée sans aucune pièce est signalée « sans justificatif » — signalée, jamais bloquée. Une tâche terminée est verrouillée : seule une double confirmation d'un administrateur permet de la rouvrir, avec motif tracé au Journal.",
  },
  budget: {
    title: "Budget",
    anchor: "premiers-pas",
    excerpt: "Trois montants par ligne, par phase et par projet : prévu (budgété), engagé (devis validés) et payé (factures et reçus réglés). Le budget d'une phase est la somme de ses lignes, jamais une saisie séparée. Le montant voté du projet est la référence : déplacer du budget d'une ligne à l'autre est normal, l'enveloppe totale ne doit pas bouger. Les lignes « valorisation » (apports non financiers) sont comptées à part.",
  },
  documents: {
    title: "Documents",
    anchor: "premiers-pas",
    excerpt: "Toutes les pièces du projet réunies, quel que soit leur point de dépôt : tâche, ligne budgétaire, phase ou projet. Filtrables par nature, par phase et par date ; l'archive téléchargée reprend exactement la sélection affichée.",
  },
  impact: {
    title: "Impact",
    anchor: "premiers-pas",
    excerpt: "Les indicateurs mesurent les résultats du projet par rapport à une cible. Saisissez une mesure par période : la jauge montre le chemin parcouru et alimente les rapports aux financeurs.",
  },
  copil: {
    title: "COPIL",
    anchor: "premiers-pas",
    excerpt: "Les réunions (COPIL, comité technique, terrain) conservent leurs comptes rendus et leurs décisions, chacune avec un responsable, une échéance et un statut de suivi.",
  },
  audit: {
    title: "Journal",
    anchor: "faq",
    excerpt: "Le journal d'audit trace qui a fait quoi et quand : créations, modifications, validations, réouvertures de tâches… Il est inaltérable et consultable par tous les membres du projet.",
  },
}
