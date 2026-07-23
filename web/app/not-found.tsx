import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#F5F6F4" }}>
      <div className="bg-white rounded-2xl border p-10 text-center max-w-md" style={{ borderColor: "#E3E6E2" }}>
        <div className="text-4xl font-bold mb-2" style={{ fontFamily: "var(--font-sora)", color: "#0E6B5C" }}>404</div>
        <h1 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
          Page introuvable
        </h1>
        <p className="text-sm mb-6" style={{ color: "#66716B" }}>
          Cette page n&apos;existe pas ou n&apos;est plus disponible.
        </p>
        <Link href="/dashboard" className="inline-block px-6 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: "#0E6B5C" }}>
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
