import React, { useState } from 'react'
import { handleError } from '@/utils/standardErrorHandler'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  Trophy,
  Target,
  Zap,
  MoreVertical,
  Clock,
  Eye,
  Loader2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAccount } from 'wagmi'
import { Link } from 'react-router-dom'
import { useSocial, usePost, usePostInteractionStatus, useComments } from '@/hooks/useSocial' // Added usePostInteractionStatus, useComments
import { useProfile } from '@/hooks/useProfile'
import { toast } from 'sonner'
import { useEffect } from 'react' // Ensure useEffect is imported
import { CommentSection } from './CommentSection' // Import CommentSection

export interface PostData {
  id: bigint
  author: `0x${string}`
  content: string
  timestamp: bigint
  likes: bigint
  shares: bigint
  isActive: boolean
  mediaUrl?: string // Added optional mediaUrl
}

interface PostCardProps {
  postId: number | bigint
  onLike?: (postId: number) => void
  onShare?: (postId: number) => void
  className?: string
}

const PostTypeIcon = ({ type }: { type: 'post' | 'achievement' | 'quest_completed' | 'token_created' }) => {
  switch (type) {
    case 'achievement':
      return <Trophy className="h-4 w-4 text-accent" />
    case 'quest_completed':
      return <Target className="h-4 w-4 text-primary" />
    case 'token_created':
      return <Zap className="h-4 w-4 text-warning" />
    default:
      return <MessageSquare className="h-4 w-4 text-muted-foreground" />
  }
}

