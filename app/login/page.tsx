import type { Metadata } from "next"
import Image from "next/image"
import { ShieldCheck } from "lucide-react"

import { Card } from "@/components/ui/card"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Sign in · LINKS Branch Analytics",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await searchParams

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.2_0.01_285/40%),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/2.5%)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/2.5%)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />

      <Card className="relative z-10 w-full max-w-sm gap-6 rounded-2xl border-foreground/[0.06] bg-foreground/[0.02] p-8 shadow-none backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-10 items-center rounded-lg bg-white px-3">
            <Image src="/links-logo.png" alt="LINKS" width={80} height={32} className="h-6 w-auto" priority />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold tracking-tight">LINKS Branch Analytics</h1>
            <p className="text-xs text-muted-foreground">
              Sign in to view branch productivity across the LINKS network.
            </p>
          </div>
        </div>

        <LoginForm from={from} />

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60">
          <ShieldCheck className="h-3.5 w-3.5" />
          HQ management access only · sign-ins are logged
        </div>
      </Card>
    </div>
  )
}
