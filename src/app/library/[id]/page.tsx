import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RecipeView } from '@/components/library/recipe-view'
import { getRecipe, listCollections } from '@/lib/local/store'
import type { Collection, Recipe } from '@/types'

export const dynamic = 'force-dynamic'

type RecipePageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: RecipePageProps): Promise<Metadata> {
  const { id } = await params
  const recipe = await getRecipe(id)
  if (!recipe) {
    return { title: 'Rezept nicht gefunden' }
  }
  return { title: `${recipe.title} – Tiptopf-AI` }
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { id } = await params
  const recipe = await getRecipe(id)
  if (!recipe) {
    notFound()
  }

  const collections = await listCollections()

  return (
    <RecipeView
      key={recipe.id}
      recipe={recipe as Recipe}
      collections={(collections ?? []) as Collection[]}
    />
  )
}
