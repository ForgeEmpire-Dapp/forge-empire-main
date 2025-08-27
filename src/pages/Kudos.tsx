import { useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { KudosCard } from '@/components/social/KudosCard'

const KudosPage = () => {
  useEffect(() => {
    document.title = 'Kudos | Avax Forge Empire'
  }, [])
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-10">
        <KudosCard />
      </main>
    </div>
  )
}

export default KudosPage
