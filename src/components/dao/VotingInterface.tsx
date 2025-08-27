import React, { useState } from 'react'
import { handleError } from '@/utils/standardErrorHandler'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  ThumbsUp,
  ThumbsDown,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  Calendar,
  Target,
  AlertCircle,
  TrendingUp
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAccount } from 'wagmi'
import { useProposal, useHasVoted } from '@/hooks/useCommunityDAO'
import { useDAOInteractions } from '@/hooks/useDAOInteractions'

export interface ProposalData {
  id: bigint
  proposer: `0x${string}`
  title: string
  description: string
  votesFor: bigint
  votesAgainst: bigint
  startTime: bigint
  endTime: bigint
  executed: boolean
  canceled: boolean
}

export type ProposalState = 'Active' | 'Succeeded' | 'Defeated' | 'Executed' | 'Canceled' | 'Pending'

interface VotingInterfaceProps {
  proposalId: bigint
  onVoteCast?: (proposalId: bigint, support: boolean) => void
  className?: string
}

export const VotingInterface = ({ proposalId, onVoteCast, className }: VotingInterfaceProps) => {
  const [isVoting, setIsVoting] = useState(false)
  const [selectedVote, setSelectedVote] = useState<boolean | null>(null)

  const { address } = useAccount()
  const { proposal, state } = useProposal(Number(proposalId))
  const hasVoted = useHasVoted(Number(proposalId), address)
  const { vote, isPending } = useDAOInteractions()

  const handleVote = async (support: boolean) => {
    setIsVoting(true)
    setSelectedVote(support)
    
    try {
      await vote(proposalId, support)
      onVoteCast?.(proposalId, support)
    } catch (error) {
      handleError(error, { component: 'VotingInterface', action: 'Vote on proposal' })
    } finally {
      setIsVoting(false)
      setSelectedVote(null)
    }
  }

  if (!proposal) {
    return (
      <Card className={`animate-pulse ${className}`}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-muted rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-5/6" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Use the proposal data directly from the hook
  if (!proposal) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Proposal not found</p>
        </CardContent>
      </Card>
    )
  }

  const totalVotes = Number(proposal.yesVotes) + Number(proposal.noVotes)
  const forPercentage = totalVotes > 0 ? (Number(proposal.yesVotes) / totalVotes) * 100 : 0
  const againstPercentage = totalVotes > 0 ? (Number(proposal.noVotes) / totalVotes) * 100 : 0
  
  const endTime = new Date(Number(proposal.endTime) * 1000)
  const isActive = state === 0 // Assuming 0 = Active in the contract
  const canVote = isActive && !hasVoted && address
  const isProcessing = isVoting || isPending

  const getStateIcon = () => {
    switch (state) {
      case 1: // Succeeded
        return <CheckCircle className="h-4 w-4 text-success" />
      case 2: // Defeated  
        return <XCircle className="h-4 w-4 text-destructive" />
      case 3: // Executed
        return <Target className="h-4 w-4 text-primary" />
      case 0: // Active
        return <Clock className="h-4 w-4 text-warning" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStateColor = () => {
    switch (state) {
      case 1: // Succeeded
        return 'success'
      case 2: // Defeated
        return 'destructive'  
      case 3: // Executed
        return 'primary'
      case 0: // Active
        return 'warning'
      default:
        return 'secondary'
    }
  }

  const getStateText = () => {
    switch (state) {
      case 0: return 'Active'
      case 1: return 'Succeeded'
      case 2: return 'Defeated'
      case 3: return 'Executed'
      default: return 'Pending'
    }
  }

  return (
    <Card className={`hover:shadow-lg transition-shadow ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg truncate">Proposal #{Number(proposalId)}</CardTitle>
              <Badge variant="outline" className={`border-${getStateColor()}/30 bg-${getStateColor()}/10 text-${getStateColor()}`}>
                {getStateIcon()}
                <span className="ml-1">{getStateText()}</span>
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Proposal #{Number(proposalId)}</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Ends {formatDistanceToNow(endTime, { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Description */}
        <div>
          <p className="text-foreground leading-relaxed line-clamp-3">
            {proposal.description}
          </p>
        </div>

        {/* Voting Results */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Voting Results</span>
            <span className="text-muted-foreground">
              {totalVotes} total votes
            </span>
          </div>

          {/* For Votes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-success">
                <ThumbsUp className="h-4 w-4" />
                <span>For</span>
              </div>
              <span className="font-medium">
                {Number(proposal.yesVotes)} ({forPercentage.toFixed(1)}%)
              </span>
            </div>
            <Progress value={forPercentage} className="h-2 bg-muted">
              <div className="h-full bg-success rounded-full transition-all" />
            </Progress>
          </div>

          {/* Against Votes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-destructive">
                <ThumbsDown className="h-4 w-4" />
                <span>Against</span>
              </div>
              <span className="font-medium">
                {Number(proposal.noVotes)} ({againstPercentage.toFixed(1)}%)
              </span>
            </div>
            <Progress value={againstPercentage} className="h-2 bg-muted">
              <div className="h-full bg-destructive rounded-full transition-all" />
            </Progress>
          </div>
        </div>

        {/* Voting Buttons */}
        {canVote ? (
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleVote(true)}
              disabled={isProcessing}
              className="flex-1 border-success/30 hover:bg-success/10 hover:border-success/50"
            >
              {isProcessing && selectedVote === true ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ThumbsUp className="h-4 w-4 mr-2" />
              )}
              Vote For
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleVote(false)}
              disabled={isProcessing}
              className="flex-1 border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50"
            >
              {isProcessing && selectedVote === false ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ThumbsDown className="h-4 w-4 mr-2" />
              )}
              Vote Against
            </Button>
          </div>
        ) : hasVoted ? (
          <div className="text-center p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-center gap-2 text-primary">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">You have voted on this proposal</span>
            </div>
          </div>
        ) : !address ? (
          <div className="text-center p-3 bg-warning/5 rounded-lg border border-warning/20">
            <div className="flex items-center justify-center gap-2 text-warning">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Connect wallet to vote</span>
            </div>
          </div>
        ) : (
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Voting has ended</span>
          </div>
        )}

        {/* Proposal Details */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>
            Proposal #{Number(proposalId)}
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {totalVotes} voters
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {forPercentage > 50 ? 'Leading' : 'Trailing'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}