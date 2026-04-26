import type { Collection, Recipe } from '@/types'

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatInstructions(instructions: string) {
  const lines = instructions
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return lines.map((line, index) => `${index + 1}. ${line.replace(/^\d+[.)]\s*/, '')}`)
}

function categoryLabel(category: Recipe['category']) {
  const labels: Record<Recipe['category'], string> = {
    starter: 'Vorspeise',
    main: 'Hauptgericht',
    dessert: 'Dessert',
    side: 'Beilage',
    breakfast: 'Frühstück',
    snack: 'Snack',
  }

  return labels[category]
}

function difficultyLabel(difficulty: Recipe['difficulty']) {
  const labels: Record<Recipe['difficulty'], string> = {
    easy: 'Einfach',
    medium: 'Mittel',
    hard: 'Schwer',
  }

  return labels[difficulty]
}

export function buildCollectionMarkdown(collection: Collection, recipes: Recipe[]) {
  const sections: string[] = []

  sections.push(`# ${collection.name}`)
  sections.push('')
  sections.push(`Exportiert am: ${new Date().toLocaleDateString('de-CH')}`)
  sections.push(`Rezepte: ${recipes.length}`)

  for (const recipe of recipes) {
    const totalTime = recipe.prep_time + recipe.cook_time

    sections.push('')
    sections.push(`## ${recipe.title}`)
    sections.push('')
    sections.push(`- Kategorie: ${categoryLabel(recipe.category)}`)
    sections.push(`- Schwierigkeit: ${difficultyLabel(recipe.difficulty)}`)
    sections.push(`- Vorbereitung: ${recipe.prep_time > 0 ? `${recipe.prep_time} min` : '—'}`)
    sections.push(`- Kochen: ${recipe.cook_time > 0 ? `${recipe.cook_time} min` : '—'}`)
    sections.push(`- Gesamtzeit: ${totalTime > 0 ? `${totalTime} min` : '—'}`)
    sections.push(`- Portionen: ${recipe.servings > 0 ? recipe.servings : '—'}`)

    if (recipe.tags.length > 0) {
      sections.push(`- Tags: ${recipe.tags.join(', ')}`)
    }

    sections.push('')
    sections.push('### Zutaten')
    sections.push('')
    for (const ingredient of recipe.ingredients) {
      sections.push(`- ${ingredient}`)
    }

    sections.push('')
    sections.push('### Anleitung')
    sections.push('')
    for (const instruction of formatInstructions(recipe.instructions)) {
      sections.push(instruction)
    }
  }

  sections.push('')
  return sections.join('\n')
}

export function collectionMarkdownFilename(collectionName: string) {
  const slug = slugify(collectionName)
  return `${slug || 'sammlung'}.md`
}
