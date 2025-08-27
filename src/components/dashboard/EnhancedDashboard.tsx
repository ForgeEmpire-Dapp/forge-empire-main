import { useState } from 'react'
import { useEnhancedDataFetching } from '@/hooks/useEnhancedDataFetching'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { useDataFreshness } from '@/hooks/useDataFreshness'
import { DataStatusIndicator } from '@/components/ui/data-status-indicator'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  Activity,
  Target,
  Trophy,
  Users,
  Zap,
  TrendingUp,
  Calendar,
  Bell,
  Settings,
  Star,
  Coins,
  Clock,
  Gift,
  ChevronRight
} from "lucide-react"
import { useAccount } from 'wagmi'
import { useUserXP, useUserLevel, useUserBadges } from '@/hooks/contracts'
import { useOnboardingQuests } from '@/hooks/useOnboardingQuests'
import { useStreakCore } from '@/hooks/useStreaks'
import { useForgeToken } from '@/hooks/useForgeToken'
import { useDynamicQuests } from '@/hooks/useDynamicQuests'
import { StatsGrid } from './StatsGrid'
import { QuickActionsHub } from './QuickActionsHub'
import { LiveActivityFeed } from './LiveActivityFeed'
import { XPLevelCard } from '@/components/achievements/XPLevelCard'
import { DailyStreakTracker } from '@/components/streaks/DailyStreakTracker'
import { ACTIVITY_TYPES } from '@/hooks/useStreakInteractions'
import { Link } from 'react-router-dom'

interface Notification {
  id: string
  type: 'quest' | 'reward' | 'achievement' | 'social'
  title: string
  message: string
  timestamp: Date
  isRead: boolean
  actionUrl?: string
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'quest',
    title: 'New Quest Available',
    message: 'Complete your onboarding to earn 100 XP',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    isRead: false,
    actionUrl: '/quests'
  },
  {
    id: '2',
    type: 'achievement',
    title: 'Badge Earned!',
    message: 'You earned the "First Steps" badge',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    isRead: false
  },
  {
    id: '3',
    type: 'social',
    title: 'Community Activity',
    message: 'Check out new posts in the social hub',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
    isRead: true,
    actionUrl: '/social'
  }
]

