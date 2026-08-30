import { revalidatePath } from 'next/cache'

export function revalidateApp() {
  revalidatePath('/library')
  revalidatePath('/library/[id]', 'page')
  revalidatePath('/collections')
  revalidatePath('/collections/[id]', 'page')
  revalidatePath('/einkaufsliste')
  revalidatePath('/profile')
}
