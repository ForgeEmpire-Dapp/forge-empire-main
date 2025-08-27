import { PageLayout } from '@/components/layout/PageLayout'
import { LeaderboardSystem } from '@/components/leaderboard/LeaderboardSystem'
import { Card, CardContent } from '@/components/ui/card'
import { Trophy } from 'lucide-react'
import { useAccount } from 'wagmi'

const LeaderboardPage = () => {
  const { isConnected } = useAccount()

  return (
    <PageLayout 
      title="Community Leaderboard"
      description="See how you rank against other members in the Avax Forge Empire ecosystem and compete for top positions."
    >
      {!isConnected ? (
        <Card className="bg-gradient-card border-border/50 animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Connect your wallet to see your ranking and compete with other community members.
            </p>
          </CardContent>
        </Card>
      ) : (
        <LeaderboardSystem />
      )}
    </PageLayout>
  )
}

export default LeaderboardPage