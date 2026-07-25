export const dynamic = 'force-dynamic'
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getPlatformSettings } from "@/lib/settings"

// Page publique (accessible sans connexion, exigence légale).
// ⚠️ Les champs [À compléter] doivent être renseignés par YCID avant
// diffusion large : ce contenu est un gabarit, pas un avis juridique.
export default async function MentionsLegalesPage() {
  const s = await getPlatformSettings()
  const h2 = { fontFamily: "var(--font-sora)", color: "#17211D" }
  return (
    <div className="min-h-screen py-10 px-4" style={{ background: "#F5F6F4" }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1 text-sm mb-6" style={{ color: "#66716B" }}>
          <ChevronLeft size={16} /> Retour à l&apos;accueil
        </Link>
        <div className="bg-white rounded-2xl border p-8 space-y-6" style={{ borderColor: "#E3E6E2" }}>
          <h1 className="text-2xl font-bold" style={h2}>Mentions légales</h1>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Éditeur</h2>
            <p className="text-sm" style={{ color: "#66716B" }}>
              {s.brandName} est une plateforme de pilotage de projets de solidarité
              internationale éditée par <strong>{s.legalEntity}</strong>
              {s.legalAddress ? <>, {s.legalAddress}</> : null}.
              {s.legalPublisher && <><br />Directeur de la publication : {s.legalPublisher}.</>}
              {s.legalEmail && <><br />Contact : {s.legalEmail}.</>}
              {(!s.legalAddress || !s.legalPublisher || !s.legalEmail) && (
                <><br /><em>Informations à compléter par l&apos;administrateur dans
                Administration ▸ Configuration ▸ Mentions légales.</em></>
              )}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Hébergement</h2>
            <p className="text-sm" style={{ color: "#66716B" }}>
              Application hébergée sur un serveur privé virtuel opéré par
              <strong> Hostinger International Ltd</strong> (61 Lordou Vironos Street,
              6023 Larnaca, Chypre). Base de données et authentification opérées par
              <strong> Supabase Inc.</strong> (970 Toa Payoh North #07-04, Singapour),
              données hébergées dans la région choisie du projet.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Propriété intellectuelle</h2>
            <p className="text-sm" style={{ color: "#66716B" }}>
              L&apos;ensemble des contenus de la plateforme (structure, textes, éléments
              graphiques) est protégé. Les données saisies par les organisations
              partenaires restent la propriété de leurs auteurs et sont utilisées
              uniquement pour le suivi des projets soutenus.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Données personnelles</h2>
            <p className="text-sm" style={{ color: "#66716B" }}>
              Le traitement des données personnelles est décrit dans la{" "}
              <Link href="/confidentialite" className="underline" style={{ color: "var(--brand-accent,#0E6B5C)" }}>
                politique de confidentialité
              </Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
