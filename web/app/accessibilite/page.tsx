export const dynamic = 'force-dynamic'
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getPlatformSettings } from "@/lib/settings"

// Page publique (accessible sans connexion).
// Obligation légale pour un service du secteur public : article 47 de la
// loi n° 2005-102, décret n° 2019-768. La déclaration doit indiquer l'état
// de conformité, les contenus non accessibles et une voie de recours.
// ⚠️ Gabarit à compléter par YCID après l'audit RGAA formel : tant que
// l'audit n'a pas eu lieu, l'état déclaré reste « non conforme » (aucun
// audit ≠ conforme).
export default async function AccessibilitePage() {
  const s = await getPlatformSettings()
  const h2 = { fontFamily: "var(--font-sora)", color: "#17211D" }
  const p = { color: "#66716B" }
  return (
    <div className="min-h-screen py-10 px-4" style={{ background: "#F5F6F4" }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1 text-sm mb-6" style={{ color: "#66716B" }}>
          <ChevronLeft size={16} aria-hidden="true" /> Retour à l&apos;accueil
        </Link>
        <div className="bg-white rounded-2xl border p-8 space-y-6" style={{ borderColor: "#E3E6E2" }}>
          <h1 className="text-2xl font-bold" style={h2}>Déclaration d&apos;accessibilité</h1>
          <p className="text-sm" style={p}>
            {s.legalEntity} s&apos;engage à rendre {s.brandName} accessible, conformément à
            l&apos;article 47 de la loi n° 2005-102 du 11 février 2005. Cette déclaration
            s&apos;applique à l&apos;ensemble de la plateforme.
          </p>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>État de conformité</h2>
            <p className="text-sm" style={p}>
              <strong>Non conforme</strong> : aucun audit RGAA 4.1 complet n&apos;a encore été
              réalisé. Un premier lot de corrections a été appliqué (navigation au clavier,
              dialogues accessibles, étiquettes de formulaires, lien d&apos;évitement, indicateur
              de focus, respect de la préférence « mouvement réduit », contraste des textes).
              Le taux de conformité sera publié ici à l&apos;issue de l&apos;audit.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Contenus non accessibles</h2>
            <ul className="text-sm list-disc pl-5 space-y-1" style={p}>
              <li>Les graphiques d&apos;avancement et de budget n&apos;ont pas encore d&apos;équivalent textuel détaillé ; les mêmes chiffres restent lisibles dans les tableaux de la même page.</li>
              <li>Les documents importés par les organisations partenaires (PDF, tableurs) ne sont pas contrôlés : leur accessibilité dépend de leur auteur.</li>
              <li>Les contenus générés par intelligence artificielle sont relus par un humain avant publication, mais leur structure n&apos;est pas garantie.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Amélioration et contact</h2>
            <p className="text-sm" style={p}>
              Si vous n&apos;arrivez pas à accéder à un contenu ou à un service, signalez-le
              {s.legalEmail ? <> à <strong>{s.legalEmail}</strong></> : <> à l&apos;administrateur de la plateforme</>} :
              nous vous indiquerons une alternative et corrigerons le point signalé.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Voie de recours</h2>
            <p className="text-sm" style={p}>
              Si le signalement reste sans réponse, vous pouvez écrire au Défenseur des droits
              (formulaire en ligne, courrier gratuit sans affranchissement à : Défenseur des
              droits, Libre réponse 71120, 75342 Paris CEDEX 07) ou contacter le délégué du
              Défenseur des droits de votre département.
            </p>
          </section>

          <p className="text-xs" style={p}>
            Technologies utilisées : HTML, CSS, JavaScript. Cette déclaration sera mise à jour
            après le premier audit RGAA.
          </p>
        </div>
      </div>
    </div>
  )
}
