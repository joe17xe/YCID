"use client"
import { useState, useTransition } from "react"
import { UserPlus } from "lucide-react"
import { inviteUser } from "@/app/(app)/admin/utilisateurs/actions"

export default function InviteUserForm() {
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")
    startTransition(async () => {
      const res = await inviteUser({ email, fullName })
      if (res.ok) {
        setSuccess(`Invitation envoyée à ${email.trim()}.`)
        setEmail("")
        setFullName("")
      } else {
        setError(res.error ?? "Une erreur est survenue.")
      }
    })
  }

  return (
    <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
      <h2 className="font-semibold mb-1" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Inviter un utilisateur</h2>
      <p className="text-sm mb-4" style={{ color: "#66716B" }}>
        La personne recevra un email pour créer son mot de passe. Pensez ensuite à la rattacher à ses projets.
      </p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nom complet</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} required
            className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            style={{ borderColor: "#E3E6E2" }} />
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            style={{ borderColor: "#E3E6E2" }} />
        </div>
        <button type="submit" disabled={pending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: "#0E6B5C", opacity: pending ? 0.7 : 1 }}>
          <UserPlus size={15} /> {pending ? "Envoi…" : "Inviter"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
      {success && <p className="mt-3 text-sm rounded-lg px-3 py-2" style={{ background: "#E4F0EC", color: "#0E6B5C" }}>{success}</p>}
    </div>
  )
}
