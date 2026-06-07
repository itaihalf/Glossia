import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getLanguageName(code: string): string {
  const map: Record<string, string> = {
    el: 'Greek', es: 'Spanish', fr: 'French', it: 'Italian',
    de: 'German', he: 'Hebrew', ar: 'Arabic', ja: 'Japanese',
    zh: 'Mandarin', ko: 'Korean', ru: 'Russian', pt: 'Portuguese',
    nl: 'Dutch', tr: 'Turkish', pl: 'Polish', hi: 'Hindi',
  }
  return map[code] ?? code
}

export function getLanguageFlag(code: string): string {
  const map: Record<string, string> = {
    el: '🇬🇷', es: '🇪🇸', fr: '🇫🇷', it: '🇮🇹',
    de: '🇩🇪', he: '🇮🇱', ar: '🇸🇦', ja: '🇯🇵',
    zh: '🇨🇳', ko: '🇰🇷', ru: '🇷🇺', pt: '🇧🇷',
    nl: '🇳🇱', tr: '🇹🇷', pl: '🇵🇱', hi: '🇮🇳',
  }
  return map[code] ?? '🌐'
}

export function getLevelLabel(level: string): string {
  const map: Record<string, string> = {
    complete_beginner: 'Complete Beginner',
    beginner: 'Beginner',
    novice: 'Novice',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  }
  return map[level] ?? level
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function getYesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

export function getISOWeek(d: Date = new Date()): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// Returns the current ISO week number (weeks start Monday) based on Israel
// local time (Asia/Jerusalem). Handles DST automatically via toLocaleDateString.
export function getIsraelWeekNumber(): number {
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// True if lastWeek is the week immediately before currentWeek.
// Handles year boundary (week 52 or 53 → week 1 of new year).
export function isConsecutiveWeek(lastWeek: number | null, currentWeek: number): boolean {
  if (lastWeek === null) return false
  if (currentWeek > 1) return lastWeek === currentWeek - 1
  return lastWeek >= 52 // week 52/53 preceding week 1 of new year
}

export function formatTimeAgo(iso: string | null): string {
  if (!iso) return 'never reviewed'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'reviewed today'
  if (days === 1) return 'reviewed yesterday'
  if (days < 7) return `reviewed ${days}d ago`
  if (days < 30) return `reviewed ${Math.floor(days / 7)}w ago`
  return `reviewed ${Math.floor(days / 30)}mo ago`
}
