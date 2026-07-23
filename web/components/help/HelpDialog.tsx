"use client"
import { useState } from "react"
import Link from "next/link"
import { HelpCircle, X } from "lucide-react"

interface HelpDialogProps {
  title: string
  excerpt: string
  anchor: string
}

export default function HelpDialog({ title, excerpt, anchor }: HelpDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
        title={`Aide — ${title}`}
        aria-label={`Aide sur l'onglet ${title}`}
      >
        <HelpCircle size={16} style={{ color: "#66716B" }} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(23,33,29,0.45)" }} onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "#E3E6E2" }}>
              <h3 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
                <HelpCircle size={16} style={{ color: "#0E6B5C" }} /> {title}
              </h3>
              <button onClick={() => setOpen(false)} style={{ color: "#66716B" }} aria-label="Fermer"><X size={18} /></button>
            </div>
            <div className="p-5">
              <p className="text-sm leading-relaxed" style={{ color: "#17211D" }}>{excerpt}</p>
              <Link
                href={`/aide#${anchor}`}
                onClick={() => setOpen(false)}
                className="inline-block mt-4 text-sm font-medium"
                style={{ color: "#0E6B5C" }}
              >
                Voir toute l&apos;aide →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
