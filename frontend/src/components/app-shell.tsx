import {
  LayoutDashboard,
  ArrowLeftRight,
  ShieldCheck,
  SlidersHorizontal,
  FileText,
} from 'lucide-react'
import { createContext, useContext, useEffect, Suspense } from 'react'
import {
  Link,
  Outlet,
  useRouterState,
  useSearch,
  useRouter,
} from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Account, Session } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { ErrorMessage, Loading, NoData } from './feedback'
import { PageSkeleton } from './page-skeleton'
import { accountOptions, sessionOptions } from '@/lib/session-queries'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { SidebarGroupLabel } from '@/components/ui/sidebar'

const Context = createContext<{
  session: Session
  accountId: string
  accounts: Account[]
} | null>(null)
export function useAccount() {
  const value = useContext(Context)
  if (!value) throw new Error('Missing account context')
  return value
}
function Brand() {
  return (
    <div className="flex items-center gap-2 py-2" aria-label="Capitec">
      <img src="/capitec-logo.svg" alt="" className="w-12" />
      <span className="text-2xl font-bold text-accent-foreground">capitec</span>
    </div>
  )
}
function SignIn() {
  const router = useRouter()
  const client = useQueryClient()
  const login = useMutation({
    mutationFn: (data: FormData) =>
      api<void>('/api/session', {
        method: 'POST',
        body: new URLSearchParams({
          username: String(data.get('username')),
          password: String(data.get('password')),
        }),
      }),
    onSuccess: async () => {
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' })
      client.setQueryData(['session'], await api<Session>('/api/me'))
      await router.invalidate()
    },
  })
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <Brand />
          <CardTitle>Capitec Operations</CardTitle>
          <CardDescription>Sign in to your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="sign-in"
            onSubmit={(e) => {
              e.preventDefault()
              login.mutate(new FormData(e.currentTarget))
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <ErrorMessage error={login.error} />
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter>
          <Button
            form="sign-in"
            type="submit"
            disabled={login.isPending}
            className="w-full"
          >
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}

function Navigation({ session }: { session: Session }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { setOpenMobile } = useSidebar()
  const links = [
    { to: '/overview', label: 'Overview', icon: LayoutDashboard, show: true },
    {
      to: '/transactions',
      label: 'Transactions',
      icon: ArrowLeftRight,
      show: true,
    },
    {
      to: '/fraud',
      label: 'Fraud checks',
      icon: ShieldCheck,
      show: session.fraudEnabled,
    },
    {
      to: '/fraud-rules',
      label: 'Fraud rules',
      icon: SlidersHorizontal,
      show: session.fraudEnabled && session.operator,
    },
    {
      to: '/statements',
      label: 'Statements',
      icon: FileText,
      show: session.statementsEnabled,
    },
  ] as const
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex flex-col gap-1 px-2 py-4">
          <Brand />
          <span className="text-sm">Operations</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {(session.operator && session.fraudEnabled
          ? ['Workspace', 'Manage']
          : ['Workspace']
        ).map((group) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {links
                  .filter(
                    (link) =>
                      link.show &&
                      (group === 'Manage'
                        ? link.to === '/fraud-rules'
                        : link.to !== '/fraud-rules'),
                  )
                  .sort(
                    (a, b) =>
                      (a.to === '/statements' ? 1 : 0) -
                      (b.to === '/statements' ? 1 : 0),
                  )
                  .map((link) => (
                    <SidebarMenuItem key={link.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === link.to}
                      >
                        <Link
                          to={link.to}
                          search={{}}
                          onClick={() => setOpenMobile(false)}
                        >
                          <link.icon />
                          <span>{link.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
export function AppShell() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const pageTitle = (
    {
      '/overview': 'Overview',
      '/transactions': 'Transactions',
      '/fraud': 'Fraud checks',
      '/fraud-rules': 'Fraud rules',
      '/statements': 'Statements',
    } as Record<string, string>
  )[pathname]
  const client = useQueryClient()
  const search = useSearch({ strict: false })
  const router = useRouter()
  const session = useQuery(sessionOptions)
  const accounts = useQuery({
    ...accountOptions(session.data?.username || ''),
    enabled: Boolean(session.data),
  })
  useEffect(() => {
    const expire = () => {
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' })
      client.setQueryData(['session'], null)
    }
    window.addEventListener('session-expired', expire)
    return () => window.removeEventListener('session-expired', expire)
  }, [client])
  const logout = useMutation({
    mutationFn: () => api('/api/session/logout', { method: 'POST' }),
    onSuccess: () => {
      client.clear()
      client.setQueryData(['session'], null)
      void router.invalidate()
    },
  })
  if (session.isPending)
    return (
      <main className="p-12">
        <Loading />
      </main>
    )
  if (session.error)
    return (
      <main className="p-12">
        <ErrorMessage error={session.error} />
        <Button onClick={() => session.refetch()}>Retry</Button>
      </main>
    )
  if (!session.data) return <SignIn />
  const visible = accounts.data?.items ?? []
  // Empty means all authorized accounts. Never silently substitute the first account.
  const accountId = search.accountId ?? ''
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Navigation session={session.data} />
        <SidebarInset>
          <header className="flex items-center justify-between gap-4 border-b bg-card px-6 py-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden sm:inline-flex">
                    Operations
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage role={undefined}>
                      {pageTitle}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-3">
              <Avatar className="hidden sm:flex">
                <AvatarFallback>
                  {session.data.username.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {session.data.username}
              </span>
              <Button
                variant="ghost"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                Sign out
              </Button>
            </div>
          </header>
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-8">
            <ErrorMessage error={accounts.error ?? logout.error} />
            {accounts.isPending ? (
              <Loading />
            ) : visible.length === 0 ? (
              <NoData
                title="No accounts"
                description="There are no accounts available to this user."
              />
            ) : (
              <Context.Provider
                key={accountId}
                value={{ session: session.data, accountId, accounts: visible }}
              >
                <Suspense fallback={<PageSkeleton />}>
                  <Outlet />
                </Suspense>
              </Context.Provider>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
