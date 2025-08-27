import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { parseEther, formatEther } from 'viem';
import { useToast } from '@/hooks/use-toast';
import { abi as stakingRewardsAbi } from '@/contract-abi/StakingRewards.sol/StakingRewards.json';
import { abi as forgeTokenAbi } from '@/contract-abi/ForgeTokenCore.sol/ForgeTokenCore.json';
import { useState, useEffect, useMemo } from 'react';

const MAX_UINT256 = 2n ** 256n - 1n;

export const useStakingRewards = () => {
  const { address } = useAccount();
  const { toast } = useToast();
  const [isApproving, setIsApproving] = useState(false);

  const stakingContract = {
    address: CONTRACT_ADDRESSES.StakingRewards as `0x${string}`,
    abi: stakingRewardsAbi,
  };

  const tokenContract = {
    address: CONTRACT_ADDRESSES.ForgeTokenCore as `0x${string}`,
    abi: forgeTokenAbi,
  };

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    ...tokenContract,
    functionName: 'allowance',
    args: [address!, stakingContract.address],
    query: { enabled: !!address },
  });

  const { data: userStaked, refetch: refetchStaked } = useReadContract({
    ...stakingContract,
    functionName: 'stakedBalances',
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: userRewards, refetch: refetchRewards } = useReadContract({
    ...stakingContract,
    functionName: 'getRewardAmount',
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: totalStaked } = useReadContract({
    ...stakingContract,
    functionName: 'totalStaked',
  });

  const { data: rewardsPerSecond } = useReadContract({
    ...stakingContract,
    functionName: 'rewardsPerSecond',
  });

  const apy = useMemo(() => {
    if (!rewardsPerSecond || !totalStaked || totalStaked === 0n) return 0;
    const secondsPerYear = 31536000;
    const yearlyRewards = Number(formatEther(rewardsPerSecond)) * secondsPerYear;
    const totalStakedFormatted = Number(formatEther(totalStaked));
    if (totalStakedFormatted === 0) return 0;
    return (yearlyRewards / totalStakedFormatted) * 100;
  }, [rewardsPerSecond, totalStaked]);

  const { writeContractAsync: approve, data: approveHash } = useWriteContract();
  const { writeContractAsync: stake, data: stakeHash } = useWriteContract();
  const { writeContractAsync: unstake, data: unstakeHash } = useWriteContract();
  const { writeContractAsync: claimRewards, data: claimHash } = useWriteContract();

  const { isLoading: isApprovePending } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isStakePending } = useWaitForTransactionReceipt({ hash: stakeHash });
  const { isLoading: isUnstakePending } = useWaitForTransactionReceipt({ hash: unstakeHash });
  const { isLoading: isClaimPending } = useWaitForTransactionReceipt({ hash: claimHash });

  useEffect(() => {
    if (isApprovePending) {
      setIsApproving(true);
    } else {
      setIsApproving(false);
    }
  }, [isApprovePending]);

  const handleStake = async (amount: string) => {
    try {
      const amountToStake = parseEther(amount);
      if (allowance < amountToStake) {
        toast({ title: 'Approval Required', description: 'Please approve the contract to spend your FORGE tokens.' });
        await approve({
          ...tokenContract,
          functionName: 'approve',
          args: [stakingContract.address, MAX_UINT256],
        });
        refetchAllowance();
      }
      
      await stake({
        ...stakingContract,
        functionName: 'stake',
        args: [amountToStake],
      });

      toast({ title: 'Staking Successful', description: `Successfully staked ${amount} FORGE.` });
      refetchStaked();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ title: 'Staking Failed', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleUnstake = async (amount: string) => {
    try {
      await unstake({
        ...stakingContract,
        functionName: 'unstake',
        args: [parseEther(amount)],
      });
      toast({ title: 'Unstaking Successful', description: `Successfully unstaked ${amount} FORGE.` });
      refetchStaked();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ title: 'Unstaking Failed', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleClaim = async () => {
    try {
      await claimRewards({
        ...stakingContract,
        functionName: 'claimRewards',
      });
      toast({ title: 'Rewards Claimed', description: 'Your rewards have been successfully claimed.' });
      refetchRewards();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ title: 'Claim Failed', description: errorMessage, variant: 'destructive' });
    }
  };

  return {
    userStaked: userStaked ? formatEther(userStaked) : '0',
    userRewards: userRewards ? formatEther(userRewards) : '0',
    totalStaked: totalStaked ? formatEther(totalStaked) : '0',
    apy,
    stakeTokens: handleStake,
    unstakeTokens: handleUnstake,
    claimStakingRewards: handleClaim,
    isApproving,
    isStakePending,
    isUnstakePending,
    isClaimPending,
  };
};