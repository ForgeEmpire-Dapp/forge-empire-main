import { useState } from 'react';
import { useCommunityDAO, useHasVoted, useProposalExecutionTime } from '@/hooks/useCommunityDAO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccount } from 'wagmi';
import { Skeleton } from '@/components/ui/skeleton';

const ProposalSkeleton = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="p-4 border rounded-lg space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex space-x-2 mt-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    ))}
  </div>
);

const ProposalListItem = ({ proposal, vote, isVoting, executeProposal, isExecutingProposal, address }) => {
  const { hasVoted, isLoadingHasVoted } = useHasVoted(proposal.id, address);
  const { proposalExecutionTime, isLoadingExecutionTime } = useProposalExecutionTime(proposal.id);

  const canVote = !hasVoted && !isLoadingHasVoted && proposal.status === 'active';
  const canExecute = proposal.status === 'passed' && !proposal.executed;

  return (
    <li className="p-4 border rounded-lg">
      <h3 className="font-bold">{proposal.description}</h3>
      <p>Status: {proposal.status}</p>
      <p>Votes for: {proposal.votesFor.toString()}</p>
      <p>Votes against: {proposal.votesAgainst.toString()}</p>
      {canVote && (
        <div className="flex space-x-2 mt-2">
          <Button onClick={() => vote(proposal.id, true)} disabled={isVoting}>Vote For</Button>
          <Button onClick={() => vote(proposal.id, false)} disabled={isVoting} variant="destructive">Vote Against</Button>
        </div>
      )}
      {canExecute && (
        <Button onClick={() => executeProposal(proposal.id)} disabled={isExecutingProposal} className="mt-2">
          {isExecutingProposal ? 'Executing...' : 'Execute'}
        </Button>
      )}
    </li>
  );
};

export const CommunityDAOComponent = () => {
  const { 
    proposals, 
    isLoadingProposals, 
    createProposal, 
    isCreatingProposal, 
    vote, 
    isVoting, 
    executeProposal, 
    isExecutingProposal, 
    setVotingPeriodDuration, 
    isSettingVotingPeriodDuration, 
    setQuorumPercentage, 
    isSettingQuorumPercentage, 
    setTotalVoters, 
    isSettingTotalVoters, 
    setBlacklistedTarget, 
    isSettingBlacklistedTarget, 
    setMaxProposalValue, 
    isSettingMaxProposalValue 
  } = useCommunityDAO();
  
  const { address } = useAccount();

  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('');
  const [callData, setCallData] = useState('');
  const [newVotingPeriod, setNewVotingPeriod] = useState('0');
  const [newQuorumPercentage, setNewQuorumPercentage] = useState('0');
  const [newTotalVoters, setNewTotalVoters] = useState('0');
  const [blacklistedTargetAddress, setBlacklistedTargetAddress] = useState('');
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const [newMaxProposalValue, setNewMaxProposalValue] = useState('0');

  const handleCreateProposal = () => {
    if (description && target && callData) {
      createProposal(description, target, callData);
    }
  };

  return (
    <div className="p-4 space-y-8">
      <h1 className="text-2xl font-bold">Community DAO</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create Proposal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input placeholder="Target Address" value={target} onChange={(e) => setTarget(e.target.value)} />
          <Input placeholder="Call Data" value={callData} onChange={(e) => setCallData(e.target.value)} />
          <Button onClick={handleCreateProposal} disabled={isCreatingProposal}>
            {isCreatingProposal ? 'Creating...' : 'Create Proposal'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proposals</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingProposals ? (
            <ProposalSkeleton />
          ) : (
            <ul className="space-y-4">
              {proposals.map((p) => (
                <ProposalListItem
                  key={p.id}
                  proposal={p}
                  vote={vote}
                  isVoting={isVoting}
                  executeProposal={executeProposal}
                  isExecutingProposal={isExecutingProposal}
                  address={address}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input placeholder="New Voting Period (seconds)" value={newVotingPeriod} onChange={(e) => setNewVotingPeriod(e.target.value)} />
            <Button onClick={() => setVotingPeriodDuration(BigInt(newVotingPeriod))} disabled={isSettingVotingPeriodDuration}>
              {isSettingVotingPeriodDuration ? 'Setting...' : 'Set Voting Period'}
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Input placeholder="New Quorum Percentage" value={newQuorumPercentage} onChange={(e) => setNewQuorumPercentage(e.target.value)} />
            <Button onClick={() => setQuorumPercentage(BigInt(newQuorumPercentage))} disabled={isSettingQuorumPercentage}>
              {isSettingQuorumPercentage ? 'Setting...' : 'Set Quorum'}
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Input placeholder="New Total Voters" value={newTotalVoters} onChange={(e) => setNewTotalVoters(e.target.value)} />
            <Button onClick={() => setTotalVoters(BigInt(newTotalVoters))} disabled={isSettingTotalVoters}>
              {isSettingTotalVoters ? 'Setting...' : 'Set Total Voters'}
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Input placeholder="Blacklisted Target Address" value={blacklistedTargetAddress} onChange={(e) => setBlacklistedTargetAddress(e.target.value)} />
            <Button onClick={() => setBlacklistedTarget(blacklistedTargetAddress as `0x${string}`, !isBlacklisted)} disabled={isSettingBlacklistedTarget}>
              {isSettingBlacklistedTarget ? 'Setting...' : 'Toggle Blacklist'}
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Input placeholder="New Max Proposal Value" value={newMaxProposalValue} onChange={(e) => setNewMaxProposalValue(e.target.value)} />
            <Button onClick={() => setMaxProposalValue(BigInt(newMaxProposalValue))} disabled={isSettingMaxProposalValue}>
              {isSettingMaxProposalValue ? 'Setting...' : 'Set Max Value'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
