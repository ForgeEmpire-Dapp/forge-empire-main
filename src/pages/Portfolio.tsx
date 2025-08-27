import { useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { PortfolioTracker } from '@/components/portfolio/PortfolioTracker'

const PortfolioPage = () => {
  useEffect(() => {
    document.title = 'Portfolio Dashboard | Avax Forge Empire'
  }, [])
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <PortfolioTracker />
      </main>
    </div>
  )
}

export default PortfolioPage