"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function AvatarUploader({ userId, avatarUrl, name }: { userId: string; avatarUrl: string | null; name: string }) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function upload(file: File) {
    setError("")
    if (!file.type.startsWith("image/")) { setError("Choisissez un fichier image (PNG ou JPG)."); return }
    if (file.size > 2 * 1024 * 1024) { setError("Image trop lourde (2 Mo maximum)."); return }
    setBusy(true)
    const ext = file.name.split(".").pop() || "png"
    const path = `${userId}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true })
    if (upErr) { setError(`Échec de l'envoi : ${upErr.message}`); setBusy(false); return }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path)
    const url = `${data.publicUrl}?v=${Date.now()}`
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId)
    if (dbErr) setError(`Échec de l'enregistrement : ${dbErr.message}`)
    setBusy(false)
    router.refresh()
  }

  async function remove() {
    setError("")
    setBusy(true)
    const { data: files } = await supabase.storage.from("avatars").list(userId)
    if (files?.length) await supabase.storage.from("avatars").remove(files.map(f => `${userId}/${f.name}`))
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId)
    if (dbErr) setError(`Échec de la suppression : ${dbErr.message}`)
    setBusy(false)
    router.refresh()
  }

  const initials = (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("")

  return (
    <div className="flex items-center gap-5">
      {avatarUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={avatarUrl} alt="Photo de profil" className="w-20 h-20 rounded-full object-cover" />
        : (
          <span className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-semibold"
            style={{ background: "#E4F0EC", color: "#0E6B5C" }}>
            {initials}
          </span>
        )}
      <div>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#0E6B5C", opacity: busy ? 0.7 : 1 }}
          >
            <Upload size={14} /> {busy ? "…" : "Changer la photo"}
          </button>
          {avatarUrl && (
            <button
              onClick={remove}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium"
              style={{ borderColor: "#E3E6E2", color: "#A3342C" }}
            >
              <Trash2 size={14} /> Supprimer
            </button>
          )}
        </div>
        <p className="text-xs mt-2" style={{ color: "#66716B" }}>PNG ou JPG · 2 Mo maximum</p>
        {error && <p className="text-xs mt-1 rounded px-2 py-1" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
    </div>
  )
}
