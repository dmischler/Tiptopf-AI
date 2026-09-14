import { describe, expect, it } from 'vitest'

import { decodeHtmlEntities, parseRecipeHtml, resolveMaybeUrl } from '@/lib/ai/url-fetcher'

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

const ENCODED_OG_IMAGE_HTML = `<!doctype html>
<html>
  <head>
    <meta property="og:image" content="/media/img.jpeg?width=500&amp;height=370&amp;v=1">
  </head>
  <body><p>Pie recipe</p></body>
</html>`

const STADELMANN_HTML = `<!doctype html>
<html>
  <head>
    <title>Rezept Kartoffelgratin</title>
    <meta property="og:image" content="/media/myqlcyad/img_8117.jpeg?width=500&amp;height=370&amp;v=1da540bd4399d50" />
  </head>
  <body>
    <h1 class="bigTitle nomarginbottom">Kartoffelgratin mit Weichk&#xE4;se und Birnen</h1>
    <div class="ingredientsWrap">
      <h2 class="bigTitle">Zutaten</h2>
      <p>4-6 Portionen</p>
      <ul>
        <li>800g Kartoffeln (festkochend)</li>
        <li>200g Weichk&#xE4;se</li>
        <li>Salz&amp;Pfeffer</li>
      </ul>
    </div>
    <div class="preparationWrap">
      <h2 class="bigTitle">Zubereitung</h2>
      <p>Kartoffeln, Birnen und Weichk&#xE4;se in d&#xFC;nne Scheiben schneiden.<br>In eine Gratinform geben.<br>F&#xFC;r 30 Minuten bei 180 Grad Umluft im Backofen garen.</p>
    </div>
    <h2 class="otherRecipeTitle">Weitere Rezepte die dich interessieren k&#xF6;nnten</h2>
  </body>
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

  it('decodes HTML entities in og:image URLs', () => {
    const result = parseRecipeHtml(ENCODED_OG_IMAGE_HTML, 'https://food.example/recipes/pie')
    expect(result.imageUrl).toBe('https://food.example/media/img.jpeg?width=500&height=370&v=1')
  })

  it('extracts German recipe sections without JSON-LD', () => {
    const result = parseRecipeHtml(STADELMANN_HTML, 'https://www.sabrina-stadelmann.ch/rezepte/kartoffelgratin/')

    expect(result.structuredRecipe).not.toBeNull()
    expect(result.structuredRecipe?.title).toBe('Kartoffelgratin mit Weichkäse und Birnen')
    expect(result.structuredRecipe?.ingredients).toEqual([
      '800g Kartoffeln (festkochend)',
      '200g Weichkäse',
      'Salz&Pfeffer',
    ])
    expect(result.structuredRecipe?.servings).toBe(4)
    expect(result.structuredRecipe?.cook_time).toBe(30)
    expect(result.structuredRecipe?.instructions).toContain('1. Kartoffeln, Birnen und Weichkäse')
    expect(result.structuredRecipe?.instructions).toContain('2. In eine Gratinform geben.')
    expect(result.structuredRecipe?.instructions).toContain('3. Für 30 Minuten')
    expect(result.imageUrl).toBe(
      'https://www.sabrina-stadelmann.ch/media/myqlcyad/img_8117.jpeg?width=500&height=370&v=1da540bd4399d50',
    )
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

describe('decodeHtmlEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeHtmlEntities('Weichk&#xE4;se &amp; Birnen')).toBe('Weichkäse & Birnen')
  })
})
