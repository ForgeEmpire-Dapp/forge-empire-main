import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Activity, 
  Trophy, 
  MessageSquare, 
  Heart, 
  Share, 
  Target,
  Clock,
  Star
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ActivityItem {
  id: string
  type: 'post' | 'like' | 'share' | 'achievement' | 'quest' | 'follow' | 'badge'
  title: string
  description?: string
  timestamp: Date
  xpEarned?: number
  icon?: React.ReactNode
  metadata?: Record<string, unknown>
}

import { useActivity } from '@/hooks/useActivity'
import { useAccount } from 'wagmi'

interface ProfileActivityFeedProps {
  limit?: number
  showHeader?: boolean
  className?: string
}

export const ProfileActivityFeed = ({ 
  limit = 10,
  showHeader = true,
  className = '' 
}: ProfileActivityFeedProps) => {
  const { address } = useAccount()
  const { activities, loading, error } = useActivity(address)

  const displayedActivities = activities?.slice(0, limit) || []

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'post':
        return <MessageSquare className="h-4 w-4 text-primary" />
      case 'like':
        return <Heart className="h-4 w-4 text-red-500" />
      case 'share':
        return <Share className="h-4 w-4 text-blue-500" />
      case 'achievement':
      case 'badge':
        return <Trophy className="h-4 w-4 text-yellow-500" />
      case 'quest':
        return <Target className="h-4 w-4 text-green-500" />
      case 'follow':
        return <Star className="h-4 w-4 text-purple-500" />
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'post':
        return 'border-l-primary'
      case 'like':
        return 'border-l-red-500'
      case 'share':
        return 'border-l-blue-500'
      case 'achievement':
      case 'badge':
        return 'border-l-yellow-500'
      case 'quest':
        return 'border-l-green-500'
      case 'follow':
        return 'border-l-purple-500'
      default:
        return 'border-l-muted-foreground'
    }
  }

  return (
    <Card className={`bg-gradient-card border-border/50 ${className}`}>
      {showHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={showHeader ? 'pt-0' : 'p-6'}>
        {loading ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground">Loading activity...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <p className="text-destructive">Error loading activity.</p>
          </div>
        ) : displayedActivities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedActivities.map((activity) => (
              <div
                key={activity.id}
                className={`flex items-start gap-3 p-4 rounded-lg bg-background/50 border-l-4 ${getActivityColor(activity.type)} hover:bg-background/80 transition-colors`}
              >
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{activity.title}</p>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                      )}
                    </div>
                    
                    {activity.xpEarned && (
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                        +{activity.xpEarned} XP
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 mt-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}