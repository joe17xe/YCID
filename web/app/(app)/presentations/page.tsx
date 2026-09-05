export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Maximize2, Printer, Presentation } from "lucide-react"
import Foldable from "@/components/ui/Foldable"

// ============================================================
// Supports de présentation (04/09)
// ============================================================
// Les deux supports existaient déjà, servis en fichiers statiques
// depuis public/presentation — mais ils n'étaient atteignables que par
// deux liens soulignés au milieu de la page Aide. « Est-ce que tu peux
// les rendre dans l'application ? » : une présentation qu'on ne
// retrouve pas la veille d'une séance n'existe pas.
//
// Cette page leur donne une porte dans la navigation, et surtout un
// APERÇU : on voit ce qu'on s'apprête à projeter avant de brancher le
// vidéoprojecteur.
//
// Les supports restent des fichiers statiques, ouverts hors de
// l'application : c'est ce qui leur permet de fonctionner SANS
// CONNEXION, depuis le poste d'une mairie ou un fichier téléchargé si
// le wifi de la salle est mauvais. La page ne les recopie pas, elle y
// mène.

const VOLETS = [
  { key: "jeita", label: "Jouy-en-Josas ↔ Jeïta" },
  { key: "azour", label: "Villepreux ↔ Azour" },
] as const

// Les touches sont celles du moteur des deux supports (voir
// public/presentation/README.md) : les rappeler ici évite de les
// découvrir devant la salle.
const TOUCHES: [string, string][] = [
  ["→ espace", "diapositive suivante — un clic dans la page aussi"],
  ["←", "précédente"],
  ["S", "sommaire cliquable"],
  ["N", "notes du présentateur : minutage, points à insister, questions attendues"],
  ["T", "chrono — il vire à l’orange après 30 min"],
  ["P", "plein écran"],
]

function Bouton({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
      style={primary
        ? { background: "var(--brand-accent,#0E6B5C)", color: "#FFFFFF" }
        : { border: "1px solid #E3E6E2", color: "#17211D" }}>
      {children}
    </a>
  )
}

