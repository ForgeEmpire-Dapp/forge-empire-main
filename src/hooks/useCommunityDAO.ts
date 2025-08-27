import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { readContract } from '@wagmi/core';
import { abi as communityDaoAbi } from '@/abis/CommunityDAO.json';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { config } from '@/config/web3';
import { toast } from 'sonner';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { createPublicClient, http, parseAbiItem, defineChain } from 'viem';

const fuji = defineChain({
  id: 43_113,
  name: 'Avalanche Fuji',
  nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://api.avax-test.network/ext/bc/C/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Snowtrace', url: 'https://testnet.snowtrace.io' },
  },
  testnet: true,
});

// Helper to determine proposal status
const getProposalStatus = (proposal) => {
  const now = new Date();
  if (proposal.executed) return 'passed';
  if (now > new Date(Number(proposal.voteEndTime) * 1000)) {
    return proposal.votesFor > proposal.votesAgainst ? 'passed' : 'rejected';
  }
  return 'active';
};

const publicClient = createPublicClient({
  chain: fuji,
  transport: http(),
});

export const useCommunityDAO = () => {
  const { address } = useAccount();
  const [proposals, setProposals] = useState([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);

  const daoContract = useMemo(() => ({
    address: CONTRACT_ADDRESSES.CommunityDAO,
    abi: communityDaoAbi,
  }), []);

  const { data: nextProposalId, isLoading: isLoadingNextProposalId } = useReadContract({
    ...daoContract,
    functionName: 'getCurrentProposalId',
  });

  const fetchProposals = useCallback(async () => {
    if (!nextProposalId || nextProposalId === 0n) {
      setProposals([]);
      return;
    }

    setIsLoadingProposals(true);
    try {
      const fetchedProposals = [];
      for (let i = 1n; i < nextProposalId; i++) {
        const proposal = await readContract(config, { ...daoContract, functionName: 'getProposal', args: [i] });
        fetchedProposals.push({
          ...proposal,
          id: proposal.proposalId,
          status: getProposalStatus(proposal),
          startDate: new Date(Number(proposal.voteStartTime) * 1000),
          endDate: new Date(Number(proposal.voteEndTime) * 1000),
        });
      }
      setProposals(fetchedProposals);
    } catch (error) {
      toast.error('Failed to fetch proposals.');
      console.error(error);
    } finally {
      setIsLoadingProposals(false);
    }
  }, [daoContract, nextProposalId]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const { writeContract: createProposal, data: createProposalHash } = useWriteContract();

  const { isLoading: isCreatingProposal } = useWaitForTransactionReceipt({ 
    hash: createProposalHash, 
    onSuccess: () => {
      toast.success('Proposal created successfully!');
      fetchProposals(); // Refetch after creation
    },
    onError: (error) => {
      toast.error(`Failed to create proposal: ${error.message}`);
    }
  });

  const { writeContract: vote, data: voteHash } = useWriteContract();

  const { writeContract: executeProposal, data: executeProposalHash } = useWriteContract();

  const { writeContract: setVotingPeriodDurationWrite, data: setVotingPeriodDurationHash } = useWriteContract();

  const { isLoading: isSettingVotingPeriodDuration } = useWaitForTransactionReceipt({ 
    hash: setVotingPeriodDurationHash, 
    onSuccess: () => {
      toast.success('Voting period duration set successfully!');
      fetchProposals(); // Refetch after setting
    },
    onError: (error) => {
      toast.error(`Failed to set voting period duration: ${error.message}`);
    }
  });

  const { writeContract: setQuorumPercentageWrite, data: setQuorumPercentageHash } = useWriteContract();

  const { isLoading: isSettingQuorumPercentage } = useWaitForTransactionReceipt({ 
    hash: setQuorumPercentageHash, 
    onSuccess: () => {
      toast.success('Quorum percentage set successfully!');
      fetchProposals(); // Refetch after setting
    },
    onError: (error) => {
      toast.error(`Failed to set quorum percentage: ${error.message}`);
    }
  });

  const { writeContract: setTotalVotersWrite, data: setTotalVotersHash } = useWriteContract();

  const { isLoading: isSettingTotalVoters } = useWaitForTransactionReceipt({ 
    hash: setTotalVotersHash, 
    onSuccess: () => {
      toast.success('Total voters set successfully!');
      fetchProposals(); // Refetch after setting
    },
    onError: (error) => {
      toast.error(`Failed to set total voters: ${error.message}`);
    }
  });

  const { writeContract: setBlacklistedTargetWrite, data: setBlacklistedTargetHash } = useWriteContract();

  const { isLoading: isSettingBlacklistedTarget } = useWaitForTransactionReceipt({ 
    hash: setBlacklistedTargetHash, 
    onSuccess: () => {
      toast.success('Blacklisted target set successfully!');
      fetchProposals(); // Refetch after setting
    },
    onError: (error) => {
      toast.error(`Failed to set blacklisted target: ${error.message}`);
    }
  });

  const { writeContract: setMaxProposalValueWrite, data: setMaxProposalValueHash } = useWriteContract();

  const { isLoading: isSettingMaxProposalValue } = useWaitForTransactionReceipt({ 
    hash: setMaxProposalValueHash, 
    onSuccess: () => {
      toast.success('Max proposal value set successfully!');
      fetchProposals(); // Refetch after setting
    },
    onError: (error) => {
      toast.error(`Failed to set max proposal value: ${error.message}`);
    }
  });

  const { isLoading: isVoting } = useWaitForTransactionReceipt({
    hash: voteHash,
    onSuccess: () => {
      toast.success('Voted successfully!');
      fetchProposals();
    },
    onError: (error) => {
      toast.error(`Failed to vote: ${error.message}`);
    }
  });

  const { isLoading: isExecutingProposal } = useWaitForTransactionReceipt({ 
    hash: executeProposalHash, 
    onSuccess: () => {
      toast.success('Proposal executed successfully!');
      fetchProposals(); // Refetch after execution
    },
    onError: (error) => {
      toast.error(`Failed to execute proposal: ${error.message}`);
    }
  });

  const { data: totalVoters, isLoading: isLoadingTotalVoters } = useReadContract({
    ...daoContract,
    functionName: 'totalVoters',
  });

  return {
    proposals,
    isLoadingProposals,
    refetchProposals: fetchProposals,
    createProposal: (description: string, target: string, callData: string) => {
      createProposal({
        ...daoContract,
        functionName: 'propose',
        args: [description, target, callData],
      });
    },
    isCreatingProposal,
    vote: (proposalId: bigint, support: boolean) => {
      vote({
        ...daoContract,
        functionName: 'vote',
        args: [proposalId, support],
      });
    },
    isVoting,
    executeProposal: (proposalId: bigint) => {
      executeProposal({
        ...daoContract,
        functionName: 'executeProposal',
        args: [proposalId],
      });
    },
    isExecutingProposal,
    setVotingPeriodDuration: (newDuration: bigint) => {
      setVotingPeriodDurationWrite({
        ...daoContract,
        functionName: 'setVotingPeriodDuration',
        args: [newDuration],
      });
    },
    isSettingVotingPeriodDuration,
    setQuorumPercentage: (newPercentage: bigint) => {
      setQuorumPercentageWrite({
        ...daoContract,
        functionName: 'setQuorumPercentage',
        args: [newPercentage],
      });
    },
    isSettingQuorumPercentage,
    setTotalVoters: (newTotal: bigint) => {
      setTotalVotersWrite({
        ...daoContract,
        functionName: 'setTotalVoters',
        args: [newTotal],
      });
    },
    isSettingTotalVoters,
    setBlacklistedTarget: (target: `0x${string}`, blacklisted: boolean) => {
      setBlacklistedTargetWrite({
        ...daoContract,
        functionName: 'setBlacklistedTarget',
        args: [target, blacklisted],
      });
    },
    isSettingBlacklistedTarget,
    setMaxProposalValue: (newValue: bigint) => {
      setMaxProposalValueWrite({
        ...daoContract,
        functionName: 'setMaxProposalValue',
        args: [newValue],
      });
    },
    isSettingMaxProposalValue,
    totalProposals: proposals.length, // Use the length of the fetched proposals array
    totalVoters,
    isLoadingTotalVoters,
    address,
  };
};

export const useHasVoted = (proposalId: bigint, voterAddress: `0x${string}` | undefined) => {
  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.CommunityDAO,
    abi: communityDaoAbi,
    functionName: 'hasVoted',
    args: [proposalId, voterAddress],
    query: {
      enabled: !!voterAddress,
    },
  });

  return { hasVoted: data, isLoadingHasVoted: isLoading, refetchHasVoted: refetch };
};

export const useProposalExecutionTime = (proposalId: bigint) => {
  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.CommunityDAO,
    abi: communityDaoAbi,
    functionName: 'proposalExecutionTime',
    args: [proposalId],
  });

  return { proposalExecutionTime: data, isLoadingExecutionTime: isLoading, refetchExecutionTime: refetch };
};