"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  SESSION_COOKIE,
  audit,
  clearFailures,
  createSessionToken,
  rateLimited,
  recordFailure,
  requestIdentity,
  verifyUser,
} from "@/lib/auth"

export interface LoginState {
  error?: string
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const user = String(formData.get("user") ?? "").trim()
  const pass = String(formData.get("password") ?? "")
  const fromRaw = String(formData.get("from") ?? "")

  const { ip } = await requestIdentity()

  if (rateLimited(ip)) {
    await audit("login-rate-limited", { user })
    return { error: "Too many attempts. Try again in a few minutes." }
  }

  const verified = await verifyUser(user, pass)
  if (!verified) {
    recordFailure(ip)
    await audit("login-failed", { user })
    return { error: "Invalid login ID or password." }
  }

  clearFailures(ip)
  await audit("login-ok", { user, role: verified.role })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, createSessionToken(user, verified.role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  })

  const from = fromRaw.startsWith("/") && !fromRaw.startsWith("//") ? fromRaw : "/dashboard"
  const target = verified.role !== "admin" && from.startsWith("/admin") ? "/dashboard" : from
  redirect(target)
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  await audit("logout")
  redirect("/login")
}
