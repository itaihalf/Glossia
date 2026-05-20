import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  icon: LucideIcon
  label: string
}

interface BottomNavProps {
  items: NavItem[]
}

export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px]',
        'bg-white/95 backdrop-blur-sm border-t border-gray-100',
        'flex items-stretch',
        'z-50',
        // Safe area for iPhone home indicator
        'pb-[env(safe-area-inset-bottom,0px)]',
      )}
    >
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to.endsWith('dashboard') || to.endsWith('home')}
          className={({ isActive }) =>
            cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors duration-150',
              isActive ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={cn('h-5 w-5 transition-transform duration-150', isActive && 'scale-110')}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
