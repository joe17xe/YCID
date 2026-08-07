// ============================================================
// Effacement RGPD par anonymisation — le vocabulaire commun
// ============================================================
// Ce module est délibérément PUR et sans importation : il est lu par
// l'action serveur (`user-actions.ts`, marquée « use server », qui ne
// peut donc rien exporter d'autre que des fonctions asynchrones), par la
// page serveur et par le tableau côté navigateur. Les trois doivent dire
// EXACTEMENT la même chose — c'est la règle du dépôt, et elle compte
// doublement ici : si l'écran et le serveur ne s'accordent pas sur la
// chaîne à recopier, le bouton se déverrouille sur une saisie que le
// serveur refuse, ou l'inverse.
//
// La migration 0063 raconte l'arbitrage complet ; on n'en répète ici que
// ce dont l'interface a besoin.

// ------------------------------------------------------------
// La chaîne à recopier pour confirmer
// ------------------------------------------------------------
// Le dépôt a un motif de confirmation par recopie du nom
// (`deleteProject`), et il a aussi le défaut qui va avec, découvert sur
// les phases puis sur les projets : `full_name` est `not null default ''`
// (0001), donc la chaîne vide est parfaitement légale. La comparaison
// `saisie !== nom` évalue alors `'' !== ''`, c'est-à-dire FAUX — la
// confirmation est réputée acquise SANS QU'ON AIT RIEN SAISI, et le
// bouton se déverrouille tout seul. Sur une opération irréversible, ce
// n'est pas une gêne, c'est un déclencheur.
//
// `deleteProject` s'en sort en REFUSANT : un projet sans nom ne peut pas
// être supprimé tant qu'on ne l'a pas nommé. Ce remède ne convient pas
// ici. Un compte sans nom complet n'a rien d'exceptionnel — le trigger
// d'inscription crée la ligne `profiles` avec `full_name` à vide, et
// l'import en masse ne le renseigne qu'à partir de l'adresse — et c'est
// justement le compte dont la seule donnée personnelle est l'adresse,
// donc celui pour lequel l'effacement se demande le plus simplement.
// Refuser reviendrait à exiger de l'administrateur qu'il INVENTE un nom
// à quelqu'un avant de pouvoir l'effacer.
//
// D'où une échelle : le nom, sinon l'adresse (`unique not null`), sinon
// rien — et « rien » est refusé des deux côtés, explicitement, jamais par
// une comparaison qui se trouve être fausse.
export function anonymizationConfirmationTarget(
  profile: { full_name?: string | null; email?: string | null },
): string {
  return (profile.full_name ?? '').trim() || (profile.email ?? '').trim()
}

// Vrai quand la saisie confirme. Le premier test est le seul qui
// compte : une cible vide ne confirme JAMAIS, quoi qu'on ait tapé.
export function anonymizationConfirmed(target: string, typed: string): boolean {
  if (!target.trim()) return false
  return (typed ?? '').trim() === target.trim()
}

// ------------------------------------------------------------
// Ce que le compte laisse derrière lui, dit en français
// ------------------------------------------------------------
// `profile_trace_count()` (0063) rend un détail par CLÉ ÉTRANGÈRE —
// « audit_log.user_id: 40 » — parce qu'il le lit dans le catalogue et
// qu'il n'a pas d'opinion sur le vocabulaire du produit. L'opinion est
// ici, et elle sert deux fois : sur l'écran de confirmation, et dans le
// commentaire de la trace d'audit. Une seule liste, donc, plutôt que la
// même phrase écrite deux fois avec deux totaux qui finiront par
// différer.
//
// Une clé absente de ce dictionnaire n'est PAS masquée : elle s'affiche
// telle quelle. C'est voulu — une table ajoutée demain apparaîtra sous
// son nom technique, ce qui est laid et honnête, plutôt que de
// disparaître du compte rendu d'une opération irréversible.
const TRACE_LABELS: Record<string, [string, string]> = {
  'audit_log.user_id': ['trace au journal', 'traces au journal'],
  'validations.decided_by': ['validation décidée', 'validations décidées'],
  'documents.uploaded_by': ['pièce déposée', 'pièces déposées'],
  'tasks.assignee_id': ['tâche assignée', 'tâches assignées'],
  'tasks.created_by': ['tâche créée', 'tâches créées'],
  'projects.created_by': ['projet créé', 'projets créés'],
  'organizations.created_by': ['organisation créée', 'organisations créées'],
  'project_members.user_id': ['rattachement à un projet', 'rattachements à des projets'],
  'memberships.user_id': ['rattachement à une organisation', 'rattachements à des organisations'],
  'reviews.updated_by': ['revue mise à jour', 'revues mises à jour'],
  'meetings.created_by': ['réunion créée', 'réunions créées'],
  'decisions.owner_user_id': ['décision portée', 'décisions portées'],
  'indicator_measures.entered_by': ['relevé d’indicateur', 'relevés d’indicateur'],
  'notifications.user_id': ['notification reçue', 'notifications reçues'],
  'import_runs.by_user': ['import réalisé', 'imports réalisés'],
  'ideas.author_id': ['idée proposée', 'idées proposées'],
  'idea_votes.user_id': ['vote sur une idée', 'votes sur des idées'],
  'idea_comments.author_id': ['commentaire sur une idée', 'commentaires sur des idées'],
  'ai_reports.created_by': ['rapport généré', 'rapports générés'],
  'ai_usage.user_id': ['appel à l’IA', 'appels à l’IA'],
  'comm_campaigns.created_by': ['campagne créée', 'campagnes créées'],
  'comm_campaigns.responsible_id': ['campagne pilotée', 'campagnes pilotées'],
  'platform_settings.updated_by': ['réglage de la plateforme', 'réglages de la plateforme'],
  'ai_settings.updated_by': ['réglage de l’IA', 'réglages de l’IA'],
  'email_settings.updated_by': ['réglage des courriels', 'réglages des courriels'],
}

export interface TraceCount {
  total: number
  blocking: number
  detail: Record<string, number>
}

// Normalise ce que rend PostgREST : un jsonb devient un objet, mais rien
// ne garantit sa forme si la migration 0063 n'est pas celle qu'on croit.
export function asTraceCount(raw: unknown): TraceCount {
  const o = (raw ?? {}) as Record<string, unknown>
  const detail: Record<string, number> = {}
  for (const [k, v] of Object.entries((o.detail ?? {}) as Record<string, unknown>)) {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) detail[k] = n
  }
  return { total: Number(o.total) || 0, blocking: Number(o.blocking) || 0, detail }
}

// « 40 traces au journal, 1 pièce déposée, 2 tâches assignées ».
// Trié par volume décroissant : ce qui pèse se lit en premier.
export function describeTraces(detail: Record<string, number>): string[] {
  return Object.entries(detail)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, n]) => {
      const labels = TRACE_LABELS[key]
      if (!labels) return `${n} × ${key}`
      return `${n} ${n > 1 ? labels[1] : labels[0]}`
    })
}
