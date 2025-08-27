import React from 'react'
import { useComments } from '@/hooks/useSocial'
import { CommentInput } from './CommentInput'
import { CommentCard } from './CommentCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Loader2 } from 'lucide-react'
import { useAccount } from 'wagmi'

interface CommentSectionProps {
  postId: number
}

export const CommentSection = ({ postId }: CommentSectionProps) => {
  const { comments, isLoading } = useComments(postId)
  const { isConnected } = useAccount()

  // State to trigger re-fetch of comments after a new one is added
  const [refreshKey, setRefreshKey] = React.useState(0)

  const handleCommentAdded = () => {
    setRefreshKey(prevKey => prevKey + 1)
  }

  // Re-fetch comments when refreshKey changes
  React.useEffect(() => {
    // The useComments hook will automatically re-fetch when its query key changes
    // which happens when postId changes or when queryClient.invalidateQueries is called
    // from addComment. The refreshKey is primarily for forcing a re-render if needed
    // but the wagmi/react-query invalidation should handle data freshness.
  }, [refreshKey])

  if (!isConnected) {
    return (
      <Card className="mt-4 border-border/50">
        <CardContent className="p-6 text-center">
          <MessageSquare className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Connect your wallet to view and add comments.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        Comments ({comments?.length || 0})
      </h3>
      
      <CommentInput postId={postId} onCommentAdded={handleCommentAdded} />

      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading comments...</span>
        </div>
      ) : comments?.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <CardContent className="p-0">
            {comments && comments
              .slice()
              .sort((a, b) => b.timestamp - a.timestamp) // Sort by newest first
              .map((comment) => (
                <CommentCard key={comment.id} comment={comment} />
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
