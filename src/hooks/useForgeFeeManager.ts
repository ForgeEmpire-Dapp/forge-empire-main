
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { config } from '@/config/web3'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { decodeContractError } from '@/utils/contractErrorDecoder'
import { globalTransactionQueue } from '@/utils/transactionQueue'
import { useUserRole } from './useContractRoles'
import ForgeFeeManagerABI from '@/contract-abi/ForgeFeeManager.sol/ForgeFeeManager.json'

const FEE_MANAGER_ABI = ForgeFeeManagerABI.abi

export const useForgeFeeManager = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const { writeContract, isPending, data: hash } = useWriteContract()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()

  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  })

  const { data: feeConfig, refetch: refetchFeeConfig } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeFeeManager as `0x${string}`,
    abi: FEE_MANAGER_ABI,
    functionName: 'feeConfig',
  })

  const { data: feeStats, refetch: refetchFeeStats } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeFeeManager as `0x${string}`,
    abi: FEE_MANAGER_ABI,
    functionName: 'getFeeStats',
  })

  const { data: limitConfig, refetch: refetchLimitConfig } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeFeeManager as `0x${string}`,
    abi: FEE_MANAGER_ABI,
    functionName: 'limitConfig',
  })

  const { data: liquidityWallet, refetch: refetchLiquidityWallet } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeFeeManager as `0x${string}`,
    abi: FEE_MANAGER_ABI,
    functionName: 'liquidityWallet',
  })

  const { data: isPaused, refetch: refetchIsPaused } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeFeeManager as `0x${string}`,
    abi: FEE_MANAGER_ABI,
    functionName: 'paused',
  })

  const { data: totalBurned, refetch: refetchTotalBurned } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeFeeManager as `0x${string}`,
    abi: FEE_MANAGER_ABI,
    functionName: 'totalBurned',
  })

  const { data: totalFeesCollected, refetch: refetchTotalFeesCollected } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeFeeManager as `0x${string}`,
    abi: FEE_MANAGER_ABI,
    functionName: 'totalFeesCollected',
  })

  const { data: totalToTreasury, refetch: refetchTotalToTreasury } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeFeeManager as `0x${string}`,
    abi: FEE_MANAGER_ABI,
    functionName: 'totalToTreasury',
  })

  const { data: treasuryWallet, refetch: refetchTreasuryWallet } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeFeeManager as `0x${string}`,
    abi: FEE_MANAGER_ABI,
    functionName: 'treasuryWallet',
  })

  const { data: previewFeeData, refetch: refetchPreviewFeeData } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeFeeManager as `0x${string}`,
    abi: FEE_MANAGER_ABI,
    functionName: 'previewFees',
    args: [address || '0x0', address || '0x0', 0n], // Placeholder args, will be updated by component
    query: { enabled: false }, // Disabled by default, enabled when needed
  })

  const { hasRole: hasFeeAdminRole, isLoading: feeAdminRoleLoading } = useUserRole(
    'ForgeFeeManager',
    address,
    'FEE_ADMIN_ROLE'
  )

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Success",
        description: "Fee manager operation completed successfully!",
      })
      setCurrentTxHash(undefined)
      refetchFeeConfig()
      refetchFeeStats()
      refetchLimitConfig()
    }
  }, [isSuccess, toast, refetchFeeConfig, refetchFeeStats, refetchLimitConfig])

  useEffect(() => {
    if (isError) {
      toast({
        title: "Transaction Failed",
        description: "Fee manager operation failed. Please try again.",
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

  const processFees = async (from: `0x${string}`, to: `0x${string}`, amount: bigint) => {
    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.ForgeFeeManager as `0x${string}`,
          abi: FEE_MANAGER_ABI,
          functionName: 'processFees',
          args: [from, to, amount],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Process fees for transaction of ${amount}`,
          priority: 'high'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Process Fees Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const setFeesEnabled = async (enabled: boolean) => {
    if (!hasFeeAdminRole) {
      toast({ title: "Error", description: "Not a fee admin", variant: "destructive" })
      return
    }
    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.ForgeFeeManager as `0x${string}`,
          abi: FEE_MANAGER_ABI,
          functionName: 'setFeesEnabled',
          args: [enabled],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Set fees enabled to ${enabled}`,
          priority: 'medium'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Set Fees Enabled Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  // ... other write functions ...

  return {
    feeConfig,
    feeStats,
    limitConfig,
    liquidityWallet,
    isPaused,
    totalBurned,
    totalFeesCollected,
    totalToTreasury,
    treasuryWallet,
    hasFeeAdminRole,
    processFees,
    setFeesEnabled,
    isProcessing: isPending || isConfirming || !!currentTxHash || feeAdminRoleLoading,
    isConnected: !!address,
    refetchFeeConfig,
    refetchFeeStats,
    refetchLimitConfig,
    refetchLiquidityWallet,
    refetchIsPaused,
    refetchTotalBurned,
    refetchTotalFeesCollected,
    refetchTotalToTreasury,
    refetchTreasuryWallet,
    previewFeeData,
    refetchPreviewFeeData,
  }
}
