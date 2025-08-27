
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { config } from '@/config/web3'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { decodeContractError } from '@/utils/contractErrorDecoder'
import { globalTransactionQueue } from '@/utils/transactionQueue'
import { useUserRole } from './useContractRoles'
import ForgeUtilityManagerABI from '@/contract-abi/ForgeUtilityManager.sol/ForgeUtilityManager.json'

const UTILITY_MANAGER_ABI = ForgeUtilityManagerABI.abi

export const useForgeUtilityManager = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const { writeContract, isPending, data: hash } = useWriteContract()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()

  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  })

  const { data: utilityStats, refetch: refetchUtilityStats } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeUtilityManager as `0x${string}`,
    abi: UTILITY_MANAGER_ABI,
    functionName: 'getUtilityStats',
  })

  const { data: stakingConfig, refetch: refetchStakingConfig } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeUtilityManager as `0x${string}`,
    abi: UTILITY_MANAGER_ABI,
    functionName: 'stakingConfig',
  })

  const { hasRole: hasUtilityAdminRole, isLoading: utilityAdminRoleLoading } = useUserRole(
    'ForgeUtilityManager',
    address,
    'UTILITY_ADMIN_ROLE'
  )

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Success",
        description: "Utility manager operation completed successfully!",
      })
      setCurrentTxHash(undefined)
      refetchUtilityStats()
      refetchStakingConfig()
    }
  }, [isSuccess, toast, refetchUtilityStats, refetchStakingConfig])

  useEffect(() => {
    if (isError) {
      toast({
        title: "Transaction Failed",
        description: "Utility manager operation failed. Please try again.",
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

  const recordGovernanceParticipation = async (user: `0x${string}`, participationWeight: bigint) => {
    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.ForgeUtilityManager as `0x${string}`,
          abi: UTILITY_MANAGER_ABI,
          functionName: 'recordGovernanceParticipation',
          args: [user, participationWeight],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Record governance participation for ${user}`,
          priority: 'low'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Record Governance Participation Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  // ... other write functions ...

  return {
    utilityStats,
    stakingConfig,
    hasUtilityAdminRole,
    recordGovernanceParticipation,
    isProcessing: isPending || isConfirming || !!currentTxHash || utilityAdminRoleLoading,
    isConnected: !!address,
    refetchUtilityStats,
    refetchStakingConfig,
  }
}
