import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return []
  }

  return tags
    .map((tag) => typeof tag === 'string' ? tag.trim().toLowerCase() : '')
    .filter((tag) => tag.length > 0)
    .filter((tag, index, arr) => arr.indexOf(tag) === index)
}
