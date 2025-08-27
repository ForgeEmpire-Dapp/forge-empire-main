import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Wallet, 
  User, 
  Target, 
  Trophy,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Play
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { useProfileRegistry } from '@/hooks/useProfileRegistry'
import { useUserXP } from '@/hooks/contracts'
import { Link } from 'react-router-dom'

interface OnboardingStep {
  id: string
  title: string
  description: string
  action: string
  actionHref?: string
  icon: React.ComponentType
  completed?: boolean
  reward?: string
  tips?: string[]
}

const getOnboardingSteps = (isConnected: boolean, hasProfile: boolean, userXP: number): OnboardingStep[] => [
  {
    id: 'connect-wallet',
    title: 'Connect Your Wallet',
    description: 'Connect your MetaMask or other compatible wallet to unlock the full Avax Forge Empire experience.',
    action: 'Connect Wallet',
    icon: Wallet,
    completed: isConnected,
    reward: '50 XP',
    tips: ['Make sure you have some AVAX for gas fees', 'Switch to Avalanche network if needed']
  },
  {
    id: 'create-profile',
    title: 'Create Your Profile',
    description: 'Set up your username and personalize your profile to join our thriving community.',
    action: 'Set Up Profile',
    actionHref: '/profile',
    icon: User,
    completed: hasProfile,
    reward: '100 XP',
    tips: ['Choose a unique username', 'Add a profile picture and bio']
  },
  {
    id: 'first-quest',
    title: 'Complete Your First Quest',
    description: 'Start earning XP by completing your first quest and learning about the Avalanche ecosystem.',
    action: 'View Quests',
    actionHref: '/quests',
    icon: Target,
    completed: userXP > 0,
    reward: '200 XP + Badge',
    tips: ['Start with beginner quests', 'Read instructions carefully']
  },
  {
    id: 'explore-features',
    title: 'Explore Features',
    description: 'Discover token forge, DAO governance, and social features to maximize your empire.',
    action: 'Explore Platform',
    actionHref: '/forge',
    icon: Sparkles,
    completed: false,
    reward: 'Achievement Badge',
    tips: ['Try creating a token', 'Join governance discussions', 'Connect with other users']
  },
  {
    id: 'earn-badge',
    title: 'Earn Your First Badge',
    description: 'Complete achievements to earn badges and show off your progress to the community.',
    action: 'View Achievements',
    actionHref: '/profile',
    icon: Trophy,
    completed: false,
    reward: 'Special Badge',
    tips: ['Check achievement requirements', 'Badges unlock new features']
  }
]

interface EnhancedOnboardingProps {
  isOpen: boolean
  onClose: () => void
}

