import { redirect } from "next/navigation"

// Internal tool — the proxy bounces unauthenticated visits to /login.
export default function Home() {
  redirect("/dashboard")
}