const NotificationItem = ({ notification }: { notification: Notification }) => {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'quest': return <Target className="w-4 h-4 text-primary" />
      case 'reward': return <Gift className="w-4 h-4 text-success" />
      case 'achievement': return <Trophy className="w-4 h-4 text-accent" />
      case 'social': return <Users className="w-4 h-4 text-secondary" />
      default: return <Bell className="w-4 h-4 text-muted-foreground" />
    }
  }

  return (
    <div className={`p-3 rounded-lg border transition-all duration-200 hover:shadow-sm ${
      notification.isRead ? 'bg-muted/30' : 'bg-primary/5 border-primary/20'
    }`}>
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-full bg-background/80 backdrop-blur-sm">
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium">{notification.title}</p>
            {!notification.isRead && (
              <div className="w-2 h-2 rounded-full bg-primary" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            {notification.message}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {Math.floor((Date.now() - notification.timestamp.getTime()) / 1000 / 60)}m ago
            </div>
            {notification.actionUrl && (
              <Button variant="ghost" size="sm" asChild>
                <Link to={notification.actionUrl}>
                  View
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const EnhancedDashboard = () => {
  const { isConnected } = useAccount()
  const { data: userXP, refetch: refetchUserXP } = useUserXP()
  const { data: userLevel, refetch: refetchUserLevel } = useUserLevel()
  const { badgeCount } = useUserBadges()
  const { nextStep } = useOnboardingQuests()
  const { balance: forgeBalance, refetchBalance } = useForgeToken()
  const { activeQuests, completedQuests } = useDynamicQuests()
  const { useActivityStreak } = useStreakCore()
  const { currentStreak } = useActivityStreak(Number(ACTIVITY_TYPES.QUEST_COMPLETION))

  // Optimized data fetching for dashboard - much less aggressive
  const { currentStrategy, isActiveTab } = useEnhancedDataFetching({
    refetchImmediate: () => {
      refetchUserXP?.()
      refetchUserLevel?.()
      refetchBalance?.()
    },
    refetchBackground: () => {
      // Very conservative background refresh
      refetchUserXP?.()
    },
    aggressiveInterval: 60000, // 1 minute when active (much less aggressive)
    conservativeInterval: 300000, // 5 minutes for background
    enabled: isConnected
  })
  
  // Data freshness tracking with longer cache
  const { 
    dataState, 
    markFresh, 
    markLoading, 
    getStateClasses 
  } = useDataFreshness({ maxAge: 120000 }) // 2 minutes for dashboard

  // Disabled real-time for better performance - manual refresh only
  const isRealtimeConnected = false
  const lastUpdate = new Date()

  // Handle data refresh with visual feedback
  const handleRefreshAll = async () => {
    markLoading()
    try {
      await Promise.all([
        refetchUserXP?.(),
        refetchUserLevel?.(),
        refetchBalance?.()
      ])
      markFresh()
    } catch (error) {
      console.error('Failed to refresh dashboard data:', error)
    }
  }
  
  const [notifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)
  const unreadCount = notifications.filter(n => !n.isRead).length

  const xpValue = userXP ? Number(userXP) : 0
  const levelValue = userLevel ? Number(userLevel) : 1
  const nextLevelXP = (levelValue + 1) * 1000
  const currentLevelXP = levelValue * 1000
  const progressPercent = ((xpValue - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100

  if (!isConnected) {
    return (
      <div className="container max-w-7xl py-8">
        <Card className="p-12 text-center">
          <Zap className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Welcome to Avax Forge Empire</h2>
          <p className="text-muted-foreground mb-6">
            Connect your wallet to access your personalized dashboard and start building your empire.
          </p>
          <Button variant="hero" className="glow-primary">
            Connect Wallet
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl py-8 space-y-8">
      {/* Welcome Header with Real-time Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold animate-fade-in">Welcome back, Builder!</h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening in your empire today
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DataStatusIndicator
            state={dataState}
            lastUpdate={lastUpdate}
            isRealtime={isRealtimeConnected}
            onRefresh={handleRefreshAll}
            compact
          />
          <Badge variant="outline" className="flex items-center gap-2 animate-scale-in">
            <Star className="w-4 h-4" />
            Level {levelValue}
          </Badge>
          {unreadCount > 0 && (
            <Badge className="bg-primary animate-scale-in">
              {unreadCount} new
            </Badge>
          )}
        </div>
      </div>

      {/* XP Progress with Animation */}
      <Card className={cn(
        "bg-gradient-primary/10 border-primary/20 transition-all duration-300",
        getStateClasses()
      )}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <span className="font-semibold">Experience Progress</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {xpValue.toLocaleString()} / {nextLevelXP.toLocaleString()} XP
            </span>
          </div>
          <Progress value={progressPercent} className="h-3 mb-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Level {levelValue}</span>
            <span>{(nextLevelXP - xpValue).toLocaleString()} XP to Level {levelValue + 1}</span>
          </div>
        </CardContent>
      </Card>

      {/* Main Stats Grid */}
      <StatsGrid />

      {/* Main Dashboard Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quests">Active Quests</TabsTrigger>
          <TabsTrigger value="activity">Activity Feed</TabsTrigger>
          <TabsTrigger value="notifications">
            Notifications {unreadCount > 0 && `(${unreadCount})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <QuickActionsHub />
            </div>
            <div className="space-y-6">
              {/* Recent Achievements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Recent Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {badgeCount > 0 ? (
                    <div className="text-center py-4">
                      <Trophy className="w-8 h-8 mx-auto text-accent mb-2" />
                      <p className="font-semibold">{badgeCount} Badges Earned</p>
                      <p className="text-sm text-muted-foreground">
                        Great progress on your journey!
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Complete quests to earn your first badge</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Current Streak */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Daily Streak
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-accent mb-2">
                      {currentStreak || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {currentStreak ? 'days in a row!' : 'Start your streak today'}
                    </p>
                    {(currentStreak || 0) >= 3 && (
                      <Badge variant="outline" className="mt-2">
                        🔥 On fire!
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="quests" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Onboarding Quest */}
            {nextStep && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Onboarding Quest
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold">{nextStep[1]?.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {nextStep[1]?.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">
                      Step {nextStep[0]}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="w-4 h-4 text-accent" />
                      +{Number(nextStep[1]?.xpReward || 0)} XP
                    </div>
                  </div>
                  <Button className="w-full" asChild>
                    <Link to="/quests">Complete Quest</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Dynamic Quests Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-accent" />
                  AI Quests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    {activeQuests?.length || 0} active dynamic quests
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {completedQuests?.length || 0} completed
                  </p>
                </div>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/dynamic-quests">View All Quests</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <LiveActivityFeed />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Notifications</h2>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
          
          <div className="space-y-3">
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </div>
          
          {notifications.length === 0 && (
            <Card className="p-12 text-center">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No notifications yet</h3>
              <p className="text-muted-foreground">
                We'll notify you about important updates and achievements.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}