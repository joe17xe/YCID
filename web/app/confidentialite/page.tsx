export const dynamic = 'force-dynamic'
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getPlatformSettings } from "@/lib/settings"

// Page publique (accessible sans connexion).
// ⚠️ Gabarit à valider par YCID (les champs [À compléter] notamment) —
// ceci n'est pas un avis juridique.
export default async function ConfidentialitePage() {
  const s = await getPlatformSettings()
  const h2 = { fontFamily: "var(--font-sora)", color: "#17211D" }
  const p = { color: "#66716B" }
  return (
    <div className="min-h-screen py-10 px-4" style={{ background: "#F5F6F4" }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1 text-sm mb-6" style={{ color: "#66716B" }}>
          <ChevronLeft size={16} /> Retour à l&apos;accueil
        </Link>
        <div className="bg-white rounded-2xl border p-8 space-y-6" style={{ borderColor: "#E3E6E2" }}>
          <h1 className="text-2xl font-bold" style={h2}>Politique de confidentialité</h1>
          <p className="text-sm" style={p}>
            {s.brandName} traite des données personnelles dans le cadre du pilotage de
            projets de solidarité internationale soutenus par YCID. Cette page décrit
            quelles données sont traitées, pourquoi, et vos droits (RGPD).
          </p>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Responsable de traitement</h2>
            <p className="text-sm" style={p}>
              YCID — Yvelines Coopération Internationale et Développement, [adresse à
              compléter]. Contact : [email de contact à compléter].
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Données collectées</h2>
            <ul className="text-sm list-disc pl-5 space-y-1" style={p}>
              <li><strong>Compte utilisateur</strong> : nom, adresse email, photo de profil (facultative), rôle sur la plateforme.</li>
              <li><strong>Données projets</strong> : tâches, budgets, indicateurs, réunions, décisions, documents importés — saisis par les organisations partenaires.</li>
              <li><strong>Journal d&apos;activité</strong> : certaines actions sensibles (ex. modification d&apos;une tâche terminée) sont tracées à des fins d&apos;audit.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Finalités et base légale</h2>
            <p className="text-sm" style={p}>
              Les données sont traitées pour le suivi et le pilotage des projets
              financés (exécution de la relation entre YCID et les organisations
              partenaires, intérêt légitime de suivi des fonds publics). Elles ne sont
              ni vendues, ni utilisées à des fins publicitaires.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Cookies</h2>
            <p className="text-sm" style={p}>
              La plateforme utilise uniquement des cookies <strong>strictement
              nécessaires</strong> : session d&apos;authentification et préférence de langue.
              Aucun cookie publicitaire ou de mesure d&apos;audience tierce — c&apos;est
              pourquoi aucun bandeau de consentement n&apos;est requis.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Durée de conservation</h2>
            <p className="text-sm" style={p}>
              Les comptes sont conservés pendant la durée de participation aux projets,
              puis désactivés ou supprimés. Les données projets sont conservées pendant
              la durée légale de suivi des financements publics [durée à préciser].
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Vos droits</h2>
            <p className="text-sm" style={p}>
              Conformément au RGPD, vous disposez de droits d&apos;accès, de rectification,
              d&apos;effacement, de limitation et d&apos;opposition. Pour les exercer :
              [email de contact à compléter]. Vous pouvez modifier vos informations de
              profil (nom, photo, mot de passe) directement dans vos Préférences.
              En cas de difficulté, vous pouvez saisir la CNIL (cnil.fr).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold" style={h2}>Sous-traitants</h2>
            <p className="text-sm" style={p}>
              Hébergement applicatif : Hostinger International Ltd. Base de données et
              authentification : Supabase Inc. Ces prestataires agissent comme
              sous-traitants au sens du RGPD.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
