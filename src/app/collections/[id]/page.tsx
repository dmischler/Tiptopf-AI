import { notFound } from 'next/navigation'
import { getCollection, listRecipes } from '@/lib/local/store'
import { CollectionDetailView } from '@/components/collections/collection-detail-view'

export const dynamic = 'force-dynamic'

interface CollectionDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function CollectionDetailPage({ params }: CollectionDetailPageProps) {
  const { id } = await params
  const collection = await getCollection(id)

  if (!collection) {
    notFound()
  }

  const allRecipes = await listRecipes()

  return <CollectionDetailView collection={collection} allRecipes={allRecipes} />
}
