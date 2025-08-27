
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { config } from '@/config/web3'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { decodeContractError } from '@/utils/contractErrorDecoder'
import { globalTransactionQueue } from '@/utils/transactionQueue'
import { useUserRole } from './useContractRoles'
import ForgeTokenManagerABI from '@/contract-abi/ForgeTokenManager.sol/ForgeTokenManager.json'

const TOKEN_MANAGER_ABI = ForgeTokenManagerABI.abi

export const useForgeTokenManager = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const { writeContract, isPending, data: hash } = useWriteContract()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()

  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  })

  const { data: moduleAddresses, refetch: refetchModuleAddresses } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeTokenManager as `0x${string}`,
    abi: TOKEN_MANAGER_ABI,
    functionName: 'getModuleAddresses',
  })

  const { data: systemStatus, refetch: refetchSystemStatus } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeTokenManager as `0x${string}`,
    abi: TOKEN_MANAGER_ABI,
    functionName: 'getSystemStatus',
  })

  const { data: tokenInfo, refetch: refetchTokenInfo } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeTokenManager as `0x${string}`,
    abi: TOKEN_MANAGER_ABI,
    functionName: 'getTokenInfo',
  })

  const { data: userInfo, refetch: refetchUserInfo } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeTokenManager as `0x${string}`,
    abi: TOKEN_MANAGER_ABI,
    functionName: 'getUserInfo',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { hasRole: hasTokenAdminRole, isLoading: tokenAdminRoleLoading } = useUserRole(
    'ForgeTokenManager',
    address,
    'TOKEN_ADMIN_ROLE'
  )

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Success",
        description: "Token manager operation completed successfully!",
      })
      setCurrentTxHash(undefined)
      refetchSystemStatus()
      refetchTokenInfo()
    }
  }, [isSuccess, toast, refetchSystemStatus, refetchTokenInfo])

  useEffect(() => {
    if (isError) {
      toast({
        title: "Transaction Failed",
        description: "Token manager operation failed. Please try again.",
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

  const batchMint = async (recipients: `0x${string}`[], amounts: bigint[]) => {
    if (!hasTokenAdminRole) {
      toast({ title: "Error", description: "Not a token admin", variant: "destructive" })
      return
    }
    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.ForgeTokenManager as `0x${string}`,
          abi: TOKEN_MANAGER_ABI,
          functionName: 'batchMint',
          args: [recipients, amounts],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Batch mint tokens`,
          priority: 'high'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Batch Mint Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  // ... other write functions ...

  return {
    moduleAddresses,
    systemStatus,
    tokenInfo,
    userInfo,
    hasTokenAdminRole,
    batchMint,
    isProcessing: isPending || isConfirming || !!currentTxHash || tokenAdminRoleLoading,
    isConnected: !!address,
    refetchModuleAddresses,
    refetchSystemStatus,
    refetchTokenInfo,
    refetchUserInfo,
  }
}
