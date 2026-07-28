"use client"
import { useState, useTransition } from "react"
import { Check, X } from "lucide-react"
import { respondToMeeting } from "@/app/(app)/projets/[id]/actions"

// ============================================================
// Répondre à une invitation de réunion (0051)
// ============================================================
// Deux gestes, pas plus : Accepter, Refuser. La réponse se change tant
// que la réunion n'a pas eu lieu — un empêchement de dernière minute
// est la norme, pas l'exception. L'état courant reste visible sur le
// bouton plein ; l'organisateur est notifié à chaque réponse.

export default function MeetingRSVP({ projectId, meetingId, current }: {
  projectId: string
  meetingId: string
  current: string
}) {
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function answer(response: "acceptee" | "refusee") {
    if (response === current) return
    setError("")
    startTransition(async () => {
      const res = await respondToMeeting({ projectId, meetingId, response })
      if (!res.ok) setError(res.error ?? "Une erreur est survenue.")
    })
  }

  const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors"

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs" style={{ color: "#66716B" }}>Votre réponse :</span>
      <button type="button" onClick={() => answer("acceptee")} disabled={pending}
        aria-pressed={current === "acceptee"}
        className={btn}
        style={current === "acceptee"
          ? { background: "var(--brand-accent,#0E6B5C)", borderColor: "var(--brand-accent,#0E6B5C)", color: "#fff" }
          : { borderColor: "#E3E6E2", color: "#17211D", opacity: pending ? 0.6 : 1 }}>
        <Check size={13} aria-hidden="true" /> Accepter
      </button>
      <button type="button" onClick={() => answer("refusee")} disabled={pending}
        aria-pressed={current === "refusee"}
        className={btn}
        style={current === "refusee"
          ? { background: "#A3342C", borderColor: "#A3342C", color: "#fff" }
          : { borderColor: "#E3E6E2", color: "#17211D", opacity: pending ? 0.6 : 1 }}>
        <X size={13} aria-hidden="true" /> Refuser
      </button>
      {error && <span className="text-xs" style={{ color: "#A3342C" }}>{error}</span>}
    </div>
  )
}
