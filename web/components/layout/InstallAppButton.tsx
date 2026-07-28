"use client"
import { useEffect, useState } from "react"
import { Download, Share, Plus } from "lucide-react"
import Modal from "@/components/ui/Modal"

// ============================================================
// PR 37 — « Ajouter à l'écran d'accueil »
// ============================================================
// Deux chemins, parce que les navigateurs ne se comportent pas pareil :
//  · Chrome / Edge / Samsung (Android, desktop) émettent
//    `beforeinstallprompt` — on garde l'évènement et on l'ouvre au clic.
//  · Safari iOS ne l'émet jamais : l'ajout se fait à la main via le menu
//    Partager. On affiche donc la marche à suivre.
// Le bouton disparaît quand l'application est déjà installée (mode
// standalone) ou quand aucun des deux chemins n'est possible.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(display-mode: standalone)").matches
    // iOS Safari : propriété non standard, absente des types DOM
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    // iPadOS 13+ se présente comme un Mac : on le reconnaît au tactile
    || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}

export default function InstallAppButton({ variant = "menu" }: { variant?: "menu" | "button" | "drawer" }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(true) // masqué tant qu'on n'a pas vérifié côté client
  const [ios, setIos] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)

  useEffect(() => {
    setInstalled(isStandalone())
    setIos(isIos())

    function onPrompt(e: Event) {
      // Sans preventDefault, Chrome affiche sa propre mini-barre et
      // l'évènement n'est plus rejouable au clic.
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    function onInstalled() { setInstalled(true); setDeferred(null) }

    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    // L'évènement n'est utilisable qu'une fois : le navigateur en
    // réémettra un nouveau si l'installation reste possible.
    setDeferred(null)
    if (outcome === "accepted") setInstalled(true)
  }

  // Rien à proposer : déjà installée, ou navigateur sans chemin d'installation
  if (installed || (!deferred && !ios)) return null

  const label = "Installer l'application"
  const onClick = ios ? () => setShowIosHelp(true) : install

  return (
    <>
      {variant === "button" ? (
        <button onClick={onClick}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: "var(--brand-accent,#0E6B5C)" }}>
          <Download size={15} aria-hidden="true" /> {label}
        </button>
      ) : variant === "drawer" ? (
        // Tiroir mobile (V1) : fond sombre — l'accent de marque n'y est
        // plus lisible, l'entrée prend les états clairs de .sidebar-link.
        <button onClick={onClick}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors sidebar-link">
          <Download size={18} aria-hidden="true" /> {label}
        </button>
      ) : (
        <button onClick={onClick}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          style={{ color: "var(--brand-accent,#0E6B5C)" }}>
          <Download size={18} aria-hidden="true" /> {label}
        </button>
      )}

      <Modal open={showIosHelp} onClose={() => setShowIosHelp(false)} maxWidth="max-w-md"
        title="Ajouter à l'écran d'accueil" icon={<Download size={18} style={{ color: "var(--brand-accent,#0E6B5C)" }} />}>
        <>
          <p className="text-sm mb-4" style={{ color: "#66716B" }}>
            Sur iPhone et iPad, l&apos;ajout se fait depuis Safari, en trois gestes :
          </p>
          <ol className="space-y-3 text-sm" style={{ color: "#17211D" }}>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>1</span>
              <span className="flex items-center gap-1.5 flex-wrap">
                Touchez <Share size={15} aria-hidden="true" /> <strong>Partager</strong>, en bas de l&apos;écran.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>2</span>
              <span className="flex items-center gap-1.5 flex-wrap">
                Faites défiler puis choisissez <Plus size={15} aria-hidden="true" /> <strong>Sur l&apos;écran d&apos;accueil</strong>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>3</span>
              <span>Confirmez avec <strong>Ajouter</strong>. L&apos;icône apparaît avec vos autres applications.</span>
            </li>
          </ol>
          <p className="text-xs mt-4" style={{ color: "#66716B" }}>
            Depuis un autre navigateur (Chrome, Firefox…) sur iOS, ouvrez d&apos;abord la page dans Safari :
            seul Safari sait ajouter une application à l&apos;écran d&apos;accueil.
          </p>
        </>
      </Modal>
    </>
  )
}
