import { useUserPosts } from '@/hooks/useSocial'
import { PostCard } from './PostCard'
import { PostCreator } from './PostCreator'
import { MessageSquare } from 'lucide-react'

interface UserPostFeedProps {
  address?: string
  limit?: number
}

export const UserPostFeed = ({ address, limit = 20 }: UserPostFeedProps) => {
  const { postIds, refetch } = useUserPosts(address)

  if (!address) {
    return (
      <div className="text-center py-8">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Connect your wallet to view posts</p>
      </div>
    )
  }

  if (postIds.length === 0) {
    return (
      <div className="space-y-4">
        <PostCreator onPostCreated={refetch} />
        <div className="text-center py-8">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Posts Yet</h3>
          <p className="text-muted-foreground">Start sharing with the community!</p>
        </div>
      </div>
    )
  }

  const displayPosts = postIds.slice(0, limit)

  return (
    <div className="space-y-4">
      <PostCreator onPostCreated={refetch} />
      {displayPosts
        .slice()
        .reverse() // Show newest posts first
        .map((postId) => (
          <PostCard 
            key={postId} 
            postId={postId}
            className="border-border/50 hover:border-primary/20 transition-colors"
          />
        ))}
    </div>
  )
}