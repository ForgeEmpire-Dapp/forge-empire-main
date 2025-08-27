import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { config } from '@/config/web3'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { decodeContractError } from '@/utils/contractErrorDecoder'
import { parseEther } from 'viem'
import TipJarABI from '@/contract-abi/TipJar.sol/TipJar.json'

const TIP_JAR_ABI = TipJarABI.abi

// Hook to get a user's tip history
export const useGetUserTipHistory = (userAddress: `0x${string}`, limit: bigint = 50n) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.TipJar as `0x${string}`,
    abi: TIP_JAR_ABI,
    functionName: 'getTipsReceived',
    args: [userAddress],
    query: {
      enabled: !!userAddress,
      refetchInterval: 30000,
    },
  })
}

// Hook to get a user's withdrawable balance
export const useGetWithdrawableBalance = (userAddress: `0x${string}`) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.TipJar as `0x${string}`,
    abi: TIP_JAR_ABI,
    functionName: 'getWithdrawableBalance',
    args: [userAddress],
    query: {
      enabled: !!userAddress,
      refetchInterval: 10000,
    },
  })
}

export const useTipJar = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const { writeContract, isPending, data: hash } = useWriteContract()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()
  
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  })

  // Get user's total tips received
  const { data: tipsReceived, refetch: refetchTipsReceived } = useReadContract({
    address: CONTRACT_ADDRESSES.TipJar as `0x${string}`,
    abi: TIP_JAR_ABI,
    functionName: 'getTipsReceived',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 15000,
    },
  })

  // Check if contract is paused
  const { data: isPaused } = useReadContract({
    address: CONTRACT_ADDRESSES.TipJar as `0x${string}`,
    abi: TIP_JAR_ABI,
    functionName: 'paused',
    query: {
      refetchInterval: 30000,
    },
  })

  // Handle transaction status
  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Success",
        description: "Tip operation completed successfully!",
      })
      setCurrentTxHash(undefined)
      refetchTipsReceived()
    }
  }, [isSuccess, toast, refetchTipsReceived])

  useEffect(() => {
    if (isError) {
      toast({
        title: "Transaction Failed",
        description: "Tip operation failed. Please try again.",
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

  const depositTips = async (amount: string) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to deposit tips.",
        variant: "destructive",
      })
      return
    }

    if (isPaused) {
      toast({
        title: "Contract Paused",
        description: "Deposits are currently paused.",
        variant: "destructive",
      })
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid deposit amount.",
        variant: "destructive",
      })
      return
    }

    try {
      const depositAmount = parseEther(amount)
      writeContract({
        address: CONTRACT_ADDRESSES.TipJar as `0x${string}`,
        abi: TIP_JAR_ABI,
        functionName: 'deposit',
        args: [depositAmount],
        value: depositAmount,
        chain: config.chains[0],
        account: address,
      })
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Deposit Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const sendTip = async (recipient: `0x${string}`, amount: string) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to send tips.",
        variant: "destructive",
      })
      return
    }

    if (isPaused) {
      toast({
        title: "Contract Paused",
        description: "Tipping is currently paused.",
        variant: "destructive",
      })
      return
    }

    if (address === recipient) {
      toast({
        title: "Invalid Recipient",
        description: "You cannot tip yourself.",
        variant: "destructive",
      })
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid tip amount.",
        variant: "destructive",
      })
      return
    }

    try {
      const tipAmount = parseEther(amount)
      writeContract({
        address: CONTRACT_ADDRESSES.TipJar as `0x${string}`,
        abi: TIP_JAR_ABI,
        functionName: 'tip',
        args: [recipient, tipAmount],
        value: tipAmount,
        chain: config.chains[0],
        account: address,
      })
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Tip Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const withdrawTips = async (amount: string) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to withdraw tips.",
        variant: "destructive",
      })
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid withdrawal amount.",
        variant: "destructive",
      })
      return
    }

    try {
      const withdrawAmount = parseEther(amount)
      writeContract({
        address: CONTRACT_ADDRESSES.TipJar as `0x${string}`,
        abi: TIP_JAR_ABI,
        functionName: 'withdraw',
        args: [withdrawAmount],
        chain: config.chains[0],
        account: address,
      })
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Withdrawal Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const calculateTipWithFee = (amount: string) => {
    // Since platformFee is removed, this function will be simplified or removed if not needed
    if (!amount) return { tipAmount: "0", platformFeeAmount: "0", totalAmount: "0" }
    
    const tipAmount = parseFloat(amount)
    
    return {
      tipAmount: tipAmount.toFixed(6),
      platformFeeAmount: "0", // No platform fee in ABI
      totalAmount: tipAmount.toFixed(6),
    }
  }

  return {
    // Contract state
    tipsReceived: tipsReceived ? Number(tipsReceived) / 1e18 : 0,
    isPaused: !!isPaused,
    
    // Transaction state
    isProcessing: isPending || isConfirming || !!currentTxHash,
    isConnected: !!address,
    
    // Actions
    depositTips,
    sendTip,
    withdrawTips,
    
    // Utility functions
    calculateTipWithFee,
    
    // Refresh functions
    refetchTipsReceived,
  }
}