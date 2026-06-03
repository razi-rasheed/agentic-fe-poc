import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { Separator } from '@/components/ui/separator'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch the athlete row — RLS ensures we only get our own row
  const { data: athlete } = await supabase
    .from('athletes')
    .select('display_name, is_admin')
    .single()

  const displayName = athlete?.display_name ?? user.email ?? 'Athlete'
  const isAdmin = athlete?.is_admin ?? false

  // TODO: when Admin nav item is added in a later slice, pass isAdmin to AppSidebar

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex flex-1 flex-col min-h-screen">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-end gap-2">
            <ThemeToggle />
            <UserMenu displayName={displayName} isAdmin={isAdmin} />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}
