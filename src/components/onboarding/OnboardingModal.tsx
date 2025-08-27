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
  Circle
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { useProfileRegistry } from '@/hooks/useProfileRegistry'
import { Link } from 'react-router-dom'

interface OnboardingStep {
  id: string
  title: string
  description: string
  action: string
  actionHref?: string
  icon: React.ComponentType
  completed?: boolean
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'connect-wallet',
    title: 'Connect Your Wallet',
    description: 'Connect your MetaMask or other compatible wallet to get started with Avax Forge Empire.',
    action: 'Connect Wallet',
    icon: Wallet
  },
  {
    id: 'create-profile',
    title: 'Create Your Profile',
    description: 'Set up your username and personalize your profile to join the community.',
    action: 'Set Up Profile',
    actionHref: '/profile',
    icon: User
  },
  {
    id: 'first-quest',
    title: 'Complete Your First Quest',
    description: 'Start earning XP by completing your first quest and learning about the ecosystem.',
    action: 'View Quests',
    actionHref: '/quests',
    icon: Target
  },
  {
    id: 'earn-badge',
    title: 'Earn Your First Badge',
    description: 'Complete achievements to earn badges and show off your progress.',
    action: 'View Achievements',
    actionHref: '/profile',
    icon: Trophy
  }
]

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
}

export const OnboardingModal = ({ isOpen, onClose }: OnboardingModalProps) => {
  const [currentStep, setCurrentStep] = useState(0)
  const { isConnected } = useAccount()
  const { hasProfile } = useProfileRegistry()

  // Update step completion status
  const getUpdatedSteps = (): OnboardingStep[] => {
    return onboardingSteps.map(step => ({
      ...step,
      completed: 
        (step.id === 'connect-wallet' && isConnected) ||
        (step.id === 'create-profile' && hasProfile) ||
        false // These would need real completion tracking
    }))
  }

  const steps = getUpdatedSteps()
  const completedSteps = steps.filter(step => step.completed).length
  const progressPercent = (completedSteps / steps.length) * 100

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

  if (!isOpen) return null

  const currentStepData = steps[currentStep]
  const Icon = currentStepData.icon

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl mx-auto animate-scale-in">
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Welcome to Avax Forge Empire!</CardTitle>
              <p className="text-muted-foreground mt-1">
                Let's get you started with a quick tour
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSkip}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Progress</span>
              <span>{completedSteps}/{steps.length} completed</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step Navigation */}
          <div className="flex justify-center space-x-2">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentStep 
                    ? 'bg-primary scale-125' 
                    : index < currentStep 
                      ? 'bg-primary/60' 
                      : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Current Step */}
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Icon className="h-8 w-8 text-primary" />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-xl font-semibold">{currentStepData.title}</h3>
                {currentStepData.completed && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
              </div>
              <p className="text-muted-foreground max-w-md mx-auto">
                {currentStepData.description}
              </p>
            </div>

            {/* Action Button */}
            <div className="pt-4">
              {currentStepData.actionHref ? (
                <Button asChild className="min-w-32">
                  <Link to={currentStepData.actionHref} onClick={onClose}>
                    {currentStepData.action}
                  </Link>
                </Button>
              ) : (
                <Button className="min-w-32" disabled={currentStepData.completed}>
                  {currentStepData.completed ? 'Completed' : currentStepData.action}
                </Button>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button 
              variant="outline" 
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleSkip}>
                Skip Tour
              </Button>
              <Button 
                onClick={handleNext}
                disabled={currentStep === steps.length - 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export const useOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const { isConnected } = useAccount()

  useEffect(() => {
    // Check if user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem('onboarding-completed')
    
    // Show onboarding for new users who just connected
    if (isConnected && !hasCompletedOnboarding) {
      const timer = setTimeout(() => {
        setShowOnboarding(true)
      }, 1000) // Small delay for better UX

      return () => clearTimeout(timer)
    }
  }, [isConnected])

  const closeOnboarding = () => {
    setShowOnboarding(false)
    localStorage.setItem('onboarding-completed', 'true')
  }

  return {
    showOnboarding,
    closeOnboarding
  }
}