"use client"
import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Upload, Trash2, LayoutDashboard } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { updateBrandSettings } from "@/app/(app)/admin/configuration/settings-actions"
import type { PlatformSettings } from "@/lib/settings"

const labelCls = "block text-xs font-semibold mb-1 tracking-wider"
const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }
const HEX = /^#[0-9A-Fa-f]{6}$/

export default function BrandForm({ settings }: { settings: PlatformSettings }) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    brandName: settings.brandName,
    tagline: settings.tagline,
    accentColor: normalize(settings.accentColor, "#0E6B5C"),
    accentSoftColor: normalize(settings.accentSoftColor, "#E4F0EC"),
    logoUrl: settings.logoUrl,
    faviconUrl: settings.faviconUrl,
  })

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }))
    setSaved(false)
  }

  async function uploadImage(file: File, kind: "logo" | "favicon") {
    setError("")
    if (!file.type.startsWith("image/")) { setError("Choisissez un fichier image (PNG, JPG ou SVG)."); return }
    if (file.size > 1024 * 1024) { setError("Fichier trop lourd (1 Mo maximum)."); return }
    setUploading(true)
    const ext = file.name.split(".").pop()?.toLowerCase() || "png"
    const path = `${kind}.${ext}`
    const { error: upErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true })
    if (upErr) { setError(`Échec de l'envoi : ${upErr.message}`); setUploading(false); return }
    const { data } = supabase.storage.from("branding").getPublicUrl(path)
    set(kind === "logo" ? "logoUrl" : "faviconUrl", `${data.publicUrl}?v=${Date.now()}`)
    setUploading(false)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.brandName.trim()) { setError("Le nom de la plateforme est obligatoire."); return }
    if (!HEX.test(form.accentColor) || !HEX.test(form.accentSoftColor)) { setError("Couleurs invalides (format #RRGGBB)."); return }
    startTransition(async () => {
      const res = await updateBrandSettings(form)
      if (res.ok) { setSaved(true); router.refresh() }
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  const previewVars = { "--brand-accent": form.accentColor, "--brand-accent-soft": form.accentSoftColor } as React.CSSProperties

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="bg-white rounded-2xl border p-6 space-y-5" style={border}>
        <div>
          <label className={labelCls} style={{ color: "#66716B" }}>NOM DE LA PLATEFORME</label>
          <input value={form.brandName} onChange={e => set("brandName", e.target.value)} required className={inputCls} style={border} />
        </div>
        <div>
          <label className={labelCls} style={{ color: "#66716B" }}>ACCROCHE</label>
          <input value={form.tagline} onChange={e => set("tagline", e.target.value)} className={inputCls} style={border}
            placeholder="Pilotage de projets de solidarité internationale" />
          <p className="text-xs mt-1" style={{ color: "#66716B" }}>Affichée sous le nom sur la page de connexion.</p>
        </div>

        {/* Logo */}
        <div>
          <label className={labelCls} style={{ color: "#66716B" }}>LOGO</label>
          <div className="flex items-center gap-4">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-contain border" style={border} />
            ) : (
              <div className="w-12 h-12 rounded-xl" style={{ background: "var(--brand-accent,#0E6B5C)" }} />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#17211D" }}>
                <Upload size={14} /> {uploading ? "…" : "Choisir un logo"}
              </button>
              {form.logoUrl && (
                <button type="button" onClick={() => set("logoUrl", null)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#A3342C" }}>
                  <Trash2 size={14} /> Retirer
                </button>
              )}
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: "#66716B" }}>PNG, JPG ou SVG &middot; 1 Mo maximum. À défaut, une pastille de couleur est utilisée.</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], "logo")} />
        </div>

        {/* Favicon — l'icône d'onglet. Champ SÉPARÉ du logo : un logo
            est souvent horizontal, un favicon doit être carré et
            lisible à 16 pixels. À défaut, le logo sert de repli (0049). */}
        <div>
          <div className="text-xs font-semibold tracking-wider mb-2" style={{ color: "#66716B" }}>ICÔNE D&apos;ONGLET (FAVICON)</div>
          <div className="flex items-center gap-3 flex-wrap">
            {form.faviconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.faviconUrl} alt="Favicon" className="w-8 h-8 rounded object-contain border" style={border} />
            ) : (
              <div className="w-8 h-8 rounded border grid place-items-center text-[10px]" style={{ ...border, color: "#9AA39D" }}>16px</div>
            )}
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium cursor-pointer"
              style={{ ...border, color: "#17211D" }}>
              <Upload size={14} /> {uploading ? "…" : "Choisir une icône"}
              <input type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], "favicon")} />
            </label>
            {form.faviconUrl && (
              <button type="button" onClick={() => set("faviconUrl", null)}
                className="text-sm underline decoration-dotted" style={{ color: "#A3342C" }}>
                Retirer
              </button>
            )}
          </div>
          <p className="text-xs mt-2" style={{ color: "#66716B" }}>
            Image carrée, lisible en tout petit. À défaut, le logo est utilisé dans l&apos;onglet du navigateur.
          </p>
        </div>

        {/* Couleurs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColorField label="COULEUR D'ACCENT" value={form.accentColor} onChange={v => set("accentColor", v)} />
          <ColorField label="ACCENT SECONDAIRE (FOND)" value={form.accentSoftColor} onChange={v => set("accentSoftColor", v)} />
        </div>
      </div>

      {/* Aperçu en direct */}
      <div className="bg-white rounded-2xl border p-6" style={border}>
        <div className="text-xs font-semibold tracking-wider mb-3" style={{ color: "#66716B" }}>APERÇU</div>
        <div style={previewVars} className="flex items-center gap-3 flex-wrap">
          {form.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logoUrl} alt="Logo" className="w-7 h-7 rounded-lg object-contain" />
          ) : (
            <div className="w-7 h-7 rounded-lg" style={{ background: "var(--brand-accent,#0E6B5C)" }} />
          )}
          <span className="font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{form.brandName || "Nom"}</span>
          <span className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>
            <LayoutDashboard size={16} /> Élément actif
          </span>
          <button type="button" className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: "var(--brand-accent,#0E6B5C)" }}>Bouton principal</button>
        </div>
      </div>

      {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
      {saved && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>Enregistré.</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || uploading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
          style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
          <Check size={16} /> {pending ? "…" : "Enregistrer"}
        </button>
      </div>
    </form>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelCls} style={{ color: "#66716B" }}>{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={HEX.test(value) ? value : "#000000"} onChange={e => onChange(e.target.value.toUpperCase())}
          className="w-10 h-10 rounded-lg border cursor-pointer p-0.5" style={border} aria-label={label} />
        <input value={value} onChange={e => onChange(e.target.value)} className={inputCls} style={border} placeholder="#0E6B5C" />
      </div>
    </div>
  )
}

function normalize(v: string, fallback: string): string {
  return HEX.test(v) ? v.toUpperCase() : fallback
}
