import { listCollections, listRecipes } from '@/lib/local/store'
import { CollectionsView } from '@/components/collections/collections-view'

export const dynamic = 'force-dynamic'

export default async function CollectionsPage() {
  const collections = await listCollections()
  const recipes = await listRecipes()

  return <CollectionsView collections={collections} recipes={recipes} />
}
