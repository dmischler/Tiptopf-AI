import { BookOpen, Folder, User, type LucideIcon } from 'lucide-react'

export type AppNavItem = {
  href: '/library' | '/collections' | '/profile'
  label: string
  icon: LucideIcon
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: '/library', label: 'Bibliothek', icon: BookOpen },
  { href: '/collections', label: 'Sammlungen', icon: Folder },
  { href: '/profile', label: 'Profil', icon: User },
]
