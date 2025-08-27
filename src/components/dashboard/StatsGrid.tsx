import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Wallet, 
  Coins, 
  Trophy, 
  Zap, 
  Users, 
  Target,
  TrendingUp,
  Star
} from "lucide-react"
import { useUserXP, useUserLevel, useUserBadges, useTokenBalance } from '@/hooks/contracts'
import { useAccount, useChainId, useBalance } from 'wagmi'
import { avalancheFuji } from 'wagmi/chains'
import { CONTRACT_ADDRESSES } from '@/config/web3'
import { useOnboardingQuests } from '@/hooks/useOnboardingQuests'
import { useStreakCore, ACTIVITY_TYPES } from '@/hooks/useStreaks'
import { useForgeToken } from '@/hooks/useForgeToken'


export const StatsGrid = () => {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: userXP } = useUserXP()
  const { data: userLevel } = useUserLevel()
  const { badgeCount } = useUserBadges()
  const { data: tokenBalance } = useTokenBalance()
  const { data: nativeBalance } = useBalance({
    address,
    chainId,
    query: { enabled: !!address, refetchInterval: 6000 },
  })
  
  // Contract integrations
  const { nextStep, stats } = useOnboardingQuests()
  const { balance: forgeBalance, totalSupply, name: tokenName } = useForgeToken()
  const { useActivityStreak } = useStreakCore()
  const { currentStreak } = useActivityStreak(ACTIVITY_TYPES.QUEST_COMPLETION)

  const xpValue = userXP ? Number(userXP) : 0
  const levelValue = userLevel ? Number(userLevel) : 1
  const tokenValue = tokenBalance ? Number(tokenBalance) / 1e18 : 0
  const nativeValue = nativeBalance ? parseFloat(nativeBalance.formatted) : 0
  const wrongChain = chainId && chainId !== avalancheFuji.id


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Wallet Balance */}
      <Card className="bg-gradient-card border-primary/20 hover:shadow-primary transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
          <Wallet className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isConnected ? `${nativeValue.toFixed(4)} ${nativeBalance?.symbol ?? 'AVAX'}` : '—'}</div>
          <p className="text-xs text-muted-foreground">Connected wallet native balance</p>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Token Balance</span>
              <span>{isConnected ? `${tokenValue.toFixed(4)}` : '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Network</span>
              <span>{chainId === avalancheFuji.id ? 'Avalanche Fuji' : chainId ? `Chain ID ${chainId}` : 'Unknown'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* XP & Level */}
      <Card className="bg-gradient-card border-accent/20 hover:shadow-glow-accent transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Experience Points</CardTitle>
          <Zap className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline space-x-2">
            <div className="text-2xl font-bold">{xpValue.toLocaleString()}</div>
            <Badge variant="outline" className="border-accent/50">Level {levelValue}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Next level at {((levelValue + 1) * 1000).toLocaleString()} XP
          </p>
          <Progress value={(xpValue % 1000) / 10} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{(levelValue * 1000).toLocaleString()} XP</span>
            <span>{((levelValue + 1) * 1000).toLocaleString()} XP</span>
          </div>
        </CardContent>
      </Card>

{/* Active Quests */}
      <Card className="bg-gradient-card border-secondary/20 hover:shadow-secondary transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Quests</CardTitle>
          <Target className="h-4 w-4 text-secondary" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {nextStep ? (
              <>
                <div className="text-2xl font-bold">Step {nextStep[0]}</div>
                <div className="text-sm text-muted-foreground">
                  {nextStep[1]?.title || 'Loading quest...'}
                </div>
                {nextStep[1]?.xpReward && (
                  <div className="flex items-center gap-1 text-xs text-accent">
                    <Star className="w-3 h-3" />
                    +{Number(nextStep[1].xpReward)} XP
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                No active onboarding quest
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Badges & Achievements */}
      <Card className="bg-gradient-card border-border/50 hover:shadow-card transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Badge Collection</CardTitle>
          <Trophy className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{badgeCount} / 12</div>
          <p className="text-xs text-muted-foreground mb-3">
            Unique badges earned
          </p>
          <div className="flex space-x-1">
            <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
              <Star className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-accent flex items-center justify-center">
              <Coins className="w-4 h-4 text-accent-foreground" />
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-secondary flex items-center justify-center">
              <Users className="w-4 h-4 text-secondary-foreground" />
            </div>
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center opacity-50">
              <span className="text-xs">+2</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FORGE Token Stats */}
      <Card className="bg-gradient-card border-border/50 hover:shadow-card transition-all duration-300 md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">FORGE Token</CardTitle>
          <Coins className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold">{forgeBalance ? Number(forgeBalance) / 1e18 : 0}</div>
              <div className="text-xs text-muted-foreground">Your Balance</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">{totalSupply ? (Number(totalSupply) / 1e18 / 1000000).toFixed(1) + 'M' : '0'}</div>
              <div className="text-xs text-muted-foreground">Total Supply</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">{currentStreak || 0}</div>
              <div className="text-xs text-muted-foreground">Quest Streak</div>
            </div>
          </div>
        </CardContent>
      </Card>

{/* Network Information (dynamic) */}
      <Card className="bg-gradient-card border-border/50 hover:shadow-card transition-all duration-300 md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Network & Status</CardTitle>
          <TrendingUp className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className={`text-xl font-bold ${wrongChain ? 'text-destructive' : 'text-success'}`}>{chainId === avalancheFuji.id ? 'Fuji' : chainId || 'Unknown'}</div>
              <div className="text-xs text-muted-foreground">{chainId === avalancheFuji.id ? 'Testnet' : 'Switch to Fuji'}</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">{Object.keys(CONTRACT_ADDRESSES).length}</div>
              <div className="text-xs text-muted-foreground">Contracts</div>
            </div>
            <div className="text-center">
              <div className={`text-xl font-bold ${isConnected && !wrongChain ? 'text-success' : 'text-muted-foreground'}`}>{isConnected && !wrongChain ? 'Connected' : 'Disconnected'}</div>
              <div className="text-xs text-muted-foreground">Wallet</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}