import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Wallet, 
  Zap, 
  Trophy, 
  Menu,
  X,
  Home,
  Target,
  Users,
  TrendingUp,
  User,
  Coins,
  Vote,
  Heart,
  Coffee,
  Map,
  Sparkles,
  Shield,
  LogOut,
  Bot
} from "lucide-react"
import { useState } from "react"
import forgeLogo from "/lovable-uploads/1edb699d-20ef-4fba-879c-506c64b4ea43.png"
import { WalletConnect } from '@/components/web3/WalletConnect'
import { useAccount } from 'wagmi'
import { useUserXP, useUserBadges } from '@/hooks/contracts'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'

// Navigation configuration with clear, user-friendly naming
const primaryNavItems = [
  { path: '/', label: 'Dashboard', icon: Home, description: 'Your personal hub' },
  { path: '/quests', label: 'Quests', icon: Target, description: 'Earn XP & rewards' },
  { path: '/social', label: 'Community', icon: Users, description: 'Connect with builders' },
  { path: '/ai-assistant', label: 'AI Assistant', icon: Bot, description: 'Get AI help' },
  { path: '/profile', label: 'Profile', icon: User, description: 'Manage your identity' },
]

const secondaryNavItems = [
  { path: '/leaderboard', label: 'Leaderboard', icon: Trophy, description: 'Community rankings' },
  { path: '/streaks', label: 'Achievements', icon: TrendingUp, description: 'Track your progress' },
  { path: '/forge', label: 'Token Registry', icon: Coins, description: 'Register your tokens' },
  { path: '/dao', label: 'Governance', icon: Vote, description: 'Vote on proposals' },
  { path: '/dynamic-quests', label: 'AI Challenges', icon: Sparkles, description: 'Personalized challenges' },
  { path: '/kudos', label: 'Recognition', icon: Heart, description: 'Celebrate achievements' },
  { path: '/tip-jar', label: 'Support Hub', icon: Coffee, description: 'Support creators' },
  { path: '/community', label: 'Community Hub', icon: Users, description: 'DAO, Guilds & Forum' },
  { path: '/marketplace', label: 'Marketplace', icon: Coins, description: 'Buy & sell NFTs' },
  { path: '/roadmap', label: 'Roadmap', icon: Map, description: 'What\'s coming next' },
]

const allNavItems = [...primaryNavItems, ...secondaryNavItems]

export const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  const isActivePath = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-2 min-w-0">
          <img src={forgeLogo} alt="Forge Empire" className="h-8 w-8 flex-shrink-0" />
          <Link to="/" className="font-bold text-lg xl:text-xl bg-gradient-primary bg-clip-text text-transparent hover:opacity-80 transition-opacity truncate">
            <span className="hidden sm:inline">Forge Empire</span>
            <span className="sm:hidden">AFE</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden xl:flex mx-4 flex-1 items-center justify-center">
          <div className="flex items-center space-x-1 text-sm font-medium">
            {primaryNavItems.map((item) => {
              const Icon = item.icon
              const isActive = isActivePath(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center space-x-1 px-2 py-2 rounded-lg transition-all duration-200 
                    hover:bg-muted/80 hover:scale-105 story-link
                    ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}
                  `}
                  title={item.description}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden 2xl:inline">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Compact Desktop Navigation for smaller screens */}
        <nav className="hidden lg:flex xl:hidden mx-4 flex-1 items-center justify-center">
          <div className="flex items-center space-x-1 text-sm font-medium">
            {primaryNavItems.slice(0, 4).map((item) => {
              const Icon = item.icon
              const isActive = isActivePath(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center justify-center p-2 rounded-lg transition-all duration-200 
                    hover:bg-muted/80 hover:scale-105 story-link
                    ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}
                  `}
                  title={item.description}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              )
            })}
          </div>
        </nav>

        {/* User Stats and Auth */}
        <div className="flex items-center space-x-2 min-w-0">
          <HeaderStats />
          
          <div className="hidden sm:flex items-center space-x-2">
            <NotificationCenter />
            <AuthButton />
            <div className="hidden md:flex">
              <WalletConnect />
            </div>
          </div>
          
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden flex-shrink-0"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-border/40 bg-background/95 backdrop-blur animate-slide-in-right">
          <nav className="container py-4 space-y-1 max-h-[80vh] overflow-y-auto">
            {allNavItems.map((item) => {
              const Icon = item.icon
              const isActive = isActivePath(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center space-x-3 px-3 py-3 rounded-lg transition-all duration-200
                    ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}
                  `}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                  </div>
                </Link>
              )
            })}
            <div className="pt-4 border-t border-border/40 space-y-3">
              <div className="sm:hidden">
                <AuthButton />
              </div>
              <WalletConnect />
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

function AuthButton() {
  const { isAuthenticated, user, signOut } = useAuth()
  
  if (isAuthenticated && user) {
    return (
      <div className="flex items-center space-x-2">
        <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
          <Shield className="w-3 h-3 mr-1" />
          Secured
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4 mr-1" />
          Sign Out
        </Button>
      </div>
    )
  }
  
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/auth" className="flex items-center space-x-2">
        <Shield className="w-4 h-4" />
        <span>Secure Account</span>
      </Link>
    </Button>
  )
}

function HeaderStats() {
  const { isConnected } = useAccount()
  const { data: userXP } = useUserXP()
  const { badgeCount } = useUserBadges()
  const xpValue = userXP ? Number(userXP) : 0

  if (!isConnected) return <div className="hidden md:flex" />

  return (
    <div className="hidden lg:flex items-center space-x-2 animate-fade-in">
      <Badge variant="secondary" className="bg-gradient-accent hover-scale text-xs">
        <Zap className="w-3 h-3 mr-1" />
        <span className="hidden xl:inline">{xpValue.toLocaleString()} XP</span>
        <span className="xl:hidden">{xpValue > 1000 ? `${Math.floor(xpValue/1000)}k` : xpValue}</span>
      </Badge>
      <Badge variant="outline" className="border-primary/30 hover-scale text-xs">
        <Trophy className="w-3 h-3 mr-1" />
        <span className="hidden xl:inline">{badgeCount} Badges</span>
        <span className="xl:hidden">{badgeCount}</span>
      </Badge>
    </div>
  )
}
