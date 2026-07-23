export const dynamic = 'force-dynamic'
import Sidebar from "@/components/layout/Sidebar"
import { createClient } from "@/lib/supabase/server"
import { isUserAdmin } from "@/lib/permissions"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const showAdmin = user ? await isUserAdmin(supabase, user.id) : false
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar showAdmin={showAdmin} />
      <main className="flex-1 overflow-auto" style={{ background: "#F5F6F4" }}>
        {children}
      </main>
    </div>
  )
}
