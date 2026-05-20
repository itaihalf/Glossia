import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
  interactive?: boolean
}

export function Card({ children, className, padding = 'md', onClick, interactive }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl shadow-sm border border-gray-100',
        paddings[padding],
        interactive && 'cursor-pointer hover:shadow-md hover:border-brand-100 active:scale-[0.99] transition-all duration-150',
        className,
      )}
    >
      {children}
    </div>
  )
}
