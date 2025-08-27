import { useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { TokenForge } from '@/components/forge/TokenForge'

const ForgePage = () => {
  useEffect(() => {
    document.title = 'Token Forge | Avax Forge Empire'
  }, [])
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-10">
        <TokenForge />
      </main>
    </div>
  )
}

export default ForgePage
