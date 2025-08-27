import { useState, useEffect } from 'react'
import { handleError } from '@/utils/standardErrorHandler'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  UserPlus, 
  UserMinus, 
  Loader2,
  Users,
  Check
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { useIsFollowing, useSocial } from '@/hooks/useSocial'
import { toast } from 'sonner'

interface FollowButtonProps {
  targetUser: `0x${string}`
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'default' | 'lg'
  showFollowerCount?: boolean
  followerCount?: number
  className?: string
}

export const FollowButton = ({ 
  targetUser, 
  variant = 'default',
  size = 'default',
  showFollowerCount = false,
  followerCount = 0,
  className 
}: FollowButtonProps) => {
  const [isOptimisticFollowing, setIsOptimisticFollowing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const { address } = useAccount()
  const isFollowingData = useIsFollowing(address, targetUser)
  const { followUser, unfollowUser, isPending } = useSocial()

  const isFollowing = isOptimisticFollowing !== undefined ? isOptimisticFollowing : isFollowingData
  const isSelf = address?.toLowerCase() === targetUser?.toLowerCase()

  // Initialize optimistic state from contract data
  useEffect(() => {
    if (isFollowingData !== undefined) {
      setIsOptimisticFollowing(isFollowingData)
    }
  }, [isFollowingData])

  const handleFollow = async () => {
    if (!address) {
      toast.error('Please connect your wallet')
      return
    }

    if (isSelf) {
      toast.error("You can't follow yourself")
      return
    }

    setIsProcessing(true)
    const previousState = isOptimisticFollowing

    try {
      // Optimistic update
      setIsOptimisticFollowing(!isFollowing)

      if (isFollowing) {
        await unfollowUser(targetUser)
        toast.success('Unfollowed successfully!')
      } else {
        await followUser(targetUser)
        toast.success('Followed successfully!')
      }

      // State will be automatically refetched by wagmi
    } catch (error) {
      // Revert optimistic update on error
      setIsOptimisticFollowing(previousState)
      handleError(error, { component: 'FollowButton', action: 'Follow/unfollow user' })
      // Error handling is done in the hook
    } finally {
      setIsProcessing(false)
    }
  }

  // Don't show follow button for self
  if (isSelf) {
    return showFollowerCount ? (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>{followerCount} followers</span>
      </div>
    ) : null
  }

  const isLoading = isProcessing || isPending
  const buttonText = isFollowing ? 'Following' : 'Follow'
  const buttonIcon = isLoading ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : isFollowing ? (
    <Check className="h-4 w-4" />
  ) : (
    <UserPlus className="h-4 w-4" />
  )

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant={isFollowing ? 'outline' : variant}
        size={size}
        onClick={handleFollow}
        disabled={isLoading || !address}
        className={`flex items-center gap-2 transition-all ${
          isFollowing 
            ? 'hover:bg-destructive hover:text-destructive-foreground hover:border-destructive' 
            : 'glow-primary'
        }`}
      >
        {buttonIcon}
        <span className="hidden sm:inline">
          {isLoading 
            ? (isFollowing ? 'Unfollowing...' : 'Following...') 
            : buttonText
          }
        </span>
      </Button>

      {showFollowerCount && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{followerCount}</span>
        </div>
      )}
    </div>
  )
}

export default FollowButton