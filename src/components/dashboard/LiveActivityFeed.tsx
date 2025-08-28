import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Activity,
  Target,
  Users,
  Coins,
  Clock,
  RefreshCw,
  Zap,
  Trophy,
  Heart,
  MessageSquare
} from "lucide-react"
import { useAccount } from 'wagmi'
import { formatDistanceToNow } from 'date-fns'

interface ActivityItem {
  id: string
  type: 'quest' | 'social' | 'badge' | 'token' | 'governance'
  user?: string
  action: string
  target?: string
  amount?: number
  timestamp: Date
  txHash?: string
}

const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: '1',
    type: 'quest',
    user: '0x1234...5678',
    action: 'Completed onboarding quest',
    target: 'Connect Wallet',
    amount: 100,
    timestamp: new Date(Date.now() - 1000 * 60 * 5)
  },
  {
    id: '2',
    type: 'social',
    user: '0x8765...4321',
    action: 'Created first post',
    target: 'Social Hub',
    timestamp: new Date(Date.now() - 1000 * 60 * 15)
  },
  {
    id: '3',
    type: 'badge',
    user: '0x2468...1357',
    action: 'Earned badge',
    target: 'Community Builder',
    timestamp: new Date(Date.now() - 1000 * 60 * 30)
  },
  {
    id: '4',
    type: 'token',
    user: '0x1357...2468',
    action: 'Received kudos',
    amount: 50,
    timestamp: new Date(Date.now() - 1000 * 60 * 45)
  }
]

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'quest': return <Target className="w-4 h-4 text-primary" />
    case 'social': return <MessageSquare className="w-4 h-4 text-secondary" />
    case 'badge': return <Trophy className="w-4 h-4 text-accent" />
    case 'token': return <Coins className="w-4 h-4 text-success" />
    case 'governance': return <Users className="w-4 h-4 text-warning" />
    default: return <Activity className="w-4 h-4 text-muted-foreground" />
  }
}

const getActivityColor = (type: string) => {
  switch (type) {
    case 'quest': return 'border-primary/20 bg-primary/5'
    case 'social': return 'border-secondary/20 bg-secondary/5'
    case 'badge': return 'border-accent/20 bg-accent/5'
    case 'token': return 'border-success/20 bg-success/5'
    case 'governance': return 'border-warning/20 bg-warning/5'
    default: return 'border-border/20 bg-muted/5'
  }
}

export const LiveActivityFeed = () => {
  const { address } = useAccount()
  const [activities, setActivities] = useState<ActivityItem[]>(MOCK_ACTIVITIES)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  useEffect(() => {
    // Set up real-time activity feed when contracts are integrated
    // Only run this simulation in development environment
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        // Add new activity simulation
        if (Math.random() > 0.8) {
          const newActivity: ActivityItem = {
            id: Date.now().toString(),
            type: (['quest', 'social', 'badge', 'token'] as ActivityItem['type'][])[Math.floor(Math.random() * 4)],
            user: `0x${Math.random().toString(16).substr(2, 4)}...${Math.random().toString(16).substr(2, 4)}`,
            action: 'Performed an action',
            timestamp: new Date()
          }
          setActivities(prev => [newActivity, ...prev.slice(0, 9)])
        }
      }, 10000)

      return () => clearInterval(interval)
    }
    return undefined // Return undefined if not in development
  }, [])

  return (
    <Card className="bg-gradient-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Live Activity Feed
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className={`p-3 rounded-lg border transition-all duration-200 hover:shadow-sm ${getActivityColor(activity.type)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-full bg-background/80 backdrop-blur-sm">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">
                        {activity.user === address ? 'You' : activity.user}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {activity.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {activity.action}
                      {activity.target && (
                        <span className="font-medium"> "{activity.target}"</span>
                      )}
                      {activity.amount && (
                        <span className="text-success font-medium"> (+{activity.amount} XP)</span>
                      )}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="mt-4 pt-4 border-t border-border/20">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Real-time updates from blockchain</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span>Live</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}