export const PostCard = ({ postId, onLike, onShare, className }: PostCardProps) => {
  const [localLikes, setLocalLikes] = useState<bigint>(0n)
  const [localShares, setLocalShares] = useState<bigint>(0n)
  const [isLiking, setIsLiking] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const { address } = useAccount()
  const { post: postData } = usePost(Number(postId))
  const { comments } = useComments(Number(postId)) // Fetch comments for this post
  const { likePost, unlikePost, sharePost, isPending } = useSocial() // Added unlikePost, sharePost
  const { profile: authorProfile } = useProfile(postData?.author)
  const { hasLiked: userHasLiked, hasShared: userHasShared } = usePostInteractionStatus(Number(postId), address) // Get initial interaction status

  const [hasLiked, setHasLiked] = useState(userHasLiked) // Initialize hasLiked from hook
  const [hasShared, setHasShared] = useState(userHasShared) // Initialize hasShared from hook

  // Update local state when user interaction status changes from hook
  useEffect(() => {
    setHasLiked(userHasLiked)
    setHasShared(userHasShared)
  }, [userHasLiked, userHasShared])

  const post = React.useMemo(() => postData ? {
    id: BigInt(postData.id),
    author: postData.author as `0x${string}`,
    content: postData.content,
    timestamp: BigInt(postData.timestamp),
    likes: BigInt(postData.likes),
    shares: BigInt(postData.shares),
    isActive: postData.active,
    mediaUrl: (postData as any).mediaUrl, // Access mediaUrl from postData
  } as PostData : undefined, [postData])

  // Initialize local state when post data loads
  React.useEffect(() => {
    if (post) {
      setLocalLikes(post.likes)
      setLocalShares(post.shares)
    }
  }, [post])

  const handleLike = async () => {
    if (!post || isLiking) return

    setIsLiking(true)
    try {
      // Optimistic update
      const newLikes = hasLiked ? localLikes - 1n : localLikes + 1n
      setLocalLikes(newLikes)
      setHasLiked(!hasLiked)

      if (hasLiked) { // If already liked, then unlike
        await unlikePost(Number(postId))
      } else { // Otherwise, like
        await likePost(Number(postId))
      }
      onLike?.(Number(postId))
      
      // State will be automatically refetched by wagmi
    } catch (error) {
      // Revert optimistic update on error
      setLocalLikes(post.likes)
      setHasLiked(false)
      handleError(error, { component: 'PostCard', action: 'Like post' })
    } finally {
      setIsLiking(false)
    }
  }

  const handleShare = async () => {
    if (!post || isSharing) return

    setIsSharing(true)
    try {
      // Optimistic update
      setLocalShares(localShares + 1n)

      await sharePost(Number(postId)) // Call the contract share function
      onShare?.(Number(postId))
      toast.success('Post shared successfully!')
      
      // State will be automatically refetched by wagmi
    } catch (error) {
      // Revert optimistic update on error
      setLocalShares(post.shares)
      toast.error('Failed to share post')
      handleError(error, { component: 'PostCard', action: 'Share post' })
    } finally {
      setIsSharing(false)
    }
  }

  if (!postData) {
    return (
      <Card className={`animate-pulse ${className}`}>
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-full" />
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-muted rounded w-1/4" />
                <div className="h-2 bg-muted rounded w-1/6" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-3/4" />
            </div>
            <div className="flex items-center gap-6 pt-3 border-t">
              <div className="h-8 w-16 bg-muted rounded" />
              <div className="h-8 w-16 bg-muted rounded" />
              <div className="h-8 w-16 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!post || !post.isActive) {
    return null
  }

  const displayAddress = `${post.author.slice(0, 6)}...${post.author.slice(-4)}`
  const timestamp = new Date(Number(post.timestamp) * 1000)
  const isOwnPost = address?.toLowerCase() === post.author.toLowerCase()

  return (
    <Card className={`hover:shadow-lg transition-all duration-200 hover-lift ${className}`}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Post Header */}
          <div className="flex items-start gap-3">
            <Link to={`/profile/${post.author}`} className="flex items-start gap-3 group">
              <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                {authorProfile?.avatar_url && (
                  <AvatarImage src={authorProfile.avatar_url} alt="Profile avatar" />
                )}
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {authorProfile?.username ? 
                    authorProfile.username.slice(0, 2).toUpperCase() : 
                    post.author.slice(2, 4).toUpperCase()
                  }
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold group-hover:text-primary transition-colors">
                    {authorProfile?.username || authorProfile?.display_name || displayAddress}
                  </span>
                  <Badge variant="outline" className="text-xs bg-muted">
                    Builder
                  </Badge>
                  <PostTypeIcon type="post" />
                </div>
              
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatDistanceToNow(timestamp, { addSuffix: true })}</span>
                  {isOwnPost && (
                    <>
                      <span>•</span>
                      <Badge variant="secondary" className="text-xs">Your Post</Badge>
                    </>
                  )}
                </div>
              </div>
            </Link>
            
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </div>

          {/* Post Content */}
          <div className="text-foreground leading-relaxed whitespace-pre-wrap">
            {post.content}
          </div>

          {/* Post Media (Image) */}
          {post.mediaUrl && (
            <div className="mt-4 rounded-lg overflow-hidden border border-border/50">
              <img src={post.mediaUrl} alt="Post media" className="w-full h-auto object-cover" />
            </div>
          )}

          {/* Engagement Actions */}
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-6">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLike}
                disabled={isLiking || isPending}
                className={`flex items-center gap-2 transition-colors ${
                  hasLiked ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-red-500'
                }`}
              >
                {isLiking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Heart className={`h-4 w-4 ${hasLiked ? 'fill-current' : ''}`} />
                )}
                <span>{Number(localLikes)}</span>
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                // Removed onClick={handleComment} as comments are now handled by CommentSection
                className="flex items-center gap-2 text-muted-foreground hover:text-primary"
              >
                <MessageSquare className="h-4 w-4" />
                <span>{comments?.length || 0}</span> {/* Display actual comment count */}
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleShare}
                disabled={isSharing || isPending}
                className="flex items-center gap-2 text-muted-foreground hover:text-accent"
              >
                {isSharing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                <span>{Number(localShares)}</span>
              </Button>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              <span>{Number(localLikes) + Number(localShares) + (comments?.length || 0)} interactions</span> {/* Update total interactions */}
            </div>
          </div>
          {/* Comment Section */}
          <CommentSection postId={Number(postId)} />
        </div>
      </CardContent>
    </Card>
  )
}