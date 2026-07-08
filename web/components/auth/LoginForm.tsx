"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function LoginForm() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignup, setIsSignup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")
    if (isSignup) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage("Verifiez votre email pour confirmer votre compte.")
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push("/dashboard")
    }
    setLoading(false)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + "/dashboard" },
    })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: "#E3E6E2" }}>
      <button onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border font-medium mb-6 hover:bg-gray-50" style={{ borderColor: "#E3E6E2", color: "#17211D" }}>
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continuer avec Google
      </button>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px" style={{ background: "#E3E6E2" }} />
        <span className="text-sm" style={{ color: "#66716B" }}>ou</span>
        <div className="flex-1 h-px" style={{ background: "#E3E6E2" }} />
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-600"
            style={{ borderColor: "#E3E6E2" }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Mot de passe</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
            className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-600"
            style={{ borderColor: "#E3E6E2" }} />
        </div>
        {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
        {message && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#E4F0EC", color: "#0E6B5C" }}>{message}</p>}
        <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-semibold text-white" style={{ background: "#0E6B5C", opacity: loading ? 0.7 : 1 }}>
          {loading ? "..." : isSignup ? "Creer un compte" : "Se connecter"}
        </button>
      </form>
      <p className="text-center text-sm mt-4" style={{ color: "#66716B" }}>
        {isSignup ? "Deja un compte ?" : "Pas encore de compte ?"}{" "}
        <button onClick={() => setIsSignup(!isSignup)} className="font-medium" style={{ color: "#0E6B5C" }}>
          {isSignup ? "Se connecter" : "Creer un compte"}
        </button>
      </p>
    </div>
  )
}
