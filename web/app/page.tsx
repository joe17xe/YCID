export const dynamic = 'force-dynamic'
import Link from "next/link"
import LoginForm from "@/components/auth/LoginForm"
import { getPlatformSettings } from "@/lib/settings"

export default async function LoginPage() {
  const s = await getPlatformSettings()
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#F5F6F4" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {s.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoUrl} alt={s.brandName} className="h-12 mx-auto mb-3 object-contain" />
          ) : (
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3" style={{ background: "var(--brand-accent,#0E6B5C)" }} />
          )}
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
            {s.brandName}
          </h1>
          <p className="mt-2" style={{ color: "#66716B" }}>{s.tagline}</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs" style={{ color: "#66716B" }}>
          <Link href="/mentions-legales" className="underline">Mentions légales</Link>
          {" · "}
          <Link href="/confidentialite" className="underline">Confidentialité</Link>
        </p>
      </div>
    </div>
  )
}
