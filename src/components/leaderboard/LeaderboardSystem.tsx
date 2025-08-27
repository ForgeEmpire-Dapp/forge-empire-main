import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Crown, Trophy, Zap, Star, Medal, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAccount } from 'wagmi'

export interface LeaderboardEntry {
  rank: number
  address: string
  username?: string
  avatar?: string
  xp: number
  completedQuests: number
  badges: number
  streak: number
  tokenRewards: number
  change?: number // Position change from last period
}

interface LeaderboardSystemProps {
  className?: string
}

// Mock data - replace with actual API calls
const mockLeaderboardData: LeaderboardEntry[] = [
  {
    rank: 1,
    address: '0x1234...5678',
    username: 'CryptoMaster',
    avatar: '',
    xp: 15420,
    completedQuests: 89,
    badges: 24,
    streak: 15,
    tokenRewards: 2350,
    change: 0
  },
  {
    rank: 2,
    address: '0x2345...6789',
    username: 'QuestSeeker',
    avatar: '',
    xp: 14750,
    completedQuests: 76,
    badges: 19,
    streak: 12,
    tokenRewards: 2100,
    change: 1
  },
  {
    rank: 3,
    address: '0x3456...7890',
    username: 'ForgeWarrior',
    avatar: '',
    xp: 13890,
    completedQuests: 65,
    badges: 18,
    streak: 8,
    tokenRewards: 1950,
    change: -1
  },
  // Add more mock entries...
  ...Array.from({ length: 7 }, (_, i) => ({
    rank: i + 4,
    address: `0x${(i + 4).toString().padStart(4, '0')}...${(i + 9999).toString().slice(-4)}`,
    username: `User${i + 4}`,
    avatar: '',
    xp: 13000 - (i * 800),
    completedQuests: 60 - (i * 5),
    badges: 15 - i,
    streak: 7 - i,
    tokenRewards: 1800 - (i * 150),
    change: Math.random() > 0.5 ? 1 : -1
  }))
]

const rankIcons = {
  1: { icon: Crown, color: 'text-accent', bg: 'bg-accent/20' },
  2: { icon: Trophy, color: 'text-secondary', bg: 'bg-secondary/20' },
  3: { icon: Medal, color: 'text-warning', bg: 'bg-warning/20' }
}

export const LeaderboardSystem = ({ className }: LeaderboardSystemProps) => {
  const { address } = useAccount()
  const [activeTab, setActiveTab] = useState('overall')
  const [timeframe, setTimeframe] = useState('all-time')
  
  const userRank = mockLeaderboardData.find(entry => 
    entry.address.toLowerCase() === address?.toLowerCase()
  )

  const sortedData = [...mockLeaderboardData].sort((a, b) => {
    switch (activeTab) {
      case 'xp':
        return b.xp - a.xp
      case 'quests':
        return b.completedQuests - a.completedQuests
      case 'streaks':
        return b.streak - a.streak
      case 'rewards':
        return b.tokenRewards - a.tokenRewards
      default:
        return a.rank - b.rank
    }
  })

  return (
    <div className={cn("space-y-6", className)}>
      {/* User's Current Position */}
      {userRank && (
        <Card className="bg-gradient-primary border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-primary-foreground">#{userRank.rank}</span>
                  {userRank.change !== undefined && (
                    <div className={cn(
                      "flex items-center gap-1 text-sm",
                      userRank.change > 0 ? "text-success" : 
                      userRank.change < 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      <TrendingUp className={cn(
                        "w-3 h-3",
                        userRank.change < 0 && "rotate-180"
                      )} />
                      {Math.abs(userRank.change)}
                    </div>
                  )}
                </div>
                <Avatar className="w-10 h-10">
                  <AvatarImage src={userRank.avatar} />
                  <AvatarFallback>
                    {userRank.username?.slice(0, 2).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-primary-foreground">Your Position</p>
                  <p className="text-sm text-primary-foreground/80">{userRank.xp.toLocaleString()} XP</p>
                </div>
              </div>
              <div className="flex gap-4 text-sm text-primary-foreground/80">
                <div className="text-center">
                  <div className="font-semibold">{userRank.completedQuests}</div>
                  <div>Quests</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{userRank.badges}</div>
                  <div>Badges</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{userRank.streak}</div>
                  <div>Streak</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              Community Leaderboard
            </CardTitle>
            <div className="flex gap-2">
              {['all-time', 'monthly', 'weekly'].map(period => (
                <button
                  key={period}
                  onClick={() => setTimeframe(period)}
                  className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium transition-all duration-200",
                    timeframe === period
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1).replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 w-full mb-6">
              <TabsTrigger value="overall">Overall</TabsTrigger>
              <TabsTrigger value="xp">XP</TabsTrigger>
              <TabsTrigger value="quests">Quests</TabsTrigger>
              <TabsTrigger value="streaks">Streaks</TabsTrigger>
              <TabsTrigger value="rewards">Rewards</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-3">
              {sortedData.slice(0, 10).map((entry) => {
                const rankConfig = rankIcons[entry.rank as keyof typeof rankIcons]
                const isCurrentUser = entry.address.toLowerCase() === address?.toLowerCase()

                return (
                  <div
                    key={entry.address}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border transition-all duration-200",
                      isCurrentUser 
                        ? "bg-primary/10 border-primary/30 shadow-primary" 
                        : "bg-muted/30 border-border/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full font-bold",
                        rankConfig ? `${rankConfig.bg} ${rankConfig.color}` : "bg-muted text-muted-foreground"
                      )}>
                        {rankConfig ? (
                          <rankConfig.icon className="w-4 h-4" />
                        ) : (
                          entry.rank
                        )}
                      </div>

                      {/* User Info */}
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={entry.avatar} />
                        <AvatarFallback>
                          {entry.username?.slice(0, 2).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {entry.username || `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`}
                          </span>
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-foreground">{entry.xp.toLocaleString()}</div>
                        <div className="text-muted-foreground">XP</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-foreground">{entry.completedQuests}</div>
                        <div className="text-muted-foreground">Quests</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-foreground">{entry.badges}</div>
                        <div className="text-muted-foreground">Badges</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-foreground">{entry.streak}</div>
                        <div className="text-muted-foreground">Streak</div>
                      </div>
                      {entry.change !== undefined && (
                        <div className={cn(
                          "flex items-center gap-1",
                          entry.change > 0 ? "text-success" : 
                          entry.change < 0 ? "text-destructive" : "text-muted-foreground"
                        )}>
                          <TrendingUp className={cn(
                            "w-3 h-3",
                            entry.change < 0 && "rotate-180"
                          )} />
                          <span className="text-xs">{Math.abs(entry.change)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}