import { LibraryView } from '@/components/library/library-view'
import { listCollections, listRecipes } from '@/lib/local/store'
import type { Recipe, Collection } from '@/types'

export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const recipes = await listRecipes()
  const collections = await listCollections()

  return (
    <LibraryView
      initialRecipes={(recipes ?? []) as Recipe[]}
      initialCollections={(collections ?? []) as Collection[]}
    />
  )
}
