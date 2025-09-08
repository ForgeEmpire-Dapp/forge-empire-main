import { PageLayout } from '@/components/layout/PageLayout'
import { EnhancedDashboard } from '@/components/dashboard/EnhancedDashboard'

export default function Dashboard() {
  return (
    <PageLayout
      title="Dashboard"
      description="Track your progress, achievements, and community activities"
    >
      <div className="max-w-6xl mx-auto">
        <EnhancedDashboard />
      </div>
    </PageLayout>
  )
}

