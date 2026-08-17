"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

// Dark is the LINKS default; the toggle flips to the clean light twin.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange={false}>
      {children}
    </NextThemesProvider>
  )
}
