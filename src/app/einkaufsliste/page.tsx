import { getShoppingList } from '@/lib/local/store'
import { ShoppingListView } from '@/components/shopping/shopping-list-view'

export const dynamic = 'force-dynamic'

export default async function EinkaufslistePage() {
  const items = await getShoppingList()

  return <ShoppingListView initialItems={items} />
}
