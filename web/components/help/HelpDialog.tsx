"use client"
import { useState } from "react"
import Link from "next/link"
import { HelpCircle } from "lucide-react"
import Modal from "@/components/ui/Modal"

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
        <HelpCircle size={16} style={{ color: "#66716B" }} aria-hidden="true" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} maxWidth="max-w-md" title={title}
        icon={<HelpCircle size={16} style={{ color: "var(--brand-accent,#0E6B5C)" }} />}>
        <>
          <p className="text-sm leading-relaxed" style={{ color: "#17211D" }}>{excerpt}</p>
          <Link
            href={`/aide#${anchor}`}
            onClick={() => setOpen(false)}
            className="inline-block mt-4 text-sm font-medium"
            style={{ color: "var(--brand-accent,#0E6B5C)" }}
          >
            Voir toute l&apos;aide →
          </Link>
        </>
      </Modal>
    </>
  )
}
