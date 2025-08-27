import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { LoadingCard } from '@/components/ui/enhanced-loading'
import { 
  User, Trophy, Zap, Star, Coins, Crown, Target, TrendingUp, 
  Calendar, MapPin, Globe, Twitter, Github, Copy, ExternalLink,
  Flame, Gift, Shield, Award, Camera, Heart, MessageSquare
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { useProfile } from '@/hooks/useProfile'
import { BannerUploader } from './BannerUploader'
import { useForgeToken } from '@/hooks/useForgeToken'
import { useForgePass } from '@/hooks/useForgePass'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { useUserXP, useUserLevel, useUserBadges } from '@/hooks/contracts'
import { useStreakCore } from '@/hooks/useStreaks'
import { ACTIVITY_TYPES } from '@/hooks/useStreaks'
import { useProfileRegistry } from '@/hooks/useProfileRegistry'
import { useSocial, useIsFollowing } from '@/hooks/useSocial'
import { useKudos } from '@/hooks/useKudos'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface OnChainProfileViewerProps {
  address?: string
}

export const OnChainProfileViewer = ({ address }: OnChainProfileViewerProps) => {
  const { address: connectedAddress } = useAccount()
  const userAddress = address || connectedAddress
  const isOwnProfile = !address && !!connectedAddress
  const { profile, loading: profileLoading, saveProfile } = useProfile(userAddress)
  const { username: onChainUsername, hasProfile: hasOnChainProfile } = useProfileRegistry(userAddress)
  
  // Social hooks
  const { followUser, unfollowUser } = useSocial()
  const isFollowing = useIsFollowing(connectedAddress, userAddress)
  const [isUserFollowing, setIsUserFollowing] = useState(false)

  useEffect(() => {
    setIsUserFollowing(isFollowing)
  }, [isFollowing])

  const handleFollowToggle = async () => {
    if (!userAddress) return
    if (isUserFollowing) {
      await unfollowUser(userAddress)
    } else {
      await followUser(userAddress)
    }
    setIsUserFollowing(!isUserFollowing) // Optimistically update UI
  }

  // Kudos hook
  const { sendKudos } = useKudos()
  const handleSendKudos = async () => {
    if (!userAddress) return
    await sendKudos(userAddress as `0x${string}`)
    toast.success(`Kudos sent to ${onChainUsername || formatAddress(userAddress)}!`)
  }

  // Placeholder for Tip
  const handleSendTip = () => {
    toast.info("Tipping functionality coming soon!")
  }

  // Contract data
  const { balance: forgeBalance, symbol } = useForgeToken()
  const { passBalance, getTierName, getTierColor } = useForgePass()
  const { userStaked, userRewards, apy } = useStakingRewards()
  const { data: userXP } = useUserXP()
  const { data: userLevel } = useUserLevel()
  const { badgeCount } = useUserBadges()
  
  // Streak data for different activities
  const questStreak = useStreakCore().useActivityStreak(ACTIVITY_TYPES.QUEST_COMPLETION)
  const loginStreak = useStreakCore().useActivityStreak(ACTIVITY_TYPES.DAILY_LOGIN)
  const socialStreak = useStreakCore().useActivityStreak(ACTIVITY_TYPES.SOCIAL_INTERACTION)

  const xpValue = userXP ? Number(userXP) : 0
  const levelValue = userLevel ? Number(userLevel) : 1
  const nextLevelXP = levelValue * 1000
  const currentLevelXP = (levelValue - 1) * 1000
  const progressToNext = nextLevelXP > 0 ? ((xpValue - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100 : 0

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatNumber = (num: string | number) => {
    return parseFloat(num.toString()).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4
    })
  }

  if (!userAddress) {
    return (
      <LoadingCard
        isLoading={false}
        showEmptyState={true}
        emptyStateText="Connect your wallet to view profile data"
      >
        <div />
      </LoadingCard>
    )
  }

  if (profileLoading) {
    return (
      <LoadingCard
        isLoading={true}
        loadingText="Loading profile data..."
      >
        <div />
      </LoadingCard>
    )
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card className="bg-gradient-card border-primary/20">
        <CardHeader className="text-center relative">
          {/* Banner with Upload Capability */}
          <div className="absolute inset-0 rounded-t-lg overflow-hidden">
            {profile?.banner_url ? (
              <img 
                src={profile.banner_url} 
                alt="Profile banner" 
                className="w-full h-full object-cover opacity-30" 
              />
            ) : (
              <div className="w-full h-full bg-gradient-primary opacity-10" />
            )}
            {isOwnProfile && (
              <div className="absolute top-2 right-2">
                <BannerUploader 
                  currentBanner={profile?.banner_url} 
                  onBannerUpdate={(url) => saveProfile({ banner_url: url })}
                />
              </div>
            )}
          </div>
          
          <div className="relative z-10">
            <Avatar className="w-24 h-24 mx-auto mb-4 border-4 border-primary/30">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt="Profile avatar" />
              ) : null}
              <AvatarFallback className="text-2xl bg-gradient-primary text-primary-foreground">
                {(onChainUsername || profile?.username) ? 
                  (onChainUsername || profile?.username)!.slice(0, 2).toUpperCase() : 
                  userAddress.slice(2, 4).toUpperCase()
                }
              </AvatarFallback>
            </Avatar>
            
            <CardTitle className="text-2xl mb-2">
              {profile?.display_name || onChainUsername || profile?.username || "Anonymous Forge User"}
            </CardTitle>
            
            {onChainUsername && (
              <div className="mb-2">
                <Badge variant="secondary" className="text-xs">
                  On-Chain Username: @{onChainUsername}
                </Badge>
              </div>
            )}
            
            <p className="text-muted-foreground mb-4">
              {profile?.bio || "Welcome to Avax Forge Empire!"}
            </p>

            {/* Level & XP Display */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <Badge variant="outline" className="text-lg px-4 py-2">
                Level {levelValue}
              </Badge>
              <div className="text-sm text-muted-foreground">
                {formatNumber(xpValue)} XP
              </div>
            </div>

            {/* Progress Bar */}
            {levelValue < 10 && (
              <div className="max-w-xs mx-auto">
                <Progress value={Math.min(progressToNext, 100)} className="h-2 mb-2" />
                <div className="text-xs text-muted-foreground">
                  {formatNumber(nextLevelXP - xpValue)} XP to Level {levelValue + 1}
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Wallet Address */}
          <div className="flex items-center space-x-2 p-3 bg-background/50 rounded-lg">
            <span className="text-sm font-mono flex-1">{formatAddress(userAddress)}</span>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6"
              onClick={() => navigator.clipboard.writeText(userAddress)}
            >
              <Copy className="w-3 h-3" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6"
              onClick={() => window.open(`https://testnet.snowtrace.io/address/${userAddress}`, '_blank')}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>

          {/* Action Buttons */}
          {!isOwnProfile && (
            <div className="flex gap-2 mt-4">
              <Button
                variant={isUserFollowing ? "secondary" : "default"}
                size="sm"
                onClick={handleFollowToggle}
              >
                <Heart className="w-4 h-4 mr-2" />
                {isUserFollowing ? "Following" : "Follow"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendKudos}
              >
                <Star className="w-4 h-4 mr-2" />
                Kudos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendTip}
              >
                <Gift className="w-4 h-4 mr-2" />
                Tip
              </Button>
            </div>
          )}

          {/* Profile Info */}
          <div className="grid grid-cols-2 gap-4">
            {profile?.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{profile.location}</span>
              </div>
            )}
            {profile?.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Website
                </a>
              </div>
            )}
          </div>

          {/* Social Links */}
          {(profile?.social_links?.twitter || profile?.social_links?.github) && (
            <div className="flex items-center justify-center gap-3">
              {profile?.social_links?.twitter && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0" 
                  onClick={() => window.open(`https://twitter.com/${profile.social_links?.twitter?.replace('@', '')}`, '_blank')}
                >
                  <Twitter className="w-4 h-4" />
                </Button>
              )}
              {profile?.social_links?.github && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0" 
                  onClick={() => window.open(`https://github.com/${profile.social_links?.github}`, '_blank')}
                >
                  <Github className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* On-Chain Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-4 text-center">
            <Coins className="w-8 h-8 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{formatNumber(forgeBalance)}</div>
            <div className="text-xs text-muted-foreground">{symbol} Tokens</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-4 text-center">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-accent" />
            <div className="text-2xl font-bold">{badgeCount}</div>
            <div className="text-xs text-muted-foreground">NFT Badges</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-4 text-center">
            <Crown className="w-8 h-8 mx-auto mb-2 text-secondary" />
            <div className="text-2xl font-bold">{passBalance}</div>
            <div className="text-xs text-muted-foreground">Forge Passes</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-success" />
            <div className="text-2xl font-bold">{parseFloat(userStaked) > 0 ? formatNumber(userStaked) : '0'}</div>
            <div className="text-xs text-muted-foreground">Staked Tokens</div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Streaks */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Activity Streaks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-background/50 rounded-lg">
              <div className="text-2xl font-bold text-orange-500 mb-1">
                {questStreak.currentStreak ? Number(questStreak.currentStreak) : 0}
              </div>
              <div className="text-sm text-muted-foreground">Quest Streak</div>
              <div className="text-xs text-muted-foreground mt-1">
                Best: {questStreak.longestStreak ? Number(questStreak.longestStreak) : 0}
              </div>
            </div>
            
            <div className="text-center p-4 bg-background/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-500 mb-1">
                {loginStreak.currentStreak ? Number(loginStreak.currentStreak) : 0}
              </div>
              <div className="text-sm text-muted-foreground">Login Streak</div>
              <div className="text-xs text-muted-foreground mt-1">
                Best: {loginStreak.longestStreak ? Number(loginStreak.longestStreak) : 0}
              </div>
            </div>
            
            <div className="text-center p-4 bg-background/50 rounded-lg">
              <div className="text-2xl font-bold text-green-500 mb-1">
                {socialStreak.currentStreak ? Number(socialStreak.currentStreak) : 0}
              </div>
              <div className="text-sm text-muted-foreground">Social Streak</div>
              <div className="text-xs text-muted-foreground mt-1">
                Best: {socialStreak.longestStreak ? Number(socialStreak.longestStreak) : 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staking & Rewards */}
      {(parseFloat(userStaked) > 0 || parseFloat(userRewards) > 0) && (
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Staking & Rewards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-background/50 rounded-lg">
                <div className="text-2xl font-bold text-primary mb-1">
                  {formatNumber(userStaked)}
                </div>
                <div className="text-sm text-muted-foreground">Staked FORGE</div>
              </div>
              
              <div className="text-center p-4 bg-background/50 rounded-lg">
                <div className="text-2xl font-bold text-accent mb-1">
                  {formatNumber(userRewards)}
                </div>
                <div className="text-sm text-muted-foreground">Pending Rewards</div>
              </div>
              
              <div className="text-center p-4 bg-background/50 rounded-lg">
                <div className="text-2xl font-bold text-success mb-1">
                  {apy.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Current APY</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Badge Collection */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-accent" />
            Achievement Badges
            <Badge variant="outline">{badgeCount}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {badgeCount > 0 ? (
              Array.from({ length: badgeCount }).map((_, index) => (
                <div key={`badge-${index}`} className="text-center p-3 bg-background/50 rounded-lg">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-accent flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-accent-foreground" />
                  </div>
                  <div className="text-xs font-medium">Achievement #{index + 1}</div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No badges earned yet</p>
                <p className="text-xs">Complete quests to earn your first badge!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}