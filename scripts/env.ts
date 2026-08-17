// Scripts run outside Next's env loader — parse .env.local manually (vipar pattern).
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
