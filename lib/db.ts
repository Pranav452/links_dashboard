import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

type Sql = NeonQueryFunction<false, false>

const globalCache = globalThis as unknown as { __linksSql?: Sql | null }

/** Neon client, or null when DATABASE_URL is not configured (file fallback mode). */
export function getSql(): Sql | null {
  if (globalCache.__linksSql !== undefined) return globalCache.__linksSql
  const url = process.env.DATABASE_URL
  globalCache.__linksSql = url ? neon(url) : null
  return globalCache.__linksSql
}

export function dbEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

function isRetryableNeonError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as Record<string, unknown>)["neon:retryable"] === true
}

/**
 * Retries a Neon query on transient "control plane request failed" errors —
 * these happen when the free-tier compute is waking from autosuspend and are
 * marked `neon:retryable` by the driver. Non-retryable errors throw immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRetryableNeonError(err) || i === attempts - 1) throw err
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** i))
    }
  }
  throw lastErr
}
