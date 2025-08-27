import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { logTransaction } from '@/utils/secureLogger'
import { avalancheFuji } from 'wagmi/chains'
import { useState, useEffect } from 'react'
import { CONTRACT_ADDRESSES } from '@/config/web3'
import { useToast } from '@/hooks/use-toast'
import { decodeContractError } from '@/utils/contractErrorDecoder'
import { useEnhancedDataFetching } from './useEnhancedDataFetching'

const XP_ENGINE_ABI = [
  // XP Operations
  {
    name: 'getXP',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getLevel',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'userXP',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalXPAwarded',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'awardXP',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'awardXpBatch',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_users', type: 'address[]' },
      { name: '_amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    name: 'spendXP',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [],
  },
  // Contract Control
  {
    name: 'pause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'unpause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'paused',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  // Constants
  {
    name: 'MAX_BATCH_SIZE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Role checking
  {
    name: 'hasRole',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' }
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'XP_AWARDER_ROLE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'XP_GRANTER_ROLE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const

export const useXPSystem = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const { writeContract, data: hash, error } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ 
    hash
  })

  // Read user's current XP with enhanced refetching
  const { data: userXP, refetch: refetchUserXP } = useReadContract({
    address: CONTRACT_ADDRESSES.XPEngine as `0x${string}`,
    abi: XP_ENGINE_ABI,
    functionName: 'getXP',
    args: address ? [address] : undefined,
    query: { 
      enabled: !!address,
      // Removed refetchOnWindowFocus: true as useEnhancedDataFetching handles active tab refetching.
      // This prevents redundant fetches when the window regains focus.
    },
  })

  // Read user's current level with enhanced refetching
  const { data: userLevel, refetch: refetchUserLevel } = useReadContract({
    address: CONTRACT_ADDRESSES.XPEngine as `0x${string}`,
    abi: XP_ENGINE_ABI,
    functionName: 'getLevel',
    args: address ? [address] : undefined,
    query: { 
      enabled: !!address,
      // Removed refetchOnWindowFocus: true as useEnhancedDataFetching handles active tab refetching.
      // This prevents redundant fetches when the window regains focus.
    },
  })

  // Enhanced data fetching strategy
  const refetchImmediate = useCallback(() => {
    refetchUserXP()
    refetchUserLevel()
  }, [refetchUserXP, refetchUserLevel])

  const refetchBackground = useCallback(() => {
    // Background refetch with reduced frequency
    refetchUserXP()
    refetchUserLevel()
  }, [refetchUserXP, refetchUserLevel])

  const { currentStrategy } = useEnhancedDataFetching({
    refetchImmediate,
    refetchBackground,
    enabled: !!address
  })

  // Read total XP awarded globally
  const { data: totalXPAwarded } = useReadContract({
    address: CONTRACT_ADDRESSES.XPEngine as `0x${string}`,
    abi: XP_ENGINE_ABI,
    functionName: 'totalXPAwarded',
  })

  // Read contract pause status
  const { data: isPaused } = useReadContract({
    address: CONTRACT_ADDRESSES.XPEngine as `0x${string}`,
    abi: XP_ENGINE_ABI,
    functionName: 'paused',
  })

  // Read max batch size
  const { data: maxBatchSize } = useReadContract({
    address: CONTRACT_ADDRESSES.XPEngine as `0x${string}`,
    abi: XP_ENGINE_ABI,
    functionName: 'MAX_BATCH_SIZE',
  })

  // Read XP_AWARDER_ROLE hash
  const { data: xpAwarderRole } = useReadContract({
    address: CONTRACT_ADDRESSES.XPEngine as `0x${string}`,
    abi: XP_ENGINE_ABI,
    functionName: 'XP_AWARDER_ROLE',
  })

  // Check if user has XP_AWARDER_ROLE
  const { data: hasAwarderRole } = useReadContract({
    address: CONTRACT_ADDRESSES.XPEngine as `0x${string}`,
    abi: XP_ENGINE_ABI,
    functionName: 'hasRole',
    args: xpAwarderRole && address ? [xpAwarderRole, address] : undefined,
    query: { enabled: !!xpAwarderRole && !!address }
  })

  const awardXP = async (targetUser: `0x${string}`, amount: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to award XP.",
        variant: "destructive"
      })
      return
    }

    // Check for pause status
    if (isPaused) {
      toast({
        title: "Contract Paused",
        description: "The XP Engine is currently paused.",
        variant: "destructive"
      })
      return
    }

    // Check for required role
    if (hasAwarderRole === false) {
      const roleRequired = 'XP_AWARDER_ROLE'
      toast({
        title: "Insufficient Permissions",
        description: `You need the ${roleRequired || 'XP_AWARDER_ROLE'} to award XP.`,
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.XPEngine as `0x${string}`,
        abi: XP_ENGINE_ABI,
        functionName: 'awardXP',
        args: [targetUser, amount],
        chain: avalancheFuji,
        account: address,
      })

      // Don't show success toast immediately - wait for confirmation
      logTransaction('XP awarding', 'success')
    } catch (error) {
      const decodedError = decodeContractError(error)
      logTransaction('XP awarding', 'failed')
      
      toast({
        title: "XP Award Failed",
        description: decodedError,
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const awardXPBatch = async (users: `0x${string}`[], amounts: bigint[]) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to award XP.",
        variant: "destructive"
      })
      return
    }

    // Enhanced validation
    if (users.length === 0 || amounts.length === 0) {
      toast({
        title: "Empty Input",
        description: "Cannot process empty user or amount arrays.",
        variant: "destructive"
      })
      return
    }

    if (users.length !== amounts.length) {
      toast({
        title: "Data Mismatch",
        description: "Users and amounts arrays must have the same length.",
        variant: "destructive"
      })
      return
    }

    if (maxBatchSize && users.length > Number(maxBatchSize)) {
      toast({
        title: "Batch Too Large",
        description: `Maximum batch size is ${maxBatchSize}. You provided ${users.length}.`,
        variant: "destructive"
      })
      return
    }

    // Check for pause status
    if (isPaused) {
      toast({
        title: "Contract Paused",
        description: "The XP Engine is currently paused.",
        variant: "destructive"
      })
      return
    }

    // Check for required role
    if (hasAwarderRole === false) {
      const roleRequired = 'XP_AWARDER_ROLE'
      toast({
        title: "Insufficient Permissions",
        description: `You need the ${roleRequired || 'XP_AWARDER_ROLE'} to award XP.`,
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.XPEngine as `0x${string}`,
        abi: XP_ENGINE_ABI,
        functionName: 'awardXpBatch',
        args: [users, amounts],
        chain: avalancheFuji,
        account: address,
      })

      logTransaction('Batch XP awarding', 'success')
    } catch (error) {
      const decodedError = decodeContractError(error)
      logTransaction('Batch XP awarding', 'failed')
      
      toast({
        title: "Batch XP Award Failed", 
        description: decodedError,
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const spendXP = async (amount: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to spend XP.",
        variant: "destructive"
      })
      return
    }

    // Check for pause status
    if (isPaused) {
      toast({
        title: "Contract Paused",
        description: "The XP Engine is currently paused.",
        variant: "destructive"
      })
      return
    }

    // Check for sufficient XP
    if (userXP && amount > userXP) {
      toast({
        title: "Insufficient XP",
        description: `You only have ${userXP} XP but tried to spend ${amount}.`,
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.XPEngine as `0x${string}`,
        abi: XP_ENGINE_ABI,
        functionName: 'spendXP',
        args: [amount],
        chain: avalancheFuji,
        account: address,
      })

      logTransaction('XP spending', 'success')
    } catch (error) {
      const decodedError = decodeContractError(error)
      logTransaction('XP spending', 'failed')
      
      toast({
        title: "XP Spend Failed",
        description: decodedError,
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Calculate level progress (simple progression: level = floor(sqrt(xp/100)))
  const currentLevel = Number(userLevel || 0n)
  const currentXP = Number(userXP || 0n)
  const xpForCurrentLevel = currentLevel > 0 ? (currentLevel * currentLevel * 100) : 0
  const xpForNextLevel = (currentLevel + 1) * (currentLevel + 1) * 100
  const progressXP = currentXP - xpForCurrentLevel
  const xpNeeded = xpForNextLevel - currentXP
  const progressPercentage = xpForNextLevel > xpForCurrentLevel 
    ? Math.max(0, Math.min(100, (progressXP * 100) / (xpForNextLevel - xpForCurrentLevel)))
    : 0

  return {
    // Data
    userXP,
    userLevel,
    totalXPAwarded,
    isPaused,
    maxBatchSize,
    hasAwarderRole,
    
    // Calculated values
    progressPercentage,
    progressXP: BigInt(Math.max(0, progressXP)),
    xpNeeded: BigInt(Math.max(0, xpNeeded)),
    xpForCurrentLevel: BigInt(xpForCurrentLevel),
    xpForNextLevel: BigInt(xpForNextLevel),
    
    // Actions
    awardXP,
    awardXPBatch,
    spendXP,
    
    // Data refresh
    refetchUserXP,
    refetchUserLevel,
    
    // State
    isProcessing: isProcessing || isConfirming,
    error,
  }
}