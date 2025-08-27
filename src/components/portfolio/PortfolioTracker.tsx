import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  TrendingUp, 
  TrendingDown,
  Wallet,
  Coins,
  Target,
  Activity,
  DollarSign,
  PieChart,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Eye,
  Zap,
  Gift,
  Clock,
  Star,
  Trophy
} from "lucide-react"
import { useAccount, useBalance } from 'wagmi'
import { useUserXP, useUserBadges } from '@/hooks/contracts'
import { useForgeToken } from '@/hooks/useForgeToken'
import { useStreakCore, ACTIVITY_TYPES } from '@/hooks/useStreaks'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { useOnboardingQuests } from '@/hooks/useOnboardingQuests'
import { useDynamicQuests } from '@/hooks/useDynamicQuests'
import { ConnectWalletEmpty } from '@/components/states/EmptyStates'

interface Asset {
  symbol: string
  name: string
  balance: number
  value: number
  change24h: number
  icon: string
  category: 'native' | 'token' | 'nft' | 'staked'
}

interface Activity {
  id: string
  type: 'quest' | 'social' | 'governance' | 'trading' | 'staking'
  title: string
  description: string
  reward: string
  xp: number
  timestamp: Date
  status: 'completed' | 'pending' | 'failed'
}

interface Milestone {
  id: string
  title: string
  description: string
  progress: number
  target: number
  reward: string
  category: 'portfolio' | 'activity' | 'social' | 'governance'
  isCompleted: boolean
}

// Real contract data integration
const useContractData = () => {
  const { address } = useAccount()
  const { balance: forgeBalance, totalSupply } = useForgeToken()
  const { data: nativeBalance } = useBalance({ address })
  const { useActivityStreak } = useStreakCore()
  const { currentStreak: questStreak } = useActivityStreak(ACTIVITY_TYPES.QUEST_COMPLETION)
  const { currentStreak: socialStreak } = useActivityStreak(ACTIVITY_TYPES.SOCIAL_INTERACTION)
  const { stakingPool, userStaked, userRewards } = useStakingRewards()
  const { nextStep, stats } = useOnboardingQuests()
  const { activeQuests, completedQuests } = useDynamicQuests()

  const liveAssets: Asset[] = [
    {
      symbol: 'AVAX',
      name: 'Avalanche',
      balance: nativeBalance ? parseFloat(nativeBalance.formatted) : 0,
      value: nativeBalance ? parseFloat(nativeBalance.formatted) * 32.5 : 0,
      change24h: 2.4,
      icon: '⚡',
      category: 'native' as const
    },
    {
      symbol: 'FORGE',
      name: 'Forge Token',
      balance: forgeBalance ? Number(forgeBalance) / 1e18 : 0,
      value: forgeBalance ? (Number(forgeBalance) / 1e18) * 0.1 : 0,
      change24h: 5.2,
      icon: '🔥',
      category: 'token' as const
    },
    {
      symbol: 'STAKED',
      name: 'Staked Tokens',
      balance: userStaked ? Number(userStaked) / 1e18 : 0,
      value: userStaked ? (Number(userStaked) / 1e18) * 0.1 : 0,
      change24h: 0,
      icon: '🔒',
      category: 'staked' as const
    }
  ].filter(asset => asset.balance > 0)

  const liveActivities: Activity[] = [
    ...(nextStep ? [{
      id: 'onboarding-' + nextStep[0],
      type: 'quest' as const,
      title: nextStep[1]?.title || 'Onboarding Quest',
      description: nextStep[1]?.description || 'Complete onboarding step',
      reward: `${Number(nextStep[1]?.xpReward || 0)} XP`,
      xp: Number(nextStep[1]?.xpReward || 0),
      timestamp: new Date(),
      status: 'pending' as const
    }] : []),
    ...(activeQuests?.slice(0, 3).map((questId, index) => ({
      id: `dynamic-${questId}`,
      type: 'quest' as const,
      title: `Dynamic Quest ${questId}`,
      description: 'AI-generated personalized quest',
      reward: '200 XP',
      xp: 200,
      timestamp: new Date(Date.now() - index * 3600000),
      status: 'pending' as const
    })) || [])
  ]

  const liveMilestones: Milestone[] = [
    {
      id: 'streak-milestone',
      title: 'Quest Master',
      description: 'Complete 7 consecutive daily quests',
      progress: questStreak || 0,
      target: 7,
      reward: 'Quest Master Badge',
      category: 'activity',
      isCompleted: (questStreak || 0) >= 7
    },
    {
      id: 'social-milestone',
      title: 'Community Builder',
      description: 'Maintain 5-day social streak',
      progress: socialStreak || 0,
      target: 5,
      reward: 'Social Badge',
      category: 'social',
      isCompleted: (socialStreak || 0) >= 5
    },
    {
      id: 'portfolio-milestone',
      title: 'Token Holder',
      description: 'Accumulate 1000 FORGE tokens',
      progress: forgeBalance ? Number(forgeBalance) / 1e18 : 0,
      target: 1000,
      reward: 'Investor Badge',
      category: 'portfolio',
      isCompleted: forgeBalance ? Number(forgeBalance) / 1e18 >= 1000 : false
    }
  ]

  return { liveAssets, liveActivities, liveMilestones }
}

