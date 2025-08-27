import { useState, useCallback, useMemo } from 'react'
import { useAccount, useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi'
import { readContract } from '@wagmi/core'
import { useQueryClient } from '@tanstack/react-query'
import { avalancheFuji } from 'wagmi/chains'
import { CONTRACT_ADDRESSES } from '@/config/web3'
import { config } from '@/config/web3'
import { toast } from 'sonner'
import { parseEther } from 'viem'
import { useEffect } from 'react'
import { logger, logUserAction } from '@/utils/logger'

import { abi as SOCIAL_GRAPH_ABI } from '@/contract-abi/SocialGraph.sol/SocialGraph.json';

export interface SocialStats {
  posts: number
  likes: number
  shares: number
  followers: number
  following: number
  reports: number
}

export interface SocialPost {
  id: number
  author: string
  content: string
  timestamp: number
  likes: number
  shares: number
  active: boolean
  mediaUrl?: string // Added optional mediaUrl
}

/**
 * @interface SocialComment
 * @description Defines the structure for a social comment.
 * @property {number} id - The unique identifier of the comment.
 * @property {number} postId - The ID of the post the comment belongs to.
 * @property {string} author - The address of the comment author.
 * @property {string} content - The content of the comment.
 * @property {number} timestamp - The timestamp when the comment was created.
 * @property {boolean} active - Indicates if the comment is active (not removed/moderated).
 */
export interface SocialComment {
  id: number
  postId: number
  author: string
  content: string
  timestamp: number
  active: boolean
}

// Main unified social hook
export const useSocial = () => {
  const { address } = useAccount()
  const { writeContract, isPending } = useWriteContract()
  const queryClient = useQueryClient()

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['readContract'] })
  }

  /**
   * @function createPost
   * @description Creates a new social post on the blockchain.
   * @param {string} content - The text content of the post.
   * @param {string} [mediaUrl] - Optional URL to media content (e.g., IPFS hash).
   */
  const createPost = async (content: string, mediaUrl?: string) => {
    if (!address) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      logUserAction('social_create_post', { contentLength: content.length, mediaUrl: mediaUrl || 'none' })
      await writeContract({
        address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
        abi: SOCIAL_GRAPH_ABI,
        functionName: 'createPost',
        args: [content], // Removed mediaUrl as SocialGraph.sol createPost only accepts content
        chain: avalancheFuji,
        account: address,
      })
      
      toast.success('Post created successfully!')
      invalidateQueries()
    } catch (error) {
      logger.error('Failed to create post:', error)
      toast.error('Failed to create post')
    }
  }

  const followUser = async (userToFollow: string) => {
    if (!address) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      logUserAction('social_follow_user', { targetUser: userToFollow })
      await writeContract({
        address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
        abi: SOCIAL_GRAPH_ABI,
        functionName: 'followUser',
        args: [userToFollow as `0x${string}`],
        chain: avalancheFuji,
        account: address,
      })
      
      toast.success('User followed successfully!')
      invalidateQueries()
    } catch (error) {
      logger.error('Failed to follow user:', error)
      toast.error('Failed to follow user')
    }
  }

  const unfollowUser = async (userToUnfollow: string) => {
    if (!address) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      logUserAction('social_unfollow_user', { targetUser: userToUnfollow })
      await writeContract({
        address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
        abi: SOCIAL_GRAPH_ABI,
        functionName: 'unfollowUser',
        args: [userToUnfollow as `0x${string}`],
        chain: avalancheFuji,
        account: address,
      })
      
      toast.success('User unfollowed successfully!')
      invalidateQueries()
    } catch (error) {
      logger.error('Failed to unfollow user:', error)
      toast.error('Failed to unfollow user')
    }
  }

  const likePost = async (postId: number) => {
    if (!address) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      logUserAction('social_like_post', { postId: postId.toString() })
      await writeContract({
        address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
        abi: SOCIAL_GRAPH_ABI,
        functionName: 'likePost',
        args: [BigInt(postId)],
        chain: avalancheFuji,
        account: address,
      })
      
      toast.success('Post liked!')
      invalidateQueries()
    } catch (error) {
      logger.error('Failed to like post:', error)
      toast.error('Failed to like post')
    }
  }

  const unlikePost = async (postId: number) => {
    if (!address) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
        abi: SOCIAL_GRAPH_ABI,
        functionName: 'unlikePost',
        args: [BigInt(postId)],
        chain: avalancheFuji,
        account: address,
      })
      
      toast.success('Post unliked!')
      invalidateQueries()
    } catch (error) {
      logger.error('Failed to unlike post:', error)
      toast.error('Failed to unlike post')
    }
  }

  const sharePost = async (postId: number) => {
    if (!address) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
        abi: SOCIAL_GRAPH_ABI,
        functionName: 'sharePost',
        args: [BigInt(postId)],
        chain: avalancheFuji,
        account: address,
      })
      
      toast.success('Post shared!')
      invalidateQueries()
    } catch (error) {
      logger.error('Failed to share post:', error)
      toast.error('Failed to share post')
    }
  }

  const tipUser = async (userAddress: string, amount: bigint) => {
    if (!address) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      logUserAction('social_tip_user', { targetUser: userAddress, amount: amount.toString() })
      await writeContract({
        address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
        abi: SOCIAL_GRAPH_ABI,
        functionName: 'tipUser',
        args: [userAddress as `0x${string}`, amount],
        value: amount,
        chain: avalancheFuji,
        account: address,
      })

      toast.success('Tip sent successfully!')
    } catch (error) {
      logger.error('Failed to tip user:', error)
      toast.error('Failed to tip user')
    }
  }

  const addComment = async (postId: number, content: string) => {
    if (!address) {
      toast.error('Please connect your wallet')
      return
    }
    if (!content.trim()) {
      toast.error('Comment cannot be empty')
      return
    }

    try {
      logUserAction('social_add_comment', { postId: postId.toString(), contentLength: content.length })
      await writeContract({
        address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
        abi: SOCIAL_GRAPH_ABI,
        functionName: 'addComment',
        args: [BigInt(postId), content],
        chain: avalancheFuji,
        account: address,
      })
      
      toast.success('Comment added successfully!')
      // Invalidate queries related to comments for this post
      queryClient.invalidateQueries({ queryKey: ['readContract', 'getComments', BigInt(postId)] })
    } catch (error) {
      logger.error('Failed to add comment:', error)
      toast.error('Failed to add comment')
    }
  }

  return {
    createPost,
    followUser,
    unfollowUser,
    likePost,
    unlikePost,
    sharePost,
    tipUser,
    addComment, // Added addComment to the returned object
    isPending,
    isConnected: !!address,
  }
}

