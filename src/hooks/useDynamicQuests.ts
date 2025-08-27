
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { config } from '@/config/web3'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { decodeContractError } from '@/utils/contractErrorDecoder'
import { globalTransactionQueue } from '@/utils/transactionQueue'
import { useUserRole } from './contracts/useContractRoles'
import DynamicQuestEngineABI from '@/contract-abi/DynamicQuestEngine.sol/DynamicQuestEngine.json'

const QUEST_ENGINE_ABI = DynamicQuestEngineABI.abi

export const useDynamicQuests = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const { writeContract, isPending, data: hash } = useWriteContract()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()

  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  })

  const { writeContract: updateQuestTemplateWrite, data: updateQuestTemplateHash } = useWriteContract();

  const { isLoading: isUpdatingQuestTemplate } = useWaitForTransactionReceipt({ 
    hash: updateQuestTemplateHash, 
    onSuccess: () => {
      toast.success('Quest template updated successfully!');
      // Refetch relevant data if needed
    },
    onError: (error) => {
      toast.error(`Failed to update quest template: ${error.message}`);
    }
  });

  const { writeContract: autoGenerateQuestsWrite, data: autoGenerateQuestsHash } = useWriteContract();

  const { isLoading: isAutoGeneratingQuests } = useWaitForTransactionReceipt({ 
    hash: autoGenerateQuestsHash, 
    onSuccess: () => {
      toast.success('Quests auto-generated successfully!');
      refetchActiveQuests();
    },
    onError: (error) => {
      toast.error(`Failed to auto-generate quests: ${error.message}`);
    }
  });

  const { writeContract: updateQuestProgressWrite, data: updateQuestProgressHash } = useWriteContract();

  const { isLoading: isUpdatingQuestProgress } = useWaitForTransactionReceipt({ 
    hash: updateQuestProgressHash, 
    onSuccess: () => {
      toast.success('Quest progress updated successfully!');
      refetchActiveQuests();
    },
    onError: (error) => {
      toast.error(`Failed to update quest progress: ${error.message}`);
    }
  });

  const { writeContract: updatePersonalizationWeightsWrite, data: updatePersonalizationWeightsHash } = useWriteContract();

  const { isLoading: isUpdatingPersonalizationWeights } = useWaitForTransactionReceipt({ 
    hash: updatePersonalizationWeightsHash, 
    onSuccess: () => {
      toast.success('Personalization weights updated successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to update personalization weights: ${error.message}`);
    }
  });

  const { writeContract: pauseQuestingWrite, data: pauseQuestingHash } = useWriteContract();

  const { isLoading: isPausingQuesting } = useWaitForTransactionReceipt({ 
    hash: pauseQuestingHash, 
    onSuccess: () => {
      toast.success('Questing paused successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to pause questing: ${error.message}`);
    }
  });

  const { writeContract: unpauseQuestingWrite, data: unpauseQuestingHash } = useWriteContract();

  const { isLoading: isUnpausingQuesting } = useWaitForTransactionReceipt({ 
    hash: unpauseQuestingHash, 
    onSuccess: () => {
      toast.success('Questing unpaused successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to unpause questing: ${error.message}`);
    }
  });

  const { writeContract: updateMaxActiveQuestsWrite, data: updateMaxActiveQuestsHash } = useWriteContract();

  const { isLoading: isUpdatingMaxActiveQuests } = useWaitForTransactionReceipt({ 
    hash: updateMaxActiveQuestsHash, 
    onSuccess: () => {
      toast.success('Max active quests updated successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to update max active quests: ${error.message}`);
    }
  });

  const { data: activeQuests, refetch: refetchActiveQuests } = useReadContract({
    address: CONTRACT_ADDRESSES.DynamicQuestEngine as `0x${string}`,
    abi: QUEST_ENGINE_ABI,
    functionName: 'getUserActiveQuests',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: completedQuests, refetch: refetchCompletedQuests } = useReadContract({
    address: CONTRACT_ADDRESSES.DynamicQuestEngine as `0x${string}`,
    abi: QUEST_ENGINE_ABI,
    functionName: 'getUserCompletedQuests',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: maxActiveQuests } = useReadContract({
    address: CONTRACT_ADDRESSES.DynamicQuestEngine as `0x${string}`,
    abi: QUEST_ENGINE_ABI,
    functionName: 'maxActiveQuests',
  })

  const { data: nextQuestId } = useReadContract({
    address: CONTRACT_ADDRESSES.DynamicQuestEngine as `0x${string}`,
    abi: QUEST_ENGINE_ABI,
    functionName: 'nextQuestId',
  })

  const { data: nextTemplateId } = useReadContract({
    address: CONTRACT_ADDRESSES.DynamicQuestEngine as `0x${string}`,
    abi: QUEST_ENGINE_ABI,
    functionName: 'nextTemplateId',
  })

  const { data: isPaused } = useReadContract({
    address: CONTRACT_ADDRESSES.DynamicQuestEngine as `0x${string}`,
    abi: QUEST_ENGINE_ABI,
    functionName: 'paused',
  })

  const { data: xpEngineAddress } = useReadContract({
    address: CONTRACT_ADDRESSES.DynamicQuestEngine as `0x${string}`,
    abi: QUEST_ENGINE_ABI,
    functionName: 'xpEngine',
  })

  const { hasRole: hasQuestManagerRole, isLoading: questManagerRoleLoading } = useUserRole(
    'DynamicQuestEngine',
    address,
    'QUEST_MANAGER_ROLE'
  )

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Success",
        description: "Quest operation completed successfully!",
      })
      setCurrentTxHash(undefined)
      refetchActiveQuests()
      refetchCompletedQuests()
    }
  }, [isSuccess, toast, refetchActiveQuests, refetchCompletedQuests])

  useEffect(() => {
    if (isError) {
      toast({
        title: "Transaction Failed",
        description: "Quest operation failed. Please try again.",
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

  const createQuestTemplate = async (
    name: string,
    description: string,
    category: number,
    questType: number,
    difficulty: number,
    baseReward: bigint,
    timeLimit: bigint,
    parameters: bigint[],
    requirements: string[]
  ) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create a quest template.",
        variant: "destructive",
      })
      return
    }

    if (!hasQuestManagerRole) {
      toast({
        title: "Insufficient Permissions",
        description: "You don't have permission to create quest templates.",
        variant: "destructive",
      })
      return
    }

    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.DynamicQuestEngine as `0x${string}`,
          abi: QUEST_ENGINE_ABI,
          functionName: 'createQuestTemplate',
          args: [name, description, category, questType, difficulty, baseReward, timeLimit, parameters, requirements],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Create quest template: ${name}`,
          priority: 'medium'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Create Template Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const generateQuestsForUser = async (user: `0x${string}`, count: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to generate quests.",
        variant: "destructive",
      })
      return
    }

    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.DynamicQuestEngine as `0x${string}`,
          abi: QUEST_ENGINE_ABI,
          functionName: 'generateQuestsForUser',
          args: [user, count],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Generate ${count} quests for ${user}`,
          priority: 'medium'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Generate Quests Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const completeQuest = async (questId: bigint, user: `0x${string}`, finalValue: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to complete a quest.",
        variant: "destructive",
      })
      return
    }

    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.DynamicQuestEngine as `0x${string}`,
          abi: QUEST_ENGINE_ABI,
          functionName: 'completeQuest',
          args: [questId, user, finalValue],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Complete quest ${questId}`,
          priority: 'high'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Complete Quest Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const claimQuestReward = async (questId: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to claim a quest reward.",
        variant: "destructive",
      })
      return
    }

    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.DynamicQuestEngine as `0x${string}`,
          abi: QUEST_ENGINE_ABI,
          functionName: 'claimQuestReward',
          args: [questId],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Claim reward for quest ${questId}`,
          priority: 'high'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Claim Reward Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  return {
    activeQuests: activeQuests as bigint[] | undefined,
    completedQuests: completedQuests as bigint[] | undefined,
    maxActiveQuests: maxActiveQuests ? Number(maxActiveQuests) : 0,
    nextQuestId: nextQuestId ? Number(nextQuestId) : 0,
    nextTemplateId: nextTemplateId ? Number(nextTemplateId) : 0,
    isPaused,
    xpEngineAddress,
    hasQuestManagerRole,
    createQuestTemplate,
    generateQuestsForUser,
    completeQuest,
    claimQuestReward,
    updateQuestTemplate: (templateId: bigint, isActive: boolean) => {
      updateQuestTemplateWrite({
        ...daoContract,
        functionName: 'updateQuestTemplate',
        args: [templateId, isActive],
      });
    },
    isUpdatingQuestTemplate,
    autoGenerateQuests: (user: `0x${string}`) => {
      autoGenerateQuestsWrite({
        ...daoContract,
        functionName: 'autoGenerateQuests',
        args: [user],
      });
    },
    isAutoGeneratingQuests,
    updateQuestProgress: (questId: bigint, user: `0x${string}`, newProgress: bigint) => {
      updateQuestProgressWrite({
        ...daoContract,
        functionName: 'updateQuestProgress',
        args: [questId, user, newProgress],
      });
    },
    isUpdatingQuestProgress,
    updatePersonalizationWeights: (
      levelWeight: bigint,
      categoryWeight: bigint,
      successRateWeight: bigint,
      timeWeight: bigint,
      diversityWeight: bigint,
      difficultyWeight: bigint
    ) => {
      updatePersonalizationWeightsWrite({
        ...daoContract,
        functionName: 'updatePersonalizationWeights',
        args: [
          levelWeight,
          categoryWeight,
          successRateWeight,
          timeWeight,
          diversityWeight,
          difficultyWeight,
        ],
      });
    },
    isUpdatingPersonalizationWeights,
    pauseQuesting: () => {
      pauseQuestingWrite({
        ...daoContract,
        functionName: 'pauseQuesting',
      });
    },
    isPausingQuesting,
    unpauseQuesting: () => {
      unpauseQuestingWrite({
        ...daoContract,
        functionName: 'unpauseQuesting',
      });
    },
    isUnpausingQuesting,
    updateMaxActiveQuests: (newMax: bigint) => {
      updateMaxActiveQuestsWrite({
        ...daoContract,
        functionName: 'updateMaxActiveQuests',
        args: [newMax],
      });
    },
    isUpdatingMaxActiveQuests,
    isProcessing: isPending || isConfirming || !!currentTxHash || questManagerRoleLoading,
    isConnected: !!address,
    refetchActiveQuests,
    refetchCompletedQuests,
  }
}

export const useGeneratedQuest = (questId: bigint | undefined) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.DynamicQuestEngine as `0x${string}`,
    abi: QUEST_ENGINE_ABI,
    functionName: 'getGeneratedQuest',
    args: questId ? [questId] : undefined,
    query: { enabled: !!questId },
  })
}

export const useQuestTemplate = (templateId: bigint | undefined) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.DynamicQuestEngine as `0x${string}`,
    abi: QUEST_ENGINE_ABI,
    functionName: 'getQuestTemplate',
    args: templateId ? [templateId] : undefined,
    query: { enabled: !!templateId },
  })
}