export default async function PresentationsPage({ searchParams }: { searchParams: Promise<{ volet?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const { volet: asked } = await searchParams
  const volet = VOLETS.some(v => v.key === asked) ? asked! : "jeita"
  const voletLabel = VOLETS.find(v => v.key === volet)!.label
  const communesUrl = `/presentation/communes.html?volet=${volet}`

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
          Supports de présentation
        </h1>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: "#66716B" }}>
          Deux supports, deux publics. Ils s’ouvrent dans un nouvel onglet, se projettent en
          plein écran et s’impriment en PDF. Ce sont des fichiers autonomes : ils fonctionnent
          même si la salle n’a pas de connexion.
        </p>
      </div>

      <div className="space-y-6">
        {/* ---- Support aux communes ---- */}
        <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
          <div className="flex items-center gap-2 mb-1">
            <Presentation size={16} style={{ color: "var(--brand-accent,#0E6B5C)" }} aria-hidden="true" />
            <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
              Aux communes partenaires
            </h2>
            <span className="text-xs" style={{ color: "#66716B" }}>30 min · 30 diapositives</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "#66716B" }}>
            La séance de prise en main : à quoi sert l’outil, comment on s’en sert, et les
            bonnes pratiques. Elle se termine par ce qu’on demande à chacun.
          </p>

          {/* Le volet n'est pas un détail de présentation : c'est à ses
              propres chiffres et à ses propres noms qu'une salle
              reconnaît qu'on a préparé SA séance. Des liens serveur,
              comme le tri du Pilotage — aucun état client. */}
          <div className="mt-4">
            <p className="text-xs mb-1.5" style={{ color: "#66716B" }}>Volet présenté</p>
            <nav aria-label="Volet présenté" className="flex flex-wrap items-center gap-1 rounded-2xl border p-1 w-fit" style={{ borderColor: "#E3E6E2" }}>
              {VOLETS.map(v => (
                <Link key={v.key} href={v.key === "jeita" ? "/presentations" : `/presentations?volet=${v.key}`}
                  aria-current={v.key === volet ? "true" : undefined}
                  className="px-3 py-1.5 rounded-xl text-sm font-medium"
                  style={v.key === volet
                    ? { background: "var(--brand-accent,#0E6B5C)", color: "#FFFFFF" }
                    : { color: "#66716B" }}>
                  {v.label}
                </Link>
              ))}
            </nav>
            <p className="text-xs mt-1.5" style={{ color: "#66716B" }}>
              Le sélecteur du bandeau bas fait la même chose en pleine séance, sans toucher à l’URL.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Bouton href={communesUrl} primary>
              <Maximize2 size={14} aria-hidden="true" /> Ouvrir — {voletLabel}
            </Bouton>
            <span className="text-xs flex items-center gap-1" style={{ color: "#66716B" }}>
              <Printer size={13} aria-hidden="true" /> une fois ouverte, Ctrl/⌘ + P sort un PDF paysage
            </span>
          </div>

          {/* Un aperçu intégré, replié sur téléphone : une diapositive
              16/9 dans 390 px de large ne se lit pas — on l'ouvre en
              plein écran. Sur un ordinateur, il évite d'ouvrir un onglet
              pour vérifier une correction. */}
          <div className="mt-4">
            <Foldable className="overflow-hidden" titleAs="h3" title="Aperçu"
              summary="La présentation telle qu’elle se projettera"
              rememberKey="apercu-communes" collapsedOnMobile bodyClassName="p-3">
              <iframe src={communesUrl} title={`Aperçu du support aux communes — ${voletLabel}`}
                className="w-full rounded-xl border"
                style={{ borderColor: "#E3E6E2", aspectRatio: "16 / 9" }} />
            </Foldable>
          </div>
        </div>

        {/* ---- Support à la coordination ---- */}
        <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
          <div className="flex items-center gap-2 mb-1">
            <Presentation size={16} style={{ color: "var(--brand-accent,#0E6B5C)" }} aria-hidden="true" />
            <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
              À la coordination et à YCID
            </h2>
            <span className="text-xs" style={{ color: "#66716B" }}>25 min · 22 diapositives</span>
          </div>
          {/* Deux publics, deux supports : la commune demande « comment
              je m'en sers », la coordination « ce que je vois, décide et
              dois prouver ». Un support unique aurait mal répondu aux
              deux. */}
          <p className="text-sm leading-relaxed" style={{ color: "#66716B" }}>
            Ce que la direction de programme voit, décide et doit prouver : les trois volets
            d’un coup d’œil, la file de validation, le compte rendu au financeur et la piste
            d’audit.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Bouton href="/presentation/ycid.html" primary>
              <Maximize2 size={14} aria-hidden="true" /> Ouvrir la présentation
            </Bouton>
            <span className="text-xs flex items-center gap-1" style={{ color: "#66716B" }}>
              <Printer size={13} aria-hidden="true" /> Ctrl/⌘ + P pour le PDF
            </span>
          </div>

          <div className="mt-4">
            <Foldable className="overflow-hidden" titleAs="h3" title="Aperçu"
              summary="La présentation telle qu’elle se projettera"
              rememberKey="apercu-ycid" collapsedOnMobile bodyClassName="p-3">
              <iframe src="/presentation/ycid.html" title="Aperçu du support à la coordination"
                className="w-full rounded-xl border"
                style={{ borderColor: "#E3E6E2", aspectRatio: "16 / 9" }} />
            </Foldable>
          </div>
        </div>

        {/* ---- Conduire la séance ---- */}
        <Foldable className="overflow-hidden" title="Pendant la présentation"
          summary="Les touches — sommaire, notes du présentateur, chrono, plein écran"
          rememberKey="presentations-touches" collapsedOnMobile bodyClassName="p-6 pt-4">
          <dl className="space-y-2">
            {TOUCHES.map(([k, quoi]) => (
              <div key={k} className="flex items-baseline gap-3 text-sm">
                <dt className="flex-shrink-0 font-mono text-xs px-2 py-1 rounded-lg w-24"
                  style={{ background: "#F5F6F4", color: "#17211D" }}>{k}</dt>
                <dd style={{ color: "#66716B" }}>{quoi}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs mt-4" style={{ color: "#66716B" }}>
            Les écrans montrés dans la visite sont des reconstitutions fidèles, pas des captures :
            elles ne périment pas au prochain changement de libellé. Pour les remplacer par de
            vraies copies d’écran, déposez les PNG dans <code>public/presentation/captures/</code> —
            aucune modification du support n’est nécessaire.
          </p>
        </Foldable>
      </div>
    </div>
  )
}
