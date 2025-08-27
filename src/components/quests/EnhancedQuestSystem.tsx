import { useState, useCallback } from 'react'
import { useEnhancedDataFetching } from '@/hooks/useEnhancedDataFetching'
import { useDataFreshness } from '@/hooks/useDataFreshness'
import { DataStatusIndicator } from '@/components/ui/data-status-indicator'
import { handleError } from '@/utils/standardErrorHandler'
import { logger } from '@/utils/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Target, 
  Trophy, 
  Star, 
  Zap,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  ShieldCheck
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { useQuestRegistry, useGetAllQuests, useUserQuestCompleted, Quest } from '@/hooks/useQuestRegistry'

interface QuestCardProps {
  quest: Quest
  onRefresh?: () => void
}

const QuestCard = ({ quest, onRefresh }: QuestCardProps) => {
  const { 
    completeQuest, 
    isProcessing 
  } = useQuestRegistry()
  const { address } = useAccount()

  const { data: completed } = useUserQuestCompleted(quest.id, address!)

  const handleCompleteQuest = async () => {
    try {
      await completeQuest(quest.id)
      onRefresh?.()
    } catch (error) {
      handleError(error, { component: 'EnhancedQuestSystem', action: 'Complete quest' })
    }
  }

  // Mock progress for now - would come from useUserQuestProgress hook
  const progressPercent = 0
  const hasProgress = false

  return (
    <Card className={`group hover:shadow-lg transition-all duration-200 ${
      completed ? 'bg-green-500/5 border-green-500/20' : 'hover:border-primary/40'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-lg">{quest.description}</CardTitle>
                <Badge variant={quest.isActive ? "default" : "secondary"}>
                  {quest.isActive ? "Active" : "Inactive"}
                </Badge>
                {quest.isRepeatable && (
                  <Badge variant="outline" className="text-xs">
                    Repeatable
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Quest ID: {quest.id.toString()}</p>
            </div>
          </div>
          {completed && (
            <CheckCircle className="h-6 w-6 text-green-500" />
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {hasProgress && !completed && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-400" />
              <span>{quest.xpReward.toString()} XP</span>
            </div>
            {quest.badgeIdReward > 0n && (
              <div className="flex items-center gap-1">
                <Trophy className="h-3 w-3 text-yellow-400" />
                <span>Badge #{quest.badgeIdReward.toString()}</span>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-muted-foreground" />
              <span>Type: {quest.questType === 5 ? 'Custom' : 'On-Chain'}</span>
            </div>
          </div>
        </div>

        <div className="pt-2">
          {!quest.isActive ? (
            <Button variant="ghost" disabled className="w-full">Quest Inactive</Button>
          ) : completed ? (
            <Button variant="outline" disabled className="w-full">
              <CheckCircle className="h-4 w-4 mr-2" />
              Completed
            </Button>
          ) : quest.questType === 5 ? ( // CUSTOM Quest Type
            <Button 
              onClick={handleCompleteQuest}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              Complete Custom Quest
            </Button>
          ) : (
            <Button variant="outline" disabled className="w-full">Requires On-Chain Action</Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const QuestStats = ({ questCount }: { questCount: number }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Available Quests</p>
              <p className="text-2xl font-bold">{questCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Other stats would be implemented here */}
    </div>
  )
}

export const EnhancedQuestSystem = () => {
  const { isConnected } = useAccount()
  const { isPaused, isProcessing } = useQuestRegistry()
  const { data: quests, isLoading, error, refetch } = useGetAllQuests(0, 100) // Fetch first 100 quests

  const { dataState, markFresh, markLoading } = useDataFreshness({ maxAge: 60000 })

  const handleRefresh = useCallback(() => {
    markLoading()
    refetch().finally(() => setTimeout(() => markFresh(), 500))
  }, [refetch, markLoading, markFresh])

  useEnhancedDataFetching({
    refetchImmediate: handleRefresh,
    refetchBackground: handleRefresh,
    aggressiveInterval: 60000, // 1 minute
    conservativeInterval: 300000, // 5 minutes
    enabled: isConnected && !isPaused
  })

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card><CardContent className="p-6">
          <Alert><Info className="h-4 w-4" /><AlertDescription>Please connect your wallet to view quests.</AlertDescription></Alert>
        </CardContent></Card>
      </div>
    )
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card><CardContent className="p-6">
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Failed to load quests. Please try again.</AlertDescription></Alert>
        </CardContent></Card>
      </div>
    )
  }

  if (isPaused) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card><CardContent className="p-6">
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>The Quest Registry is paused.</AlertDescription></Alert>
        </CardContent></Card>
      </div>
    )
  }

  const activeQuests = quests?.filter(q => q.isActive) || []

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold tracking-tight">Quest Central</h1>
            <p className="text-muted-foreground">Complete challenges, earn XP, and unlock rewards.</p>
          </div>
          <DataStatusIndicator state={dataState} lastUpdate={new Date()} onRefresh={handleRefresh} />
        </div>
        <QuestStats questCount={activeQuests.length} />
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Active Quests</TabsTrigger>
          <TabsTrigger value="all">All Quests</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {activeQuests.map((quest) => (
              <QuestCard key={quest.id.toString()} quest={quest} onRefresh={refetch} />
            ))}
          </div>
          {activeQuests.length === 0 && (
            <div className="text-center py-12"><Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Active Quests</h3>
              <p className="text-muted-foreground">Check back later for new challenges!</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="all">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {quests?.map((quest) => (
              <QuestCard key={quest.id.toString()} quest={quest} onRefresh={refetch} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}


