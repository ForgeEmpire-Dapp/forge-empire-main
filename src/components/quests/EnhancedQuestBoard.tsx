import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { 
  Target, 
  Trophy, 
  Clock, 
  Users, 
  Star, 
  Zap,
  Filter,
  Search,
  ChevronRight,
  Calendar,
  Sparkles,
  BookOpen,
  Code,
  Coins,
  Vote,
  MessageSquare,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Play,
  Gift,
  ArrowRight
} from 'lucide-react'
import { formatDistanceToNow, addDays, isAfter } from 'date-fns'
import { useAccount } from 'wagmi'
import { Link } from 'react-router-dom'
import { useNotifications } from '@/components/notifications/NotificationSystem'
import { toast } from 'sonner'

interface Quest {
  id: string
  title: string
  description: string
  type: 'daily' | 'weekly' | 'epic' | 'community' | 'special'
  category: 'defi' | 'social' | 'governance' | 'learning' | 'creation'
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  xpReward: number
  tokenReward?: number
  badgeReward?: string
  timeLimit?: Date
  prerequisites?: string[]
  progress: number
  maxProgress: number
  completed: boolean
  participants: number
  estimatedTime: string
  tags: string[]
  icon: React.ComponentType
  color: string
  isNew?: boolean
  isTrending?: boolean
  communityRating?: number
}

interface QuestChain {
  id: string
  title: string
  description: string
  quests: Quest[]
  totalXP: number
  completedQuests: number
  unlocked: boolean
  finalReward: string
}

const questCategories = [
  { id: 'all', name: 'All Quests', icon: Target },
  { id: 'defi', name: 'DeFi', icon: Coins },
  { id: 'social', name: 'Social', icon: Users },
  { id: 'governance', name: 'Governance', icon: Vote },
  { id: 'learning', name: 'Learning', icon: BookOpen },
  { id: 'creation', name: 'Creation', icon: Code }
]

const questTypes = [
  { id: 'all', name: 'All Types' },
  { id: 'daily', name: 'Daily' },
  { id: 'weekly', name: 'Weekly' },
  { id: 'epic', name: 'Epic' },
  { id: 'community', name: 'Community' },
  { id: 'special', name: 'Special Events' }
]

const generateMockQuests = (): Quest[] => [
  {
    id: '1',
    title: 'DeFi Fundamentals',
    description: 'Learn the basics of decentralized finance by completing interactive tutorials and mini-games',
    type: 'daily',
    category: 'learning',
    difficulty: 'beginner',
    xpReward: 200,
    tokenReward: 10,
    progress: 3,
    maxProgress: 5,
    completed: false,
    participants: 1247,
    estimatedTime: '15-20 min',
    tags: ['DeFi', 'Tutorial', 'Beginner'],
    icon: BookOpen,
    color: 'primary',
    isNew: true,
    communityRating: 4.8
  },
  {
    id: '2',
    title: 'Community Helper',
    description: 'Help 3 new members by answering their questions or providing guidance',
    type: 'weekly',
    category: 'social',
    difficulty: 'intermediate',
    xpReward: 350,
    badgeReward: 'Helper Badge',
    progress: 1,
    maxProgress: 3,
    completed: false,
    participants: 523,
    estimatedTime: '30-45 min',
    tags: ['Social', 'Community', 'Helping'],
    icon: Users,
    color: 'secondary',
    isTrending: true,
    communityRating: 4.6
  },
  {
    id: '3',
    title: 'Governance Explorer',
    description: 'Participate in 2 DAO votes and create 1 proposal discussion',
    type: 'weekly',
    category: 'governance',
    difficulty: 'advanced',
    xpReward: 500,
    tokenReward: 25,
    timeLimit: addDays(new Date(), 4),
    progress: 0,
    maxProgress: 3,
    completed: false,
    participants: 189,
    estimatedTime: '45-60 min',
    tags: ['DAO', 'Voting', 'Proposals'],
    icon: Vote,
    color: 'accent',
    communityRating: 4.4
  },
  {
    id: '4',
    title: 'Token Creator',
    description: 'Design and deploy your first custom token using the Token Forge',
    type: 'epic',
    category: 'creation',
    difficulty: 'expert',
    xpReward: 1000,
    tokenReward: 100,
    badgeReward: 'Creator Badge',
    prerequisites: ['DeFi Fundamentals', 'Smart Contract Basics'],
    progress: 0,
    maxProgress: 1,
    completed: false,
    participants: 67,
    estimatedTime: '2-3 hours',
    tags: ['Tokens', 'Creation', 'Advanced'],
    icon: Code,
    color: 'warning',
    communityRating: 4.9
  },
  {
    id: '5',
    title: 'Social Butterfly',
    description: 'Share 3 posts, like 10 community posts, and comment on 5 discussions',
    type: 'daily',
    category: 'social',
    difficulty: 'beginner',
    xpReward: 150,
    progress: 8,
    maxProgress: 18,
    completed: false,
    participants: 892,
    estimatedTime: '10-15 min',
    tags: ['Social', 'Engagement', 'Daily'],
    icon: MessageSquare,
    color: 'success',
    communityRating: 4.3
  },
  {
    id: '6',
    title: 'Weekly Achiever',
    description: 'Complete 5 different quests within one week',
    type: 'weekly',
    category: 'learning',
    difficulty: 'intermediate',
    xpReward: 750,
    badgeReward: 'Achiever Badge',
    progress: 2,
    maxProgress: 5,
    completed: false,
    participants: 334,
    estimatedTime: '3-5 hours total',
    tags: ['Challenge', 'Weekly', 'Achievement'],
    icon: Trophy,
    color: 'destructive',
    isTrending: true,
    communityRating: 4.7
  }
]

