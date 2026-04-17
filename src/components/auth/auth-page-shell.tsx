import type { ReactNode } from 'react'

type AuthPageShellProps = {
  children: ReactNode
}

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(251,146,60,0.22),_transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(249,115,22,0.18),_transparent_35%),linear-gradient(135deg,_#09090b_0%,_#111114_45%,_#18181b_100%)] px-4 py-10">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="relative w-full max-w-xl">{children}</div>
    </main>
  )
}
