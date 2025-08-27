
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { config } from '@/config/web3'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { decodeContractError } from '@/utils/contractErrorDecoder'
import { globalTransactionQueue } from '@/utils/transactionQueue'
import ProfileRegistryABI from '@/contract-abi/ProfileRegistryV2.sol/ProfileRegistryV2.json'

const PROFILE_REGISTRY_ABI = ProfileRegistryABI.abi

export const useProfileRegistry = (targetAddress?: string) => {
  const { address: connectedAddress } = useAccount()
  const { toast } = useToast()
  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, isError, error } = useWaitForTransactionReceipt({ hash })
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()

  const address = targetAddress || connectedAddress

  const { data: profile, refetch: refetchProfile } = useReadContract({
    address: CONTRACT_ADDRESSES.ProfileRegistry as `0x${string}`,
    abi: PROFILE_REGISTRY_ABI,
    functionName: 'getProfile',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  })

  const { data: userBadges, refetch: refetchUserBadges } = useReadContract({
    address: CONTRACT_ADDRESSES.ProfileRegistry as `0x${string}`,
    abi: PROFILE_REGISTRY_ABI,
    functionName: 'getUserBadges',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  })

  const { data: verifiedBadges, refetch: refetchVerifiedBadges } = useReadContract({
    address: CONTRACT_ADDRESSES.ProfileRegistry as `0x${string}`,
    abi: PROFILE_REGISTRY_ABI,
    functionName: 'getVerifiedUserBadges',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  })

  const { data: badgeMinterAddress } = useReadContract({
    address: CONTRACT_ADDRESSES.ProfileRegistry as `0x${string}`,
    abi: PROFILE_REGISTRY_ABI,
    functionName: 'badgeMinter',
  })

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Success",
        description: "Profile operation completed successfully!",
      })
      setCurrentTxHash(undefined)
      refetchProfile()
      refetchUserBadges()
      refetchVerifiedBadges()
    }
  }, [isSuccess, toast, refetchProfile, refetchUserBadges, refetchVerifiedBadges])

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

  const setUsername = async (newUsername: string) => {
    if (!connectedAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to set username.",
        variant: "destructive",
      })
      return
    }

    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.ProfileRegistry as `0x${string}`,
          abi: PROFILE_REGISTRY_ABI,
          functionName: 'setUsername',
          args: [newUsername],
          chain: config.chains[0],
          account: connectedAddress,
        })),
        {
          description: `Set username to ${newUsername}`,
          priority: 'high'
        }
      )
    } catch (e: unknown) {
      const decodedError = decodeContractError(e)
      toast({
        title: "Set Username Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const addBadgeToProfile = async (tokenId: bigint) => {
    if (!connectedAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to add a badge.",
        variant: "destructive",
      })
      return
    }

    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.ProfileRegistry as `0x${string}`,
          abi: PROFILE_REGISTRY_ABI,
          functionName: 'addBadgeToProfile',
          args: [tokenId],
          chain: config.chains[0],
          account: connectedAddress,
        })),
        {
          description: `Add badge #${tokenId} to profile`,
          priority: 'medium'
        }
      )
    } catch (e: unknown) {
      const decodedError = decodeContractError(e)
      toast({
        title: "Add Badge Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const removeBadgeFromProfile = async (tokenId: bigint) => {
    if (!connectedAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to remove a badge.",
        variant: "destructive",
      })
      return
    }

    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.ProfileRegistry as `0x${string}`,
          abi: PROFILE_REGISTRY_ABI,
          functionName: 'removeBadgeFromProfile',
          args: [tokenId],
          chain: config.chains[0],
          account: connectedAddress,
        })),
        {
          description: `Remove badge #${tokenId} from profile`,
          priority: 'medium'
        }
      )
    } catch (e: unknown) {
      const decodedError = decodeContractError(e)
      toast({
        title: "Remove Badge Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const cleanupInvalidBadges = async (user: `0x${string}`) => {
    if (!connectedAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to clean up badges.",
        variant: "destructive",
      })
      return
    }

    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.ProfileRegistry as `0x${string}`,
          abi: PROFILE_REGISTRY_ABI,
          functionName: 'cleanupInvalidBadges',
          args: [user],
          chain: config.chains[0],
          account: connectedAddress,
        })),
        {
          description: `Clean up invalid badges for ${user}`,
          priority: 'low'
        }
      )
    } catch (e: unknown) {
      const decodedError = decodeContractError(e)
      toast({
        title: "Cleanup Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const setTwitterHandle = async (newTwitterHandle: string) => {
    if (!connectedAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to set Twitter handle.",
        variant: "destructive",
      })
      return
    }

    try {
      await globalTransactionQueue.add(
        () => Promise.resolve(writeContract({
          address: CONTRACT_ADDRESSES.ProfileRegistry as `0x${string}`,
          abi: PROFILE_REGISTRY_ABI,
          functionName: 'setTwitterHandle',
          args: [newTwitterHandle],
          chain: config.chains[0],
          account: connectedAddress,
        })),
        {
          description: `Set Twitter handle to ${newTwitterHandle}`,
          priority: 'high'
        }
      )
    } catch (e: unknown) {
      const decodedError = decodeContractError(e)
      toast({
        title: "Set Twitter Handle Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  return {
    // Data
    username: profile?.[0],
    badges: userBadges,
    verifiedBadges,
    badgeMinterAddress,
    twitterHandle: profile?.[2],
    hasProfile: !!profile?.[0],

    // Actions
    setUsername,
    addBadgeToProfile,
    removeBadgeFromProfile,
    cleanupInvalidBadges,
    setTwitterHandle,

    // State
    isProcessing: isWritePending || isConfirming || !!currentTxHash,

    // Refetch functions
    refetchProfile,
    refetchUserBadges,
    refetchVerifiedBadges,
  }
}

export const useAddressForUsername = (username: string | undefined) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.ProfileRegistry as `0x${string}`,
    abi: PROFILE_REGISTRY_ABI,
    functionName: 'addressForUsername',
    args: username ? [username] : undefined,
    query: { enabled: !!username },
  })
}
