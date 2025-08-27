import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CheckCircle, Circle, ArrowRight, Gift, Star, Zap, Users, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAccount } from 'wagmi'
import { useOnboardingQuests, useStepConfig } from '@/hooks/useOnboardingQuests'

// Define OnboardingStep enum values as they are in the contract
enum OnboardingStep {
  PROFILE_CREATION,      // 0
  QUEST_EXPLORATION,     // 1
  COMMUNITY_INTERACTION, // 2
  TOKEN_ACTIVITY,        // 3
  DAO_PARTICIPATION      // 4
}

interface TutorialStep {
  id: OnboardingStep // Use the enum for ID
  title: string
  description: string
  action: string
  icon: React.ComponentType<{ className?: string }>
  category: 'wallet' | 'profile' | 'quest' | 'social' | 'advanced' // Still useful for UI categorization
}

// Map contract steps to local UI representation
const contractStepsMap: Record<OnboardingStep, Omit<TutorialStep, 'id' | 'completed' | 'xpReward' | 'tokenReward'>> = {
  [OnboardingStep.PROFILE_CREATION]: {
    title: "Create Your Profile",
    description: "Set up your unique identity in the Forge Empire",
    action: "Go to Profile settings and choose a username",
    icon: Star,
    category: 'profile'
  },
  [OnboardingStep.QUEST_EXPLORATION]: {
    title: "Discover Quests",
    description: "Learn about the quest system and rewards",
    action: "Visit the Quests page and browse available challenges",
    icon: Target,
    category: 'quest'
  },
  [OnboardingStep.COMMUNITY_INTERACTION]: {
    title: "Join the Community",
    description: "Connect with other users and start building relationships",
    action: "Follow another user or send kudos to someone",
    icon: Users,
    category: 'social'
  },
  [OnboardingStep.TOKEN_ACTIVITY]: {
    title: "Enter DeFi",
    description: "Make your first trade or stake tokens",
    action: "Use TokenLauncher to trade or StakingRewards to stake",
    icon: Zap,
    category: 'advanced'
  },
  [OnboardingStep.DAO_PARTICIPATION]: {
    title: "Become a Citizen",
    description: "Participate in governance and shape the future",
    action: "Cast your first vote in an active DAO proposal",
    icon: CheckCircle,
    category: 'advanced'
  }
}

interface OnboardingTutorialProps {
  className?: string
}

