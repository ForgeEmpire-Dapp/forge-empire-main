import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useSocialGraph } from '@/hooks/contracts/useSocialGraph'
import { PostCard } from './PostCard'
import { useGlobalFeed } from '@/hooks/useSocial' // Import useGlobalFeed for actual post IDs


interface UnifiedSocialFeedProps {
  limit?: number
  showHeader?: boolean
  className?: string
}

export const UnifiedSocialFeed = ({ 
  limit = 20, 
  showHeader = false, 
  className = "" 
}: UnifiedSocialFeedProps) => {
  const { totalPosts, isPaused, isConnected } = useSocialGraph()
  const [refreshing, setRefreshing] = useState(false)
  
  // Fetch actual global post IDs
  const { feedPostIds } = useGlobalFeed(limit) // Use useGlobalFeed to get real post IDs

  const handleRefresh = async () => {
    setRefreshing(true)
    // Simulate refresh delay
    setTimeout(() => setRefreshing(false), 1000)
  }

  if (!isConnected) {
    return (
      <Card className="border-border/50">
        <CardContent className="text-center py-12">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
          <p className="text-muted-foreground">Connect your wallet to view the community feed</p>
        </CardContent>
      </Card>
    )
  }

  if (isPaused) {
    return (
      <Card className="border-warning/50">
        <CardContent className="text-center py-12">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-warning" />
          <h3 className="text-lg font-semibold mb-2">Social Features Paused</h3>
          <p className="text-muted-foreground">Social interactions are temporarily disabled</p>
        </CardContent>
      </Card>
    )
  }

  if (feedPostIds.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="text-center py-12">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <h3 className="text-lg font-semibold mb-2">No Posts Yet</h3>
          <p className="text-muted-foreground mb-4">
            Be the first to share something with the community!
          </p>
          <div className="text-sm text-muted-foreground">
            Total posts on-chain: {totalPosts?.toString() || '0'}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Community Feed</h2>
            <div className="flex items-center gap-2 ml-4">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-sm text-muted-foreground">
                {totalPosts?.toString() || '0'} total posts
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="hover-scale"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
      
      {feedPostIds
        .slice()
        .reverse() // Show newest posts first
        .map((postId) => (
          <PostCard
            key={postId}
            postId={postId}
            className="border-border/50 hover:border-primary/20 transition-all duration-200 hover-lift"
          />
        ))}
    </div>
  )
}