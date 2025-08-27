import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import { Link } from 'react-router-dom'
import { useProfile } from '@/hooks/useProfile'
import { SocialComment } from '@/hooks/useSocial'

interface CommentCardProps {
  comment: SocialComment
}

export const CommentCard = ({ comment }: CommentCardProps) => {
  const { profile: authorProfile } = useProfile(comment.author)

  const displayAddress = `${comment.author.slice(0, 6)}...${comment.author.slice(-4)}`
  const timestamp = new Date(Number(comment.timestamp) * 1000)

  return (
    <div className="flex items-start gap-3 p-4 border-b border-border/50 last:border-b-0">
      <Link to={`/profile/${comment.author}`}>
        <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
          {authorProfile?.avatar_url && (
            <AvatarImage src={authorProfile.avatar_url} alt="Profile avatar" />
          )}
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
            {authorProfile?.username ? 
              authorProfile.username.slice(0, 2).toUpperCase() : 
              comment.author.slice(2, 4).toUpperCase()
            }
          </AvatarFallback>
        </Avatar>
      </Link>
      
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Link to={`/profile/${comment.author}`} className="font-semibold hover:text-primary transition-colors">
            {authorProfile?.username || authorProfile?.display_name || displayAddress}
          </Link>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(timestamp, { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {comment.content}
        </p>
      </div>
    </div>
  )
}