const questChains: QuestChain[] = [
  {
    id: 'defi-master',
    title: 'DeFi Master Path',
    description: 'Complete journey from DeFi beginner to advanced practitioner',
    quests: [],
    totalXP: 2500,
    completedQuests: 2,
    unlocked: true,
    finalReward: 'DeFi Master Badge + 1000 Bonus XP'
  },
  {
    id: 'community-leader',
    title: 'Community Leader Track',
    description: 'Build your reputation as a respected community member',
    quests: [],
    totalXP: 1800,
    completedQuests: 1,
    unlocked: true,
    finalReward: 'Leader Badge + Special Recognition'
  },
  {
    id: 'creator-journey',
    title: 'Creator\'s Journey',
    description: 'Learn to build and deploy on the Avalanche network',
    quests: [],
    totalXP: 3000,
    completedQuests: 0,
    unlocked: false,
    finalReward: 'Creator Master Badge + Premium Features'
  }
]

const QuestCard = ({ 
  quest, 
  onStart, 
  onContinue 
}: { 
  quest: Quest
  onStart: (id: string) => void
  onContinue: (id: string) => void
}) => {
  const Icon = quest.icon
  const progressPercent = (quest.progress / quest.maxProgress) * 100
  const isTimeExpiring = quest.timeLimit && isAfter(quest.timeLimit, new Date()) && 
    quest.timeLimit.getTime() - new Date().getTime() < 24 * 60 * 60 * 1000

  return (
    <Card className={`group hover:shadow-lg transition-all duration-200 ${
      quest.completed ? 'bg-success/5 border-success/20' : 'hover:border-primary/40'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${quest.color}/10`}>
              <Icon className={`h-5 w-5 text-${quest.color}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-lg">{quest.title}</CardTitle>
                {quest.isNew && (
                  <Badge variant="secondary" className="text-xs animate-bounce-gentle">
                    New
                  </Badge>
                )}
                {quest.isTrending && (
                  <Badge variant="outline" className="text-xs">
                    🔥 Trending
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{quest.description}</p>
            </div>
          </div>
          {quest.completed && (
            <CheckCircle className="h-6 w-6 text-success" />
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quest Progress */}
        {quest.progress > 0 && !quest.completed && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{quest.progress}/{quest.maxProgress}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Quest Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-accent" />
              <span>{quest.xpReward} XP</span>
            </div>
            {quest.tokenReward && (
              <div className="flex items-center gap-1">
                <Coins className="h-3 w-3 text-warning" />
                <span>{quest.tokenReward} Tokens</span>
              </div>
            )}
            {quest.badgeReward && (
              <div className="flex items-center gap-1">
                <Trophy className="h-3 w-3 text-accent" />
                <span>{quest.badgeReward}</span>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>{quest.estimatedTime}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span>{quest.participants} participating</span>
            </div>
            {quest.communityRating && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-500" />
                <span>{quest.communityRating}/5</span>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1 flex-wrap">
          {quest.tags.map((tag, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Time Limit Warning */}
        {isTimeExpiring && (
          <div className="flex items-center gap-2 p-2 bg-warning/10 border border-warning/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-warning" />
            <span className="text-sm text-warning">
              Expires {formatDistanceToNow(quest.timeLimit!, { addSuffix: true })}
            </span>
          </div>
        )}

        {/* Prerequisites */}
        {quest.prerequisites && quest.prerequisites.length > 0 && (
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Prerequisites:</p>
            <div className="flex flex-wrap gap-1">
              {quest.prerequisites.map((prereq, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {prereq}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          {quest.completed ? (
            <Button variant="outline" disabled className="w-full">
              <CheckCircle className="h-4 w-4 mr-2" />
              Completed
            </Button>
          ) : quest.progress > 0 ? (
            <Button 
              onClick={() => onContinue(quest.id)}
              className={`w-full bg-${quest.color} hover:bg-${quest.color}/90`}
            >
              Continue Quest
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={() => onStart(quest.id)}
              variant="outline"
              className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Quest
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const QuestChainCard = ({ chain }: { chain: QuestChain }) => {
  const progressPercent = (chain.completedQuests / chain.quests.length) * 100

  return (
    <Card className={`hover:shadow-lg transition-all ${
      !chain.unlocked ? 'opacity-60' : ''
    }`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {chain.title}
              {!chain.unlocked && <Badge variant="outline">Locked</Badge>}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{chain.description}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-accent">{chain.totalXP}</div>
            <div className="text-xs text-muted-foreground">Total XP</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{chain.completedQuests}/{chain.quests.length} quests</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
        </div>
        
        <div className="p-3 bg-accent/10 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium text-accent">
            <Gift className="h-4 w-4" />
            Final Reward
          </div>
          <p className="text-sm text-muted-foreground mt-1">{chain.finalReward}</p>
        </div>
        
        <Button 
          variant={chain.unlocked ? "default" : "ghost"} 
          disabled={!chain.unlocked}
          className="w-full"
        >
          {chain.unlocked ? 'View Chain' : 'Unlock Required'}
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  )
}

export const EnhancedQuestBoard = () => {
  const { isConnected } = useAccount()
  const { addNotification } = useNotifications()
  const [quests, setQuests] = useState<Quest[]>(generateMockQuests())
  const [filteredQuests, setFilteredQuests] = useState<Quest[]>(quests)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('recommended')

  useEffect(() => {
    let filtered = quests

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(q => q.category === selectedCategory)
    }

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(q => q.type === selectedType)
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(q => 
        q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Sort quests
    switch (sortBy) {
      case 'xp':
        filtered.sort((a, b) => b.xpReward - a.xpReward)
        break
      case 'difficulty': {
        const difficultyOrder = { beginner: 0, intermediate: 1, advanced: 2, expert: 3 }
        filtered.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty])
        break
      }
      case 'trending':
        filtered.sort((a, b) => (b.isTrending ? 1 : 0) - (a.isTrending ? 1 : 0))
        break
      default: // recommended
        filtered.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0))
    }

    setFilteredQuests(filtered)
  }, [quests, selectedCategory, selectedType, searchQuery, sortBy])

  const handleStartQuest = (questId: string) => {
    setQuests(prev => prev.map(q => 
      q.id === questId 
        ? { ...q, progress: 1 }
        : q
    ))
    
    addNotification({
      type: 'quest_completed',
      title: 'Quest Started!',
      message: 'You\'ve begun a new quest. Good luck!',
      actionUrl: '/quests'
    })
    
    toast.success('Quest started! Check your progress in the dashboard.')
  }

  const handleContinueQuest = (questId: string) => {
    const quest = quests.find(q => q.id === questId)
    if (quest) {
      // Simulate continuing the quest
      toast.info(`Continuing "${quest.title}"...`)
    }
  }

  const completedQuests = quests.filter(q => q.completed).length
  const activeQuests = quests.filter(q => q.progress > 0 && !q.completed).length
  const totalXP = quests.filter(q => q.completed).reduce((sum, q) => sum + q.xpReward, 0)

  if (!isConnected) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Start Your Quest Journey</h2>
            <p className="text-muted-foreground mb-6">
              Connect your wallet to access quests, earn XP, and unlock amazing rewards.
            </p>
            <Button size="lg">Connect Wallet</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Quest Board
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Complete challenges, earn XP, and unlock exclusive rewards while building your empire
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-8 w-8 mx-auto text-success mb-2" />
            <div className="text-2xl font-bold">{completedQuests}</div>
            <p className="text-sm text-muted-foreground">Completed Quests</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <TrendingUp className="h-8 w-8 mx-auto text-primary mb-2" />
            <div className="text-2xl font-bold">{activeQuests}</div>
            <p className="text-sm text-muted-foreground">Active Quests</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <Star className="h-8 w-8 mx-auto text-accent mb-2" />
            <div className="text-2xl font-bold">{totalXP}</div>
            <p className="text-sm text-muted-foreground">XP Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="quests" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="quests">Individual Quests</TabsTrigger>
          <TabsTrigger value="chains">Quest Chains</TabsTrigger>
        </TabsList>

        <TabsContent value="quests" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search quests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    {questCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                
                <select 
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  {questTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
                
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="recommended">Recommended</option>
                  <option value="xp">Highest XP</option>
                  <option value="difficulty">Difficulty</option>
                  <option value="trending">Trending</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Quest Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredQuests.map(quest => (
              <QuestCard
                key={quest.id}
                quest={quest}
                onStart={handleStartQuest}
                onContinue={handleContinueQuest}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="chains" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {questChains.map(chain => (
              <QuestChainCard key={chain.id} chain={chain} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}