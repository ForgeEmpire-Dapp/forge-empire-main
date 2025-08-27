import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  FileX, 
  Users, 
  Target, 
  Trophy, 
  Heart,
  Coffee,
  TrendingUp,
  Sparkles,
  Plus,
  ExternalLink,
  Vote
} from 'lucide-react'
import { Link } from 'react-router-dom'

interface EmptyStateProps {
  icon?: React.ComponentType
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
    external?: boolean
  }
  children?: ReactNode
  className?: string
}

export const EmptyState = ({ 
  icon: Icon = FileX, 
  title, 
  description, 
  action,
  children,
  className = ''
}: EmptyStateProps) => {
  return (
    <Card className={`${className}`}>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground max-w-md mb-6">{description}</p>
        
        {action && (
          <div className="space-y-2">
            {action.href ? (
              <Button asChild>
                <Link to={action.href} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {action.label}
                  {action.external && <ExternalLink className="h-3 w-3" />}
                </Link>
              </Button>
            ) : (
              <Button onClick={action.onClick} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {action.label}
              </Button>
            )}
          </div>
        )}
        
        {children}
      </CardContent>
    </Card>
  )
}

// Pre-configured empty states for common scenarios
export const NoQuestsEmpty = () => (
  <EmptyState
    icon={Target}
    title="No Active Quests"
    description="You haven't started any quests yet. Complete quests to earn XP, badges, and climb the leaderboard!"
    action={{
      label: "Browse Quests",
      href: "/quests"
    }}
  />
)

export const NoSocialEmpty = () => (
  <EmptyState
    icon={Users}
    title="Welcome to the Social Hub"
    description="Start connecting with the community! Share your thoughts, follow other builders, and engage with posts."
    action={{
      label: "Create Your First Post",
      href: "/social"
    }}
  />
)

export const NoBadgesEmpty = () => (
  <EmptyState
    icon={Trophy}
    title="No Badges Yet"
    description="Complete quests and achievements to earn your first badges. Show off your progress in the ecosystem!"
    action={{
      label: "View Available Quests",
      href: "/quests"
    }}
  />
)

export const NoStreaksEmpty = () => (
  <EmptyState
    icon={TrendingUp}
    title="Start Your First Streak"
    description="Build consistent habits by completing daily activities. Maintain streaks to unlock special rewards!"
    action={{
      label: "Learn About Streaks",
      href: "/streaks"
    }}
  />
)

export const NoKudosEmpty = () => (
  <EmptyState
    icon={Heart}
    title="No Kudos Sent Yet"
    description="Spread positivity in the community by sending kudos to other members for their contributions."
    action={{
      label: "Send Kudos",
      href: "/kudos"
    }}
  />
)

export const NoTipsEmpty = () => (
  <EmptyState
    icon={Coffee}
    title="No Tips Sent"
    description="Support community members by sending tips. It's a great way to show appreciation for valuable contributions."
    action={{
      label: "Send Your First Tip",
      href: "/tip-jar"
    }}
  />
)

export const NoProposalsEmpty = () => (
  <EmptyState
    icon={Vote}
    title="No Proposals Yet"
    description="DAO governance features are being prepared. Community proposals will be available soon."
    action={{
      label: "View Roadmap",
      href: "/roadmap"
    }}
  />
)

export const ComingSoonEmpty = ({ feature }: { feature: string }) => (
  <EmptyState
    icon={Sparkles}
    title={`${feature} Coming Soon`}
    description="We're working hard to bring you this exciting feature. Stay tuned for updates!"
    action={{
      label: "View Roadmap",
      href: "/roadmap"
    }}
  />
)

export const ConnectWalletEmpty = () => (
  <EmptyState
    icon={Target}
    title="Connect Your Wallet"
    description="Connect your wallet to access all features of Avax Forge Empire and start building your on-chain reputation."
  />
)