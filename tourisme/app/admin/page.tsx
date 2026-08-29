import type { Metadata } from 'next'
import Link from 'next/link'
import { contentMode } from '@/lib/content'
import AdminClient from '@/components/admin/AdminClient'

export const metadata: Metadata = { title: 'Administration', robots: { index: false } }

// Le back-office est volontairement en français : c'est l'outil de
// l'équipe de gestion (LEY, municipalité, jeunes guides formés) — l'app
// publique, elle, est trilingue.
export default function PageAdmin() {
  if (contentMode() === 'fichiers') {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-[24px] font-extrabold">Administration</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--encre-2)]">
          L&rsquo;application tourne en <strong>mode fichiers</strong> (aucune base Supabase
          configurée) : le contenu vit dans <code className="mono">content/*.json</code> et se
          modifie par commit — <code className="mono">node scripts/gen-seed.mjs</code> régénère le
          seed SQL. Le back-office en ligne s&rsquo;active en renseignant{' '}
          <code className="mono">NEXT_PUBLIC_SUPABASE_URL</code> et{' '}
          <code className="mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (voir le guide de
          déploiement).
        </p>
        <Link href="/" className="btn btn-surface mt-6">Retour au site</Link>
      </main>
    )
  }
  return <AdminClient territoireSlug={process.env.NEXT_PUBLIC_TERRITOIRE ?? 'azour'} />
}
