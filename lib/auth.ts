import { createHmac, timingSafeEqual } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import { cookies, headers } from "next/headers"

import { getSql, withRetry } from "./db"
import { verifyPassword } from "./password"

// ---------------------------------------------------------------------------
// Config — fallback credentials apply only when no database is configured.
// With DATABASE_URL set, users live in the links_users table.
// ---------------------------------------------------------------------------

const FALLBACK_VIEWER_USER = process.env.LINKS_USER ?? "links"
const FALLBACK_VIEWER_PASS = process.env.LINKS_PASS ?? "links"
const FALLBACK_ADMIN_USER = process.env.LINKS_ADMIN_USER ?? "admin"
const FALLBACK_ADMIN_PASS = process.env.LINKS_ADMIN_PASS ?? "admin123"
const AUTH_SECRET = process.env.AUTH_SECRET ?? "links-branches-dev-secret-change-me"
const SESSION_HOURS = Number(process.env.SESSION_HOURS ?? 24 * 7)

export const SESSION_COOKIE = "links_session"

const DATA_DIR = path.join(process.cwd(), "data")
const AUDIT_FILE = path.join(DATA_DIR, "access-log.jsonl")

export type Role = "viewer" | "admin"

// ---------------------------------------------------------------------------
// Signed session tokens (HMAC-SHA256, stateless)
// ---------------------------------------------------------------------------

export interface SessionPayload {
  u: string
  role: Role
  exp: number
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url")
}

function sign(data: string): string {
  return createHmac("sha256", AUTH_SECRET).update(data).digest("base64url")
}

export function createSessionToken(user: string, role: Role): string {
  const payload: SessionPayload = {
    u: user,
    role,
    exp: Date.now() + SESSION_HOURS * 3600_000,
  }
  const body = b64url(JSON.stringify(payload))
  return `${body}.${sign(body)}`
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null
  const dot = token.lastIndexOf(".")
  if (dot < 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null
    if (payload.role !== "admin" && payload.role !== "viewer") payload.role = "viewer"
    return payload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return verifySessionToken(token)
}

export async function requireAdmin(): Promise<SessionPayload | null> {
  const session = await getSession()
  return session?.role === "admin" ? session : null
}

// ---------------------------------------------------------------------------
// User verification — Neon links_users table, hardcoded fallback without DB
// ---------------------------------------------------------------------------

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export async function verifyUser(username: string, password: string): Promise<{ role: Role } | null> {
  const sql = getSql()
  if (sql) {
    try {
      const rows = (await withRetry(() => sql`
        SELECT password_hash, role FROM links_users WHERE username = ${username}
      `)) as { password_hash: string; role: Role }[]
      if (rows.length > 0) {
        return verifyPassword(password, rows[0].password_hash) ? { role: rows[0].role } : null
      }
      // fall through to hardcoded fallback when the table has no such user
    } catch (err) {
      console.error("verifyUser db error:", err)
      // fall through — table may not exist yet
    }
  }
  if (safeEqual(username, FALLBACK_VIEWER_USER) && safeEqual(password, FALLBACK_VIEWER_PASS)) {
    return { role: "viewer" }
  }
  if (safeEqual(username, FALLBACK_ADMIN_USER) && safeEqual(password, FALLBACK_ADMIN_PASS)) {
    return { role: "admin" }
  }
  return null
}

// ---------------------------------------------------------------------------
// Request identity + audit log (file-based; never breaks the login flow)
// ---------------------------------------------------------------------------

export async function requestIdentity(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers()
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  return { ip, userAgent: h.get("user-agent") ?? "unknown" }
}

export async function audit(event: string, extra: Record<string, string> = {}): Promise<void> {
  try {
    const { ip, userAgent } = await requestIdentity()
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.appendFile(
      AUDIT_FILE,
      JSON.stringify({ ts: new Date().toISOString(), event, ip, userAgent, ...extra }) + "\n",
    )
  } catch {
    // audit logging must never break the login flow
  }
}

// ---------------------------------------------------------------------------
// Login rate limiting (in-memory)
// ---------------------------------------------------------------------------

const attempts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 10 * 60_000
const MAX_ATTEMPTS = 5

export function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || entry.resetAt < now) return false
  return entry.count >= MAX_ATTEMPTS
}

export function recordFailure(ip: string): void {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
  } else {
    entry.count += 1
  }
}

export function clearFailures(ip: string): void {
  attempts.delete(ip)
}
