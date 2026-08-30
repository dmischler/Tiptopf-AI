import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RecipeEditForm } from '@/components/library/recipe-edit-form'
import { getRecipe, listRecipes } from '@/lib/local/store'
import type { Recipe } from '@/types'

export const dynamic = 'force-dynamic'

type EditRecipePageProps = {
  params: Promise<{ id: string }>
}

function uniqueTags(recipes: Recipe[]) {
  const tagSet = new Set<string>()
  for (const recipe of recipes) {
    for (const tag of recipe.tags) {
      tagSet.add(tag)
    }
  }
  return Array.from(tagSet).sort()
}

export async function generateMetadata({ params }: EditRecipePageProps): Promise<Metadata> {
  const { id } = await params
  const recipe = await getRecipe(id)
  if (!recipe) {
    return { title: 'Rezept nicht gefunden' }
  }
  return { title: `${recipe.title} bearbeiten – Tiptopf-AI` }
}

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const { id } = await params
  const recipe = await getRecipe(id)
  if (!recipe) {
    notFound()
  }

  const recipes = await listRecipes()

  return (
    <RecipeEditForm
      key={recipe.id}
      recipe={recipe as Recipe}
      allTags={uniqueTags((recipes ?? []) as Recipe[])}
    />
  )
}
