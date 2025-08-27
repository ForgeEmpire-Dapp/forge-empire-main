import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Star, Trophy, Loader2, Zap } from 'lucide-react'
import { useXPSystem } from '@/hooks/useXPSystem'
import { useAccount } from 'wagmi'

interface XPLevelCardProps {
  className?: string
}

export const XPLevelCard = ({ className }: XPLevelCardProps) => {
  const { isConnected } = useAccount()
  const { 
    userXP, 
    userLevel, 
    xpNeeded,
    progressPercentage,
    progressXP,
    totalXPAwarded,
    isProcessing 
  } = useXPSystem()

  if (!isConnected) {
    return (
      <Card className={className}>
        <CardContent className="py-6">
          <div className="flex flex-col items-center justify-center text-center">
            <Star className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Connect wallet to view XP progress</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentLevel = Number(userLevel || 0n)
  const totalXP = Number(userXP || 0n)
  const xpNeededForNext = Number(xpNeeded || 0n)
  const currentProgressXP = Number(progressXP || 0n)
  const globalXP = Number(totalXPAwarded || 0n)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Level Progress
          </div>
          <Badge variant="secondary" className="text-lg font-bold px-3 py-1">
            Level {currentLevel}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* XP Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-500">
              {totalXP.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Total XP</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {xpNeededForNext.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">XP to Next Level</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Level {currentLevel} Progress</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{currentProgressXP.toLocaleString()} XP</span>
            <span>{(currentProgressXP + xpNeededForNext).toLocaleString()} XP</span>
          </div>
        </div>

        {/* Level Milestones */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Level Rewards
          </h4>
          
          <div className="grid grid-cols-1 gap-2">
            {/* Next Level Preview */}
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-yellow-500" />
                <span className="text-xs">Level {currentLevel + 1} Reward</span>
              </div>
                <Badge variant="outline" className="text-xs">
                  {xpNeededForNext} XP to unlock
                </Badge>
            </div>

            {/* Global Stats */}
            {globalXP > 0 && (
              <div className="flex items-center justify-between p-2 bg-accent/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-accent-foreground" />
                  <span className="text-xs">Total Platform XP</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {globalXP.toLocaleString()}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* XP Sources */}
        <div className="pt-2 border-t">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Earn XP by:</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• Completing quests (+50-200 XP)</div>
            <div>• Daily login streaks (+10 XP)</div>
            <div>• Social interactions (+5-25 XP)</div>
            <div>• DAO participation (+100 XP)</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}