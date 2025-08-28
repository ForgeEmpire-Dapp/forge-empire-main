import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Target, 
  Users, 
  Heart, 
  Coffee, 
  TrendingUp,
  Sparkles,
  ChevronRight,
  Clock,
  Star,
  Zap,
  Gift,
  MessageSquare,
  Vote,
  Coins
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useUserXP, useUserLevel } from '@/hooks/contracts'
import { useProfileRegistry } from '@/hooks/useProfileRegistry'
import { ContextualHelpIcon } from '@/components/help/ContextualHelp'

interface QuickAction {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
  category: 'essential' | 'social' | 'defi' | 'governance'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: string
  xpReward?: number
  comingSoon?: boolean
  requiresProfile?: boolean
  requiresXP?: number
}

const quickActions: QuickAction[] = [
  {
    id: 'complete-quests',
    title: 'Complete Quests',
    description: 'Earn XP and badges by completing platform challenges',
    icon: Target,
    href: '/quests',
    color: 'primary',
    category: 'essential',
    difficulty: 'beginner',
    estimatedTime: '5-15 min',
    xpReward: 100
  },
  {
    id: 'dynamic-quests',
    title: 'AI Quests',
    description: 'Try personalized quests powered by artificial intelligence',
    icon: Sparkles,
    href: '/dynamic-quests',
    color: 'accent',
    category: 'essential',
    difficulty: 'intermediate',
    estimatedTime: '10-30 min',
    xpReward: 200,
    comingSoon: true
  },
  {
    id: 'social-hub',
    title: 'Join Community',
    description: 'Connect with builders and share your progress',
    icon: Users,
    href: '/social',
    color: 'secondary',
    category: 'social',
    difficulty: 'beginner',
    estimatedTime: '2-5 min',
    requiresProfile: true
  },
  {
    id: 'send-kudos',
    title: 'Send Kudos',
    description: 'Appreciate community members with kudos tokens',
    icon: Heart,
    href: '/kudos',
    color: 'success',
    category: 'social',
    difficulty: 'beginner',
    estimatedTime: '1-2 min',
    requiresProfile: true
  },
  {
    id: 'activity-streaks',
    title: 'Build Streaks',
    description: 'Maintain daily activity for bonus rewards',
    icon: TrendingUp,
    href: '/streaks',
    color: 'warning',
    category: 'essential',
    difficulty: 'beginner',
    estimatedTime: 'Daily',
    comingSoon: true
  },
  {
    id: 'dao-governance',
    title: 'Vote on Proposals',
    description: 'Participate in platform governance decisions',
    icon: Vote,
    href: '/dao',
    color: 'primary',
    category: 'governance',
    difficulty: 'intermediate',
    estimatedTime: '5-10 min',
    requiresXP: 100
  },
  {
    id: 'tip-jar',
    title: 'Support Creators',
    description: 'Tip your favorite content creators',
    icon: Gift,
    href: '/tip-jar',
    color: 'accent',
    category: 'social',
    difficulty: 'beginner',
    estimatedTime: '1-2 min'
  }
]

const categoryColors = {
  essential: 'bg-primary/10 text-primary',
  social: 'bg-secondary/10 text-secondary',
  defi: 'bg-destructive/10 text-destructive',
  governance: 'bg-accent/10 text-accent'
}

const difficultyColors = {
  beginner: 'bg-success/10 text-success',
  intermediate: 'bg-warning/10 text-warning',
  advanced: 'bg-destructive/10 text-destructive'
}

