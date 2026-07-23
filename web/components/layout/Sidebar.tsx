"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, FolderKanban, Building2, Upload, PieChart, Users, ShieldCheck, HelpCircle, LogOut, ChevronLeft, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
import { useTranslations } from "next-intl"

const NAV = [
  { href: "/dashboard", key: "dashboard", Icon: LayoutDashboard },
  { href: "/projets", key: "projects", Icon: FolderKanban },
  { href: "/organisations", key: "organisations", Icon: Building2 },
  { href: "/import", key: "import", Icon: Upload },
  { href: "/pilotage", key: "steering", Icon: PieChart },
  { href: "/aide", key: "help", Icon: HelpCircle },
]

const ADMIN_NAV = [
  { href: "/admin/utilisateurs", key: "users", Icon: Users },
  { href: "/admin/acces", key: "access", Icon: ShieldCheck },
]

export default function Sidebar({ showAdmin = false }: { showAdmin?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const t = useTranslations("nav")

  async function signOut() {
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <aside
      className="flex flex-col h-full border-r transition-all duration-200"
      style={{ width: collapsed ? 64 : 220, background: "#FFFFFF", borderColor: "#E3E6E2", minHeight: "100vh" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b" style={{ borderColor: "#E3E6E2" }}>
        <div className="w-7 h-7 rounded-lg flex-shrink-0" style={{ background: "#0E6B5C" }} />
        {!collapsed && (
          <span className="font-bold text-base leading-tight" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
            Solid&apos;Pilot
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {NAV.map(({ href, key, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
              style={{
                background: active ? "#E4F0EC" : "transparent",
                color: active ? "#0E6B5C" : "#66716B",
                fontFamily: "var(--font-inter)",
                fontWeight: active ? 600 : 400,
              }}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="text-sm">{t(key)}</span>}
            </Link>
          )
        })}
        {showAdmin && (
          <>
            {!collapsed && (
              <div className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wider" style={{ color: "#66716B" }}>
                {t("administration")}
              </div>
            )}
            {ADMIN_NAV.map(({ href, key, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/")
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                  style={{
                    background: active ? "#E4F0EC" : "transparent",
                    color: active ? "#0E6B5C" : "#66716B",
                    fontFamily: "var(--font-inter)",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && <span className="text-sm">{t(key)}</span>}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t" style={{ borderColor: "#E3E6E2" }}>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-red-50"
          style={{ color: "#A3342C" }}
        >
          <LogOut size={18} />
          {!collapsed && <span className="text-sm font-medium" style={{ fontFamily: "var(--font-inter)" }}>{t("signOut")}</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 mt-1 rounded-xl transition-colors hover:bg-gray-50"
          style={{ color: "#66716B" }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  )
}
