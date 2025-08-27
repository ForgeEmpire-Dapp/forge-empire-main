import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { avalancheFuji } from 'wagmi/chains'
import { useState } from 'react'
import { CONTRACT_ADDRESSES } from '@/config/web3'
import { useToast } from '@/hooks/use-toast'

const STREAK_INTERACTIONS_ABI = [
  {
    name: 'recordActivity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'streakType', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    name: 'claimReward',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'streakType', type: 'uint8' },
      { name: 'threshold', type: 'uint32' },
    ],
    outputs: [],
  },
  {
    name: 'claimAllRewards',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'streakType', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    name: 'claimMilestone',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'milestoneId', type: 'uint32' },
    ],
    outputs: [],
  },
] as const

export const ACTIVITY_TYPES = {
  DAILY_LOGIN: 0n,
  QUEST_COMPLETION: 1n,
  SOCIAL_INTERACTION: 2n,
  DAO_PARTICIPATION: 3n,
  STAKING: 4n,
} as const

export const useStreakInteractions = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const { writeContract, data: hash, error } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash })

  const recordActivity = async (streakType: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to record activity.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.StreakCore as `0x${string}`,
        abi: STREAK_INTERACTIONS_ABI,
        functionName: 'recordActivity',
        args: [address, Number(streakType)],
        chain: avalancheFuji,
        account: address,
      })

      toast({
        title: "Activity Recorded!",
        description: "Your daily activity has been recorded.",
      })
    } catch (error) {
      console.error('Activity recording failed:', error)
      toast({
        title: "Activity Recording Failed",
        description: "Failed to record activity. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const claimReward = async (streakType: bigint, threshold: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to claim rewards.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.StreakRewards as `0x${string}`,
        abi: STREAK_INTERACTIONS_ABI,
        functionName: 'claimReward',
        args: [Number(streakType), Number(threshold)],
        chain: avalancheFuji,
        account: address,
      })

      toast({
        title: "Reward Claimed!",
        description: "Your streak reward has been claimed successfully.",
      })
    } catch (error) {
      console.error('Reward claiming failed:', error)
      toast({
        title: "Reward Claiming Failed",
        description: "Failed to claim reward. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const claimAllRewards = async (streakType: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to claim rewards.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.StreakRewards as `0x${string}`,
        abi: STREAK_INTERACTIONS_ABI,
        functionName: 'claimAllRewards',
        args: [Number(streakType)],
        chain: avalancheFuji,
        account: address,
      })

      toast({
        title: "All Rewards Claimed!",
        description: "All available streak rewards have been claimed.",
      })
    } catch (error) {
      console.error('Bulk reward claiming failed:', error)
      toast({
        title: "Reward Claiming Failed",
        description: "Failed to claim all rewards. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const claimMilestone = async (milestoneId: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to claim milestones.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.StreakMilestones as `0x${string}`,
        abi: STREAK_INTERACTIONS_ABI,
        functionName: 'claimMilestone',
        args: [Number(milestoneId)],
        chain: avalancheFuji,
        account: address,
      })

      toast({
        title: "Milestone Claimed!",
        description: "Your streak milestone has been claimed successfully.",
      })
    } catch (error) {
      console.error('Milestone claiming failed:', error)
      toast({
        title: "Milestone Claiming Failed",
        description: "Failed to claim milestone. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    recordActivity,
    claimReward,
    claimAllRewards,
    claimMilestone,
    isProcessing: isProcessing || isConfirming,
    error,
    ACTIVITY_TYPES,
  }
}