import { LibraryView } from '@/components/library/library-view'
import { listRecipes } from '@/lib/local/store'
import type { Recipe } from '@/types'

export default async function LibraryPage() {
  const data = await listRecipes()

  return <LibraryView initialRecipes={(data ?? []) as Recipe[]} />
}
