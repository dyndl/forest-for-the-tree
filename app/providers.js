'use client'
import 'regenerator-runtime/runtime'
import { SessionProvider } from 'next-auth/react'
export function Providers({ children }) {
  return <SessionProvider>{children}</SessionProvider>
}