const AssetCard = ({ asset }: { asset: Asset }) => {
  const isPositive = asset.change24h >= 0
  
  return (
    <Card className="hover:shadow-lg transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-lg">
              {asset.icon}
            </div>
            <div>
              <div className="font-semibold">{asset.symbol}</div>
              <div className="text-sm text-muted-foreground">{asset.name}</div>
            </div>
          </div>
          <Badge variant={asset.category === 'staked' ? 'default' : 'outline'}>
            {asset.category}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Balance</span>
            <span className="font-medium">{asset.balance.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Value</span>
            <span className="font-semibold">${asset.value.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">24h Change</span>
            <div className={`flex items-center gap-1 ${isPositive ? 'text-success' : 'text-destructive'}`}>
              {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              <span className="text-sm font-medium">{Math.abs(asset.change24h)}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const ActivityCard = ({ activity }: { activity: Activity }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'quest': return <Target className="w-4 h-4" />
      case 'social': return <Activity className="w-4 h-4" />
      case 'governance': return <Star className="w-4 h-4" />
      case 'trading': return <TrendingUp className="w-4 h-4" />
      case 'staking': return <Zap className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }
  
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'quest': return 'text-primary'
      case 'social': return 'text-secondary'
      case 'governance': return 'text-accent'
      case 'trading': return 'text-success'
      case 'staking': return 'text-warning'
      default: return 'text-muted-foreground'
    }
  }
  
  return (
    <Card className="hover:shadow-lg transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-gradient-card ${getActivityColor(activity.type)}`}>
            {getActivityIcon(activity.type)}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-medium">{activity.title}</h4>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{activity.timestamp.toLocaleTimeString()}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{activity.description}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {activity.reward}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  +{activity.xp} XP
                </Badge>
              </div>
              <Badge 
                className={`text-xs ${
                  activity.status === 'completed' ? 'bg-success/10 text-success' : 
                  activity.status === 'pending' ? 'bg-warning/10 text-warning' :
                  'bg-destructive/10 text-destructive'
                }`}
              >
                {activity.status}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const MilestoneCard = ({ milestone }: { milestone: Milestone }) => {
  const progress = Math.min((milestone.progress / milestone.target) * 100, 100)
  
  return (
    <Card className={`hover:shadow-lg transition-all duration-300 ${
      milestone.isCompleted ? 'ring-2 ring-success/20 bg-success/5' : ''
    }`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              milestone.isCompleted ? 'bg-success text-success-foreground' : 'bg-gradient-card'
            }`}>
              {milestone.isCompleted ? <Trophy className="w-5 h-5" /> : <Target className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="font-semibold">{milestone.title}</h4>
              <p className="text-sm text-muted-foreground">{milestone.description}</p>
            </div>
          </div>
          <Badge className={milestone.isCompleted ? 'bg-success text-success-foreground' : 'bg-muted'}>
            {milestone.category}
          </Badge>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {milestone.progress.toLocaleString()} / {milestone.target.toLocaleString()}
            </span>
          </div>
          
          <Progress 
            value={progress} 
            className={`h-2 ${milestone.isCompleted ? '[&>div]:bg-success' : ''}`}
          />
          
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              <Gift className="w-3 h-3 mr-1" />
              {milestone.reward}
            </Badge>
            <span className="text-sm font-medium">
              {milestone.isCompleted ? 'Completed!' : `${progress.toFixed(1)}%`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const PortfolioTracker = () => {
  const { isConnected } = useAccount()
  const [timeframe, setTimeframe] = useState('24h')
  const { data: userXP } = useUserXP()
  const { badgeCount } = useUserBadges()
  const { liveAssets, liveActivities, liveMilestones } = useContractData()
  
  const xpValue = userXP ? Number(userXP) : 0
  
  if (!isConnected) {
    return <ConnectWalletEmpty />
  }

  const totalValue = liveAssets.reduce((sum, asset) => sum + asset.value, 0)
  const totalChange = liveAssets.reduce((sum, asset) => sum + (asset.value * asset.change24h / 100), 0)
  const changePercentage = totalValue > 0 ? (totalChange / (totalValue - totalChange)) * 100 : 0
  const isPositive = changePercentage >= 0

  return (
    <div className="container max-w-7xl py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Portfolio Dashboard
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Track your assets, activities, and achievements in one comprehensive dashboard
        </p>
      </div>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Portfolio Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">${totalValue.toFixed(2)}</div>
                  <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-success' : 'text-destructive'}`}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span>{isPositive ? '+' : ''}{changePercentage.toFixed(2)}% (${totalChange.toFixed(2)})</span>
                  </div>
                </div>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">24h</SelectItem>
                    <SelectItem value="7d">7d</SelectItem>
                    <SelectItem value="30d">30d</SelectItem>
                    <SelectItem value="1y">1y</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Coins className="w-4 h-4" />
                    <span>Total Assets</span>
                  </div>
                  <div className="text-xl font-semibold">{liveAssets.length}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <PieChart className="w-4 h-4" />
                    <span>Largest Holding</span>
                  </div>
                  <div className="text-xl font-semibold">--</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total XP</span>
              <span className="font-semibold">{xpValue.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Achievements</span>
              <span className="font-semibold">{badgeCount || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Streak Days</span>
              <span className="font-semibold">0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Votes Cast</span>
              <span className="font-semibold">0</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Views */}
      <Tabs defaultValue="assets" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Your Assets</h2>
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Asset
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveAssets.length > 0 ? (
              liveAssets.map((asset, index) => (
                <AssetCard key={index} asset={asset} />
              ))
            ) : (
              <div className="md:col-span-2 lg:col-span-3 text-center py-12">
                <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Assets Found</h3>
                <p className="text-muted-foreground">
                  Connect your wallet and start using the platform to see your assets here.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Recent Activity</h2>
            <Button variant="outline">
              <Eye className="w-4 h-4 mr-2" />
              View All
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {liveActivities.length > 0 ? (
              liveActivities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))
            ) : (
              <div className="lg:col-span-2 text-center py-12">
                <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Recent Activity</h3>
                <p className="text-muted-foreground">
                  Start completing quests and engaging with the platform to see your activity here.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="milestones" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Achievement Milestones</h2>
            <Badge variant="outline">
              {liveMilestones.filter(m => m.isCompleted).length} / {liveMilestones.length} Completed
            </Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {liveMilestones.length > 0 ? (
              liveMilestones.map((milestone) => (
                <MilestoneCard key={milestone.id} milestone={milestone} />
              ))
            ) : (
              <div className="lg:col-span-2 text-center py-12">
                <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Milestones Available</h3>
                <p className="text-muted-foreground">
                  Milestones will appear as you progress through the platform and earn achievements.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="text-center py-12">
            <PieChart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Advanced Analytics</h3>
            <p className="text-muted-foreground mb-6">
              Detailed portfolio analytics and performance insights coming soon.
            </p>
            <Button variant="outline">
              <Calendar className="w-4 h-4 mr-2" />
              Get Notified
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}