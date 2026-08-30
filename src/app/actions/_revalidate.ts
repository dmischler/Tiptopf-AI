import { revalidatePath } from 'next/cache'

export function revalidateApp() {
  revalidatePath('/library')
  revalidatePath('/collections')
  revalidatePath('/einkaufsliste')
  revalidatePath('/profile')
}
