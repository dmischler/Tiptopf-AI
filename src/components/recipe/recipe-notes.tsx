export function renderNotesToHtml(notes: string): string {
  let html = notes
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>')

  const lines = html.split('\n')
  const out: string[] = []
  let inUl = false
  let inOl = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (/^[-*+]\s+/.test(line)) {
      if (!inUl) {
        if (inOl) {
          out.push('</ol>')
          inOl = false
        }
        out.push('<ul class="list-disc pl-5 space-y-1">')
        inUl = true
      }
      out.push('<li>' + line.replace(/^[-*+]\s+/, '') + '</li>')
    } else if (/^\d+\.\s+/.test(line)) {
      if (!inOl) {
        if (inUl) {
          out.push('</ul>')
          inUl = false
        }
        out.push('<ol class="list-decimal pl-5 space-y-1">')
        inOl = true
      }
      out.push('<li>' + line.replace(/^\d+\.\s+/, '') + '</li>')
    } else {
      if (inUl) {
        out.push('</ul>')
        inUl = false
      }
      if (inOl) {
        out.push('</ol>')
        inOl = false
      }
      if (line) out.push('<p class="mb-2 last:mb-0">' + line + '</p>')
    }
  }
  if (inUl) out.push('</ul>')
  if (inOl) out.push('</ol>')

  return out.join('')
}

type RecipeNotesProps = {
  notes?: string | null
}

export function RecipeNotes({ notes }: RecipeNotesProps) {
  const trimmed = notes?.trim()
  if (!trimmed) {
    return null
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Anmerkungen</h2>
      <div
        className="text-sm leading-relaxed text-foreground/90"
        dangerouslySetInnerHTML={{ __html: renderNotesToHtml(trimmed) }}
      />
    </section>
  )
}
