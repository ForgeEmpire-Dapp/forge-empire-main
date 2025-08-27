import { useState } from 'react'
import { handleError } from '@/utils/standardErrorHandler'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Send, Loader2 } from 'lucide-react'
import { useAccount } from 'wagmi'
import { useProfile } from '@/hooks/useProfile'
import { useProfileRegistry } from '@/hooks/useProfileRegistry'
import { useSocial } from '@/hooks/useSocial'
import { toast } from 'sonner'

interface CommentInputProps {
  postId: number
  onCommentAdded?: () => void
}

export const CommentInput = ({ postId, onCommentAdded }: CommentInputProps) => {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { isConnected, address } = useAccount()
  const { profile } = useProfile()
  const { username } = useProfileRegistry()
  const { addComment, isPending } = useSocial()

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('Please enter some content for your comment')
      return
    }

    if (!isConnected) {
      toast.error('Please connect your wallet to comment')
      return
    }

    setIsSubmitting(true)
    try {
      await addComment(postId, content.trim())
      setContent('')
      onCommentAdded?.()
    } catch (error) {
      handleError(error, { component: 'CommentInput', action: 'Add comment' })
      // Error handling is done in the hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const isDisabled = !content.trim() || isSubmitting || isPending || !isConnected

  const displayName = username || profile?.username || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Anonymous')
  const avatarSrc = profile?.avatar_url

  return (
    <div className="flex items-start gap-3 p-4 border-t border-border/50 bg-muted/20 rounded-b-lg">
      <Avatar className="h-9 w-9 border-2 border-primary/20">
        <AvatarImage src={avatarSrc} />
        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-2">
        <Textarea
          placeholder="Write a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[60px] resize-none border-0 bg-background focus:bg-background transition-colors placeholder:text-muted-foreground/70"
          disabled={isSubmitting || isPending}
        />
        <div className="flex justify-end">
          <Button 
            onClick={handleSubmit}
            disabled={isDisabled}
            size="sm"
            className="flex items-center gap-1"
          >
            {isSubmitting || isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Comment
          </Button>
        </div>
      </div>
    </div>
  )
}
