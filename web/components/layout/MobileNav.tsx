"use client"
import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Menu, X, Settings, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useTranslations, useLocale } from "next-intl"
import { NAV_GROUPS, ADMIN_NAV, NavLink } from "@/components/layout/Sidebar"
import NotificationsBell from "@/components/layout/NotificationsBell"
import InstallAppButton from "@/components/layout/InstallAppButton"

interface MobileNavProps {
  showAdmin: boolean
  brandName: string
  logoUrl: string | null
  name: string
  email: string
  avatarUrl: string | null
}

// Navigation mobile (« mode application ») : barre supérieure compacte +
// tiroir latéral reprenant la navigation de la Sidebar — mêmes groupes,
// même habillage sombre (V1) : une seule liste, une seule identité
// visuelle. Visible uniquement < md ; la Sidebar et le Header classiques
// restent inchangés sur desktop.
export default function MobileNav({ showAdmin, brandName, logoUrl, name, email, avatarUrl }: MobileNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const t = useTranslations("nav")
  const ta = useTranslations("account")
  const locale = useLocale()

  // Bloque le défilement de la page quand le tiroir est ouvert, et permet
  // de le fermer au clavier (RGAA : toute fonctionnalité accessible sans souris)
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = ""
    }
  }, [open])

  async function signOut() {
    await supabase.auth.signOut()
    router.push("/")
  }

  function setLocale(next: "fr" | "en") {
    document.cookie = `SP_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`
    startTransition(() => router.refresh())
  }

  const initials = (name || email || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("")
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")

  return (
    <div className="md:hidden">
      {/* Barre supérieure mobile */}
      <div className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 border-b bg-white" style={{ borderColor: "#E3E6E2" }}>
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-50"
          style={{ color: "#17211D" }}
        >
          <Menu size={22} />
        </button>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={brandName} className="w-6 h-6 rounded-md object-contain" />
        ) : (
          <div className="w-6 h-6 rounded-md" style={{ background: "var(--brand-accent,#0E6B5C)" }} />
        )}
        <span className="font-bold text-base flex-1 truncate" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{brandName}</span>
        <NotificationsBell />
      </div>

      {/* Tiroir de navigation — même fond sombre dérivé de la marque que
          la Sidebar : le téléphone et l'écran racontent le même produit. */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="Menu de navigation"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col overflow-y-auto shadow-xl"
            style={{ background: "var(--sidebar-bg)" }}>
            {/* En-tête : identité */}
            <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                  style={{ background: "var(--sidebar-bg-raised)", color: "var(--sidebar-fg)" }}>
                  {initials || "?"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate" style={{ color: "var(--sidebar-fg)", fontFamily: "var(--font-sora)" }}>{name || "—"}</div>
                <div className="text-xs truncate" style={{ color: "var(--sidebar-muted)" }}>{email}</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fermer le menu" className="p-1.5 rounded-lg sidebar-link">
                <X size={20} />
              </button>
            </div>

            {/* Navigation : mêmes groupes que la Sidebar (NAV_GROUPS) */}
            <nav className="flex-1 py-3 px-2 space-y-1">
              {NAV_GROUPS.map((group, gi) => (
                <div key={group.key ?? `g${gi}`} className="space-y-1">
                  {group.key && (
                    <div className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wider uppercase" style={{ color: "var(--sidebar-muted)" }}>
                      {t(group.key)}
                    </div>
                  )}
                  {group.items.map(({ href, key, Icon }) => (
                    <NavLink key={href} href={href} label={t(key)} Icon={Icon} active={isActive(href)} onNavigate={() => setOpen(false)} />
                  ))}
                </div>
              ))}
              {showAdmin && (
                <div className="space-y-1">
                  <div className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wider uppercase" style={{ color: "var(--sidebar-muted)" }}>
                    {t("administration")}
                  </div>
                  {ADMIN_NAV.map(({ href, key, Icon }) => (
                    <NavLink key={href} href={href} label={t(key)} Icon={Icon} active={isActive(href)} onNavigate={() => setOpen(false)} />
                  ))}
                </div>
              )}
            </nav>

            {/* Pied : installation, préférences, langue, déconnexion */}
            <div className="border-t p-2 space-y-1" style={{ borderColor: "var(--sidebar-border)" }}>
              <InstallAppButton variant="drawer" />
              <Link href="/preferences" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm sidebar-link">
                <Settings size={18} /> {ta("preferences")}
              </Link>
              <div className="flex items-center gap-2 px-3 py-1.5" role="group" aria-label="Langue de l'interface">
                {(["fr", "en"] as const).map(l => (
                  <button key={l} onClick={() => setLocale(l)}
                    aria-pressed={locale === l}
                    aria-label={l === "fr" ? "Français" : "English"}
                    className="px-3 py-1 rounded-xl border text-xs font-semibold uppercase"
                    style={{
                      background: locale === l ? "#F4F7F5" : "transparent",
                      borderColor: locale === l ? "#F4F7F5" : "var(--sidebar-border)",
                      color: locale === l ? "#17211D" : "var(--sidebar-muted)",
                    }}>
                    {l}
                  </button>
                ))}
              </div>
              <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: "#F0B9B3" }}>
                <LogOut size={18} /> {t("signOut")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
