import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Target, Clock, Coins, CheckCircle, AlertCircle, Trophy } from "lucide-react"
import { NextStepConfig } from '@/hooks/useOnboardingQuests'

interface QuestCardProps {
  step: number
  config: NextStepConfig
  isOnboarding?: boolean
  progress?: number
  isCompleted?: boolean
}

export const QuestCard = ({ 
  step, 
  config, 
  isOnboarding = false, 
  progress = 0, 
  isCompleted = false 
}: QuestCardProps) => {
  const formatTimeLimit = (timeLimit: bigint) => {
    const hours = Number(timeLimit) / 3600
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
  }

  const getStepBadgeVariant = (stepNumber: number) => {
    if (isCompleted) return "default"
    if (stepNumber === 1) return "destructive"
    return "secondary"
  }

  return (
    <Card className="bg-gradient-card border-border/50 animate-fade-in hover-scale">
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {isCompleted ? (
              <CheckCircle className="w-6 h-6 text-green-500" />
            ) : (
              <Target className="w-6 h-6 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{config.title}</CardTitle>
            <p className="text-sm text-muted-foreground mb-3">
              {config.description}
            </p>
            {config.instructions && (
              <div className="bg-muted/50 rounded-lg p-3 mb-3">
                <p className="text-sm font-medium flex items-center mb-1">
                  <AlertCircle className="w-4 h-4 mr-2 text-primary" />
                  Instructions
                </p>
                <p className="text-sm text-muted-foreground">
                  {config.instructions}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end space-y-2">
          <Badge variant={getStepBadgeVariant(step)}>
            {isOnboarding ? `Step ${step}` : `Quest #${step}`}
          </Badge>
          {!config.isActive && (
            <Badge variant="outline" className="text-xs">
              Inactive
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress bar if applicable */}
        {progress > 0 && progress < 100 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Quest details */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-muted-foreground">
              <Coins className="w-4 h-4 mr-1" />
              <span>{config.xpReward.toString()} XP</span>
            </div>
            {config.timeLimit > 0 && (
              <div className="flex items-center text-muted-foreground">
                <Clock className="w-4 h-4 mr-1" />
                <span>{formatTimeLimit(config.timeLimit)} limit</span>
              </div>
            )}
          </div>
          
          <div className="flex space-x-2">
            {isCompleted ? (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                Completed
              </Badge>
            ) : config.isActive ? (
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                Start Quest
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                Coming Soon
              </Button>
            )}
          </div>
        </div>

        {/* Badge preview if available */}
        {config.badgeURI && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">Reward Badge</p>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center">
                <Trophy className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium">Achievement Badge</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}