export type RecipeImageCandidate = {
  id: string
  source: 'pexels' | 'mealdb'
  url: string
  thumbnailUrl: string
  alt: string
  creditName?: string
  creditUrl?: string
}

export type ResolvedRecipeImage = {
  imageUrl: string
  source: 'pexels' | 'mealdb' | 'ai'
  creditName?: string
  creditUrl?: string
}
