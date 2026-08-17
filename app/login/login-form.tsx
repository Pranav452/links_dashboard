"use client"

import { useActionState } from "react"
import { KeyRound, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { login, type LoginState } from "./actions"

export function LoginForm({ from }: { from?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      {from && <input type="hidden" name="from" value={from} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="user" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Login ID
        </label>
        <Input
          id="user"
          name="user"
          autoComplete="username"
          required
          autoFocus
          placeholder="Login ID"
          className="h-11 rounded-xl border-foreground/10 bg-foreground/[0.03]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="h-11 rounded-xl border-foreground/10 bg-foreground/[0.03]"
        />
      </div>

      {state.error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-1 h-11 rounded-xl text-sm font-medium">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
