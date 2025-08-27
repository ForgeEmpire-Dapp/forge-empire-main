
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { config } from '@/config/web3'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { decodeContractError } from '@/utils/contractErrorDecoder'
import { validateMintParams, validateBatchParams, validateArrayLengthsMatch } from '@/utils/web3Validation'
import { globalTransactionQueue } from '@/utils/transactionQueue'
import { useUserRole } from './contracts/useContractRoles'

import BadgeMinterABI from '@/contract-abi/BadgeMinter.sol/BadgeMinter.json'

const BADGE_MINTER_ABI = BadgeMinterABI.abi

export const useBadgeSystem = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const { writeContract, isPending, data: hash } = useWriteContract()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()

  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  })

  // Get user badge balance
  const { data: badgeBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
    abi: BADGE_MINTER_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000,
    },
  })

  // Check if user has required role for minting (using dynamic role fetching)
  const { hasRole: hasMinterRole, isLoading: roleLoading } = useUserRole(
    'BadgeMinter',
    address,
    'MINTER_ROLE'
  )

  // Check if contract is paused
  const { data: isPaused } = useReadContract({
    address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
    abi: BADGE_MINTER_ABI,
    functionName: 'paused',
    query: {
      refetchInterval: 30000,
    },
  })

  const { data: name } = useReadContract({
    address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
    abi: BADGE_MINTER_ABI,
    functionName: 'name',
  });

  const { data: symbol } = useReadContract({
    address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
    abi: BADGE_MINTER_ABI,
    functionName: 'symbol',
  });

  const { data: xpEngineAddress } = useReadContract({
    address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
    abi: BADGE_MINTER_ABI,
    functionName: 'xpEngine',
  });

  const { data: currentTokenId, refetch: refetchCurrentTokenId } = useReadContract({
    address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
    abi: BADGE_MINTER_ABI,
    functionName: 'getCurrentTokenId',
  });


  // Handle transaction status
  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Success",
        description: "Badge operation completed successfully!",
      })
      setCurrentTxHash(undefined)
      refetchBalance()
    }
  }, [isSuccess, toast, refetchBalance])

  useEffect(() => {
    if (isError) {
      toast({
        title: "Transaction Failed",
        description: "Badge operation failed. Please try again.",
        variant: "destructive",
      })
      setCurrentTxHash(undefined)
    }
  }, [isError, toast])

  // Update current hash when new transaction is submitted
  useEffect(() => {
    if (hash) {
      setCurrentTxHash(hash)
    }
  }, [hash])

  const mintBadge = async (to: `0x${string}`, tokenURI: string) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to mint badges.",
        variant: "destructive",
      })
      return
    }

    if (isPaused) {
      toast({
        title: "Contract Paused",
        description: "Badge minting is currently paused.",
        variant: "destructive",
      })
      return
    }

    if (roleLoading) {
      toast({
        title: "Loading Permissions",
        description: "Please wait while we verify your permissions.",
        variant: "default",
      })
      return
    }

    if (!hasMinterRole) {
      toast({
        title: "Insufficient Permissions",
        description: "You don't have permission to mint badges.",
        variant: "destructive",
      })
      return
    }

    try {
      // Validate inputs before transaction
      validateMintParams(to, tokenURI)

      // Queue transaction for execution
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
          abi: BADGE_MINTER_ABI,
          functionName: 'mintBadge',
          args: [to, tokenURI],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Mint badge to ${to.slice(0, 6)}...`,
          priority: 'high'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Minting Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const batchMintBadge = async (recipients: `0x${string}`[], tokenURIs: string[]) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to mint badges.",
        variant: "destructive",
      })
      return
    }

    if (!hasMinterRole) {
      toast({
        title: "Insufficient Permissions",
        description: "You don't have permission to mint badges.",
        variant: "destructive",
      })
      return
    }

    try {
      // Enhanced validation for batch operations
      validateBatchParams(recipients, 50, 'recipient')
      validateArrayLengthsMatch(recipients, tokenURIs, 'recipients', 'tokenURIs')

      // Validate each recipient and URI
      recipients.forEach((recipient, index) => {
        validateMintParams(recipient, tokenURIs[index])
      })

      // Queue transaction for execution
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
          abi: BADGE_MINTER_ABI,
          functionName: 'batchMintBadge',
          args: [recipients, tokenURIs],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Batch mint ${recipients.length} badges`,
          priority: 'medium'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Batch Minting Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const mintBadgeWithRequirements = async (to: `0x${string}`, badgeId: bigint, tokenURI: string) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to mint badges.",
        variant: "destructive",
      })
      return
    }

    try {
      // Queue transaction for execution
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
          abi: BADGE_MINTER_ABI,
          functionName: 'mintBadgeWithRequirements',
          args: [to, badgeId, tokenURI],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Mint badge with requirements to ${to.slice(0, 6)}...`,
          priority: 'high'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Minting Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const setBadgeXpRequirement = async (badgeId: bigint, xpAmount: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to set XP requirement.",
        variant: "destructive",
      })
      return
    }

    try {
      // Queue transaction for execution
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
          abi: BADGE_MINTER_ABI,
          functionName: 'setBadgeXpRequirement',
          args: [badgeId, xpAmount],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Set XP requirement for badge ${badgeId}`,
          priority: 'medium'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Set XP Requirement Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const setXPEngine = async (xpEngine: `0x${string}`) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to set XP Engine.",
        variant: "destructive",
      })
      return
    }

    try {
      // Queue transaction for execution
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
          abi: BADGE_MINTER_ABI,
          functionName: 'setXPEngine',
          args: [xpEngine],
          chain: config.chains[0],
          account: address,
        })),
        {
          description: `Set XP Engine to ${xpEngine}`,
          priority: 'medium'
        }
      )
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Set XP Engine Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  return {
    // Contract state
    badgeBalance: badgeBalance ? Number(badgeBalance) : 0,
    hasMinterRole: !!hasMinterRole,
    isPaused: !!isPaused,
    name,
    symbol,
    xpEngineAddress,
    currentTokenId: currentTokenId ? Number(currentTokenId) : 0,

    // Transaction state
    isProcessing: isPending || isConfirming || !!currentTxHash || roleLoading,
    isConnected: !!address,

    // Actions
    mintBadge,
    batchMintBadge,
    mintBadgeWithRequirements,
    setBadgeXpRequirement,
    setXPEngine,

    // Refresh functions
    refetchBalance,
    refetchCurrentTokenId,
  }
}

export const useBadgeTokenURI = (tokenId: bigint) => {
  const { data: tokenURI } = useReadContract({
    address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
    abi: BADGE_MINTER_ABI,
    functionName: 'tokenURI',
    args: [tokenId],
    query: {
      enabled: !!tokenId,
    },
  });

  return { tokenURI };
};

export const useBadgeData = (tokenId: bigint) => {
  const { data: ownerOf } = useReadContract({
    address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
    abi: BADGE_MINTER_ABI,
    functionName: 'ownerOf',
    args: [tokenId],
    query: {
      enabled: !!tokenId,
    },
  })

  const { data: tokenURI } = useReadContract({
    address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
    abi: BADGE_MINTER_ABI,
    functionName: 'tokenURI',
    args: [tokenId],
    query: {
      enabled: !!tokenId,
    },
  })

  const { data: badgeXpRequirement } = useReadContract({
    address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
    abi: BADGE_MINTER_ABI,
    functionName: 'badgeXpRequirements',
    args: [tokenId],
    query: {
      enabled: !!tokenId,
    },
  })

  return {
    ownerOf,
    tokenURI,
    badgeXpRequirement: badgeXpRequirement ? Number(badgeXpRequirement) : 0,
  }
}
