import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { config } from '@/config/web3'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { decodeContractError } from '@/utils/contractErrorDecoder'
import SocialGraphABI from '@/contract-abi/SocialGraph.sol/SocialGraph.json'

const SOCIAL_GRAPH_ABI = SocialGraphABI.abi

// Hook to check if a user is following another
export const useIsFollowing = (follower: `0x${string}`, following: `0x${string}`) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'isFollowing',
    args: [follower, following],
    query: {
      enabled: !!follower && !!following,
      refetchInterval: 15000,
    },
  })
}

// Hook to get a specific post
export const useGetPost = (postId: bigint) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'getPost',
    args: [postId],
    query: {
      enabled: !!postId && postId > 0n,
      refetchInterval: 10000,
    },
  })
}

// Hook to get posts for a specific user
export const useGetUserPosts = (userAddress: `0x${string}`, limit: bigint = 20n) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'getUserPosts',
    args: [userAddress, limit],
    query: {
      enabled: !!userAddress,
      refetchInterval: 15000,
    },
  })
}

// Hook to get a user's followers
export const useGetFollowers = (userAddress: `0x${string}`) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'getFollowers',
    args: [userAddress],
    query: {
      enabled: !!userAddress,
      refetchInterval: 30000,
    },
  })
}

// Hook to get a user's following list
export const useGetFollowing = (userAddress: `0x${string}`) => {
  return useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'getFollowing',
    args: [userAddress],
    query: {
      enabled: !!userAddress,
      refetchInterval: 30000,
    },
  })
}


export const useSocialGraph = () => {
  const { address } = useAccount()
  const { toast } = useToast()
  const { writeContract, isPending, data: hash } = useWriteContract()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()
  
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  })

  // Get user's followers count
  const { data: followerCount, refetch: refetchFollowerCount } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'getFollowerCount',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 15000,
    },
  })

  // Get user's following count
  const { data: followingCount, refetch: refetchFollowingCount } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'getFollowingCount',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 15000,
    },
  })

  // Get user's posts count
  const { data: postCount, refetch: refetchPostCount } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'getUserPostCount',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000,
    },
  })

  // Get total posts count
  const { data: totalPosts } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'totalPosts',
    query: {
      refetchInterval: 30000,
    },
  })

  // Check if contract is paused
  const { data: isPaused } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
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
        description: "Social operation completed successfully!",
      })
      setCurrentTxHash(undefined)
      refetchFollowerCount()
      refetchFollowingCount()
      refetchPostCount()
    }
  }, [isSuccess, toast, refetchFollowerCount, refetchFollowingCount, refetchPostCount])

  useEffect(() => {
    if (isError) {
      toast({
        title: "Transaction Failed",
        description: "Social operation failed. Please try again.",
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

  const followUser = async (userToFollow: `0x${string}`) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to follow users.",
        variant: "destructive",
      })
      return
    }

    if (isPaused) {
      toast({
        title: "Contract Paused",
        description: "Social features are currently paused.",
        variant: "destructive",
      })
      return
    }

    if (address === userToFollow) {
      toast({
        title: "Invalid Action",
        description: "You cannot follow yourself.",
        variant: "destructive",
      })
      return
    }

    try {
      writeContract({
        address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
        abi: SOCIAL_GRAPH_ABI,
        functionName: 'followUser',
        args: [userToFollow],
        chain: config.chains[0],
        account: address,
      })
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Follow Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const unfollowUser = async (userToUnfollow: `0x${string}`) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to unfollow users.",
        variant: "destructive",
      })
      return
    }

    try {
      writeContract({
        address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
        abi: SOCIAL_GRAPH_ABI,
        functionName: 'unfollowUser',
        args: [userToUnfollow],
        chain: config.chains[0],
        account: address,
      })
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Unfollow Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const createPost = async (contentHash: string, hashtags: string[]) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create posts.",
        variant: "destructive",
      })
      return
    }

    if (isPaused) {
      toast({
        title: "Contract Paused",
        description: "Posting is currently paused.",
        variant: "destructive",
      })
      return
    }

    try {
      writeContract({
        address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
        abi: SOCIAL_GRAPH_ABI,
        functionName: 'createPost',
        args: [contentHash, hashtags],
        chain: config.chains[0],
        account: address,
      })
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Post Creation Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const likePost = async (postId: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to like posts.",
        variant: "destructive",
      })
      return
    }

    try {
      writeContract({
        address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
        abi: SOCIAL_GRAPH_ABI,
        functionName: 'likePost',
        args: [postId],
        chain: config.chains[0],
        account: address,
      })
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Like Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const sharePost = async (postId: bigint) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to share posts.",
        variant: "destructive",
      })
      return
    }

    try {
      writeContract({
        address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
        abi: SOCIAL_GRAPH_ABI,
        functionName: 'sharePost',
        args: [postId],
        chain: config.chains[0],
        account: address,
      })
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Share Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  return {
    // Contract state
    followerCount: followerCount ? Number(followerCount) : 0,
    followingCount: followingCount ? Number(followingCount) : 0,
    postCount: postCount ? Number(postCount) : 0,
    totalPosts: totalPosts ? Number(totalPosts) : 0,
    isPaused: !!isPaused,
    
    // Transaction state
    isProcessing: isPending || isConfirming || !!currentTxHash,
    isConnected: !!address,
    
    // Actions
    followUser,
    unfollowUser,
    createPost,
    likePost,
    sharePost,
    
    // Refresh functions
    refetchFollowerCount,
    refetchFollowingCount,
    refetchPostCount,
  }
}
