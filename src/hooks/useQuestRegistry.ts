import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSignMessage } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { config } from '@/config/web3'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { decodeContractError } from '@/utils/contractErrorDecoder'
import { globalTransactionQueue } from '@/utils/transactionQueue'
import { useUserRole } from './contracts/useContractRoles'
import QuestRegistryABI from '@/contract-abi/QuestRegistry.sol/QuestRegistry.json'

const QUEST_REGISTRY_ABI = QuestRegistryABI.abi

export interface Quest {
  id: bigint
  questType: number
  description: string
  parameters: `0x${string}`
  xpReward: bigint
  badgeIdReward: bigint
  isRepeatable: boolean
  isActive: boolean
}

// Hook for reading all quests
export const useGetAllQuests = (offset: number, limit: number) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.QuestRegistry as `0x${string}`,
    abi: QUEST_REGISTRY_ABI,
    functionName: 'getAllQuests',
    args: [offset, limit],
    query: {
      refetchInterval: 300000, // 5 minutes
    },
  })
}


// Hook for reading a single quest
export const useGetQuest = (questId: bigint) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.QuestRegistry as `0x${string}`,
    abi: QUEST_REGISTRY_ABI,
    functionName: 'getQuest',
    args: [questId],
    query: {
      enabled: !!questId && questId > 0n,
      refetchInterval: 300000,
    },
  })
}

// Hook for checking if a user has completed a quest
export const useUserQuestCompleted = (questId: bigint, userAddress: `0x${string}`) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.QuestRegistry as `0x${string}`,
    abi: QUEST_REGISTRY_ABI,
    functionName: 'userQuestCompleted',
    args: [userAddress, questId],
    query: {
      enabled: !!questId && !!userAddress,
      refetchInterval: 120000,
    },
  })
}

// Hook for getting user quest progress
export const useUserQuestProgress = (questId: bigint, userAddress: `0x${string}`) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.QuestRegistry as `0x${string}`,
    abi: QUEST_REGISTRY_ABI,
    functionName: 'userQuestProgress',
    args: [userAddress, questId],
    query: {
      enabled: !!questId && !!userAddress,
      refetchInterval: 120000,
    },
  })
}


export const useQuestRegistry = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, isError, error } = useWaitForTransactionReceipt({ hash })
  const { signMessageAsync } = useSignMessage()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()

  const { data: isPaused, refetch: refetchIsPaused } = useReadContract({
    address: CONTRACT_ADDRESSES.QuestRegistry as `0x${string}`,
    abi: QUEST_REGISTRY_ABI,
    functionName: 'paused',
  })

  const { hasRole: hasQuestAdminRole, isLoading: questAdminRoleLoading } = useUserRole(
    'QuestRegistry',
    address,
    'QUEST_ADMIN_ROLE'
  )

  const { hasRole: hasProgressRecorderRole, isLoading: progressRecorderRoleLoading } = useUserRole(
    'QuestRegistry',
    address,
    'PROGRESS_RECORDER_ROLE'
  )

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Success",
        description: "Quest operation completed successfully!",
      })
      setCurrentTxHash(undefined)
    }
  }, [isSuccess, toast])

  useEffect(() => {
    if (isError && error) {
      toast({
        title: "Transaction Failed",
        description: decodeContractError(error),
        variant: "destructive",
      })
      setCurrentTxHash(undefined)
    }
  }, [isError, error, toast])

  useEffect(() => {
    if (hash) {
      setCurrentTxHash(hash)
    }
  }, [hash])

  const createQuest = async (
    questType: number,
    description: string,
    parameters: `0x${string}`,
    xpReward: bigint,
    badgeIdReward: bigint,
    isRepeatable: boolean
  ) => {
    if (!hasQuestAdminRole) {
      toast({ title: "Error", description: "Not a quest admin", variant: "destructive" })
      return
    }

    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.QuestRegistry as `0x${string}`,
          abi: QUEST_REGISTRY_ABI,
          functionName: 'createQuest',
          args: [questType, description, parameters, xpReward, badgeIdReward, isRepeatable],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Create quest: ${description}`,
          priority: 'high'
        }
      )
    } catch (error: unknown) { 
      const decodedError = decodeContractError(error)
      toast({
        title: "Quest Creation Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const recordProgress = async (user: `0x${string}`, questId: bigint, progressAmount: bigint) => {
    if (!hasProgressRecorderRole) {
      toast({ title: "Error", description: "Not a progress recorder", variant: "destructive" })
      return
    }

    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.QuestRegistry as `0x${string}`,
          abi: QUEST_REGISTRY_ABI,
          functionName: 'recordProgress',
          args: [user, questId, progressAmount],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Record progress for quest #${questId}`,
          priority: 'medium'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Record Progress Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const completeQuest = async (questId: bigint) => {
    if (!address) {
        toast({ title: "Error", description: "Please connect your wallet", variant: "destructive" })
        return
    }

    try {
        // In a real app, this message would be standardized and potentially come from a backend
        const message = `Complete quest ${questId}`;
        const signature = await signMessageAsync({ message });

        await globalTransactionQueue.add(
            () => Promise.resolve(writeContract({
                address: CONTRACT_ADDRESSES.QuestRegistry as `0x${string}`,
                abi: QUEST_REGISTRY_ABI,
                functionName: 'completeQuest',
                args: [address, questId, signature],
                chain: config.chains[0],
                account: address,
            })),
            {
                description: `Complete quest #${questId}`,
                priority: 'high'
            }
        )
    } catch (error: unknown) {
        const decodedError = decodeContractError(error)
        toast({
            title: "Quest Completion Failed",
            description: decodedError,
            variant: "destructive",
        })
    }
  }

  return {
    // Contract state
    isPaused,
    hasQuestAdminRole,
    hasProgressRecorderRole,

    // Transaction state
    isProcessing: isWritePending || isConfirming || !!currentTxHash || questAdminRoleLoading || progressRecorderRoleLoading,
    isConnected: !!address,

    // Actions
    createQuest,
    recordProgress,
    completeQuest,

    // Refetch functions
    refetchIsPaused,
  }
}

