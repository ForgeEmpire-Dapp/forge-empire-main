import { useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { EnhancedDAOGovernance } from '@/components/dao/EnhancedDAOGovernance'

const DAOPage = () => {
  useEffect(() => {
    document.title = 'DAO Governance | Avax Forge Empire'
  }, [])
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-10">
        <EnhancedDAOGovernance />
      </main>
    </div>
  )
}

export default DAOPage
