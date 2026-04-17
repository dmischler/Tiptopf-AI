'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function toQuery(params: Record<string, string>) {
  const search = new URLSearchParams(params)
  return search.toString()
}

async function getBaseUrl() {
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
  const proto = headerStore.get('x-forwarded-proto') ?? 'http'

  if (host) {
    return `${proto}://${host}`
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

export async function signInAction(formData: FormData) {
  const email = readFormValue(formData, 'email')
  const password = readFormValue(formData, 'password')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?${toQuery({ error: error.message })}`)
  }

  redirect('/library')
}

export async function signUpAction(formData: FormData) {
  const email = readFormValue(formData, 'email')
  const password = readFormValue(formData, 'password')

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    redirect(`/signup?${toQuery({ error: error.message })}`)
  }

  redirect(
    `/login?${toQuery({
      message: 'Account created. Please check your email to verify your account.',
    })}`
  )
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = readFormValue(formData, 'email')
  const baseUrl = await getBaseUrl()
  const redirectTo = `${baseUrl}/reset-password`

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

  if (error) {
    redirect(`/forgot-password?${toQuery({ error: error.message })}`)
  }

  redirect(
    `/forgot-password?${toQuery({ message: 'Password reset email sent. Check your inbox.' })}`
  )
}

export async function resetPasswordAction(formData: FormData) {
  const password = readFormValue(formData, 'password')
  const confirmPassword = readFormValue(formData, 'confirmPassword')

  if (!password || password.length < 8) {
    redirect(`/reset-password?${toQuery({ error: 'Password must be at least 8 characters.' })}`)
  }

  if (password !== confirmPassword) {
    redirect(`/reset-password?${toQuery({ error: 'Passwords do not match.' })}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirect(`/reset-password?${toQuery({ error: error.message })}`)
  }

  redirect(`/login?${toQuery({ message: 'Password updated successfully. You can sign in now.' })}`)
}
