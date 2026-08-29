import { getParcoursBySlug } from '@/lib/content'
import { toGpx } from '@/lib/geo'
import { tx } from '@/lib/i18n-text'

// La trace en GPX — l'échange universel (montres, Wikiloc, Organic Maps).
// Pas de GPX public pour les sentiers à accès guidé : la sécurité prime.
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const parcours = await getParcoursBySlug(slug)
  if (!parcours || !parcours.trace || parcours.acces_guide) {
    return new Response('Introuvable', { status: 404 })
  }
  const gpx = toGpx(tx(parcours.nom, 'fr') || slug, parcours.trace, {
    provisional: parcours.trace_statut === 'provisoire',
  })
  return new Response(gpx, {
    headers: {
      'content-type': 'application/gpx+xml; charset=utf-8',
      'content-disposition': `attachment; filename="${slug}.gpx"`,
      'cache-control': 'public, max-age=300',
    },
  })
}
