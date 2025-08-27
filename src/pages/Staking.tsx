import { PageLayout } from '@/components/layout/PageLayout'
import { StakingInterface } from '@/components/staking/StakingInterface'

const StakingPage = () => {
  return (
    <PageLayout
      title="Staking Dashboard"
      description="Stake tokens, earn rewards, and participate in DeFi opportunities"
    >
      <div className="max-w-6xl mx-auto">
        <StakingInterface />
      </div>
    </PageLayout>
  )
}

export default StakingPage