export const QuickActionsHub = () => {
  const { isConnected } = useAccount()
  const { data: userXP } = useUserXP()
  const { data: userLevel } = useUserLevel()
  const { hasProfile } = useProfileRegistry()

  const xpValue = userXP ? Number(userXP) : 0
  const levelValue = userLevel ? Number(userLevel) : 1

  const getAvailableActions = () => {
    return quickActions.filter(action => {
      if (!isConnected) return false
      if (action.requiresProfile && !hasProfile) return false
      if (action.requiresXP && xpValue < action.requiresXP) return false
      return true
    })
  }

  const getRecommendedActions = () => {
    const available = getAvailableActions()
    
    if (!hasProfile) {
      return available.filter(action => action.id === 'complete-quests').slice(0, 3)
    }
    
    if (xpValue < 100) {
      return available.filter(action => 
        ['complete-quests', 'social-hub', 'send-kudos'].includes(action.id)
      )
    }
    
    return available.filter(action => action.difficulty !== 'beginner').slice(0, 3)
  }

  const recommendedActions = getRecommendedActions()
  const allActions = getAvailableActions()

 

  return (
    <div className="space-y-6">
      {/* Recommended Actions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold">Recommended for You</h3>
            <ContextualHelpIcon
              title="Personalized Recommendations"
              content="These actions are tailored to your current progress and experience level. Complete them to unlock more advanced features."
              category="beginner"
              tips={[
                'Start with essential actions to build your foundation',
                'Social actions help you connect with the community',
                'Advanced actions unlock as you gain more XP'
              ]}
            />
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            Level {levelValue}
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendedActions.map((action, index) => (
            <QuickActionCard
              key={action.id}
              action={action}
              index={index}
              isRecommended={true}
            />
          ))}
        </div>
      </div>

      {/* All Actions by Category */}
      <div>
        <h3 className="text-xl font-semibold mb-4">All Actions</h3>
        
        {['essential', 'social', 'defi', 'governance'].map(category => {
          const categoryActions = allActions.filter(action => action.category === category)
          if (categoryActions.length === 0) return null

          return (
            <div key={category} className="mb-6">
              <h4 className="text-lg font-medium mb-3 capitalize flex items-center gap-2">
                {category === 'essential' && <Zap className="h-4 w-4" />}
                {category === 'social' && <Users className="h-4 w-4" />}
                {category === 'defi' && <Coins className="h-4 w-4" />}
                {category === 'governance' && <Vote className="h-4 w-4" />}
                {category} Actions
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {categoryActions.map((action, index) => (
                  <QuickActionCard
                    key={action.id}
                    action={action}
                    index={index}
                    isRecommended={false}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface QuickActionCardProps {
  action: QuickAction
  index: number
  isRecommended: boolean
}

const QuickActionCard = ({ action, index, isRecommended }: QuickActionCardProps) => {
  const Icon = action.icon

  return (
    <Card 
      className={`group hover:shadow-lg transition-all duration-200 hover-lift ${
        isRecommended ? 'ring-2 ring-primary/20' : ''
      }`}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className={`p-2 rounded-lg bg-${action.color}/10`}>
              <Icon className={`h-5 w-5 text-${action.color}`} />
            </div>
            <div className="flex flex-col gap-1">
              <Badge 
                variant="outline" 
                className={`text-xs ${categoryColors[action.category]}`}
              >
                {action.category}
              </Badge>
              <Badge 
                variant="outline" 
                className={`text-xs ${difficultyColors[action.difficulty]}`}
              >
                {action.difficulty}
              </Badge>
            </div>
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm">{action.title}</h4>
              {action.comingSoon && (
                <Badge variant="secondary" className="text-xs animate-bounce-gentle">
                  Soon
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {action.description}
            </p>
          </div>

          {/* Meta Info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {action.estimatedTime}
            </div>
            {action.xpReward && (
              <div className="flex items-center gap-1 text-accent">
                <Star className="h-3 w-3" />
                {action.xpReward} XP
              </div>
            )}
          </div>

          {/* Action Button */}
          <Button 
            variant={isRecommended ? "default" : "outline"}
            size="sm" 
            asChild={!action.comingSoon}
            disabled={action.comingSoon}
            className={`w-full transition-colors ${
              isRecommended 
                ? 'glow-primary' 
                : 'group-hover:bg-primary group-hover:text-primary-foreground'
            }`}
          >
            {action.comingSoon ? (
              <span>Coming Soon</span>
            ) : (
              <Link to={action.href} className="flex items-center justify-center gap-1">
                Get Started
                <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}