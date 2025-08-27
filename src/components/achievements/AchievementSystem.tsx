import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Trophy, 
  Star, 
  Zap, 
  Target, 
  Users, 
  X,
  Sparkles
} from 'lucide-react'

declare global {
  interface Window {
    triggerAchievement: ((achievementId: string) => void) | undefined;
  }
}

interface Achievement {
  id: string
  title: string
  description: string
  icon: React.ComponentType
  type: 'xp' | 'badge' | 'social' | 'quest'
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  xpReward?: number
}

const achievements: Achievement[] = [
  {
    id: 'first-connection',
    title: 'Welcome Aboard!',
    description: 'Connected your wallet for the first time',
    icon: Zap,
    type: 'xp',
    rarity: 'common',
    xpReward: 100
  },
  {
    id: 'profile-created',
    title: 'Identity Forged',
    description: 'Created your profile and set a username',
    icon: Users,
    type: 'badge',
    rarity: 'common',
    xpReward: 150
  },
  {
    id: 'first-quest',
    title: 'Quest Beginner',
    description: 'Completed your first quest',
    icon: Target,
    type: 'quest',
    rarity: 'common',
    xpReward: 200
  },
  {
    id: 'level-up',
    title: 'Level Up!',
    description: 'Reached a new level',
    icon: Star,
    type: 'xp',
    rarity: 'rare',
    xpReward: 500
  }
]

interface AchievementToastProps {
  achievement: Achievement
  onClose: () => void
}

const AchievementToast = ({ achievement, onClose }: AchievementToastProps) => {
  const Icon = achievement.icon
  
  const rarityColors = {
    common: 'from-gray-500 to-gray-600',
    rare: 'from-blue-500 to-blue-600', 
    epic: 'from-purple-500 to-purple-600',
    legendary: 'from-yellow-500 to-orange-500'
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <Card className="fixed top-4 right-4 z-50 w-80 animate-slide-in-right shadow-lg border-2">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <div className={`
              w-12 h-12 rounded-full bg-gradient-to-r ${rarityColors[achievement.rarity]} 
              flex items-center justify-center
            `}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm">{achievement.title}</h4>
                <Badge variant="secondary" className="text-xs">
                  {achievement.rarity}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {achievement.description}
              </p>
              {achievement.xpReward && (
                <div className="flex items-center gap-1 mt-2">
                  <Sparkles className="h-3 w-3 text-yellow-500" />
                  <span className="text-xs font-medium">+{achievement.xpReward} XP</span>
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface AchievementState {
  achievement: Achievement
  id: string
}

export const AchievementSystem = () => {
  const [activeAchievements, setActiveAchievements] = useState<AchievementState[]>([])

  const showAchievement = (achievementId: string) => {
    const achievement = achievements.find(a => a.id === achievementId)
    if (achievement) {
      const id = Date.now().toString()
      setActiveAchievements(prev => [...prev, { achievement, id }])
    }
  }

  const closeAchievement = (id: string) => {
    setActiveAchievements(prev => prev.filter(a => a.id !== id))
  }

  // Expose the function globally so other components can trigger achievements
  useEffect(() => {
    ;window.triggerAchievement = showAchievement
    return () => {
      delete window.triggerAchievement
    }
  }, [])

  return (
    <>
      {activeAchievements.map(({ achievement, id }) => (
        <AchievementToast
          key={id}
          achievement={achievement}
          onClose={() => closeAchievement(id)}
        />
      ))}
    </>
  )
}

// Utility function to trigger achievements from anywhere
export const triggerAchievement = (achievementId: string) => {
  if (window.triggerAchievement) {
    ;window.triggerAchievement(achievementId)
  }
}