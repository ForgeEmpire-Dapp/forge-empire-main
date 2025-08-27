import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { avalancheFuji } from 'wagmi/chains'
import { useState } from 'react'
import { CONTRACT_ADDRESSES } from '@/config/web3'
import { useToast } from '@/hooks/use-toast'

const LIQUIDITY_POOL_ABI = [
  {
    name: 'addLiquidity',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'minLiquidity', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'liquidity', type: 'uint256' }],
  },
  {
    name: 'removeLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'liquidity', type: 'uint256' },
      { name: 'minTokens', type: 'uint256' },
      { name: 'minAvax', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'avaxAmount', type: 'uint256' },
    ],
  },
  {
    name: 'swapTokensForAvax',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'minAvax', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'avaxAmount', type: 'uint256' }],
  },
  {
    name: 'swapAvaxForTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'minTokens', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'tokenAmount', type: 'uint256' }],
  },
] as const

export const useLiquidityPools = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const { writeContract, data: hash, error } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash })

  const addLiquidity = async (tokenAmount: string, avaxAmount: string, slippage: number = 0.5) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to add liquidity.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      const tokenAmountWei = BigInt(parseFloat(tokenAmount) * 10**18)
      const avaxAmountWei = BigInt(parseFloat(avaxAmount) * 10**18)
      const minLiquidity = tokenAmountWei * BigInt(100 - slippage * 100) / 100n
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800) // 30 minutes
      
      await writeContract({
        address: CONTRACT_ADDRESSES.LiquidityPool as `0x${string}`,
        abi: LIQUIDITY_POOL_ABI,
        functionName: 'addLiquidity',
        args: [tokenAmountWei, minLiquidity, deadline],
        value: avaxAmountWei,
        chain: avalancheFuji,
        account: address,
      })

      toast({
        title: "Liquidity Added!",
        description: `Successfully added ${tokenAmount} tokens and ${avaxAmount} AVAX to the pool.`,
      })
    } catch (error) {
      console.error('Adding liquidity failed:', error)
      toast({
        title: "Adding Liquidity Failed",
        description: "Failed to add liquidity. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const removeLiquidity = async (liquidityAmount: string, slippage: number = 0.5) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to remove liquidity.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      const liquidityWei = BigInt(parseFloat(liquidityAmount) * 10**18)
      const minTokens = liquidityWei * BigInt(100 - slippage * 100) / 100n / 2n
      const minAvax = liquidityWei * BigInt(100 - slippage * 100) / 100n / 2n
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.LiquidityPool as `0x${string}`,
        abi: LIQUIDITY_POOL_ABI,
        functionName: 'removeLiquidity',
        args: [liquidityWei, minTokens, minAvax, deadline],
        chain: avalancheFuji,
        account: address,
      })

      toast({
        title: "Liquidity Removed!",
        description: `Successfully removed ${liquidityAmount} liquidity from the pool.`,
      })
    } catch (error) {
      console.error('Removing liquidity failed:', error)
      toast({
        title: "Removing Liquidity Failed",
        description: "Failed to remove liquidity. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const swapTokensForAvax = async (tokenAmount: string, slippage: number = 0.5) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to swap tokens.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      const tokenAmountWei = BigInt(parseFloat(tokenAmount) * 10**18)
      const minAvax = tokenAmountWei * BigInt(100 - slippage * 100) / 100n
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.LiquidityPool as `0x${string}`,
        abi: LIQUIDITY_POOL_ABI,
        functionName: 'swapTokensForAvax',
        args: [tokenAmountWei, minAvax, deadline],
        chain: avalancheFuji,
        account: address,
      })

      toast({
        title: "Swap Complete!",
        description: `Successfully swapped ${tokenAmount} tokens for AVAX.`,
      })
    } catch (error) {
      console.error('Token swap failed:', error)
      toast({
        title: "Swap Failed",
        description: "Failed to swap tokens. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const swapAvaxForTokens = async (avaxAmount: string, slippage: number = 0.5) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to swap AVAX.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      
      const avaxAmountWei = BigInt(parseFloat(avaxAmount) * 10**18)
      const minTokens = avaxAmountWei * BigInt(100 - slippage * 100) / 100n
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.LiquidityPool as `0x${string}`,
        abi: LIQUIDITY_POOL_ABI,
        functionName: 'swapAvaxForTokens',
        args: [minTokens, deadline],
        value: avaxAmountWei,
        chain: avalancheFuji,
        account: address,
      })

      toast({
        title: "Swap Complete!",
        description: `Successfully swapped ${avaxAmount} AVAX for tokens.`,
      })
    } catch (error) {
      console.error('AVAX swap failed:', error)
      toast({
        title: "Swap Failed",
        description: "Failed to swap AVAX. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    addLiquidity,
    removeLiquidity,
    swapTokensForAvax,
    swapAvaxForTokens,
    isProcessing: isProcessing || isConfirming,
    error,
  }
}