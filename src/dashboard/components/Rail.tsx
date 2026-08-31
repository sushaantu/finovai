import { LogOut, Moon, Sun } from 'lucide-react'

import { cn } from '@/lib/utils'
import { DashboardBrandWordmark } from './DashboardBrandWordmark'
import { DASHBOARD_PAGES, type DashboardPage } from '../lib/routing'
import type { DashboardTheme } from '../lib/types'

interface RailProps {
  activePage: DashboardPage
  dashboardTheme: DashboardTheme
  onNavigate: (page: DashboardPage) => void
  onToggleTheme: () => void
  onLogout: () => void
}

export function Rail({ activePage, dashboardTheme, onNavigate, onToggleTheme, onLogout }: RailProps) {
  return (
    <aside className="flex min-w-0 items-center justify-between gap-3 border-b border-border/70 bg-background px-3 py-2 md:h-full md:flex-col md:items-stretch md:border-b-0 md:border-r md:px-3 md:py-4">
      <div className="flex min-w-0 items-center gap-2 md:flex-col md:items-stretch md:gap-5">
        <button
          type="button"
          className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-0 text-foreground transition-colors hover:bg-secondary md:w-full md:justify-start md:px-2"
          aria-label="FinovAI"
          title="FinovAI"
          onClick={() => onNavigate('inicio')}
        >
          <DashboardBrandWordmark />
        </button>

        <nav className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] md:mx-0 md:flex-col md:items-stretch md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden" aria-label="Dashboard">
          {DASHBOARD_PAGES.map((page) => {
            const Icon = page.icon
            const isActive = activePage === page.id

            return (
              <button
                key={page.id}
                type="button"
                aria-label={page.label}
                title={page.label}
                className={cn(
                  'flex h-10 shrink-0 items-center justify-center gap-3 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:w-full md:justify-start',
                  isActive && 'bg-secondary text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                )}
                onClick={() => onNavigate(page.id)}
              >
                <Icon className="size-4" />
                <span className="hidden truncate md:block">{page.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1 md:flex-col md:items-stretch">
        <button
          type="button"
          aria-label={dashboardTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={dashboardTheme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          className="flex h-10 shrink-0 items-center justify-center gap-3 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:w-full md:justify-start"
          onClick={onToggleTheme}
        >
          {dashboardTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          <span className="hidden truncate md:block">{dashboardTheme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
        <button
          type="button"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex h-10 shrink-0 items-center justify-center gap-3 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:w-full md:justify-start"
          onClick={onLogout}
        >
          <LogOut className="size-4" />
          <span className="hidden truncate md:block">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
