import { useWatchContractEvent, ReadContractEventReturnType } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { useEffect } from 'react'

import { abi as SOCIAL_GRAPH_ABI } from '@/contract-abi/SocialGraph.sol/SocialGraph.json';

export const useRealtimeSocial = () => {
  const queryClient = useQueryClient()

  // Watch for new posts
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    eventName: 'PostCreated',
    onLogs: (logs: ReadContractEventReturnType) => {
      console.log('New post created:', logs)
      // Invalidate relevant queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['globalFeed'] })
      queryClient.invalidateQueries({ queryKey: ['userPosts'] })
      queryClient.invalidateQueries({ queryKey: ['socialStats'] })
    },
  })

  // Watch for post likes
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    eventName: 'PostLiked',
    onLogs: (logs: ReadContractEventReturnType) => {
      console.log('Post liked:', logs)
      // Invalidate post queries to show updated like counts
      logs.forEach(log => {
        if (log.args?.postId) {
          queryClient.invalidateQueries({ 
            queryKey: ['post', Number(log.args.postId)] 
          })
        }
      })
    },
  })

  // Watch for post shares
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    eventName: 'PostShared',
    onLogs: (logs: ReadContractEventReturnType) => {
      console.log('Post shared:', logs)
      logs.forEach(log => {
        if (log.args?.postId) {
          queryClient.invalidateQueries({ 
            queryKey: ['post', Number(log.args.postId)] 
          })
        }
      })
    },
  })

  // Watch for follow events
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    eventName: 'UserFollowed',
    onLogs: (logs: ReadContractEventReturnType) => {
      console.log('User followed:', logs)
      // Invalidate social stats and follow status
      queryClient.invalidateQueries({ queryKey: ['socialStats'] })
      queryClient.invalidateQueries({ queryKey: ['isFollowing'] })
      queryClient.invalidateQueries({ queryKey: ['activityFeed'] })
    },
  })

  return {
    // This hook sets up real-time listeners
    // Returns empty object since it's just for side effects
  }
}