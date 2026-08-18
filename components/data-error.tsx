import { DatabaseZap } from "lucide-react"

import { Card } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"

/**
 * Inline "we could not read the data" card. Every page reads from Neon only, so
 * a missing DATABASE_URL or an unreachable database renders this instead of
 * crashing the route.
 */
export function DataErrorCard({ message, title }: { message: string; title?: string }) {
  return (
    <Card className="gap-3 rounded-2xl border-destructive/25 bg-destructive/[0.05] p-6 shadow-none">
      <div className="flex items-center gap-2">
        <DatabaseZap className="h-4 w-4 text-destructive" />
        <span className="text-xs font-medium tracking-widest uppercase">
          {title ?? "Database not configured / unreachable"}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{message}</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground/60">
        Job data lives in the Neon table <code className="font-mono">links_jobs</code>. Set{" "}
        <code className="font-mono">DATABASE_URL</code>, run{" "}
        <code className="font-mono">npx tsx scripts/migrate.ts</code>, then upload a branch template from the admin
        panel.
      </p>
    </Card>
  )
}

/** Full-page variant — header plus the card, for a page that cannot render. */
export function DataErrorPage({ message, crumb }: { message: string; crumb: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center gap-2 text-[11px] font-medium tracking-widest text-muted-foreground/70 uppercase">
          <span>LINKS</span>
          <span className="text-muted-foreground/30">/</span>
          <span>{crumb}</span>
        </div>
        <DataErrorCard message={message} />
      </main>
    </div>
  )
}