// Read hooks

/**
 * @function useComments
 * @description Hook to fetch comments for a specific post.
 * @param {number | undefined} postId - The ID of the post to fetch comments for. Used to enable/disable the query.
 * @returns {{ comments: SocialComment[] | undefined }} An object containing the comments for the post.
 */
export const useComments = (postId: number | undefined) => {
  const { data: commentsData, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'getComments',
    args: postId ? [BigInt(postId)] : undefined,
    query: { enabled: !!postId && postId > 0 },
  })

  const comments: SocialComment[] | undefined = commentsData ? 
    (commentsData as [bigint, bigint, string, string, bigint, boolean][]).map(comment => ({
      id: Number(comment[0]),
      postId: Number(comment[1]),
      author: comment[2],
      content: comment[3],
      timestamp: Number(comment[4]),
      active: comment[5],
    })) : undefined

  return { comments, isLoading }
}

export const useSocialStats = (userAddress?: string) => {
  const { data: socialStats } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'getUserSocialStats',
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: { enabled: !!userAddress },
  })

  return {
    stats: socialStats ? {
      posts: Number(socialStats[0]),
      likes: Number(socialStats[1]),
      shares: Number(socialStats[2]),
      followers: Number(socialStats[3]),
      following: Number(socialStats[4]),
      reports: Number(socialStats[5]),
    } as SocialStats : undefined,
  }
}

