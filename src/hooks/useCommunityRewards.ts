
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { config } from '@/config/web3'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { decodeContractError } from '@/utils/contractErrorDecoder'
import { globalTransactionQueue } from '@/utils/transactionQueue'
import { useUserRole } from './useContractRoles'

import CommunityRewardsABI from '@/contract-abi/CommunityRewards.sol/CommunityRewards.json'

const REWARDS_ABI = CommunityRewardsABI.abi

export const useCommunityRewards = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const { writeContract, isPending, data: hash } = useWriteContract()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()

  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  })

  const { data: rewardToken, refetch: refetchRewardToken } = useReadContract({
    address: CONTRACT_ADDRESSES.CommunityRewards as `0x${string}`,
    abi: REWARDS_ABI,
    functionName: 'rewardToken',
  })

  const { data: totalRewardsDistributed, refetch: refetchTotalRewardsDistributed } = useReadContract({
    address: CONTRACT_ADDRESSES.CommunityRewards as `0x${string}`,
    abi: REWARDS_ABI,
    functionName: 'totalRewardsDistributed',
  })

  const { data: vestingWalletFactory, refetch: refetchVestingWalletFactory } = useReadContract({
    address: CONTRACT_ADDRESSES.CommunityRewards as `0x${string}`,
    abi: REWARDS_ABI,
    functionName: 'vestingWalletFactory',
  })

  const { hasRole: hasDepositorRole, isLoading: depositorRoleLoading } = useUserRole(
    'CommunityRewards',
    address,
    'REWARD_DEPOSITOR_ROLE'
  )

  const { hasRole: hasDistributorRole, isLoading: distributorRoleLoading } = useUserRole(
    'CommunityRewards',
    address,
    'REWARD_DISTRIBUTOR_ROLE'
  )

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Success",
        description: "Community rewards operation completed successfully!",
      })
      setCurrentTxHash(undefined)
      refetchTotalRewardsDistributed()
    }
  }, [isSuccess, toast, refetchTotalRewardsDistributed])

  useEffect(() => {
    if (isError) {
      toast({
        title: "Transaction Failed",
        description: "Community rewards operation failed. Please try again.",
        variant: "destructive",
      })
      setCurrentTxHash(undefined)
    }
  }, [isError, toast])

  useEffect(() => {
    if (hash) {
      setCurrentTxHash(hash)
    }
  }, [hash])

  const depositRewards = async (amount: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to deposit rewards.",
        variant: "destructive",
      })
      return
    }

    if (!hasDepositorRole) {
      toast({
        title: "Insufficient Permissions",
        description: "You don't have permission to deposit rewards.",
        variant: "destructive",
      })
      return
    }

    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.CommunityRewards as `0x${string}`,
          abi: REWARDS_ABI,
          functionName: 'depositRewards',
          args: [amount],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Deposit ${amount} rewards`,
          priority: 'medium'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Deposit Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const distributeVestedRewards = async (beneficiary: `0x${string}`, amount: bigint, duration: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to distribute rewards.",
        variant: "destructive",
      })
      return
    }

    if (!hasDistributorRole) {
      toast({
        title: "Insufficient Permissions",
        description: "You don't have permission to distribute rewards.",
        variant: "destructive",
      })
      return
    }

    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.CommunityRewards as `0x${string}`,
          abi: REWARDS_ABI,
          functionName: 'distributeVestedRewards',
          args: [beneficiary, amount, duration],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Distribute ${amount} rewards to ${beneficiary}`,
          priority: 'medium'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Distribution Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  return {
    rewardToken,
    totalRewardsDistributed: totalRewardsDistributed ? Number(totalRewardsDistributed) : 0,
    vestingWalletFactory,
    hasDepositorRole,
    hasDistributorRole,
    depositRewards,
    distributeVestedRewards,
    isProcessing: isPending || isConfirming || !!currentTxHash || depositorRoleLoading || distributorRoleLoading,
    isConnected: !!address,
    refetchRewardToken,
    refetchTotalRewardsDistributed,
    refetchVestingWalletFactory,
  }
}
