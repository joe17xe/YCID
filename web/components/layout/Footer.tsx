// Pied de page versionné : les valeurs sont injectées au build par
// scripts/deploy.sh (NEXT_PUBLIC_APP_VERSION = commit court,
// NEXT_PUBLIC_BUILD_TIME = date du build). En dev, repli sur « dev ».
export default function Footer() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "dev"
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME
  return (
    <footer className="py-4 text-center text-xs" style={{ color: "#66716B" }}>
      Solid&apos;Pilot · <span className="font-mono">version {version}</span>
      {buildTime && <> · Mis à jour le {buildTime}</>}
    </footer>
  )
}
