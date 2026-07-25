// Pied de page versionné : les valeurs sont injectées au build par
// scripts/deploy.sh (NEXT_PUBLIC_APP_VERSION = commit court,
// NEXT_PUBLIC_BUILD_TIME = date du build). En dev, repli sur « dev ».
import Link from "next/link"

export default function Footer({ brandName = "Solid'Pilot" }: { brandName?: string }) {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "dev"
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME
  return (
    <footer className="py-4 text-center text-xs space-y-1" style={{ color: "#66716B" }}>
      <div>
        {brandName} · <span className="font-mono">version {version}</span>
        {buildTime && <> · Mis à jour le {buildTime}</>}
      </div>
      <div className="flex items-center justify-center gap-3">
        <Link href="/mentions-legales" className="underline">Mentions légales</Link>
        <Link href="/confidentialite" className="underline">Confidentialité</Link>
        {/* Mention obligatoire de l'état de conformité (décret 2019-768) */}
        <Link href="/accessibilite" className="underline">Accessibilité : non conforme</Link>
      </div>
    </footer>
  )
}
