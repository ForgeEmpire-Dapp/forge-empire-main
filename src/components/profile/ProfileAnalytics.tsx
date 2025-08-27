import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  Eye, 
  Heart, 
  MessageSquare, 
  Share, 
  Users,
  Calendar,
  Award
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { useAnalytics } from '@/hooks/useAnalytics'

interface ProfileAnalyticsProps {
  userAddress?: string
  className?: string
}

export const ProfileAnalytics = ({ userAddress, className = '' }: ProfileAnalyticsProps) => {
  const { analytics, loading, error } = useAnalytics(userAddress)


  const getGrowthColor = (growth: number) => {
    return growth > 0 ? 'text-green-500' : growth < 0 ? 'text-red-500' : 'text-muted-foreground'
  }

  const getEngagementLevel = (rate: number) => {
    if (rate >= 10) return { label: 'Excellent', color: 'bg-green-500' }
    if (rate >= 5) return { label: 'Good', color: 'bg-blue-500' }
    if (rate >= 2) return { label: 'Fair', color: 'bg-yellow-500' }
    return { label: 'Low', color: 'bg-gray-500' }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error loading analytics</div>
  }

  if (!analytics) {
    return <div>No analytics data</div>
  }

  const engagement = getEngagementLevel(analytics.engagementRate)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Stats */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Profile Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Eye className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold">{analytics.profileViews.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Profile Views</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Heart className="h-5 w-5 text-red-500" />
              </div>
              <div className="text-2xl font-bold">{analytics.totalLikes}</div>
              <p className="text-sm text-muted-foreground">Total Likes</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <MessageSquare className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold">{analytics.totalComments}</div>
              <p className="text-sm text-muted-foreground">Comments</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Share className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-2xl font-bold">{analytics.totalShares}</div>
              <p className="text-sm text-muted-foreground">Shares</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Engagement & Growth */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Growth Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Follower Growth (30d)</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${getGrowthColor(analytics.followerGrowth)}`}>
                  {analytics.followerGrowth > 0 ? '+' : ''}{analytics.followerGrowth}
                </span>
                <TrendingUp className={`h-4 w-4 ${getGrowthColor(analytics.followerGrowth)}`} />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Engagement Rate</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs text-white ${engagement.color}`}>
                  {analytics.engagementRate}% {engagement.label}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Member Since</span>
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(analytics.joinedAt, { addSuffix: true })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4" />
              Top Performing Content
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.topContent.map((content, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm">{content.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">{content.type}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {content.engagement} interactions
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Activity Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="font-medium text-sm">Last Active</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(analytics.lastActiveAt, { addSuffix: true })}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
              Online
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}