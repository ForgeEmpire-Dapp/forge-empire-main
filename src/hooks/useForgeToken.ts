
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { formatEther, parseEther } from 'viem'
import { useToast } from '@/hooks/use-toast'
import { decodeContractError } from '@/utils/contractErrorDecoder'
import { config } from '@/config/web3'
import { useState, useEffect } from 'react'
import { useForgeFeeManager } from './useForgeFeeManager'
import ForgeTokenCoreABI from '@/contract-abi/ForgeTokenCore.sol/ForgeTokenCore.json'

const FORGE_TOKEN_ABI = ForgeTokenCoreABI.abi

export const useForgeToken = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, isError, error } = useWaitForTransactionReceipt({ hash })
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()

  const [previewToAddress, setPreviewToAddress] = useState<`0x${string}` | undefined>(undefined)
  const [previewAmount, setPreviewAmount] = useState<bigint | undefined>(undefined)

  const { previewFeeData, refetchPreviewFeeData } = useForgeFeeManager()

  // Read functions
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeTokenCore as `0x${string}`,
    abi: FORGE_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  })

  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeTokenCore as `0x${string}`,
    abi: FORGE_TOKEN_ABI,
    functionName: 'totalSupply'
  })

  const { data: name } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeTokenCore as `0x${string}`,
    abi: FORGE_TOKEN_ABI,
    functionName: 'name'
  })

  const { data: symbol } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeTokenCore as `0x${string}`,
    abi: FORGE_TOKEN_ABI,
    functionName: 'symbol'
  })

  const { data: decimals } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeTokenCore as `0x${string}`,
    abi: FORGE_TOKEN_ABI,
    functionName: 'decimals'
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgeTokenCore as `0x${string}`,
    abi: FORGE_TOKEN_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.StakingRewards] : undefined,
    query: { enabled: !!address }
  })

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Transaction Successful",
        description: "Your transaction has been confirmed.",
      })
      setCurrentTxHash(undefined)
      refetchBalance()
      refetchAllowance()
    }
  }, [isSuccess, toast, refetchBalance, refetchAllowance])

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

  useEffect(() => {
    if (previewToAddress && previewAmount !== undefined) {
      refetchPreviewFeeData({ args: [previewToAddress, previewToAddress, previewAmount] })
    }
  }, [previewToAddress, previewAmount, refetchPreviewFeeData])

  const transferTokens = async (to: `0x${string}`, amount: string) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to transfer tokens.",
        variant: "destructive",
      })
      return
    }

    if (!to || !amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid recipient and amount.",
        variant: "destructive",
      })
      return
    }

    try {
      const amountWei = parseEther(amount)
      // Set state for previewing fees
      setPreviewToAddress(to)
      setPreviewAmount(amountWei)

      writeContract({
        address: CONTRACT_ADDRESSES.ForgeTokenCore as `0x${string}`,
        abi: FORGE_TOKEN_ABI,
        functionName: 'transfer',
        args: [to, amountWei],
        chain: config.chains[0],
        account: address,
      })
    } catch (e: unknown) {
      const decodedError = decodeContractError(e)
      toast({
        title: "Transfer Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const approve = async (spender: `0x${string}`, amount: string) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to approve tokens.",
        variant: "destructive",
      })
      return
    }

    try {
      const amountWei = parseEther(amount)
      writeContract({
        address: CONTRACT_ADDRESSES.ForgeTokenCore as `0x${string}`,
        abi: FORGE_TOKEN_ABI,
        functionName: 'approve',
        args: [spender, amountWei],
        chain: config.chains[0],
        account: address,
      })
    } catch (e: unknown) {
      const decodedError = decodeContractError(e)
      toast({
        title: "Approval Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  return {
    // Data
    balance: balance ? formatEther(balance) : '0',
    balanceRaw: balance,
    totalSupply: totalSupply ? formatEther(totalSupply) : '0',
    name: name as string || 'FORGE',
    symbol: symbol as string || 'FORGE',
    decimals: decimals || 18,
    allowance: allowance ? formatEther(allowance) : '0',
    allowanceRaw: allowance,
    previewFee: previewFeeData ? formatEther(previewFeeData[0]) : '0',
    previewNetAmount: previewFeeData ? formatEther(previewFeeData[1]) : '0',

    // Functions
    transferTokens,
    approve,
    refetchBalance,
    refetchAllowance,
    refetchTotalSupply,

    // Loading states
    isProcessing: isWritePending || isConfirming || !!currentTxHash,

    // Contract info
    contractAddress: CONTRACT_ADDRESSES.ForgeTokenCore as `0x${string}`,
    abi: FORGE_TOKEN_ABI,
  }
}
