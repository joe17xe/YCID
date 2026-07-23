"use client"
import { useEffect, useState } from "react"

type TextSize = "compact" | "normal" | "grand" | "tres-grand"
interface Prefs { textSize: TextSize; contrast: boolean; motion: boolean }

const DEFAULTS: Prefs = { textSize: "normal", contrast: false, motion: false }
const STORAGE_KEY = "sp-appearance"

const SIZES: { key: TextSize; label: string }[] = [
  { key: "compact", label: "Compact" },
  { key: "normal", label: "Normal" },
  { key: "grand", label: "Grand" },
  { key: "tres-grand", label: "Très grand" },
]

function apply(prefs: Prefs) {
  const h = document.documentElement
  h.setAttribute("data-textsize", prefs.textSize)
  if (prefs.contrast) h.setAttribute("data-contrast", "high")
  else h.removeAttribute("data-contrast")
  if (prefs.motion) h.setAttribute("data-motion", "reduced")
  else h.removeAttribute("data-motion")
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="w-11 h-6 rounded-full transition-colors flex-shrink-0 relative"
      style={{ background: checked ? "#0E6B5C" : "#CBD2CD" }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  )
}

export default function AppearanceSettings() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      setPrefs({ ...DEFAULTS, ...stored })
    } catch { /* préférences corrompues : on repart des défauts */ }
  }, [])

  function update(next: Prefs) {
    setPrefs(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    apply(next)
  }

  return (
    <div className="space-y-6">
      {/* Taille du texte */}
      <div>
        <div className="text-sm font-medium mb-1" style={{ color: "#17211D" }}>Taille du texte</div>
        <p className="text-xs mb-2" style={{ color: "#66716B" }}>Agrandit ou réduit l&apos;ensemble des textes de l&apos;application.</p>
        <div className="flex flex-wrap gap-2">
          {SIZES.map(s => (
            <button
              key={s.key}
              onClick={() => update({ ...prefs, textSize: s.key })}
              className="px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors"
              style={{
                background: prefs.textSize === s.key ? "#E4F0EC" : "#fff",
                borderColor: prefs.textSize === s.key ? "#0E6B5C" : "#E3E6E2",
                color: prefs.textSize === s.key ? "#0E6B5C" : "#66716B",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contraste élevé */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium" style={{ color: "#17211D" }}>Contraste élevé</div>
          <p className="text-xs mt-0.5" style={{ color: "#66716B" }}>
            Renforce les contrastes pour une meilleure lisibilité. Version renforcée à venir avec le thème centralisé.
          </p>
        </div>
        <Toggle checked={prefs.contrast} onChange={v => update({ ...prefs, contrast: v })} label="Contraste élevé" />
      </div>

      {/* Réduire les animations */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium" style={{ color: "#17211D" }}>Réduire les animations</div>
          <p className="text-xs mt-0.5" style={{ color: "#66716B" }}>
            Désactive les transitions et animations pour un affichage plus stable.
          </p>
        </div>
        <Toggle checked={prefs.motion} onChange={v => update({ ...prefs, motion: v })} label="Réduire les animations" />
      </div>

      <p className="text-xs" style={{ color: "#66716B" }}>
        Ces réglages sont mémorisés sur cet appareil (navigateur), pour vous uniquement.
      </p>
    </div>
  )
}
