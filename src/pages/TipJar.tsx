import { useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { TipJarCard } from '@/components/tips/TipJarCard'

const TipJarPage = () => {
  useEffect(() => {
    document.title = 'Tip Jar | Avax Forge Empire'
  }, [])
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-10">
        <TipJarCard />
      </main>
    </div>
  )
}

export default TipJarPage
