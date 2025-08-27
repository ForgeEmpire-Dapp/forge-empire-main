import { PageLayout } from '@/components/layout/PageLayout'
import { StreakOverview } from '@/components/streaks/StreakOverview'
import { StreakMilestones } from '@/components/streaks/StreakMilestones'
import { useAccount } from 'wagmi'
import { Card, CardContent } from '@/components/ui/card'
import { Flame } from 'lucide-react'

const StreaksPage = () => {
  const { isConnected } = useAccount()

  return (
    <PageLayout 
      title="Activity Streaks"
      description="Build consistent habits and earn rewards for your dedication to the Avax Forge Empire ecosystem."
    >
      {!isConnected ? (
        <Card className="bg-gradient-card border-border/50 animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Flame className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Connect your wallet to start tracking your activity streaks and earn rewards for consistency.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-12">
          <StreakOverview />
          <StreakMilestones />
        </div>
      )}
    </PageLayout>
  )
}

export default StreaksPage