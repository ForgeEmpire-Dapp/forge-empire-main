import { Button } from '@/components/ui/button';
import { useHasVoted, useProposalExecutionTime } from '@/hooks/useCommunityDAO';

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

export default ProposalListItem;
