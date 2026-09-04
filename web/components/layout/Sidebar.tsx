"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, FolderKanban, Building2, Upload, PieChart, Lightbulb, Users, ShieldCheck, Settings, HardDrive, HelpCircle, Presentation, LogOut, ChevronLeft, ChevronRight, CheckSquare, Layers, Megaphone, type LucideIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { ADMIN_NAV_HREFS, ADMIN_NAV_KEYS, type AdminNavKey } from "@/lib/admin-nav"

export type NavItem = { href: string; key: string; Icon: LucideIcon }
export type NavGroup = { key: string | null; items: NavItem[] }

// Partagé avec la navigation mobile (MobileNav) : UNE seule liste.
// Les sections (V1, maquette du 27/07) vivent dans la donnée, pas dans le
// JSX — sans quoi la Sidebar et le tiroir mobile finiraient par grouper
// différemment, la divergence habituelle des copies.
export const NAV_GROUPS: NavGroup[] = [
  { key: null, items: [{ href: "/dashboard", key: "dashboard", Icon: LayoutDashboard }] },
  {
    key: "groupProjects",
    items: [
      { href: "/projets", key: "projects", Icon: FolderKanban },
      // Placée haut : une décision qui attend est ce qui bloque le plus
      // vite un projet, depuis que l'unanimité est requise.
      { href: "/a-valider", key: "toValidate", Icon: CheckSquare },
      { href: "/organisations", key: "organisations", Icon: Building2 },
      { href: "/import", key: "import", Icon: Upload },
    ],
  },
  {
    key: "groupMonitoring",
    items: [
      { href: "/pilotage", key: "steering", Icon: PieChart },
      { href: "/roadmap", key: "roadmap", Icon: Lightbulb },
      // Kit de communication (0057) : les supports du designer, pour
      // tout le monde.
      { href: "/kit", key: "kit", Icon: Megaphone },
      // Les supports de présentation (04/09) n'étaient atteignables que
      // par deux liens au milieu de l'Aide : on ne les retrouvait pas la
      // veille d'une séance. Voisins du kit et de l'aide — c'est là
      // qu'on cherche « comment j'explique l'outil aux autres ».
      { href: "/presentations", key: "presentations", Icon: Presentation },
      { href: "/aide", key: "help", Icon: HelpCircle },
    ],
  },
]

// Les icônes seules vivent ici — un composant ne traverse pas la
// frontière serveur/client. Les clés et les chemins viennent de
// `lib/admin-nav.ts`, que le layout serveur interroge pour décider QUI
// voit QUOI, entrée par entrée (0065). `Record<AdminNavKey, …>` fait
// échouer la compilation si une entrée est ajoutée d'un côté et oubliée
// de l'autre — c'est ce qui a rattrapé « Programmes » (0055) lors de la
// reprise sur master.
const ADMIN_ICONS: Record<AdminNavKey, LucideIcon> = {
  users: Users,
  // Programmes (0055) : le niveau au-dessus des projets — création et
  // directeurs. Réservé aux administrateurs, voir `adminNavKeysFor`.
  programmes: Layers,
  access: ShieldCheck,
  storage: HardDrive,
  configuration: Settings,
}

export const ADMIN_NAV: NavItem[] = ADMIN_NAV_KEYS.map(key => ({
  href: ADMIN_NAV_HREFS[key], key, Icon: ADMIN_ICONS[key],
}))

// Les entrées d'administration réellement affichées. `adminNav` est la
// liste des clés autorisées, calculée côté serveur : un porteur de la
// capacité « gestion des comptes » n'en reçoit qu'une. Liste vide = pas
// de section du tout.
export function visibleAdminNav(adminNav: string[]): NavItem[] {
  return ADMIN_NAV.filter(item => adminNav.includes(item.key))
}

// Une entrée de navigation, partagée entre la Sidebar et le tiroir
// mobile. Ses états (repos, survol, actif en pastille claire) sont en
// CSS (.sidebar-link, globals.css) : un style inline interdirait le
// :hover et dupliquerait la règle.
export function NavLink({ href, label, Icon, active, collapsed, onNavigate }: {
  href: string; label: string; Icon: LucideIcon; active: boolean; collapsed?: boolean; onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      data-active={active ? "" : undefined}
      aria-current={active ? "page" : undefined}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors sidebar-link"
    >
      <Icon size={18} className="flex-shrink-0 sidebar-link-icon" />
      {!collapsed && <span className="text-sm">{label}</span>}
    </Link>
  )
}

export default function Sidebar({ adminNav = [], brandName = "Solid'Pilot", logoUrl = null }: { adminNav?: string[]; brandName?: string; logoUrl?: string | null }) {
  const adminItems = visibleAdminNav(adminNav)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const t = useTranslations("nav")

  async function signOut() {
    await supabase.auth.signOut()
    router.push("/")
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")

  return (
    <aside
      className="hidden md:flex flex-col h-full border-r transition-all duration-200"
      style={{ width: collapsed ? 64 : 220, background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)", minHeight: "100vh" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={brandName} className="w-7 h-7 rounded-lg flex-shrink-0 object-contain bg-white/90 p-0.5" />
        ) : (
          <div className="w-7 h-7 rounded-lg flex-shrink-0" style={{ background: "var(--brand-accent,#0E6B5C)" }} />
        )}
        {!collapsed && (
          <span className="font-bold text-base leading-tight" style={{ fontFamily: "var(--font-sora)", color: "var(--sidebar-fg)" }}>
            {brandName}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.key ?? `g${gi}`} className="space-y-1">
            {group.key && !collapsed && (
              <div className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wider uppercase" style={{ color: "var(--sidebar-muted)" }}>
                {t(group.key)}
              </div>
            )}
            {/* Replié, un intitulé n'a pas la place : un simple filet
                marque la coupure entre sections. */}
            {group.key && collapsed && <div className="mx-3 my-3 border-t" style={{ borderColor: "var(--sidebar-border)" }} />}
            {group.items.map(({ href, key, Icon }) => (
              <NavLink key={href} href={href} label={t(key)} Icon={Icon} active={isActive(href)} collapsed={collapsed} />
            ))}
          </div>
        ))}
        {adminItems.length > 0 && (
          <div className="space-y-1">
            {!collapsed && (
              <div className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wider uppercase" style={{ color: "var(--sidebar-muted)" }}>
                {t("administration")}
              </div>
            )}
            {collapsed && <div className="mx-3 my-3 border-t" style={{ borderColor: "var(--sidebar-border)" }} />}
            {adminItems.map(({ href, key, Icon }) => (
              <NavLink key={href} href={href} label={t(key)} Icon={Icon} active={isActive(href)} collapsed={collapsed} />
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t" style={{ borderColor: "var(--sidebar-border)" }}>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors sidebar-link"
          style={{ color: "#F0B9B3" }}
        >
          <LogOut size={18} />
          {!collapsed && <span className="text-sm font-medium" style={{ fontFamily: "var(--font-inter)" }}>{t("signOut")}</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          className="w-full flex items-center justify-center py-2 mt-1 rounded-xl transition-colors sidebar-link"
          style={{ color: "var(--sidebar-muted)" }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  )
}
