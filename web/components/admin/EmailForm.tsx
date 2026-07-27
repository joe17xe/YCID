"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Plug } from "lucide-react"
import { updateEmailSettings, testEmailConnection } from "@/app/(app)/admin/configuration/settings-actions"

const label = "block text-xs font-semibold mb-1 tracking-wider"
const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

export interface EmailPublic {
  enabled: boolean
  host: string | null
  port: number
  secure: boolean
  username: string | null
  // Jamais le mot de passe lui-même : seulement le fait qu'il existe.
  hasPassword: boolean
  from_name: string
  from_email: string | null
  reply_to: string | null
  site_url: string | null
  last_test_at: string | null
  last_test_ok: boolean | null
  last_test_error: string | null
}

export default function EmailForm({ settings }: { settings: EmailPublic }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    enabled: settings.enabled,
    host: settings.host ?? "",
    port: String(settings.port ?? 587),
    secure: settings.secure,
    username: settings.username ?? "",
    password: "",
    fromName: settings.from_name ?? "Solid'Pilot",
    fromEmail: settings.from_email ?? "",
    replyTo: settings.reply_to ?? "",
    siteUrl: settings.site_url ?? "",
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setOk("")
    startTransition(async () => {
      const res = await updateEmailSettings(form)
      if (res.ok) { setOk("Configuration enregistrée."); setForm(f => ({ ...f, password: "" })); router.refresh() }
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  function test() {
    setError(""); setOk("")
    startTransition(async () => {
      const res = await testEmailConnection()
      if (res.ok) setOk("Connexion au serveur réussie — aucun message n'a été envoyé.")
      else setError(res.error ?? "Test échoué.")
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border p-6 space-y-5" style={border}>
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} className="mt-0.5" />
        <span>
          <span className="text-sm font-medium" style={{ color: "#17211D" }}>Activer l&apos;envoi d&apos;emails</span>
          <span className="block text-xs" style={{ color: "#66716B" }}>
            Désactivé, l&apos;application continue de fonctionner : les notifications restent visibles
            dans l&apos;application, mais rien ne part par messagerie.
          </span>
        </span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label htmlFor="smtp-host" className={label} style={{ color: "#66716B" }}>SERVEUR SMTP</label>
          <input id="smtp-host" value={form.host} onChange={e => setForm({ ...form, host: e.target.value })}
            placeholder="smtp.exemple.fr" className={inputCls} style={border} />
        </div>
        <div>
          <label htmlFor="smtp-port" className={label} style={{ color: "#66716B" }}>PORT</label>
          <input id="smtp-port" type="number" min={1} max={65535} value={form.port}
            onChange={e => setForm({ ...form, port: e.target.value })} className={inputCls} style={border} />
        </div>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input type="checkbox" checked={form.secure} onChange={e => setForm({ ...form, secure: e.target.checked })} className="mt-0.5" />
        <span>
          <span className="text-sm font-medium" style={{ color: "#17211D" }}>Connexion chiffrée dès l&apos;ouverture (TLS implicite)</span>
          <span className="block text-xs" style={{ color: "#66716B" }}>
            À cocher pour le port 465. Pour le port 587, le cas le plus courant, laissez décoché :
            le chiffrement s&apos;établit après connexion (STARTTLS).
          </span>
        </span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="smtp-user" className={label} style={{ color: "#66716B" }}>IDENTIFIANT</label>
          <input id="smtp-user" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
            autoComplete="off" className={inputCls} style={border} />
          <p className="text-xs mt-1" style={{ color: "#66716B" }}>Laissez vide pour un relais sans authentification.</p>
        </div>
        <div>
          <label htmlFor="smtp-pwd" className={label} style={{ color: "#66716B" }}>MOT DE PASSE</label>
          <input id="smtp-pwd" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
            autoComplete="new-password" className={inputCls} style={border}
            placeholder={settings.hasPassword ? "•••••••• (enregistré)" : ""} />
          <p className="text-xs mt-1" style={{ color: "#66716B" }}>
            {settings.hasPassword ? "Laissez vide pour conserver le mot de passe actuel." : "Jamais renvoyé au navigateur une fois enregistré."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t" style={border}>
        <div>
          <label htmlFor="from-name" className={label} style={{ color: "#66716B" }}>NOM DE L&apos;EXPÉDITEUR</label>
          <input id="from-name" value={form.fromName} onChange={e => setForm({ ...form, fromName: e.target.value })}
            className={inputCls} style={border} />
        </div>
        <div>
          <label htmlFor="from-email" className={label} style={{ color: "#66716B" }}>ADRESSE DE L&apos;EXPÉDITEUR</label>
          <input id="from-email" type="email" value={form.fromEmail} onChange={e => setForm({ ...form, fromEmail: e.target.value })}
            placeholder="solidpilot@ycid.fr" className={inputCls} style={border} />
        </div>
      </div>

      <div>
        <label htmlFor="reply-to" className={label} style={{ color: "#66716B" }}>ADRESSE DE RÉPONSE</label>
        <input id="reply-to" type="email" value={form.replyTo} onChange={e => setForm({ ...form, replyTo: e.target.value })}
          placeholder="cem.notif@exemple.fr" className={inputCls} style={border} />
        <p className="text-xs mt-1" style={{ color: "#66716B" }}>
          Où arrivent les réponses. Vide = l&apos;adresse d&apos;expédition. Si celle-ci
          n&apos;est relevée par personne, les réponses se perdent sans que leur auteur
          le sache.
        </p>
      </div>

      <div>
        <label htmlFor="site-url" className={label} style={{ color: "#66716B" }}>ADRESSE DE L&apos;APPLICATION</label>
        <input id="site-url" value={form.siteUrl} onChange={e => setForm({ ...form, siteUrl: e.target.value })}
          placeholder="https://solidpilot.ycid.fr" className={inputCls} style={border} />
        <p className="text-xs mt-1" style={{ color: "#66716B" }}>
          Sert à construire les liens des messages. Sans elle, un email annonce qu&apos;une décision
          attend sans donner le chemin pour s&apos;y rendre.
        </p>
      </div>

      {/* Le dernier essai est affiché, et daté. Un envoi qui cesse de
          fonctionner — mot de passe changé, quota atteint — se découvrait
          jusqu'ici le jour où quelqu'un s'étonnait de n'avoir rien reçu. */}
      {settings.last_test_at && (
        <p className="text-xs rounded-lg px-3 py-2"
          style={settings.last_test_ok
            ? { background: "#E4F0EC", color: "#0E6B5C" }
            : { background: "#F6E7E5", color: "#A3342C" }}>
          Dernier test le {new Date(settings.last_test_at).toLocaleString("fr-FR")} —{" "}
          {settings.last_test_ok ? "connexion réussie." : `échec : ${settings.last_test_error ?? "raison inconnue"}`}
        </p>
      )}

      {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
      {ok && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#E4F0EC", color: "#0E6B5C" }}>{ok}</p>}

      <div className="flex items-center gap-3 pt-1 flex-wrap">
        <button type="submit" disabled={pending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
          style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
          <Check size={16} /> {pending ? "…" : "Enregistrer"}
        </button>
        {/* Tester ouvre la session et s'authentifie, puis referme. Envoyer
            un vrai message supposerait de choisir un destinataire, donc
            d'écrire à quelqu'un pour rien. */}
        <button type="button" onClick={test} disabled={pending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium"
          style={{ ...border, color: "#17211D" }}>
          <Plug size={15} /> Tester la connexion
        </button>
        <span className="text-xs" style={{ color: "#66716B" }}>Le test n&apos;envoie aucun message.</span>
      </div>
    </form>
  )
}
