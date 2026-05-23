import { BookOpen, Folder, ShoppingCart, User, type LucideIcon } from 'lucide-react'

export type AppNavItem = {
  href: '/library' | '/collections' | '/einkaufsliste' | '/profile'
  label: string
  icon: LucideIcon
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: '/library', label: 'Bibliothek', icon: BookOpen },
  { href: '/collections', label: 'Sammlungen', icon: Folder },
  { href: '/einkaufsliste', label: 'Einkaufsliste', icon: ShoppingCart },
  { href: '/profile', label: 'Profil', icon: User },
]
