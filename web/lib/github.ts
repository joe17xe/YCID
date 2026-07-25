// ============================================================
// PR 30 — Suivi du développement (onglet « Déploiements »)
// ============================================================
// Lecture publique de l'activité GitHub du dépôt : pull requests,
// releases et déploiements en production (runs du workflow deploy.yml).
// Configurable par variables d'environnement (serveur uniquement) :
//   GITHUB_REPO  — défaut : joe17xe/YCID
//   GITHUB_TOKEN — facultatif, relève la limite de 60 requêtes/heure
// Les réponses sont mises en cache 5 minutes pour rester sous la limite.

export interface PrItem {
  number: number
  title: string
  author: string
  url: string
  date: string
  draft: boolean
}

export interface ReleaseItem {
  name: string
  tag: string
  url: string
  date: string
  prerelease: boolean
  kind: 'release' | 'deployment'
}

export interface DevActivity {
  repo: string
  open: PrItem[]
  review: PrItem[]
  merged: PrItem[]
  published: ReleaseItem[]
  error?: string
}

const CACHE_SECONDS = 300

function repoSlug(): string {
  return process.env.GITHUB_REPO?.trim() || 'joe17xe/YCID'
}

async function gh<T>(path: string): Promise<T | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'solidpilot-roadmap',
  }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  try {
    const res = await fetch(`https://api.github.com/repos/${repoSlug()}${path}`, {
      headers,
      next: { revalidate: CACHE_SECONDS },
    })
    if (!res.ok) {
      console.error('[github] réponse inattendue:', { path, status: res.status })
      return null
    }
    return (await res.json()) as T
  } catch (e) {
    console.error('[github] échec réseau:', { path, error: e instanceof Error ? e.message : String(e) })
    return null
  }
}

interface RawPr {
  number: number; title: string; html_url: string; draft: boolean
  created_at: string; merged_at: string | null; updated_at: string
  user: { login: string } | null
  requested_reviewers?: Array<{ login: string }>
}
interface RawRelease {
  name: string | null; tag_name: string; html_url: string
  published_at: string | null; created_at: string; prerelease: boolean
}
interface RawRuns {
  workflow_runs?: Array<{
    id: number; conclusion: string | null; status: string
    head_sha: string; display_title: string; updated_at: string; html_url: string
  }>
}

export async function getDevActivity(): Promise<DevActivity> {
  const repo = repoSlug()
  const [prs, releases, runs] = await Promise.all([
    gh<RawPr[]>('/pulls?state=all&sort=updated&direction=desc&per_page=50'),
    gh<RawRelease[]>('/releases?per_page=8'),
    gh<RawRuns>('/actions/workflows/deploy.yml/runs?per_page=10&status=success'),
  ])

  if (!prs) {
    return { repo, open: [], review: [], merged: [], published: [], error: "Activité GitHub indisponible (dépôt privé, limite d'appels atteinte, ou réseau). Renseignez GITHUB_TOKEN sur le serveur pour lever la limite." }
  }

  const toItem = (p: RawPr): PrItem => ({
    number: p.number,
    title: p.title,
    author: p.user?.login ?? '—',
    url: p.html_url,
    date: p.merged_at ?? p.updated_at ?? p.created_at,
    draft: p.draft,
  })

  // « En revue » : brouillons ou relecture demandée ; « Ouvertes » : le reste
  const opened = prs.filter(p => !p.merged_at && p.html_url.includes('/pull/'))
  const review = opened.filter(p => p.draft || (p.requested_reviewers?.length ?? 0) > 0).map(toItem)
  const reviewNumbers = new Set(review.map(r => r.number))
  const open = opened.filter(p => !reviewNumbers.has(p.number)).map(toItem)
  const merged = prs.filter(p => p.merged_at).map(toItem).slice(0, 12)

  // « Publiées » : les releases si le dépôt en a, sinon les déploiements
  // réussis en production (la version affichée en pied de page = ce commit).
  let published: ReleaseItem[] = (releases ?? []).map(r => ({
    name: r.name || r.tag_name,
    tag: r.tag_name,
    url: r.html_url,
    date: r.published_at ?? r.created_at,
    prerelease: r.prerelease,
    kind: 'release' as const,
  }))
  if (published.length === 0) {
    published = (runs?.workflow_runs ?? [])
      .filter(r => r.conclusion === 'success')
      .slice(0, 8)
      .map(r => ({
        name: r.display_title,
        tag: r.head_sha.slice(0, 7),
        url: r.html_url,
        date: r.updated_at,
        prerelease: false,
        kind: 'deployment' as const,
      }))
  }

  return { repo, open, review, merged, published }
}