export const OnboardingTutorial = ({ className }: OnboardingTutorialProps) => {
  const { isConnected, address } = useAccount()
  const { 
    startOnboarding, 
    completeStep, 
    userProgress, 
    nextStep, 
    isProcessing, 
    refetchUserProgress, 
    refetchNextStep 
  } = useOnboardingQuests()

  const [showWelcome, setShowWelcome] = useState(false)

  // Auto-start onboarding if connected and not started
  useEffect(() => {
    if (isConnected && userProgress && userProgress.startedAt === 0n) {
      setShowWelcome(true)
    }
  }, [isConnected, userProgress])

  // Handle welcome modal dismiss and start onboarding
  const handleWelcomeDismiss = async () => {
    setShowWelcome(false)
    if (userProgress?.startedAt === 0n) {
      await startOnboarding()
    }
  }

  // Determine current step and completed steps based on on-chain data
  const currentStepIndex = userProgress?.currentStep || 0
  const completedStepsBitmask = userProgress?.completedSteps || 0n

  const steps = Object.values(OnboardingStep).filter(value => typeof value === 'number').map(stepEnum => {
    const stepId = stepEnum as OnboardingStep
    const config = contractStepsMap[stepId]
    const { data: stepConfigFromContract } = useStepConfig(stepId)

    const isCompleted = (completedStepsBitmask & (1n << BigInt(stepId))) !== 0n
    const xpReward = stepConfigFromContract?.xpReward ? Number(stepConfigFromContract.xpReward) : 0
    const badgeURI = stepConfigFromContract?.badgeURI || ''

    return {
      id: stepId,
      title: stepConfigFromContract?.title || config.title,
      description: stepConfigFromContract?.description || config.description,
      action: config.action,
      completed: isCompleted,
      xpReward: xpReward,
      tokenReward: 0, // On-chain contract only awards XP and badges, not generic tokens
      icon: config.icon,
      category: config.category,
      badgeURI: badgeURI,
    }
  })

  const totalSteps = steps.length
  const actualCompletedStepsCount = steps.filter(s => s.completed).length
  const progress = (actualCompletedStepsCount / totalSteps) * 100

  const totalRewards = steps
    .filter(step => step.completed)
    .reduce((acc, step) => ({
      xp: acc.xp + step.xpReward,
      tokens: acc.tokens + (step.tokenReward || 0)
    }), { xp: 0, tokens: 0 })

  const nextIncompleteStep = steps.find(step => !step.completed)

  const handleCompleteStep = async (stepId: OnboardingStep) => {
    await completeStep(stepId)
  }

  // Refetch progress when a transaction is processed
  useEffect(() => {
    if (!isProcessing) {
      refetchUserProgress()
      refetchNextStep()
    }
  }, [isProcessing, refetchUserProgress, refetchNextStep])

  return (
    <>
      {/* Welcome Dialog */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-6 h-6 text-primary" />
              Welcome to Avax Forge Empire!
            </DialogTitle>
            <DialogDescription>
              You've successfully connected your wallet! Complete the onboarding tutorial to earn your first rewards and learn how to maximize your experience.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gradient-primary p-4 rounded-lg">
              <h4 className="font-semibold text-primary-foreground mb-2">
                Tutorial Rewards
              </h4>
              <div className="flex gap-2">
                <Badge className="bg-primary-foreground/20 text-primary-foreground">
                  Total: +{steps.reduce((sum, step) => sum + step.xpReward, 0)} XP
                </Badge>
                {/* Removed SFORGE token reward as contract only awards XP and badges */}
              </div>
            </div>
            <Button onClick={handleWelcomeDismiss} className="w-full">
              Start Tutorial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tutorial Progress Card */}
      <Card className={cn("bg-gradient-card border-border/50", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Onboarding Tutorial
            </CardTitle>
            <Badge variant={actualCompletedStepsCount === totalSteps ? "default" : "outline"}>
              {actualCompletedStepsCount}/{totalSteps} Complete
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Rewards Summary */}
          <div className="flex gap-4 p-3 bg-muted/30 rounded-lg">
            <div className="text-center">
              <div className="font-semibold text-accent">{totalRewards.xp}</div>
              <div className="text-xs text-muted-foreground">XP Earned</div>
            </div>
            {/* Removed SFORGE token reward as contract only awards XP and badges */}
            <div className="text-center">
              <div className="font-semibold text-secondary">{actualCompletedStepsCount}</div>
              <div className="text-xs text-muted-foreground">Steps Done</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {steps.map((step) => {
            const Icon = step.icon
            const isActive = !step.completed && step.id === currentStepIndex // Check against currentStepIndex
            
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border transition-all duration-200",
                  step.completed 
                    ? "bg-success/10 border-success/30"
                    : isActive
                    ? "bg-primary/10 border-primary/30 shadow-primary"
                    : "bg-muted/30 border-border/50"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2",
                  step.completed
                    ? "bg-success text-success-foreground border-success"
                    : isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-muted-foreground"
                )}>
                  {step.completed ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={cn(
                      "font-medium",
                      step.completed && "line-through text-muted-foreground"
                    )}>
                      {step.title}
                    </h4>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs",
                        step.category === 'wallet' && "border-warning text-warning",
                        step.category === 'profile' && "border-accent text-accent",
                        step.category === 'quest' && "border-primary text-primary",
                        step.category === 'social' && "border-secondary text-secondary",
                        step.category === 'advanced' && "border-success text-success"
                      )}
                    >
                      {step.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {step.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {step.action}
                  </p>
                </div>

                <div className="text-right">
                  <div className="flex gap-1 mb-2">
                    <Badge variant="outline" className="text-xs">
                      +{step.xpReward} XP
                    </Badge>
                    {step.tokenReward && (
                      <Badge variant="outline" className="text-xs text-primary">
                        +{step.tokenReward}
                      </Badge>
                    )}
                  </div>
                  
                  {!step.completed && step.id === currentStepIndex && (
                    <Button 
                      size="sm"
                      onClick={() => handleCompleteStep(step.id)}
                      className="text-xs h-7"
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Processing...' : 'Mark Done'}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Completion Celebration */}
          {actualCompletedStepsCount === totalSteps && (
            <div className="mt-6 p-6 bg-gradient-primary rounded-lg text-center">
              <Gift className="w-12 h-12 text-primary-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold text-primary-foreground mb-2">
                Tutorial Complete! 🎉
              </h3>
              <p className="text-primary-foreground/80 mb-4">
                You've mastered the basics of Avax Forge Empire. Now go forth and build your legacy!
              </p>
              <div className="flex justify-center gap-2">
                <Badge className="bg-primary-foreground/20 text-primary-foreground">
                  Total: +{steps.reduce((sum, step) => sum + step.xpReward, 0)} XP
                </Badge>
                {/* Removed SFORGE token reward as contract only awards XP and badges */}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}