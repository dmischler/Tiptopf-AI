import { scaleIngredient } from '@/lib/ingredient-scaling'

type RecipeIngredientsProps = {
  ingredients: string[]
  scaleRatio?: number
}

export function RecipeIngredients({ ingredients, scaleRatio = 1 }: RecipeIngredientsProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Zutaten</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
        {ingredients.map((ingredient, index) => {
          const display = scaleRatio !== 1 ? scaleIngredient(ingredient, scaleRatio) : ingredient
          return <li key={index}>{display}</li>
        })}
      </ul>
    </section>
  )
}
