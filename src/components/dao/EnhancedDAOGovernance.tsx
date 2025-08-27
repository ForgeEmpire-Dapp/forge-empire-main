import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Vote, 
  Users, 
  TrendingUp,
  Shield,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  Target,
  Coins,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { useAccount } from 'wagmi';
import { ConnectWalletEmpty } from '@/components/states/EmptyStates';
import { formatDistanceToNow } from 'date-fns';
import { useCommunityDAO, useHasVoted, useProposalExecutionTime } from '@/hooks/useCommunityDAO';
import { BigNumber } from 'ethers';

interface Proposal {
  id: BigNumber;
  title: string;
  description: string;
  proposer: string;
  target: string;
  callData: string;
  voteStartTime: BigNumber;
  voteEndTime: BigNumber;
  snapshotBlock: BigNumber;
  votesFor: BigNumber;
  votesAgainst: BigNumber;
  executed: boolean;
  category: 'treasury' | 'governance' | 'technical' | 'community';
  status: 'active' | 'passed' | 'rejected' | 'pending';
  totalVotes: BigNumber;
  quorum: BigNumber;
  startDate: Date;
  endDate: Date;
  requiredMajority: number;
  executionDelay?: number;
  discussionCount: number;
}

const ProposalCard = ({ proposal, onVote, onExecute }: { proposal: Proposal, onVote: (proposalId: BigNumber, support: boolean) => void, onExecute: (proposalId: BigNumber) => void }) => {
  const { isVoting, isExecutingProposal, address } = useCommunityDAO();
  const { hasVoted, isLoadingHasVoted } = useHasVoted(proposal.id, address);
  const { proposalExecutionTime } = useProposalExecutionTime(proposal.id);

  const getProposalStatus = (proposal, executionTime) => {
    const now = new Date();
    if (proposal.executed) return 'passed';
    if (now > new Date(Number(proposal.voteEndTime) * 1000)) {
      if (proposal.votesFor > proposal.votesAgainst) {
        if (executionTime && now < new Date(Number(executionTime) * 1000)) {
          return 'queued';
        }
        return 'passed';
      }
      return 'rejected';
    }
    return 'active';
  };

  const status = getProposalStatus(proposal, proposalExecutionTime);
  
  const votePercentage = proposal.totalVotes.gt(0) ? (proposal.votesFor.mul(100).div(proposal.totalVotes)).toNumber() : 0;
  const quorumPercentage = proposal.quorum.gt(0) ? (proposal.totalVotes.mul(100).div(proposal.quorum)).toNumber() : 0;
  const isQuorumMet = quorumPercentage >= 100;
  const timeRemaining = formatDistanceToNow(proposal.endDate, { addSuffix: true });
  
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'treasury': return 'bg-accent/10 text-accent border-accent/20';
      case 'governance': return 'bg-primary/10 text-primary border-primary/20';
      case 'technical': return 'bg-secondary/10 text-secondary border-secondary/20';
      case 'community': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-primary text-primary-foreground';
      case 'passed': return 'bg-success text-success-foreground';
      case 'rejected': return 'bg-destructive text-destructive-foreground';
      case 'queued': return 'bg-warning text-warning-foreground';
      case 'pending': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={getCategoryColor(proposal.category)}>
                {proposal.category.charAt(0).toUpperCase() + proposal.category.slice(1)}
              </Badge>
              <Badge className={getStatusColor(status)}>
                {status === 'active' && <Clock className="w-3 h-3 mr-1" />}
                {status === 'passed' && <CheckCircle className="w-3 h-3 mr-1" />}
                {status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Badge>
            </div>
            <CardTitle className="text-xl mb-2">{proposal.title}</CardTitle>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {proposal.description}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div className="flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3" />
              <span>Proposal #{proposal.id.toString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>{proposal.proposer}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Voting Progress</span>
            <span className="font-medium">{votePercentage.toFixed(1)}% For</span>
          </div>
          
          <div className="space-y-2">
            <Progress value={votePercentage} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{proposal.votesFor.toString()} FOR</span>
              <span>{proposal.votesAgainst.toString()} AGAINST</span>
            </div>
          </div>

          <div className="bg-muted/30 p-3 rounded-lg">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Quorum Progress</span>
              <span className={`font-medium ${isQuorumMet ? 'text-success' : 'text-warning'}`}>
                {quorumPercentage.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={Math.min(quorumPercentage, 100)} 
              className={`h-2 ${isQuorumMet ? '[&>div]:bg-success' : '[&>div]:bg-warning'}`} 
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{proposal.totalVotes.toString()} / {proposal.quorum.toString()} votes</span>
              <span>{isQuorumMet ? 'Quorum Met' : 'Needs More Votes'}</span>
            </div>
          </div>
        </div>

        {status === 'active' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Ends {timeRemaining}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                <span>{proposal.discussionCount} comments</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                onClick={() => onVote(proposal.id, true)}
                disabled={isVoting || hasVoted || isLoadingHasVoted}
                className="bg-success/10 border-success/20 hover:bg-success/20 text-success hover:text-success"
              >
                {isVoting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ThumbsUp className="w-4 h-4 mr-2" />
                )}
                Vote For
              </Button>
              <Button 
                variant="outline" 
                onClick={() => onVote(proposal.id, false)}
                disabled={isVoting || hasVoted || isLoadingHasVoted}
                className="bg-destructive/10 border-destructive/20 hover:bg-destructive/20 text-destructive hover:text-destructive"
              >
                {isVoting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ThumbsDown className="w-4 h-4 mr-2" />
                )}
                Vote Against
              </Button>
            </div>
          </div>
        )}

        {status === 'queued' && (
          <div className="bg-accent/10 border border-accent/20 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-accent">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Execution available {formatDistanceToNow(new Date(Number(proposalExecutionTime) * 1000), { addSuffix: true })}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              This proposal has passed and is in a timelock period before execution.
            </p>
          </div>
        )}

        {proposal.status === 'passed' && !proposal.executed && (
          <div className="mt-4">
            <Button 
              onClick={() => onExecute(proposal.id)}
              disabled={isExecutingProposal}
              className="w-full bg-gradient-primary hover:opacity-90"
            >
              {isExecutingProposal ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Execute Proposal
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const CreateProposalDialog = ({ onCreate }: { onCreate: (description: string, target: string, callData: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [target, setTarget] = useState('');
  const [callData, setCallData] = useState('');
  const { isCreatingProposal } = useCommunityDAO();

  const handleSubmit = () => {
    onCreate(description, target, callData);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary hover:opacity-90">
          <Plus className="w-4 h-4 mr-2" />
          Create Proposal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Vote className="w-5 h-5" />
            Create New Proposal
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proposal-title">Proposal Title</Label>
              <Input 
                id="proposal-title"
                placeholder="Enter a clear, descriptive title"
                className="bg-background"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposal-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="treasury">Treasury</SelectItem>
                  <SelectItem value="governance">Governance</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="community">Community</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proposal-description">Description</Label>
            <Textarea 
              id="proposal-description"
              placeholder="Provide a detailed description of your proposal, including rationale, implementation details, and expected outcomes..."
              className="bg-background min-h-[120px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proposal-target">Target Address</Label>
            <Input 
              id="proposal-target"
              placeholder="Enter the contract address to interact with"
              className="bg-background"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proposal-calldata">Calldata</Label>
            <Textarea 
              id="proposal-calldata"
              placeholder="Enter the calldata for the function call (e.g., 0x...)"
              className="bg-background min-h-[80px]"
              value={callData}
              onChange={(e) => setCallData(e.target.value)}
            />
          </div>

          <div className="bg-warning/10 border border-warning/20 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-warning mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Proposal Requirements</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Minimum 1,000 FORGE tokens required to create proposals</li>
              <li>• Proposals require 100,000 votes to meet quorum</li>
              <li>• Majority threshold varies by category (60-66%)</li>
              <li>• Failed proposals cannot be resubmitted for 30 days</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isCreatingProposal} className="flex-1 bg-gradient-primary hover:opacity-90">
              {isCreatingProposal && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <ArrowRight className="w-4 h-4 mr-2" />
              Submit Proposal
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const EnhancedDAOGovernance = () => {
  const { isConnected } = useAccount();
  const [filter, setFilter] = useState<'all' | 'active' | 'passed' | 'rejected'>('all');
  const { 
    proposals: liveProposals, 
    isLoadingProposals, 
    totalProposals, 
    totalVoters, 
    createProposal, 
    vote, 
    executeProposal 
  } = useCommunityDAO();

  const filteredProposals = useMemo(() => {
    if (!liveProposals) return [];
    if (filter === 'all') return liveProposals as Proposal[];
    return (liveProposals as Proposal[]).filter(p => p.status === filter);
  }, [liveProposals, filter]);

  const passedProposals = useMemo(() => {
    if (!liveProposals) return 0;
    return (liveProposals as Proposal[]).filter(p => p.status === 'passed').length;
  }, [liveProposals]);

  const participationRate = useMemo(() => {
    if (totalVoters === undefined || totalVoters === 0n || !liveProposals) return '0.0';
    const activeVoters = new Set((liveProposals as Proposal[]).map(p => p.proposer));
    return (activeVoters.size / Number(totalVoters) * 100).toFixed(1);
  }, [liveProposals, totalVoters]);

  if (!isConnected) {
    return <ConnectWalletEmpty />;
  }

  if (isLoadingProposals) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section id="dao" className="py-12 container max-w-7xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          <span className="bg-gradient-primary bg-clip-text text-transparent">
            DAO Governance
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Shape the future of Avax Forge Empire through community governance and democratic decision-making
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <Card className="bg-gradient-card border-primary/20">
          <CardContent className="p-6 text-center">
            <Vote className="w-8 h-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold">{totalProposals?.toString() || 0}</div>
            <div className="text-sm text-muted-foreground">Total Proposals</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-card border-secondary/20">
          <CardContent className="p-6 text-center">
            <Users className="w-8 h-8 text-secondary mx-auto mb-2" />
            <div className="text-2xl font-bold">{totalVoters?.toString() || 0}</div>
            <div className="text-sm text-muted-foreground">Total Voters</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-card border-accent/20">
          <CardContent className="p-6 text-center">
            <TrendingUp className="w-8 h-8 text-accent mx-auto mb-2" />
            <div className="text-2xl font-bold">{participationRate}%</div>
            <div className="text-sm text-muted-foreground">Participation Rate</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-card border-success/20">
          <CardContent className="p-6 text-center">
            <Shield className="w-8 h-8 text-success mx-auto mb-2" />
            <div className="text-2xl font-bold">{passedProposals}</div>
            <div className="text-sm text-muted-foreground">Passed Proposals</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold">Proposals</h2>
          <Badge variant="outline">{filteredProposals.length}</Badge>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={(value: 'all' | 'active' | 'passed' | 'rejected') => setFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <CreateProposalDialog onCreate={createProposal} />
        </div>
      </div>

      <div className="space-y-6">
        {filteredProposals.length > 0 ? (
          filteredProposals.map((proposal) => (
            <ProposalCard key={proposal.id.toString()} proposal={proposal} onVote={vote} onExecute={executeProposal} />
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Vote className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Proposals Yet</h3>
              <p className="text-muted-foreground mb-4">
                Be the first to create a proposal and shape the future of the platform.
              </p>
              <CreateProposalDialog onCreate={createProposal} />
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
};