import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { EnhancedProfileViewer } from '@/components/profile/EnhancedProfileViewer'

const UserProfilePage = () => {
  const { address } = useParams<{ address: string }>()

  useEffect(() => {
    document.title = `Profile | Avax Forge Empire`
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-10">
        <EnhancedProfileViewer address={address} />
      </main>
    </div>
  )
}

export default UserProfilePage