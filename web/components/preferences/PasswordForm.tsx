"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"

export default function PasswordForm({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const supabase = createClient()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [busy, setBusy] = useState(false)

  if (!hasPassword) {
    return (
      <p className="text-sm rounded-xl px-4 py-3" style={{ background: "#E8ECF5", color: "#3B5488" }}>
        Votre compte est connecté via Google : le mot de passe est géré par Google, il n&apos;y a rien à changer ici.
      </p>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")
    if (next.length < 12) { setError("Le nouveau mot de passe doit contenir au moins 12 caractères."); return }
    if (next !== confirm) { setError("La confirmation ne correspond pas au nouveau mot de passe."); return }
    setBusy(true)
    // Vérifie le mot de passe actuel par ré-authentification
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: current })
    if (authErr) { setError("Mot de passe actuel incorrect."); setBusy(false); return }
    const { error: updErr } = await supabase.auth.updateUser({ password: next })
    if (updErr) setError(`Échec du changement : ${updErr.message}`)
    else {
      setSuccess("Mot de passe modifié.")
      setCurrent(""); setNext(""); setConfirm("")
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="space-y-3 max-w-sm">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Mot de passe actuel</label>
        <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required
          autoComplete="current-password" className={inputCls} style={{ borderColor: "#E3E6E2" }} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nouveau mot de passe</label>
        <input type="password" value={next} onChange={e => setNext(e.target.value)} required minLength={12}
          autoComplete="new-password" className={inputCls} style={{ borderColor: "#E3E6E2" }} />
        <p className="text-xs mt-1" style={{ color: "#66716B" }}>12 caractères minimum.</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Confirmer le nouveau mot de passe</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={12}
          autoComplete="new-password" className={inputCls} style={{ borderColor: "#E3E6E2" }} />
      </div>
      {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
      {success && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#E4F0EC", color: "#0E6B5C" }}>{success}</p>}
      <button type="submit" disabled={busy}
        className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
        style={{ background: "#0E6B5C", opacity: busy ? 0.7 : 1 }}>
        {busy ? "…" : "Changer le mot de passe"}
      </button>
    </form>
  )
}
