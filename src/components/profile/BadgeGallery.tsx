import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Award, Star, Crown, Zap, Shield, Trophy, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBadgeSystem } from '@/hooks/useBadgeSystem'
import { useAccount } from 'wagmi'

export interface NFTBadge {
  id: string
  name: string
  description: string
  imageUrl?: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  category: 'quest' | 'social' | 'trading' | 'governance' | 'achievement'
  earnedAt: Date
  xpReward?: number
}

interface BadgeGalleryProps {
  badges?: NFTBadge[]
  userAddress?: string
  className?: string
}

const rarityConfig = {
  common: {
    color: 'text-muted-foreground',
    bg: 'bg-muted/20',
    border: 'border-muted',
    glow: '',
    icon: Award
  },
  rare: {
    color: 'text-secondary',
    bg: 'bg-secondary/20', 
    border: 'border-secondary',
    glow: 'shadow-secondary',
    icon: Star
  },
  epic: {
    color: 'text-accent',
    bg: 'bg-accent/20',
    border: 'border-accent',
    glow: 'shadow-glow-accent',
    icon: Crown
  },
  legendary: {
    color: 'text-primary',
    bg: 'bg-primary/20',
    border: 'border-primary',
    glow: 'shadow-glow-primary animate-pulse-glow',
    icon: Trophy
  }
}

const categoryIcons = {
  quest: Zap,
  social: Star,
  trading: Trophy,
  governance: Crown,
  achievement: Shield
}

export const BadgeGallery = ({ badges = [], userAddress, className }: BadgeGalleryProps) => {
  const { address } = useAccount()
  const { 
    badgeBalance, 
    isProcessing,
    refetchBalance,
    isConnected 
  } = useBadgeSystem()
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  // Use contract data if no badges prop provided and viewing own profile
  const isOwnProfile = !userAddress || address?.toLowerCase() === userAddress.toLowerCase()
  const displayBadges = badges || []
  
  const categories = ['all', ...Array.from(new Set(displayBadges.map(b => b.category)))]
  const filteredBadges = selectedCategory === 'all' 
    ? displayBadges 
    : displayBadges.filter(b => b.category === selectedCategory)

  const badgesByRarity = filteredBadges.reduce((acc, badge) => {
    acc[badge.rarity] = (acc[badge.rarity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetchBalance()
    setTimeout(() => setRefreshing(false), 1000)
  }

  return (
    <TooltipProvider>
      <Card className={cn("bg-gradient-card border-border/50", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-accent" />
              Badge Collection 
              {isConnected && isOwnProfile && (
                <Badge variant="outline" className="animate-pulse">
                  {badgeBalance} NFT{badgeBalance !== 1 ? 's' : ''}
                </Badge>
              )}
              {displayBadges.length > 0 && (
                <Badge variant="secondary">
                  ({displayBadges.length} visible)
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {isConnected && isOwnProfile && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="hover-scale"
                >
                  {refreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </Button>
              )}
              <div className="flex gap-2">
                {Object.entries(badgesByRarity).map(([rarity, count]) => {
                  const config = rarityConfig[rarity as keyof typeof rarityConfig]
                  return (
                    <Badge key={rarity} variant="outline" className={config.color}>
                      {count} {rarity}
                    </Badge>
                  )
                })}
              </div>
            </div>
          </div>
          
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap",
                  selectedCategory === category
                    ? "bg-primary text-primary-foreground shadow-primary"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {/* Contract Statistics */}
          {isConnected && isOwnProfile && (
            <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gradient-subtle rounded-lg border border-primary/10">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{badgeBalance}</div>
                <div className="text-xs text-muted-foreground">Owned Badges</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary">{/* Removed userBadges.length */}</div>
                <div className="text-xs text-muted-foreground">Token IDs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">{/* Removed totalSupply */}</div>
                <div className="text-xs text-muted-foreground">Total Supply</div>
              </div>
            </div>
          )}

          {filteredBadges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Award className="w-12 h-12 mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">
                {isConnected && isOwnProfile && badgeBalance > 0 
                  ? "Badges Not Loaded" 
                  : "No Badges Yet"
                }
              </h3>
              <p className="text-center max-w-md">
                {isConnected && isOwnProfile && badgeBalance > 0 
                  ? "Your on-chain badges are detected but metadata loading is in development."
                  : "Complete quests and engage with the community to earn your first badges!"
                }
              </p>
              {isConnected && isOwnProfile && badgeBalance > 0 && (
                <Button onClick={handleRefresh} variant="outline" className="mt-4 hover-scale">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Refresh Badges
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {filteredBadges.map(badge => {
                const config = rarityConfig[badge.rarity]
                const CategoryIcon = categoryIcons[badge.category]
                const RarityIcon = config.icon

                return (
                  <Tooltip key={badge.id}>
                    <TooltipTrigger asChild>
                      <div 
                        className={cn(
                          "relative aspect-square rounded-lg p-4 border-2 transition-all duration-300 cursor-pointer hover-lift group",
                          config.bg,
                          config.border,
                          config.glow
                        )}
                      >
                        {/* Badge Image or Icon */}
                        <div className="flex items-center justify-center h-full">
                          {badge.imageUrl ? (
                            <img 
                              src={badge.imageUrl} 
                              alt={badge.name}
                              className="w-full h-full object-cover rounded-md"
                            />
                          ) : (
                            <CategoryIcon className={cn("w-8 h-8", config.color)} />
                          )}
                        </div>

                        {/* Rarity Indicator */}
                        <div className="absolute top-2 right-2">
                          <RarityIcon className={cn("w-4 h-4", config.color)} />
                        </div>

                        {/* XP Reward Badge */}
                        {badge.xpReward && (
                          <div className="absolute bottom-2 left-2">
                            <Badge 
                              variant="outline" 
                              className="text-xs bg-accent/90 text-accent-foreground border-accent"
                            >
                              +{badge.xpReward} XP
                            </Badge>
                          </div>
                        )}

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-end p-2">
                          <p className="text-xs font-medium text-foreground">{badge.name}</p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{badge.name}</span>
                          <Badge variant="outline" className={config.color}>
                            {badge.rarity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{badge.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CategoryIcon className="w-3 h-3" />
                          <span>{badge.category}</span>
                          <span>•</span>
                          <span>Earned {badge.earnedAt.toLocaleDateString()}</span>
                        </div>
                        {badge.xpReward && (
                          <div className="text-xs text-accent">
                            Rewarded {badge.xpReward} XP
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}