import { Card, CardContent } from '@/components/ui/card'
import { MessageSquare, Heart } from 'lucide-react'
import { useAccount } from 'wagmi'
import { useActivityFeed } from '@/hooks/useSocial'
import { PostCard } from './PostCard'

export const PersonalFeed = () => {
  const { address } = useAccount()
  const { feedPostIds } = useActivityFeed(address, 20)

  if (!address) {
    return (
      <Card className="bg-gradient-card border-border/50">
        <CardContent className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-muted-foreground">Connect your wallet to view your personalized feed</p>
        </CardContent>
      </Card>
    )
  }

  if (feedPostIds.length === 0) {
    return (
      <Card className="bg-gradient-card border-border/50">
        <CardContent className="p-8 text-center">
          <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Activity Yet</h3>
          <p className="text-muted-foreground">Follow other users to see their posts in your personal feed</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {feedPostIds
        .slice()
        .reverse() // Reverse to show newest posts first
        .map((postId) => (
          <PostCard
            key={postId}
            postId={postId}
          />
        ))}
    </div>
  )
}