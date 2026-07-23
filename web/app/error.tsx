"use client"
import { AlertTriangle } from "lucide-react"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#F5F6F4" }}>
      <div className="bg-white rounded-2xl border p-10 text-center max-w-md" style={{ borderColor: "#E3E6E2" }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#F6E7E5" }}>
          <AlertTriangle size={28} style={{ color: "#A3342C" }} />
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
          Une erreur est survenue
        </h1>
        <p className="text-sm mb-6" style={{ color: "#66716B" }}>
          Le chargement de la page a échoué. Réessayez, et si le problème persiste,
          contactez l&apos;administrateur.
          {error.digest && <span className="block mt-2 text-xs font-mono">Réf. {error.digest}</span>}
        </p>
        <button onClick={reset} className="px-6 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: "#0E6B5C" }}>
          Réessayer
        </button>
      </div>
    </div>
  )
}
