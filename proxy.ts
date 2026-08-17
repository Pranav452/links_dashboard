import { NextResponse, type NextRequest } from "next/server"

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth"

// Session gate for every app page (vipar pattern, Next 16 proxy convention).
// /dashboard needs any session; /admin needs the admin role.
export default function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const needsSession = path === "/dashboard" || path.startsWith("/dashboard/")
  const needsAdmin = path === "/admin" || path.startsWith("/admin/")
  const session = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)

  if (needsSession || needsAdmin) {
    if (!session) {
      const login = new URL("/login", req.nextUrl)
      login.searchParams.set("from", path)
      return NextResponse.redirect(login)
    }
    if (needsAdmin && session.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
    }
  }

  if (path === "/login" && session) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
}
