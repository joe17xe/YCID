"use client"
import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu, X, Settings, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useTranslations, useLocale } from "next-intl"
import { NAV, ADMIN_NAV } from "@/components/layout/Sidebar"
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
// tiroir latéral reprenant la navigation de la Sidebar, l'identité, les
// préférences, la langue et la déconnexion. Visible uniquement < md ;
// la Sidebar et le Header classiques restent inchangés sur desktop.
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

      {/* Tiroir de navigation */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="Menu de navigation"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white flex flex-col overflow-y-auto shadow-xl">
            {/* En-tête : identité */}
            <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: "#E3E6E2" }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                  style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>
                  {initials || "?"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate" style={{ color: "#17211D", fontFamily: "var(--font-sora)" }}>{name || "—"}</div>
                <div className="text-xs truncate" style={{ color: "#66716B" }}>{email}</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fermer le menu" className="p-1.5 rounded-lg hover:bg-gray-50" style={{ color: "#66716B" }}>
                <X size={20} />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-3 px-2 space-y-1">
              {NAV.map(({ href, key, Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/")
                return (
                  <Link key={href} href={href} onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      background: active ? "var(--brand-accent-soft,#E4F0EC)" : "transparent",
                      color: active ? "var(--brand-accent,#0E6B5C)" : "#66716B",
                      fontFamily: "var(--font-inter)",
                      fontWeight: active ? 600 : 400,
                    }}>
                    <Icon size={18} className="flex-shrink-0" />
                    <span className="text-sm">{t(key)}</span>
                  </Link>
                )
              })}
              {showAdmin && (
                <>
                  <div className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wider" style={{ color: "#66716B" }}>
                    {t("administration")}
                  </div>
                  {ADMIN_NAV.map(({ href, key, Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + "/")
                    return (
                      <Link key={href} href={href} onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{
                          background: active ? "var(--brand-accent-soft,#E4F0EC)" : "transparent",
                          color: active ? "var(--brand-accent,#0E6B5C)" : "#66716B",
                          fontFamily: "var(--font-inter)",
                          fontWeight: active ? 600 : 400,
                        }}>
                        <Icon size={18} className="flex-shrink-0" />
                        <span className="text-sm">{t(key)}</span>
                      </Link>
                    )
                  })}
                </>
              )}
            </nav>

            {/* Pied : installation, préférences, langue, déconnexion */}
            <div className="border-t p-2 space-y-1" style={{ borderColor: "#E3E6E2" }}>
              <InstallAppButton />
              <Link href="/preferences" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm" style={{ color: "#17211D" }}>
                <Settings size={18} style={{ color: "#66716B" }} /> {ta("preferences")}
              </Link>
              <div className="flex items-center gap-2 px-3 py-1.5" role="group" aria-label="Langue de l'interface">
                {(["fr", "en"] as const).map(l => (
                  <button key={l} onClick={() => setLocale(l)}
                    aria-pressed={locale === l}
                    aria-label={l === "fr" ? "Français" : "English"}
                    className="px-3 py-1 rounded-xl border text-xs font-semibold uppercase"
                    style={{
                      background: locale === l ? "var(--brand-accent-soft,#E4F0EC)" : "#fff",
                      borderColor: locale === l ? "var(--brand-accent,#0E6B5C)" : "#E3E6E2",
                      color: locale === l ? "var(--brand-accent,#0E6B5C)" : "#66716B",
                    }}>
                    {l}
                  </button>
                ))}
              </div>
              <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: "#A3342C" }}>
                <LogOut size={18} /> {t("signOut")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
