import type { ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type AuthCardShellProps = {
  title: string
  description: string
  children: ReactNode
}

export function AuthCardShell({ title, description, children }: AuthCardShellProps) {
  return (
    <Card className="w-full max-w-md border border-border/70 bg-card/90 backdrop-blur-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
