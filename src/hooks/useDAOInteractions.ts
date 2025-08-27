
import { useState, useCallback, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { toast } from 'sonner'
import { logTransaction } from '@/utils/secureLogger'

const DAO_ABI = [
  {
    name: 'createProposal',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'targetContract', type: 'address' },
      { name: 'callData', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'vote',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'executeProposal',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [],
  },
] as const

export const useDAOInteractions = () => {
  const { isConnected } = useAccount()
  const { writeContractAsync, isPending } = useWriteContract()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()

  const { isSuccess, isError, error } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  })

  // Handle transaction feedback
  useEffect(() => {
    if (isSuccess && currentTxHash) {
      toast.success('Transaction confirmed!')
      setCurrentTxHash(undefined)
    }
  }, [isSuccess, currentTxHash])

  useEffect(() => {
    if (isError && error) {
      toast.error(`Transaction failed: ${error.message}`)
      setCurrentTxHash(undefined)
    }
  }, [isError, error])

  const createProposal = useCallback(async (
    title: string,
    description: string,
    targetContract: `0x${string}` = '0x0000000000000000000000000000000000000000',
    callData: `0x${string}` = '0x'
  ) => {
    if (!isConnected) {
      toast.error('Please connect your wallet')
      return
    }

    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required')
      return
    }

    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.CommunityDAO as `0x${string}`,
        abi: DAO_ABI,
        functionName: 'createProposal',
        args: [title.trim(), description.trim(), targetContract, callData],
      })
      
      setCurrentTxHash(hash)
      toast.success('Proposal creation transaction sent!')
      return hash
    } catch (error: unknown) {
      logTransaction('Create proposal', 'failed')
      toast.error(error.shortMessage || error.message || 'Failed to create proposal')
      throw error
    }
  }, [isConnected, writeContractAsync])

  const vote = useCallback(async (proposalId: bigint, support: boolean) => {
    if (!isConnected) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.CommunityDAO as `0x${string}`,
        abi: DAO_ABI,
        functionName: 'vote',
        args: [proposalId, support],
      })
      
      setCurrentTxHash(hash)
      toast.success(`${support ? 'Support' : 'Opposition'} vote transaction sent!`)
      return hash
    } catch (error: unknown) {
      logTransaction('Vote', 'failed')
      toast.error(error.shortMessage || error.message || 'Failed to cast vote')
      throw error
    }
  }, [isConnected, writeContractAsync])

  const executeProposal = useCallback(async (proposalId: bigint) => {
    if (!isConnected) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.CommunityDAO as `0x${string}`,
        abi: DAO_ABI,
        functionName: 'executeProposal',
        args: [proposalId],
      })
      
      setCurrentTxHash(hash)
      toast.success('Proposal execution transaction sent!')
      return hash
    } catch (error: unknown) {
      logTransaction('Execute proposal', 'failed')
      toast.error(error.shortMessage || error.message || 'Failed to execute proposal')
      throw error
    }
  }, [isConnected, writeContractAsync])

  return {
    createProposal,
    vote,
    executeProposal,
    isPending: isPending || !!currentTxHash,
    isConnected,
  }
}

export default useDAOInteractions
