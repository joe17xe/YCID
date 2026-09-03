import type { SupabaseClient } from '@supabase/supabase-js'
import { isUserAdmin } from './permissions'

// ============================================================
// La visite guidée — construite depuis les droits RÉELS
// ============================================================
// Une visite générique serait fausse : montrer « déposez un devis » à
// un auditeur, c'est lui apprendre des choses qu'il ne peut pas faire.
// Ce module lit les organisations et les rôles de la personne et écrit
// SA visite — celle du modèle à deux couches qui gouverne toute
// l'application : l'appartenance décide de ce qu'on voit, le rôle de ce
// qu'on peut faire.
//
// Serveur uniquement : les étapes se calculent avec les données, le
// composant WelcomeTour ne fait que les montrer.

export interface TourStep {
  title: string
  body: string[]
  link?: { href: string; label: string }
}

// Ce que chaque rôle SIGNIFIE, en une phrase. Les libellés viennent de
// lib/constants (ACCESS_ROLES) ; la phrase d'usage vit ici, au seul
// endroit qui raconte le modèle à un nouveau venu.
const ROLE_MEANING: Record<string, string> = {
  chef_projet: 'vous pilotez : phases, tâches, budget, membres',
  referent_mairie: 'vous pilotez côté commune : phases, tâches, budget',
  resp_financier: 'vous tenez les chiffres : lignes budgétaires, devis, factures, indicateurs',
  contributeur: 'vous réalisez : tâches, pièces jointes, mesures de terrain',
  auditeur: 'vous consultez tout sans rien modifier — c’est la force du rôle',
}

export async function buildTourSteps(supabase: SupabaseClient, userId: string): Promise<TourStep[]> {
  const [{ data: orgs }, { data: memberRoles }, admin] = await Promise.all([
    supabase.from('memberships').select('organizations:org_id(name)').eq('user_id', userId),
    supabase.from('project_members').select('role, projects:project_id(name)').eq('user_id', userId),
    isUserAdmin(supabase, userId),
  ])

  const orgNames = (orgs ?? [])
    .map((m: any) => (Array.isArray(m.organizations) ? m.organizations[0] : m.organizations)?.name)
    .filter(Boolean) as string[]
  const roles = (memberRoles ?? []).map((m: any) => ({
    role: m.role as string,
    project: ((Array.isArray(m.projects) ? m.projects[0] : m.projects)?.name ?? 'un projet') as string,
  }))

  const steps: TourStep[] = []

  // 1 — Le principe. Une seule idée, la plus structurante.
  steps.push({
    title: 'Bienvenue sur Solid’Pilot',
    body: [
      'Une règle suffit pour tout comprendre : votre organisation décide de ce que vous VOYEZ, votre rôle sur chaque projet décide de ce que vous pouvez y FAIRE.',
      orgNames.length
        ? `Vous êtes membre de ${orgNames.join(', ')} : vous voyez les projets auxquels ${orgNames.length > 1 ? 'ces organisations participent' : 'cette organisation participe'}.`
        : 'Vous n’êtes rattaché à aucune organisation pour l’instant : vous ne verrez que les projets où un rôle vous est confié. Un administrateur peut vous rattacher.',
    ],
  })

  // 2 — Ses rôles à lui, pas une liste de fonctionnalités.
  if (admin) {
    steps.push({
      title: 'Vous êtes administrateur',
      body: [
        'Vous voyez tout et configurez tout : comptes, organisations, circuit de validation, email, IA.',
        'Deux pouvoirs vous sont réservés : nommer ou retirer un auditeur — le contrôlé ne choisit pas son contrôleur — et décider une validation au nom d’une organisation, geste motivé et tracé au Journal.',
      ],
      link: { href: '/admin/acces', label: 'Voir la matrice des droits' },
    })
  } else if (roles.length) {
    steps.push({
      title: roles.length > 1 ? 'Vos rôles' : 'Votre rôle',
      body: roles.slice(0, 4).map(r =>
        `${r.project} — ${ROLE_MEANING[r.role] ?? r.role} .`.replace(' .', '.')),
    })
  }

  // 3 — Le circuit de l'argent : la mécanique que tout le monde doit
  // connaître, acteur comme observateur.
  steps.push({
    title: 'Le circuit d’un devis',
    body: [
      'Un devis vit sur une ligne budgétaire. Deux chemins y mènent : l’onglet Budget, bouton « Pièces » de la ligne ; ou l’onglet Documents, où la ligne et le montant vous seront demandés. Il part alors en validation : l’organisation porteuse d’abord, la coordinatrice ensuite.',
      'Le montant n’est engagé que lorsque toutes ont validé ; un refus le rejette. Ce qui attend VOTRE décision se trouve dans la file « À valider ».',
    ],
    link: { href: '/a-valider', label: 'Ouvrir la file « À valider »' },
  })

  // 4 — Où regarder en arrivant.
  steps.push({
    title: 'Lire un projet d’un coup d’œil',
    body: [
      'En tête de chaque projet, le pouls : avancement, engagé, payé, retards, décisions qui vous attendent.',
      '« Prochaines étapes » trie les tâches par urgence réelle — les retards d’abord — et nomme leur responsable.',
      'La cloche en haut à droite vous notifie, par email aussi si l’envoi est configuré, avec un lien direct vers la ligne concernée.',
    ],
  })

  // 5 — Où trouver de l'aide ensuite.
  steps.push({
    title: 'Et pour la suite',
    body: [
      'Chaque onglet d’un projet porte un « ? » qui explique ce qu’on y fait.',
      'La page Aide rassemble le mode d’emploi complet — et vous pourrez y revoir cette visite à tout moment.',
    ],
    link: { href: '/aide', label: 'Ouvrir l’aide' },
  })

  return steps
}