export const EnhancedOnboarding = ({ isOpen, onClose }: EnhancedOnboardingProps) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [showTutorialMode, setShowTutorialMode] = useState(false)
  const { isConnected } = useAccount()
  const { hasProfile } = useProfileRegistry()
  const { data: userXP } = useUserXP()

  const xpValue = userXP ? Number(userXP) : 0
  const steps = getOnboardingSteps(isConnected, hasProfile, xpValue)
  const completedSteps = steps.filter(step => step.completed).length
  const progressPercent = (completedSteps / steps.length) * 100

  useEffect(() => {
    // Auto-advance to next incomplete step
    const nextIncompleteStep = steps.findIndex(step => !step.completed)
    if (nextIncompleteStep !== -1 && nextIncompleteStep !== currentStep) {
      setCurrentStep(nextIncompleteStep)
    }
  }, [isConnected, hasProfile, xpValue, steps, currentStep])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    localStorage.setItem('onboarding-completed', 'true')
    onClose()
  }

  const startTutorial = () => {
    setShowTutorialMode(true)
    setCurrentStep(0)
  }

  if (!isOpen) return null

  const currentStepData = steps[currentStep]
  const Icon = currentStepData.icon

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl mx-auto animate-scale-in shadow-2xl border-2">
        <CardHeader className="relative bg-gradient-primary text-primary-foreground rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Sparkles className="h-8 w-8" />
                Welcome to Avax Forge Empire!
              </CardTitle>
              <p className="text-primary-foreground/90 mt-2 text-lg">
                Let's get you started on your empire-building journey
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSkip} className="text-primary-foreground hover:bg-primary-foreground/20">
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Enhanced Progress */}
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-3">
              <span className="font-semibold">Your Progress</span>
              <span className="flex items-center gap-1">
                <Trophy className="h-4 w-4" />
                {completedSteps}/{steps.length} completed
              </span>
            </div>
            <Progress value={progressPercent} className="h-3 bg-primary-foreground/20" />
            {progressPercent === 100 && (
              <div className="mt-2 text-center animate-bounce-gentle">
                <span className="text-sm font-semibold">🎉 Congratulations! Empire Founded! 🎉</span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-8">
          {/* Interactive Step Navigation */}
          <div className="flex justify-center space-x-3">
            {steps.map((step, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`relative w-4 h-4 rounded-full transition-all duration-300 ${
                  index === currentStep 
                    ? 'bg-primary scale-125 shadow-lg' 
                    : step.completed
                      ? 'bg-success scale-110' 
                      : index < currentStep 
                        ? 'bg-primary/60' 
                        : 'bg-muted hover:bg-muted-foreground/20'
                }`}
              >
                {step.completed && (
                  <CheckCircle className="absolute inset-0 w-4 h-4 text-white scale-75" />
                )}
              </button>
            ))}
          </div>

          {/* Enhanced Current Step Display */}
          <div className="text-center space-y-6">
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
              currentStepData.completed 
                ? 'bg-success/20 border-2 border-success' 
                : 'bg-primary/10 border-2 border-primary/20'
            } animate-scale-in`}>
              <Icon className={`h-10 w-10 ${
                currentStepData.completed ? 'text-success' : 'text-primary'
              }`} />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3">
                <h3 className="text-2xl font-bold">{currentStepData.title}</h3>
                {currentStepData.completed && (
                  <Badge variant="secondary" className="bg-success text-success-foreground animate-bounce-gentle">
                    ✓ Complete
                  </Badge>
                )}
                {currentStepData.reward && (
                  <Badge variant="outline" className="border-accent text-accent">
                    🎁 {currentStepData.reward}
                  </Badge>
                )}
              </div>
              
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
                {currentStepData.description}
              </p>

              {/* Tips Section */}
              {currentStepData.tips && currentStepData.tips.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4 max-w-md mx-auto">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                    💡 Pro Tips:
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {currentStepData.tips.map((tip) => (
                      <li key={tip} className="flex items-start gap-2">
                        <span className="text-accent">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Enhanced Action Button */}
            <div className="pt-4">
              {currentStepData.actionHref ? (
                <Button asChild size="lg" className="min-w-48 font-semibold glow-primary">
                  <Link to={currentStepData.actionHref} onClick={onClose} className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    {currentStepData.action}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button 
                  size="lg" 
                  className="min-w-48 font-semibold"
                  disabled={currentStepData.completed}
                >
                  {currentStepData.completed ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Completed
                    </>
                  ) : (
                    currentStepData.action
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Enhanced Navigation */}
          <div className="flex justify-between items-center pt-6 border-t">
            <Button 
              variant="outline" 
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <div className="flex gap-3">
              {!showTutorialMode && (
                <Button variant="ghost" onClick={startTutorial} className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  Interactive Tutorial
                </Button>
              )}
              <Button variant="ghost" onClick={handleSkip}>
                Skip for Now
              </Button>
              <Button 
                onClick={handleNext}
                disabled={currentStep === steps.length - 1}
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export const useEnhancedOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const { isConnected } = useAccount()

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('onboarding-completed')
    
    if (isConnected && !hasCompletedOnboarding) {
      const timer = setTimeout(() => {
        setShowOnboarding(true)
      }, 1500)

      return () => clearTimeout(timer)
    }
  }, [isConnected])

  const closeOnboarding = () => {
    setShowOnboarding(false)
    localStorage.setItem('onboarding-completed', 'true')
  }

  const reopenOnboarding = () => {
    setShowOnboarding(true)
  }

  return {
    showOnboarding,
    closeOnboarding,
    reopenOnboarding
  }
}