export const dynamic = 'force-dynamic'
import LoginForm from "@/components/auth/LoginForm"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#F5F6F4" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
            Solid&apos;Pilot
          </h1>
          <p className="mt-2" style={{ color: "#66716B" }}>YCID - Pilotage de projets de solidarite internationale</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
