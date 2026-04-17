import { redirect } from 'next/navigation'

import { LibraryView } from '@/components/library/library-view'
import { createClient } from '@/lib/supabase/server'
import type { Recipe } from '@/types'

export default async function LibraryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    throw new Error(error.message)
  }

  return <LibraryView initialRecipes={(data ?? []) as Recipe[]} />
}
