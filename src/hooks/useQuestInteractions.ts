import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { avalancheFuji } from 'wagmi/chains'
import { useState } from 'react'
import { CONTRACT_ADDRESSES } from '@/config/web3'
import { useToast } from '@/hooks/use-toast'

const QUEST_REGISTRY_ABI = [
  {
    name: 'checkAndCompleteQuest',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_questId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'recordProgress',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_questId', type: 'uint256' },
      { name: '_progressAmount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

export const useQuestInteractions = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const { writeContract, data: hash, error } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash })

  const completeQuest = async (questId: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to complete quests.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.QuestRegistry as `0x${string}`,
        abi: QUEST_REGISTRY_ABI,
        functionName: 'checkAndCompleteQuest',
        args: [address, questId],
        chain: avalancheFuji,
        account: address,
      })

      toast({
        title: "Quest Completed!",
        description: "Your quest completion is being processed.",
      })
    } catch (error) {
      console.error('Quest completion failed:', error)
      toast({
        title: "Quest Completion Failed",
        description: "Failed to complete quest. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const recordProgress = async (questId: bigint, progress: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Required", 
        description: "Please connect your wallet to record progress.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.QuestRegistry as `0x${string}`,
        abi: QUEST_REGISTRY_ABI,
        functionName: 'recordProgress',
        args: [address, questId, progress],
        chain: avalancheFuji,
        account: address,
      })

      toast({
        title: "Progress Recorded",
        description: "Your quest progress has been updated.",
      })
    } catch (error) {
      console.error('Progress recording failed:', error)
      toast({
        title: "Progress Recording Failed",
        description: "Failed to record progress. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    completeQuest,
    recordProgress,
    isProcessing: isProcessing || isConfirming,
    error,
  }
}