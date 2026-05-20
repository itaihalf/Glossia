import { Outlet } from 'react-router-dom'
import { Home, GraduationCap, ClipboardList, User } from 'lucide-react'
import { BottomNav } from './BottomNav'
import type { NavItem } from './BottomNav'

const NAV_ITEMS: NavItem[] = [
  { to: '/teacher/dashboard',   icon: Home,          label: 'Home'        },
  { to: '/teacher/classes',     icon: GraduationCap, label: 'Classes'     },
  { to: '/teacher/assignments', icon: ClipboardList, label: 'Assignments' },
  { to: '/teacher/profile',     icon: User,          label: 'Profile'     },
]

export function TeacherLayout() {
  return (
    <div className="relative min-h-dvh">
      <main className="pb-nav">
        <Outlet />
      </main>
      <BottomNav items={NAV_ITEMS} />
    </div>
  )
}
