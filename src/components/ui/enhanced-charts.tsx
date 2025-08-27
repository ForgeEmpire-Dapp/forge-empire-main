import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  Users, 
  Trophy, 
  Activity,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react'

interface DataPoint {
  name: string
  value: number
  change?: number
  color?: string
}

interface ChartProps {
  data: DataPoint[]
  title: string
  type: 'bar' | 'line' | 'pie'
  className?: string
}

// Simple animated progress bars for data visualization
export const MiniBarChart = ({ data, title, className }: Omit<ChartProps, 'type'>) => {
  const [animatedData, setAnimatedData] = useState<DataPoint[]>([])
  const maxValue = Math.max(...data.map(d => d.value))

  useEffect(() => {
    // Animate in the data
    const timer = setTimeout(() => {
      setAnimatedData(data)
    }, 100)
    return () => clearTimeout(timer)
  }, [data])

  return (
    <Card className={`${className} hover-lift`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {animatedData.map((item, index) => (
          <div key={item.name} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.name}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.value.toLocaleString()}</span>
                {item.change && (
                  <Badge 
                    variant={item.change > 0 ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {item.change > 0 ? '+' : ''}{item.change}%
                  </Badge>
                )}
              </div>
            </div>
            <Progress 
              value={(item.value / maxValue) * 100} 
              className="h-2"
              style={{
                animationDelay: `${index * 100}ms`
              }}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Animated stat cards with visual improvements
export const AnimatedStatCard = ({ 
  title, 
  value, 
  previousValue, 
  icon: Icon, 
  trend = 'up',
  className = ''
}: {
  title: string
  value: number
  previousValue?: number
  icon: React.ComponentType
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}) => {
  const [animatedValue, setAnimatedValue] = useState(0)
  const change = previousValue ? ((value - previousValue) / previousValue) * 100 : 0

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value)
    }, 200)
    return () => clearTimeout(timer)
  }, [value])

  const trendColors = {
    up: 'text-success',
    down: 'text-destructive',
    neutral: 'text-muted-foreground'
  }

  const trendIcons = {
    up: '↗',
    down: '↘',
    neutral: '→'
  }

  return (
    <Card className={`hover-lift ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold transition-all duration-500">
              {animatedValue.toLocaleString()}
            </p>
            {previousValue && (
              <div className={`flex items-center gap-1 text-sm ${trendColors[trend]}`}>
                <span>{trendIcons[trend]}</span>
                <span>{Math.abs(change).toFixed(1)}%</span>
              </div>
            )}
          </div>
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Activity feed with animations
export const ActivityFeed = ({ 
  activities = [],
  className = ''
}: {
  activities: Array<{
    id: string
    type: string
    description: string
    timestamp: Date
    value?: number
    icon?: React.ComponentType
  }>
  className?: string
}) => {
  const getActivityIcon = (type: string) => {
    const icons = {
      quest: Trophy,
      social: Users,
      xp: Activity,
      default: Activity
    }
    return icons[type as keyof typeof icons] || icons.default
  }

  const getActivityColor = (type: string) => {
    const colors = {
      quest: 'text-primary',
      social: 'text-secondary',
      xp: 'text-accent',
      default: 'text-muted-foreground'
    }
    return colors[type as keyof typeof colors] || colors.default
  }

  return (
    <Card className={`${className} hover-lift`}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No recent activity
            </p>
          ) : (
            activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.type)
              const colorClass = getActivityColor(activity.type)
              
              return (
                <div 
                  key={activity.id}
                  className={`
                    flex items-start gap-3 animate-fade-in border-l-2 border-muted pl-4 py-2
                    hover:border-primary transition-colors
                  `}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {activity.timestamp.toLocaleDateString()}
                      </span>
                      {activity.value && (
                        <Badge variant="outline" className="text-xs">
                          +{activity.value} XP
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Enhanced leaderboard component
export const Leaderboard = ({ 
  users = [],
  currentUserId,
  className = ''
}: {
  users: Array<{
    id: string
    name: string
    score: number
    avatar?: string
    badge?: string
  }>
  currentUserId?: string
  className?: string
}) => {
  return (
    <Card className={`${className} hover-lift`}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Community Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {users.map((user, index) => {
            const isCurrentUser = user.id === currentUserId
            const rank = index + 1
            
            return (
              <div 
                key={user.id}
                className={`
                  flex items-center gap-3 p-3 rounded-lg transition-all
                  ${isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'}
                  animate-fade-in
                `}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-center w-8 h-8">
                  {rank <= 3 ? (
                    <div className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${rank === 1 ? 'bg-yellow-500 text-yellow-900' : ''}
                      ${rank === 2 ? 'bg-gray-400 text-gray-900' : ''}
                      ${rank === 3 ? 'bg-amber-600 text-amber-100' : ''}
                    `}>
                      {rank}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">#{rank}</span>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium truncate ${isCurrentUser ? 'text-primary' : ''}`}>
                      {user.name}
                    </span>
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <span className="font-bold">{user.score.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground block">XP</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}