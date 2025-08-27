import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { avalancheFuji } from 'wagmi/chains'
import { useState } from 'react'
import { logTransaction } from '@/utils/secureLogger'
import { CONTRACT_ADDRESSES } from '@/config/web3'
import { useToast } from '@/hooks/use-toast'

const STAKING_ABI = [
  {
    name: 'stake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'lockPeriod', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'unstake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'stakeId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'claimRewards',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'stakeId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'emergencyWithdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'stakeId', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

export const LOCK_PERIODS = {
  FLEXIBLE: 0n,
  WEEK: 7n,
  MONTH: 30n,
  QUARTER: 90n,
  YEAR: 365n,
} as const

export const useStakingInteractions = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const { writeContract, data: hash, error } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash })

  const stakeTokens = async (amount: string, lockPeriod: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to stake tokens.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      const amountWei = BigInt(parseFloat(amount) * 10**18)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.StakingRewards as `0x${string}`,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [amountWei, lockPeriod],
        chain: avalancheFuji,
        account: address,
      })

      toast({
        title: "Tokens Staked!",
        description: `Successfully staked ${amount} tokens for ${lockPeriod} days.`,
      })
    } catch (error) {
      logTransaction('Staking', 'failed')
      toast({
        title: "Staking Failed",
        description: "Failed to stake tokens. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const unstakeTokens = async (stakeId: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to unstake tokens.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.StakingRewards as `0x${string}`,
        abi: STAKING_ABI,
        functionName: 'unstake',
        args: [stakeId],
        chain: avalancheFuji,
        account: address,
      })

      toast({
        title: "Tokens Unstaked!",
        description: "Successfully unstaked your tokens and claimed rewards.",
      })
    } catch (error) {
      logTransaction('Unstaking', 'failed')
      toast({
        title: "Unstaking Failed",
        description: "Failed to unstake tokens. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const claimStakingRewards = async (stakeId: bigint) => {
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
        address: CONTRACT_ADDRESSES.StakingRewards as `0x${string}`,
        abi: STAKING_ABI,
        functionName: 'claimRewards',
        args: [stakeId],
        chain: avalancheFuji,
        account: address,
      })

      toast({
        title: "Rewards Claimed!",
        description: "Successfully claimed your staking rewards.",
      })
    } catch (error) {
      logTransaction('Claiming rewards', 'failed')
      toast({
        title: "Claiming Failed",
        description: "Failed to claim rewards. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const emergencyWithdraw = async (stakeId: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet for emergency withdrawal.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.StakingRewards as `0x${string}`,
        abi: STAKING_ABI,
        functionName: 'emergencyWithdraw',
        args: [stakeId],
        chain: avalancheFuji,
        account: address,
      })

      toast({
        title: "Emergency Withdrawal Complete!",
        description: "Tokens withdrawn (rewards forfeited).",
      })
    } catch (error) {
      logTransaction('Emergency withdrawal', 'failed')
      toast({
        title: "Withdrawal Failed",
        description: "Failed to withdraw tokens. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    stakeTokens,
    unstakeTokens,
    claimStakingRewards,
    emergencyWithdraw,
    isProcessing: isProcessing || isConfirming,
    error,
    LOCK_PERIODS,
  }
}