import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Sparkles, Clock, Heart, Share2 } from 'lucide-react'
import { useGlobalFeed, usePost, fetchPostData } from '@/hooks/useSocial'
import { useQueries } from '@tanstack/react-query' // Added fetchPostData
import { PostCard } from './PostCard'
import { Badge } from '@/components/ui/badge'
import { useMemo } from 'react'
import { TRENDING_CONFIG } from '@/utils/constants'

interface TrendingPost {
  id: number
  score: number
  reason: string
}

const calculateTrendingScore = (
  likes: number, 
  shares: number, 
  timestamp: number
): { score: number; reason: string } => {
  const now = Date.now() / 1000
  const ageInHours = (now - timestamp) / 3600
  
  // Calculate engagement score
  const engagementScore = 
    (likes * TRENDING_CONFIG.WEIGHT_LIKES) + 
    (shares * TRENDING_CONFIG.WEIGHT_SHARES)
  
  // Apply time decay (newer posts get bonus)
  const timeDecay = Math.max(0, 1 - (ageInHours / TRENDING_CONFIG.TIME_DECAY_HOURS))
  const timeBonus = timeDecay * TRENDING_CONFIG.WEIGHT_RECENCY
  
  const finalScore = engagementScore + timeBonus
  
  // Determine trending reason
  let reason = 'Popular'
  if (ageInHours < 2 && engagementScore > TRENDING_CONFIG.MIN_INTERACTIONS) {
    reason = 'Hot'
  } else if (shares > likes) {
    reason = 'Viral'
  } else if (likes > 10) {
    reason = 'Well-liked'
  }
  
  return { score: finalScore, reason }
}

const TrendingPostCard = ({ postId, rank, reason }: { 
  postId: number
  rank: number
  reason: string
}) => {
  return (
    <div className="relative">
      <div className="absolute top-2 left-2 z-10">
        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
          #{rank} {reason}
        </Badge>
      </div>
      <PostCard postId={postId} className="pt-8" />
    </div>
  )
}

export const EnhancedTrendingFeed = () => {
  const { feedPostIds } = useGlobalFeed(50) // Get more posts for better trending analysis

  // Fetch all post data for trending analysis
  const postQueries = useQueries({
    queries: feedPostIds.map(postId => ({
      queryKey: ['post', postId],
      queryFn: () => fetchPostData(postId), // Use the utility function to fetch post data
      enabled: !!postId,
      staleTime: 60 * 1000, // 1 minute stale time for trending data
    })),
  })

  // Calculate trending scores for all posts
  const trendingPosts = useMemo(() => {
    const scoredPosts: TrendingPost[] = []

    postQueries.forEach(query => {
      if (query.data && !query.isLoading && !query.isError) {
        const post = query.data
        const { score, reason } = calculateTrendingScore(
          Number(post.likes),
          Number(post.shares),
          Number(post.timestamp)
        )
        
        if (score >= TRENDING_CONFIG.MIN_INTERACTIONS) {
          scoredPosts.push({ id: post.id, score, reason })
        }
      }
    })

    // Sort by score and return top 10
    return scoredPosts
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }, [postQueries])

  if (trendingPosts.length === 0) {
    return (
      <Card className="bg-gradient-card border-border/50">
        <CardContent className="p-8 text-center">
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Trending Posts</h3>
          <p className="text-muted-foreground">Create engaging content to see trending posts here</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Trending Now
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              <Heart className="h-3 w-3 mr-1" />
              Most Liked
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Share2 className="h-3 w-3 mr-1" />
              Most Shared
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Recent Activity
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4 p-6">
            {trendingPosts.map((post, index) => (
              <TrendingPostCard
                key={post.id}
                postId={post.id}
                rank={index + 1}
                reason={post.reason}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}