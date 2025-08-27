
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { config } from '@/config/web3'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { decodeContractError } from '@/utils/contractErrorDecoder'
import { globalTransactionQueue } from '@/utils/transactionQueue'
import { useUserRole } from './useContractRoles'
import KudosABI from '@/contract-abi/Kudos.sol/Kudos.json'

const KUDOS_ABI = KudosABI.abi

export const useKudos = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const { writeContract, isPending, data: hash } = useWriteContract()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()

  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  })

  const { data: userKudos, refetch: refetchUserKudos } = useReadContract({
    address: CONTRACT_ADDRESSES.Kudos as `0x${string}`,
    abi: KUDOS_ABI,
    functionName: 'getKudos',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Success",
        description: "Kudos operation completed successfully!",
      })
      setCurrentTxHash(undefined)
      refetchUserKudos()
    }
  }, [isSuccess, toast, refetchUserKudos])

  useEffect(() => {
    if (isError) {
      toast({
        title: "Transaction Failed",
        description: "Kudos operation failed. Please try again.",
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

  const sendKudos = async (to: `0x${string}`) => {
    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.Kudos as `0x${string}`,
          abi: KUDOS_ABI,
          functionName: 'sendKudos',
          args: [to],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Send kudos to ${to}`,
          priority: 'low'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Send Kudos Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  return {
    userKudos,
    sendKudos,
    isProcessing: isPending || isConfirming || !!currentTxHash,
    isConnected: !!address,
    refetchUserKudos,
  }
}

export const useGetKudos = (userAddress: `0x${string}` | undefined) => {
  const { data: kudos, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.Kudos as `0x${string}`,
    abi: KUDOS_ABI,
    functionName: 'getKudos',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  })

  return { kudos, refetchKudos: refetch };
}
