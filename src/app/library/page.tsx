import { LibraryView } from '@/components/library/library-view'
import { listRecipes } from '@/lib/local/store'

export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const recipes = await listRecipes()

  return <LibraryView initialRecipes={recipes} />
}
