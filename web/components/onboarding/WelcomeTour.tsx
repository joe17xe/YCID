"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Compass, ChevronRight, ChevronLeft } from "lucide-react"
import Modal from "@/components/ui/Modal"
import { createClient } from "@/lib/supabase/client"
import type { TourStep } from "@/lib/tour"

// ============================================================
// Visite guidée de première connexion
// ============================================================
// Les étapes arrivent du serveur, déjà personnalisées (lib/tour.ts) —
// ce composant ne sait rien des rôles, il montre et il tourne.
//
// Choix assumés :
//   · des CARTES, pas des bulles ancrées sur l'écran. Les bulles se
//     brisent au premier changement de mise en page — et l'interface
//     vient d'être refaite deux fois en un jour. Les cartes disent le
//     modèle, qui est stable, pas les pixels, qui ne le sont pas ;
//   · « Passer » marque la visite comme vue, autant que « Terminer ».
//     une visite qui insiste apprend une seule chose : où est la croix ;
//   · le marqueur s'écrit en base (profiles.tour_seen_at, policy « Own
//     profile ») : vu au bureau, pas rejoué au téléphone.

export default function WelcomeTour({ userId, steps, mode }: {
  userId: string
  steps: TourStep[]
  // « auto » : s'ouvre seule (première connexion). « button » : bouton
  // « Revoir la visite » (page Aide) — ne touche pas au marqueur.
  mode: "auto" | "button"
}) {
  const router = useRouter()
  const [open, setOpen] = useState(mode === "auto")
  const [i, setI] = useState(0)
  const [pending, startTransition] = useTransition()
  const step = steps[i]
  const last = i === steps.length - 1

  function close(markSeen: boolean) {
    setOpen(false)
    if (!markSeen) return
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.from("profiles")
        .update({ tour_seen_at: new Date().toISOString() }).eq("id", userId)
      // Échec d'écriture (migration 0048 absente…) : la visite se
      // refermera quand même, elle reviendra à la connexion suivante.
      // Pire des cas acceptable ; un blocage ne le serait pas.
      if (error) console.warn("[tour] marqueur non enregistré:", error.message)
      router.refresh()
    })
  }

  if (!steps.length) return null

  return (
    <>
      {mode === "button" && (
        <button type="button" onClick={() => { setI(0); setOpen(true) }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border bg-white text-sm font-medium"
          style={{ borderColor: "#E3E6E2", color: "var(--brand-accent,#0E6B5C)" }}>
          <Compass size={15} aria-hidden="true" /> Revoir la visite guidée
        </button>
      )}
      {open && (
        <Modal open onClose={() => close(mode === "auto")} title={step.title} busy={pending} maxWidth="max-w-md">
          <div className="space-y-3">
            {step.body.map((p, k) => (
              <p key={k} className="text-sm leading-relaxed" style={{ color: "#17211D" }}>{p}</p>
            ))}
            {step.link && (
              <Link href={step.link.href} onClick={() => close(mode === "auto")}
                className="inline-block text-sm font-medium underline decoration-dotted"
                style={{ color: "var(--brand-accent,#0E6B5C)" }}>
                {step.link.label}
              </Link>
            )}
            <div className="flex items-center justify-between pt-2">
              {/* Les points disent où l'on en est — et sont cliquables :
                  une visite n'est pas un couloir. */}
              <div className="flex items-center gap-1.5">
                {steps.map((_, k) => (
                  <button key={k} type="button" onClick={() => setI(k)}
                    aria-label={`Étape ${k + 1} sur ${steps.length}`}
                    aria-current={k === i ? "step" : undefined}
                    className="w-2 h-2 rounded-full"
                    style={{ background: k === i ? "var(--brand-accent,#0E6B5C)" : "#E3E6E2" }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {mode === "auto" && !last && (
                  <button type="button" onClick={() => close(true)}
                    className="px-3 py-2 text-sm" style={{ color: "#66716B" }}>
                    Passer
                  </button>
                )}
                {i > 0 && (
                  <button type="button" onClick={() => setI(i - 1)}
                    className="p-2 rounded-xl border" style={{ borderColor: "#E3E6E2", color: "#66716B" }}
                    aria-label="Étape précédente">
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                )}
                <button type="button"
                  onClick={() => (last ? close(mode === "auto") : setI(i + 1))}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold"
                  style={{ background: "var(--brand-accent,#0E6B5C)" }}>
                  {last ? "C’est parti" : "Suivant"}
                  {!last && <ChevronRight size={15} aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
