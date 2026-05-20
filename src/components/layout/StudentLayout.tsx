import { Outlet } from 'react-router-dom'
import { Home, BookOpen, Archive, Users, User } from 'lucide-react'
import { BottomNav } from './BottomNav'
import type { NavItem } from './BottomNav'

const NAV_ITEMS: NavItem[] = [
  { to: '/student/dashboard', icon: Home,     label: 'Home'    },
  { to: '/student/stories',   icon: BookOpen,  label: 'Stories' },
  { to: '/student/words',     icon: Archive,   label: 'Words'   },
  { to: '/student/classes',   icon: Users,     label: 'Classes' },
  { to: '/student/profile',   icon: User,      label: 'Profile' },
]

export function StudentLayout() {
  return (
    <div className="relative min-h-dvh">
      <main className="pb-nav">
        <Outlet />
      </main>
      <BottomNav items={NAV_ITEMS} />
    </div>
  )
}
