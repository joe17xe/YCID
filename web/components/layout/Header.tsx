"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Settings, LogOut, ChevronDown } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export interface HeaderRole { label: string; project: string }

interface HeaderProps {
  name: string
  email: string
  avatarUrl: string | null
  roles: HeaderRole[]
  isAdmin: boolean
}

function Initials({ name, email }: { name: string; email: string }) {
  const source = name || email
  const initials = source.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("")
  return (
    <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
      style={{ background: "#E4F0EC", color: "#0E6B5C" }}>
      {initials || "?"}
    </span>
  )
}

export default function Header({ name, email, avatarUrl, roles, isAdmin }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  async function signOut() {
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-end gap-3 px-6 py-3 border-b bg-white" style={{ borderColor: "#E3E6E2" }}>
      {/* Emplacement futur : cloche de notifications (PR 19) */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-gray-50 transition-colors"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            : <Initials name={name} email={email} />}
          <ChevronDown size={14} style={{ color: "#66716B" }} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border shadow-lg z-50 overflow-hidden" style={{ borderColor: "#E3E6E2" }} role="menu">
              {/* Identité (lecture seule) */}
              <div className="px-4 py-3 border-b" style={{ borderColor: "#E3E6E2" }}>
                <div className="text-sm font-semibold" style={{ color: "#17211D", fontFamily: "var(--font-sora)" }}>{name || "—"}</div>
                <div className="text-xs mt-0.5" style={{ color: "#66716B" }}>{email}</div>
              </div>
              {/* Rôles */}
              <div className="px-4 py-3 border-b" style={{ borderColor: "#E3E6E2" }}>
                <div className="text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "#66716B" }}>RÔLES</div>
                <div className="flex flex-wrap gap-1">
                  {isAdmin && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#F0E9F5", color: "#6B4A8C" }}>Admin YCID/LEY</span>
                  )}
                  {roles.slice(0, 3).map((r, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#E4F0EC", color: "#0E6B5C" }} title={r.project}>
                      {r.label} · {r.project}
                    </span>
                  ))}
                  {roles.length > 3 && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#EEF0EE", color: "#66716B" }}>+{roles.length - 3}</span>
                  )}
                  {!roles.length && !isAdmin && <span className="text-xs" style={{ color: "#66716B" }}>Aucun rôle projet</span>}
                </div>
              </div>
              {/* Préférences */}
              <Link
                href="/preferences"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                style={{ color: "#17211D" }}
                role="menuitem"
              >
                <Settings size={15} style={{ color: "#66716B" }} /> Préférences
              </Link>
              {/* Déconnexion — séparée visuellement */}
              <div className="border-t" style={{ borderColor: "#E3E6E2" }}>
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-50 transition-colors"
                  style={{ color: "#A3342C" }}
                  role="menuitem"
                >
                  <LogOut size={15} /> Déconnexion
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
