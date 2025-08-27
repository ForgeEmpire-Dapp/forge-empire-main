import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { config } from '@/config/web3'
import { useToast } from '@/hooks/use-toast'
import { useState, useEffect } from 'react'
import { decodeContractError } from '@/utils/contractErrorDecoder'
import { globalTransactionQueue } from '@/utils/transactionQueue'
import { useUserRole } from './contracts/useContractRoles'
import OnboardingQuestsABI from '@/contract-abi/OnboardingQuests.sol/OnboardingQuests.json'

const ONBOARDING_QUESTS_ABI = OnboardingQuestsABI.abi

export type NextStepConfig = {
  title: string
  description: string
  instructions: string
  xpReward: bigint
  badgeURI: string
  isActive: boolean
  timeLimit: bigint
}

export type UserProgress = {
  currentStep: number
  completedSteps: number
  isOnboarding: boolean
  startedAt: bigint
}

export type StepConfig = {
  title: string
  description: string
  instructions: string
  xpReward: bigint
  badgeURI: string
  isActive: boolean
  timeLimit: bigint
}

export const useOnboardingQuests = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, isError, error } = useWaitForTransactionReceipt({ hash })
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()

  const { data: nextStep, refetch: refetchNextStep } = useReadContract({
    address: CONTRACT_ADDRESSES.OnboardingQuests as `0x${string}`,
    abi: ONBOARDING_QUESTS_ABI,
    functionName: 'getNextStep',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: stats, refetch: refetchStats } = useReadContract({
    address: CONTRACT_ADDRESSES.OnboardingQuests as `0x${string}`,
    abi: ONBOARDING_QUESTS_ABI,
    functionName: 'getOnboardingStats',
  })

  const { data: userProgress, refetch: refetchUserProgress } = useReadContract({
    address: CONTRACT_ADDRESSES.OnboardingQuests as `0x${string}`,
    abi: ONBOARDING_QUESTS_ABI,
    functionName: 'getUserProgress',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: isPaused, refetch: refetchIsPaused } = useReadContract({
    address: CONTRACT_ADDRESSES.OnboardingQuests as `0x${string}`,
    abi: ONBOARDING_QUESTS_ABI,
    functionName: 'paused',
  })

  const { hasRole: hasQuestManagerRole, isLoading: questManagerRoleLoading } = useUserRole(
    'OnboardingQuests',
    address,
    'QUEST_MANAGER_ROLE'
  )

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Success",
        description: "Onboarding quest operation completed successfully!",
      })
      setCurrentTxHash(undefined)
      refetchNextStep()
      refetchUserProgress()
      refetchStats()
    }
  }, [isSuccess, toast, refetchNextStep, refetchUserProgress, refetchStats])

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

  const startOnboarding = async () => {
    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.OnboardingQuests as `0x${string}`,
          abi: ONBOARDING_QUESTS_ABI,
          functionName: 'startOnboarding',
          args: [],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: 'Start onboarding quests',
          priority: 'high'
        }
      )
    } catch (e: unknown) {
      const decodedError = decodeContractError(e)
      toast({
        title: "Start Onboarding Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const completeStep = async (step: number) => {
    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.OnboardingQuests as `0x${string}`,
          abi: ONBOARDING_QUESTS_ABI,
          functionName: 'completeStep',
          args: [step],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Complete onboarding step ${step}`,
          priority: 'high'
        }
      )
    } catch (e: unknown) {
      const decodedError = decodeContractError(e)
      toast({
        title: "Complete Step Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const updateStepConfig = async (
    step: number,
    title: string,
    description: string,
    instructions: string,
    xpReward: bigint,
    badgeURI: string,
    isActive: boolean,
    timeLimit: bigint
  ) => {
    if (!hasQuestManagerRole) {
      toast({ title: "Error", description: "Not a quest manager", variant: "destructive" })
      return
    }
    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.OnboardingQuests as `0x${string}`,
          abi: ONBOARDING_QUESTS_ABI,
          functionName: 'updateStepConfig',
          args: [step, title, description, instructions, xpReward, badgeURI, isActive, timeLimit],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Update config for step ${step}`,
          priority: 'medium'
        }
      )
    } catch (e: unknown) {
      const decodedError = decodeContractError(e)
      toast({
        title: "Update Step Config Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  return {
    // Data
    nextStep,
    stats,
    userProgress,
    isPaused,
    hasQuestManagerRole,

    // Actions
    startOnboarding,
    completeStep,
    updateStepConfig,

    // State
    isProcessing: isWritePending || isConfirming || !!currentTxHash || questManagerRoleLoading,

    // Refetch functions
    refetchNextStep,
    refetchStats,
    refetchUserProgress,
    refetchIsPaused,
  }
}

// Hook for getting step configuration
export const useStepConfig = (step: number | undefined) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.OnboardingQuests as `0x${string}`,
    abi: ONBOARDING_QUESTS_ABI,
    functionName: 'stepConfigs',
    args: step !== undefined ? [step] : undefined,
    query: { enabled: step !== undefined },
  })
}

// Hook for getting step completion count
export const useStepCompletionCount = (step: number | undefined) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.OnboardingQuests as `0x${string}`,
    abi: ONBOARDING_QUESTS_ABI,
    functionName: 'stepCompletionCounts',
    args: step !== undefined ? [step] : undefined,
    query: { enabled: step !== undefined },
  })
}
