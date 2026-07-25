"use client"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface NotificationRow {
  id: string
  type: string
  payload: { title?: string; href?: string } | null
  read_at: string | null
  created_at: string
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "à l'instant"
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? "hier" : `il y a ${d} j`
}

// Cloche de notifications in-app : liste les 15 dernières notifications de
// l'utilisateur (RLS « Own notifications »), badge non-lues, rafraîchie
// toutes les 60 s et au retour sur l'onglet.
export default function NotificationsBell() {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [unread, setUnread] = useState(0)

  // Une seule requête : le non-lu est déduit des 15 dernières (le badge
  // plafonne à 9+ de toute façon). La requête HEAD count séparée provoquait
  // des 503 répétés côté Supabase (incident du 25/07/2026).
  const refresh = useCallback(async () => {
    const { data } = await supabase.from("notifications")
      .select("id, type, payload, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(15)
    const rows = (data as NotificationRow[]) ?? []
    setItems(rows)
    setUnread(rows.filter(r => !r.read_at).length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const initial = setTimeout(refresh, 0)
    const interval = setInterval(refresh, 60_000)
    window.addEventListener("focus", refresh)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
      window.removeEventListener("focus", refresh)
    }
  }, [refresh])

  async function markAllRead() {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null)
    refresh()
  }

  async function openItem(n: NotificationRow) {
    if (!n.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id)
      refresh()
    }
    setOpen(false)
    if (n.payload?.href) router.push(n.payload.href)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative p-2 rounded-full hover:bg-gray-50 transition-colors"
        style={{ color: "#66716B" }}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ background: "#A3342C" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl border shadow-lg z-50 overflow-hidden" style={{ borderColor: "#E3E6E2" }} role="menu">
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#E3E6E2" }}>
              <span className="text-sm font-semibold" style={{ color: "#17211D", fontFamily: "var(--font-sora)" }}>Notifications</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs underline" style={{ color: "var(--brand-accent,#0E6B5C)" }}>
                  Tout marquer comme lu
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 && (
                <p className="px-4 py-6 text-sm text-center" style={{ color: "#66716B" }}>Aucune notification.</p>
              )}
              {items.map(n => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                  style={{ borderColor: "#F0F2F0", background: n.read_at ? "transparent" : "var(--brand-accent-soft,#E4F0EC)" }}
                  role="menuitem"
                >
                  <span className="block text-sm" style={{ color: "#17211D", fontWeight: n.read_at ? 400 : 600 }}>
                    {n.payload?.title ?? n.type}
                  </span>
                  <span className="block text-xs mt-0.5" style={{ color: "#66716B" }}>{timeAgo(n.created_at)}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