export const useUserPosts = (userAddress?: string) => {
  const { data: postIds } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'getUserPosts',
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: { enabled: !!userAddress },
  })

  return {
    postIds: postIds ? (postIds as bigint[]).map(id => Number(id)) : [],
  }
}

export const useGlobalFeed = (limit: number = 20) => {
  const { data: nextPostIdBigInt } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'nextPostId',
  })

  const nextPostId = nextPostIdBigInt ? Number(nextPostIdBigInt) : 0

  const allPostIds = useMemo(() => {
    const ids: number[] = []
    for (let i = 1; i < nextPostId; i++) {
      ids.push(i)
    }
    return ids
  }, [nextPostId])

  const feedPostIds = useMemo(() => {
    return allPostIds.slice().reverse().slice(0, limit)
  }, [allPostIds, limit])

  const trendingPosts = feedPostIds
    ? (feedPostIds as readonly number[])
        .sort((a, b) => {
          return b - a
        })
        .slice(0, Math.min(10, limit))
    : []

  return {
    feedPostIds,
    trendingPosts,
  }
}

export const useActivityFeed = (userAddress?: string, limit: number = 20) => {
  const { data: feedPostIds } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'getActivityFeed',
    args: userAddress ? [userAddress as `0x${string}`, BigInt(limit)] : undefined,
    query: { enabled: !!userAddress },
  })

  return {
    feedPostIds: feedPostIds ? (feedPostIds as bigint[]).map(id => Number(id)) : [],
  }
}

export const usePost = (postId: number | undefined) => {
  const { data: postData } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'getPost',
    args: postId ? [BigInt(postId)] : undefined,
    query: { enabled: !!postId && postId > 0 },
  })

  return {
    post: postData ? {
      id: postId!,
      author: postData[0],
      content: postData[1],
      timestamp: Number(postData[2]),
      likes: Number(postData[3]),
      shares: Number(postData[4]),
      active: Boolean(postData[5]),
    } as SocialPost : undefined,
  }
}

export const useIsFollowing = (followerAddress?: string, targetUser?: string) => {
  const { data: isFollowing } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'isFollowing',
    args: followerAddress && targetUser ? [followerAddress as `0x${string}`, targetUser as `0x${string}`] : undefined,
    query: { enabled: !!followerAddress && !!targetUser },
  })

  return isFollowing || false
}

export const usePostInteractionStatus = (postId: number | undefined, userAddress?: string) => {
  const { data: hasLiked } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'hasUserLikedPost',
    args: postId && userAddress ? [BigInt(postId), userAddress as `0x${string}`] : undefined,
    query: { enabled: !!postId && !!userAddress },
  })

  const { data: hasShared } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'hasUserSharedPost',
    args: postId && userAddress ? [BigInt(postId), userAddress as `0x${string}`] : undefined,
    query: { enabled: !!postId && !!userAddress },
  })

  return {
    hasLiked: hasLiked || false,
    hasShared: hasShared || false,
  }
}

export const fetchPostData = async (postId: number): Promise<SocialPost | undefined> => {
  if (!postId || postId <= 0) return undefined

  try {
    const postData = await readContract(config, {
      address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
      abi: SOCIAL_GRAPH_ABI,
      functionName: 'getPost',
      args: [BigInt(postId)],
    })

    return postData ? {
      id: postId,
      author: postData[0],
      content: postData[1],
      timestamp: Number(postData[2]),
      likes: Number(postData[3]),
      shares: Number(postData[4]),
      active: Boolean(postData[5]),
    } as SocialPost : undefined
  } catch (error) {
    console.error(`Failed to fetch post data for postId ${postId}:`, error)
    return undefined
  }
}
