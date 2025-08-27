import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Flame, 
  Calendar, 
  Trophy, 
  Target, 
  Star, 
  Zap,
  TrendingUp,
  CheckCircle,
  Clock,
  Gift,
  Award,
  Users,
  Heart,
  MessageSquare,
  Coffee,
  ArrowRight,
  Sparkles
} from 'lucide-react'
import { formatDistanceToNow, isToday, format } from 'date-fns'
import { useAccount } from 'wagmi'
import { useProfile } from '@/hooks/useProfile'
import { useNotifications } from '@/components/notifications/NotificationSystem'
import { toast } from 'sonner'

interface StreakData {
  type: 'daily_login' | 'quest_completion' | 'social_interaction' | 'token_creation' | 'governance_participation'
  name: string
  description: string
  icon: React.ElementType
  currentStreak: number
  longestStreak: number
  lastActivity: Date | null
  nextMilestone: number
  milestoneReward: string
  color: string
  isActive: boolean
  todayCompleted: boolean
}

interface Milestone {
  streakCount: number
  reward: string
  description: string
  achieved: boolean
  achievedDate?: Date
}

const streakTypes: StreakData[] = [
  {
    type: 'daily_login',
    name: 'Daily Login',
    description: 'Log in every day to maintain your streak',
    icon: Calendar,
    currentStreak: 7,
    longestStreak: 12,
    lastActivity: new Date(),
    nextMilestone: 10,
    milestoneReward: '500 XP + Special Badge',
    color: 'primary',
    isActive: true,
    todayCompleted: true
  },
  {
    type: 'quest_completion',
    name: 'Quest Master',
    description: 'Complete at least one quest every day',
    icon: Target,
    currentStreak: 4,
    longestStreak: 8,
    lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000),
    nextMilestone: 7,
    milestoneReward: '300 XP + Quest Badge',
    color: 'accent',
    isActive: true,
    todayCompleted: false
  },
  {
    type: 'social_interaction',
    name: 'Community Builder',
    description: 'Interact with the community daily (posts, likes, comments)',
    icon: Users,
    currentStreak: 2,
    longestStreak: 5,
    lastActivity: new Date(),
    nextMilestone: 5,
    milestoneReward: '200 XP + Social Badge',
    color: 'secondary',
    isActive: true,
    todayCompleted: true
  },
  {
    type: 'token_creation',
    name: 'Token Forge Master',
    description: 'Create or interact with tokens regularly',
    icon: Coffee,
    currentStreak: 0,
    longestStreak: 3,
    lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    nextMilestone: 3,
    milestoneReward: '400 XP + Forge Badge',
    color: 'warning',
    isActive: false,
    todayCompleted: false
  },
  {
    type: 'governance_participation',
    name: 'DAO Participant',
    description: 'Participate in governance votes and discussions',
    icon: Award,
    currentStreak: 1,
    longestStreak: 2,
    lastActivity: new Date(),
    nextMilestone: 5,
    milestoneReward: '600 XP + Governor Badge',
    color: 'destructive',
    isActive: true,
    todayCompleted: true
  }
]

