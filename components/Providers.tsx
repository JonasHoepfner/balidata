'use client'

import { AuthModalProvider } from '@/context/AuthModalContext'
import AuthModal from '@/components/AuthModal'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthModalProvider>
      {children}
      <AuthModal />
    </AuthModalProvider>
  )
}
