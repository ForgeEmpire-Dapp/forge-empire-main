import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Heart, MessageSquare, Share2, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { usePost } from '@/hooks/useSocial'
import { useProfile } from '@/hooks/useProfile'

interface PostPreviewProps {
  postId: number
}

export const PostPreview = ({ postId }: PostPreviewProps) => {
  const { post } = usePost(postId)
  const { profile } = useProfile(post?.author)

  if (!post || !post.active) {
    return null
  }

  const displayAddress = `${post.author.slice(0, 6)}...${post.author.slice(-4)}`
  const timestamp = new Date(post.timestamp * 1000)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Author Info */}
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              {profile?.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt="Profile avatar" />
              )}
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {profile?.username ? 
                  profile.username.slice(0, 2).toUpperCase() : 
                  post.author.slice(2, 4).toUpperCase()
                }
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {profile?.display_name || profile?.username || displayAddress}
                </span>
                <Badge variant="outline" className="text-xs">
                  Builder
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatDistanceToNow(timestamp, { addSuffix: true })}</span>
              </div>
            </div>
          </div>

          {/* Post Content */}
          <p className="text-sm text-foreground line-clamp-3">
            {post.content}
          </p>

          {/* Engagement Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              <span>{post.likes}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              <span>0</span>
            </div>
            <div className="flex items-center gap-1">
              <Share2 className="h-3 w-3" />
              <span>{post.shares}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}