const milestones: Milestone[] = [
  { streakCount: 3, reward: '100 XP', description: 'First milestone', achieved: true, achievedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
  { streakCount: 7, reward: '250 XP + Badge', description: 'Weekly warrior', achieved: true, achievedDate: new Date() },
  { streakCount: 14, reward: '500 XP + Special Badge', description: 'Dedication master', achieved: false },
  { streakCount: 30, reward: '1000 XP + Legendary Badge', description: 'Empire legend', achieved: false },
  { streakCount: 100, reward: '5000 XP + Ultimate Badge', description: 'Ultimate champion', achieved: false }
]

const StreakCard = ({ streak, onMaintain }: { 
  streak: StreakData
  onMaintain: (type: string) => void 
}) => {
  const Icon = streak.icon
  const isStreakAtRisk = streak.lastActivity && !isToday(streak.lastActivity) && streak.currentStreak > 0
  const progressToMilestone = (streak.currentStreak / streak.nextMilestone) * 100

  return (
    <Card className={`hover:shadow-lg transition-all ${
      streak.isActive ? 'ring-2 ring-primary/20' : 'opacity-60'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${streak.color}/10`}>
              <Icon className={`h-5 w-5 text-${streak.color}`} />
            </div>
            <div>
              <CardTitle className="text-lg">{streak.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{streak.description}</p>
            </div>
          </div>
          {streak.isActive && (
            <div className="flex items-center gap-1">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="font-bold text-lg">{streak.currentStreak}</span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Streak Status */}
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-muted-foreground">Current: </span>
            <span className="font-semibold">{streak.currentStreak} days</span>
          </div>
          <div>
            <span className="text-muted-foreground">Best: </span>
            <span className="font-semibold">{streak.longestStreak} days</span>
          </div>
        </div>

        {/* Progress to Next Milestone */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Next milestone: {streak.nextMilestone} days</span>
            <span className="text-accent font-medium">{Math.round(progressToMilestone)}%</span>
          </div>
          <Progress value={progressToMilestone} className="h-2" />
          <p className="text-xs text-muted-foreground">{streak.milestoneReward}</p>
        </div>

        {/* Status and Actions */}
        <div className="space-y-3">
          {streak.todayCompleted ? (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle className="h-4 w-4" />
              <span>Completed today!</span>
            </div>
          ) : isStreakAtRisk ? (
            <div className="flex items-center gap-2 text-sm text-warning">
              <Clock className="h-4 w-4" />
              <span>Streak at risk! Complete today to maintain.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Ready to continue your streak</span>
            </div>
          )}

          {!streak.todayCompleted && streak.isActive && (
            <Button 
              size="sm" 
              onClick={() => onMaintain(streak.type)}
              className={`w-full bg-${streak.color} hover:bg-${streak.color}/90`}
            >
              Maintain Streak
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}

          {streak.lastActivity && (
            <p className="text-xs text-muted-foreground">
              Last activity: {formatDistanceToNow(streak.lastActivity, { addSuffix: true })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const MilestoneCard = ({ milestones }: { milestones: Milestone[] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-accent" />
          Streak Milestones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {milestones.map((milestone, index) => (
          <div key={index} className={`flex items-center gap-3 p-3 rounded-lg border ${
            milestone.achieved ? 'bg-success/10 border-success/20' : 'bg-muted/50'
          }`}>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
              milestone.achieved 
                ? 'bg-success border-success text-white' 
                : 'border-muted-foreground text-muted-foreground'
            }`}>
              {milestone.achieved ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <span className="text-xs font-bold">{milestone.streakCount}</span>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className={`font-medium ${milestone.achieved ? 'text-success' : ''}`}>
                  {milestone.streakCount} Day Streak
                </span>
                <Badge variant={milestone.achieved ? 'default' : 'outline'} className="text-xs">
                  {milestone.reward}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{milestone.description}</p>
              {milestone.achieved && milestone.achievedDate && (
                <p className="text-xs text-success">
                  Achieved {formatDistanceToNow(milestone.achievedDate, { addSuffix: true })}
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

const StreakLeaderboard = () => {
  const leaderboard = [
    { id: '1', username: 'StreakMaster', avatar: '/api/placeholder/32/32', totalStreak: 45, badges: 8 },
    { id: '2', username: 'DailyBuilder', avatar: '/api/placeholder/32/32', totalStreak: 38, badges: 6 },
    { id: '3', username: 'ConsistentCoder', avatar: '/api/placeholder/32/32', totalStreak: 32, badges: 5 },
    { id: '4', username: 'QuestHero', avatar: '/api/placeholder/32/32', totalStreak: 28, badges: 4 },
    { id: '5', username: 'CommunityChamp', avatar: '/api/placeholder/32/32', totalStreak: 24, badges: 3 }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Community Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {leaderboard.map((user, index) => (
          <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              index === 0 ? 'bg-yellow-500 text-white' :
              index === 1 ? 'bg-gray-400 text-white' :
              index === 2 ? 'bg-amber-600 text-white' :
              'bg-muted text-muted-foreground'
            }`}>
              {index + 1}
            </div>
            
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar} />
              <AvatarFallback>{user.username.slice(0, 2)}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="font-medium text-sm">{user.username}</div>
              <div className="text-xs text-muted-foreground">
                {user.badges} badges earned
              </div>
            </div>
            
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm font-semibold">
                <Flame className="h-3 w-3 text-orange-500" />
                {user.totalStreak}
              </div>
              <div className="text-xs text-muted-foreground">total days</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export const StreakOverview = () => {
  const { isConnected } = useAccount()
  const { profile } = useProfile()
  const { addNotification } = useNotifications()
  const [streaks, setStreaks] = useState<StreakData[]>(streakTypes)

  const handleMaintainStreak = (streakType: string) => {
    const streakActions = {
      daily_login: { action: 'Login completed!', href: '/dashboard' },
      quest_completion: { action: 'Complete a quest to maintain streak', href: '/quests' },
      social_interaction: { action: 'Interact with community', href: '/social' },
      token_creation: { action: 'Create or trade tokens', href: '/forge' },
      governance_participation: { action: 'Participate in governance', href: '/dao' }
    }

    const action = streakActions[streakType as keyof typeof streakActions]
    
    if (streakType === 'daily_login') {
      // Simulate completing login streak
      setStreaks(prev => prev.map(s => 
        s.type === streakType 
          ? { ...s, todayCompleted: true, currentStreak: s.currentStreak + 1 }
          : s
      ))
      
      addNotification({
        type: 'achievement',
        title: 'Streak Maintained!',
        message: 'Daily login streak continued. Keep it up!',
        actionUrl: '/streaks'
      })
      
      toast.success('Daily login streak maintained!')
    } else {
      // Redirect to appropriate section
      window.location.href = action.href
    }
  }

  const totalActiveStreaks = streaks.filter(s => s.isActive).length
  const longestCurrentStreak = Math.max(...streaks.map(s => s.currentStreak))
  const totalStreakDays = streaks.reduce((sum, s) => sum + s.currentStreak, 0)

  if (!isConnected) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Flame className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Track Your Streaks</h2>
            <p className="text-muted-foreground mb-6">
              Connect your wallet to start building powerful activity streaks and earn amazing rewards.
            </p>
            <Button size="lg">Connect Wallet</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Activity Streaks
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Build consistent habits, earn rewards, and climb the leaderboard through daily activities
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Flame className="h-6 w-6 text-orange-500" />
              <span className="text-2xl font-bold">{longestCurrentStreak}</span>
            </div>
            <p className="text-sm text-muted-foreground">Longest Active Streak</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Target className="h-6 w-6 text-primary" />
              <span className="text-2xl font-bold">{totalActiveStreaks}</span>
            </div>
            <p className="text-sm text-muted-foreground">Active Streaks</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Star className="h-6 w-6 text-accent" />
              <span className="text-2xl font-bold">{totalStreakDays}</span>
            </div>
            <p className="text-sm text-muted-foreground">Total Streak Days</p>
          </CardContent>
        </Card>
      </div>

      {/* Streak Cards */}
      <div>
        <h2 className="text-2xl font-semibold mb-6">Your Streaks</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {streaks.map(streak => (
            <StreakCard 
              key={streak.type} 
              streak={streak} 
              onMaintain={handleMaintainStreak}
            />
          ))}
        </div>
      </div>

      {/* Sidebar Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MilestoneCard milestones={milestones} />
        <StreakLeaderboard />
      </div>

      {/* Tips Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Streak Building Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-semibold">🎯 Set Reminders</h4>
            <p className="text-sm text-muted-foreground">
              Use daily reminders to maintain your streaks consistently
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">🏆 Start Small</h4>
            <p className="text-sm text-muted-foreground">
              Begin with one streak type and gradually add more activities
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">👥 Join the Community</h4>
            <p className="text-sm text-muted-foreground">
              Connect with other streak builders for motivation and support
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">🎁 Claim Rewards</h4>
            <p className="text-sm text-muted-foreground">
              Don't forget to claim your milestone rewards as you achieve them
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}