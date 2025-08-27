import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Calendar, Flame, CheckCircle, Clock, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStreakCore, ACTIVITY_TYPES } from '@/hooks/useStreaks'
import { useAccount } from 'wagmi'

interface DailyActivity {
  id: string
  name: string
  description: string
  xpReward: number
  tokenReward?: number
  completed: boolean
  icon: React.ComponentType<{ className?: string }>
  activityType: number
}

const dailyActivities: DailyActivity[] = [
  {
    id: 'daily-login',
    name: 'Daily Login',
    description: 'Visit the platform',
    xpReward: 10,
    tokenReward: 1,
    completed: false,
    icon: CheckCircle,
    activityType: ACTIVITY_TYPES.DAILY_LOGIN
  },
  {
    id: 'complete-quest',
    name: 'Complete a Quest',
    description: 'Finish any available quest',
    xpReward: 50,
    tokenReward: 5,
    completed: false,
    icon: CheckCircle,
    activityType: ACTIVITY_TYPES.QUEST_COMPLETION
  },
  {
    id: 'social-interaction',
    name: 'Social Interaction',
    description: 'Like, comment, or share a post',
    xpReward: 25,
    tokenReward: 2,
    completed: false,
    icon: CheckCircle,
    activityType: ACTIVITY_TYPES.SOCIAL_INTERACTION
  }
]

const streakMilestones = [
  { days: 3, reward: { xp: 100, tokens: 10 }, name: 'Getting Started' },
  { days: 7, reward: { xp: 250, tokens: 25 }, name: 'Week Warrior' },
  { days: 14, reward: { xp: 500, tokens: 50 }, name: 'Two Week Champion' },
  { days: 30, reward: { xp: 1000, tokens: 100 }, name: 'Monthly Master' },
  { days: 60, reward: { xp: 2000, tokens: 200 }, name: 'Streak Legend' },
  { days: 100, reward: { xp: 5000, tokens: 500 }, name: 'Consistency King' }
]

interface DailyStreakTrackerProps {
  className?: string
}

export const DailyStreakTracker = ({ className }: DailyStreakTrackerProps) => {
  const { address } = useAccount()
  const { useActivityStreak } = useStreakCore()
  const [activities, setActivities] = useState(dailyActivities)

  // Get streak data for overall daily activities
  const { currentStreak, longestStreak, hasRecordedToday } = useActivityStreak(ACTIVITY_TYPES.DAILY_LOGIN)

  const completedToday = activities.filter(a => a.completed).length
  const totalActivities = activities.length
  const completionPercentage = (completedToday / totalActivities) * 100

  const nextMilestone = streakMilestones.find(m => m.days > (currentStreak || 0))
  const lastMilestone = streakMilestones
    .slice()
    .reverse()
    .find(m => m.days <= (currentStreak || 0))

  const daysUntilNextMilestone = nextMilestone ? nextMilestone.days - (currentStreak || 0) : 0

  const markActivityCompleted = (activityId: string) => {
    setActivities(prev => 
      prev.map(activity => 
        activity.id === activityId 
          ? { ...activity, completed: true }
          : activity
      )
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Streak Overview */}
      <Card className="bg-gradient-accent border-accent/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Flame className="w-12 h-12 text-accent-foreground" />
                {(currentStreak || 0) > 0 && (
                  <div className="absolute -top-2 -right-2 bg-accent-foreground text-accent text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {currentStreak}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-accent-foreground">
                  {currentStreak || 0} Day Streak
                </h3>
                <p className="text-accent-foreground/80">
                  Longest: {longestStreak || 0} days
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold text-accent-foreground">
                {completedToday}/{totalActivities}
              </div>
              <p className="text-sm text-accent-foreground/80">
                Today's Progress
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-accent-foreground/80">Daily Completion</span>
              <span className="text-sm font-medium text-accent-foreground">
                {Math.round(completionPercentage)}%
              </span>
            </div>
            <Progress 
              value={completionPercentage} 
              className="h-2 bg-accent-foreground/20"
            />
          </div>
        </CardContent>
      </Card>

      {/* Next Milestone */}
      {nextMilestone && (
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              Next Milestone: {nextMilestone.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {daysUntilNextMilestone} more {daysUntilNextMilestone === 1 ? 'day' : 'days'} to go
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <Badge variant="outline" className="text-accent">
                    +{nextMilestone.reward.xp} XP
                  </Badge>
                  <Badge variant="outline" className="text-primary">
                    +{nextMilestone.reward.tokens} SFORGE
                  </Badge>
                </div>
              </div>
            </div>
            <Progress 
              value={((currentStreak || 0) / nextMilestone.days) * 100}
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{currentStreak || 0} days</span>
              <span>{nextMilestone.days} days</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Activities */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-secondary" />
            Today's Activities
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Complete these activities to maintain your streak
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {activities.map(activity => {
            const Icon = activity.icon
            
            return (
              <div
                key={activity.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border transition-all duration-200",
                  activity.completed
                    ? "bg-success/10 border-success/30"
                    : "bg-muted/30 border-border/50 hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn(
                    "w-5 h-5",
                    activity.completed ? "text-success" : "text-muted-foreground"
                  )} />
                  <div>
                    <h4 className={cn(
                      "font-medium",
                      activity.completed && "line-through text-muted-foreground"
                    )}>
                      {activity.name}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {activity.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        +{activity.xpReward} XP
                      </Badge>
                      {activity.tokenReward && (
                        <Badge variant="outline" className="text-xs text-primary">
                          +{activity.tokenReward} SFORGE
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {!activity.completed ? (
                    <Button
                      size="sm"
                      onClick={() => markActivityCompleted(activity.id)}
                      className="shrink-0"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Complete
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1 text-success text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Done
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Recent Milestones */}
      {lastMilestone && (
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" />
              Recent Achievement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg border border-accent/20">
              <div>
                <h4 className="font-semibold text-accent">{lastMilestone.name}</h4>
                <p className="text-sm text-muted-foreground">
                  Achieved at {lastMilestone.days} day streak
                </p>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-accent text-accent-foreground">
                  +{lastMilestone.reward.xp} XP
                </Badge>
                <Badge className="bg-primary text-primary-foreground">
                  +{lastMilestone.reward.tokens} SFORGE
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}