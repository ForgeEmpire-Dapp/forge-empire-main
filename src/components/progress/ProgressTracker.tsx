import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, Circle, Star, Trophy, Target } from 'lucide-react'

interface ProgressItem {
  id: string
  title: string
  description: string
  completed: boolean
  current?: number
  target?: number
  type: 'boolean' | 'progress'
  category: 'profile' | 'engagement' | 'achievements'
  points: number
}

interface ProgressTrackerProps {
  userId?: string
  className?: string
}

export const ProgressTracker = ({ userId, className }: ProgressTrackerProps) => {
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([])
  const [loading, setLoading] = useState(true)

  // Real progress data from contracts and user achievements
  useEffect(() => {
    const loadProgressItems = async () => {
      // This will be populated with real data from contracts
      const progressItems: ProgressItem[] = []
      
      setProgressItems(progressItems)
      setLoading(false)
    }

    loadProgressItems()
  }, [userId])

  const completedItems = progressItems.filter(item => item.completed)
  const totalPoints = progressItems.reduce((sum, item) => sum + item.points, 0)
  const earnedPoints = completedItems.reduce((sum, item) => sum + item.points, 0)
  const completionPercent = progressItems.length > 0 ? (completedItems.length / progressItems.length) * 100 : 0

  const categoryIcons = {
    profile: Star,
    engagement: Target,
    achievements: Trophy
  }

  const categoryColors = {
    profile: 'text-blue-500',
    engagement: 'text-green-500',
    achievements: 'text-yellow-500'
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-2 bg-muted rounded"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Overall Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Your Progress</h3>
              <Badge variant="secondary">
                {completedItems.length}/{progressItems.length} completed
              </Badge>
            </div>
            <Progress value={completionPercent} className="h-3" />
            <div className="flex justify-between text-sm text-muted-foreground mt-2">
              <span>{earnedPoints} points earned</span>
              <span>{totalPoints} total points</span>
            </div>
          </div>

          {/* Progress Items */}
          <div className="space-y-3">
            {progressItems.map(item => {
              const Icon = categoryIcons[item.category]
              const iconColor = categoryColors[item.category]
              
              return (
                <div 
                  key={item.id}
                  className={`
                    flex items-center space-x-3 p-3 rounded-lg border transition-all
                    ${item.completed ? 'bg-green-50 border-green-200' : 'bg-muted/30'}
                  `}
                >
                  <div className="flex-shrink-0">
                    {item.completed ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${iconColor}`} />
                      <h4 className={`font-medium text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                    
                    {item.type === 'progress' && item.current !== undefined && item.target !== undefined && (
                      <div className="mt-2">
                        <Progress 
                          value={(item.current / item.target) * 100} 
                          className="h-1.5"
                        />
                        <span className="text-xs text-muted-foreground">
                          {item.current}/{item.target}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <Badge variant={item.completed ? "default" : "outline"} className="text-xs">
                      {item.points} pts
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}