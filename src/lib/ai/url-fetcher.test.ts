import { describe, expect, it } from 'vitest'

import { parseRecipeHtml, resolveMaybeUrl } from '@/lib/ai/url-fetcher'

const RECIPE_HTML = `<!doctype html>
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Pancakes",
        "recipeIngredient": ["2 Eier", "150 g Mehl"],
        "recipeInstructions": ["Mix the batter", "Fry until golden"],
        "prepTime": "PT10M",
        "cookTime": "PT15M",
        "recipeYield": "4"
      }
    </script>
  </head>
  <body><h1>Pancakes</h1></body>
</html>`

const OBJECT_TYPE_HTML = `<!doctype html>
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": { "id": "https://schema.org/Recipe" },
        "name": "Should skip",
        "recipeIngredient": ["x"],
        "recipeInstructions": "y"
      }
    </script>
  </head>
  <body><p>Just a blog post about pancakes.</p></body>
</html>`

const OG_IMAGE_HTML = `<!doctype html>
<html>
  <head>
    <meta property="og:image" content="/images/pie.jpg">
  </head>
  <body><p>Pie recipe</p></body>
</html>`

describe('parseRecipeHtml', () => {
  it('extracts structured fields from JSON-LD Recipe', () => {
    const result = parseRecipeHtml(RECIPE_HTML, 'https://example.com/recipes/pancakes')

    expect(result.structuredRecipe).not.toBeNull()
    expect(result.structuredRecipe?.title).toBe('Pancakes')
    expect(result.structuredRecipe?.ingredients).toEqual(['2 Eier', '150 g Mehl'])
    expect(result.structuredRecipe?.instructions).toContain('Mix the batter')
    expect(result.structuredRecipe?.prep_time).toBe(10)
    expect(result.structuredRecipe?.cook_time).toBe(15)
    expect(result.structuredRecipe?.servings).toBe(4)
    expect(result.content).toContain('Pancakes')
  })

  it('skips object @type values without throwing', () => {
    expect(() => parseRecipeHtml(OBJECT_TYPE_HTML, 'https://example.com/post')).not.toThrow()

    const result = parseRecipeHtml(OBJECT_TYPE_HTML, 'https://example.com/post')
    expect(result.structuredRecipe).toBeNull()
    expect(result.content.toLowerCase()).toContain('blog post')
  })

  it('resolves a relative og:image against the page URL', () => {
    const result = parseRecipeHtml(OG_IMAGE_HTML, 'https://food.example/recipes/pie')
    expect(result.imageUrl).toBe('https://food.example/images/pie.jpg')
  })
})

describe('resolveMaybeUrl', () => {
  it('resolves relative paths against a base URL', () => {
    expect(resolveMaybeUrl('/images/pie.jpg', 'https://food.example/recipes/pie')).toBe(
      'https://food.example/images/pie.jpg',
    )
  })

  it('rejects non-http(s) protocols', () => {
    expect(resolveMaybeUrl('file:///etc/passwd', 'https://example.com/')).toBeNull()
  })
})
