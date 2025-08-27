import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Target, 
  Users, 
  Coins, 
  Vote, 
  Heart, 
  Coffee, 
  TrendingUp, 
  Map,
  Sparkles,
  Shield,
  Zap,
  Trophy,
  ChevronRight,
  ArrowUpRight
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface FeatureCardProps {
  title: string
  description: string
  icon: React.ComponentType
  href: string
  status?: 'live' | 'coming-soon' | 'beta'
  highlight?: boolean
  className?: string
}

const statusConfig = {
  live: {
    badge: 'Live',
    variant: 'default' as const,
    className: 'bg-success/10 text-success border-success/20'
  },
  beta: {
    badge: 'Beta',
    variant: 'secondary' as const,
    className: 'bg-warning/10 text-warning border-warning/20'
  },
  'coming-soon': {
    badge: 'Soon',
    variant: 'outline' as const,
    className: 'bg-muted/50 text-muted-foreground animate-pulse'
  }
}

const FeatureCard = ({ 
  title, 
  description, 
  icon: Icon, 
  href, 
  status = 'live',
  highlight = false,
  className 
}: FeatureCardProps) => {
  const config = statusConfig[status]
  const isDisabled = status === 'coming-soon'

  return (
    <Card className={cn(
      'group relative transition-all duration-300 hover:shadow-lg hover-lift',
      highlight && 'ring-2 ring-primary/20 bg-gradient-card',
      isDisabled && 'opacity-75',
      className
    )}>
      {highlight && (
        <div className="absolute -top-2 -right-2">
          <Badge className="bg-primary text-primary-foreground animate-bounce-gentle">
            <Sparkles className="w-3 h-3 mr-1" />
            Popular
          </Badge>
        </div>
      )}
      
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg transition-colors',
              highlight ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg leading-tight">{title}</CardTitle>
              <Badge 
                variant={config.variant}
                className={config.className}
              >
                {config.badge}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
        
        <Button 
          variant={highlight ? 'default' : 'outline'}
          size="sm"
          asChild={!isDisabled}
          disabled={isDisabled}
          className={cn(
            'w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors',
            isDisabled && 'cursor-not-allowed'
          )}
        >
          {isDisabled ? (
            <span className="flex items-center justify-center gap-2">
              Coming Soon
              <Sparkles className="w-4 h-4" />
            </span>
          ) : (
            <Link to={href} className="flex items-center justify-center gap-2">
              Get Started
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

const features = [
  {
    title: 'Challenge System',
    description: 'Complete engaging tasks to earn XP, unlock achievements, and climb the leaderboards.',
    icon: Target,
    href: '/quests',
    status: 'live' as const,
    highlight: true
  },
  {
    title: 'AI Challenges',
    description: 'Personalized quests powered by AI that adapt to your skills and interests.',
    icon: Sparkles,
    href: '/dynamic-quests',
    status: 'beta' as const
  },
  {
    title: 'Community Hub',
    description: 'Connect with builders, share achievements, and collaborate on projects.',
    icon: Users,
    href: '/social',
    status: 'live' as const
  },
  {
    title: 'Token Creator',
    description: 'Launch your own tokens on Avalanche with built-in features and utilities.',
    icon: Coins,
    href: '/forge',
    status: 'live' as const
  },
  {
    title: 'Governance',
    description: 'Participate in ecosystem decisions and vote on important proposals.',
    icon: Vote,
    href: '/dao',
    status: 'live' as const
  },
  {
    title: 'Recognition System',
    description: 'Send kudos to celebrate community contributions and achievements.',
    icon: Heart,
    href: '/kudos',
    status: 'live' as const
  }
]

export const FeatureGrid = () => {
  return (
    <section className="py-16 container">
      <div className="text-center mb-12 animate-fade-in">
        <h2 className="text-3xl font-bold mb-4">
          <span className="bg-gradient-primary bg-clip-text text-transparent">
            Build, Connect, Grow
          </span>
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Discover all the tools and features available to help you succeed in the Avalanche ecosystem
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
        {features.map((feature, index) => (
          <div 
            key={feature.title}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <FeatureCard {...feature} />
          </div>
        ))}
      </div>

      <div className="mt-12 text-center animate-fade-in">
        <Card className="bg-gradient-card border-primary/20">
          <CardContent className="p-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Shield className="w-8 h-8 text-primary" />
              <h3 className="text-xl font-bold">Secure & Audited</h3>
            </div>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              All smart contracts are audited for security. Your assets and data are protected by industry-leading security practices.
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span>Avalanche Fuji</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span>Audited Code</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span>Open Source</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}