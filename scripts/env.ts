// Scripts run outside Next's env loader — parse .env.local manually (vipar pattern).
import dns from "node:dns"
import { readFileSync } from "node:fs"
import path from "node:path"

export function loadEnvLocal(): void {
  try {
    const file = readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
    for (const line of file.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let v = m[2]
      if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1)
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  } catch {
    /* no .env.local — fine */
  }
}

/**
 * Some local routers cannot resolve *.neon.tech. Resolve A records through
 * public DNS first and fall back to the system resolver. Scripts only — the
 * app runtime never imports this — and a no-op on Vercel / when opted out
 * with LINKS_SYSTEM_DNS=1.
 */
export function installPublicDnsFallback(): void {
  if (process.env.VERCEL || process.env.LINKS_SYSTEM_DNS === "1") return
  const marker = dns as unknown as { __linksPatched?: boolean }
  if (marker.__linksPatched) return
  marker.__linksPatched = true

  const resolver = new dns.Resolver()
  resolver.setServers(["8.8.8.8", "1.1.1.1"])
  const original = dns.lookup
  type Cb = (err: NodeJS.ErrnoException | null, address?: unknown, family?: number) => void
  ;(dns as unknown as { lookup: unknown }).lookup = (host: string, opts: unknown, cb?: Cb) => {
    if (typeof opts === "function") {
      cb = opts as Cb
      opts = {}
    }
    const wantAll = typeof opts === "object" && opts !== null && (opts as { all?: boolean }).all
    resolver.resolve4(host, (err, addrs) => {
      if (err || !addrs?.length) return (original as unknown as (...a: unknown[]) => void)(host, opts, cb)
      if (wantAll) return cb!(null, addrs.map((address) => ({ address, family: 4 })))
      cb!(null, addrs[0], 4)
    })
  }
}
