export function toInstructionSteps(instructions: string) {
  const lines = instructions
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0 && instructions.trim()) {
    return [instructions.trim()]
  }

  return lines.map((line) => line.replace(/^\d+[.)]\s*/, ''))
}

type RecipeInstructionsProps = {
  instructions: string
}

export function RecipeInstructions({ instructions }: RecipeInstructionsProps) {
  const steps = toInstructionSteps(instructions)

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Anleitung</h2>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={`${step}-${index}`} className="flex gap-3 text-sm leading-relaxed">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
