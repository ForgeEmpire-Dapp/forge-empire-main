import { useQuery } from '@tanstack/react-query'
import { useReadContract } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'

// Cache durations for different types of data
const CACHE_TIMES = {
  STATIC: 1000 * 60 * 60, // 1 hour for rarely changing data
  SEMI_STATIC: 1000 * 60 * 10, // 10 minutes for occasionally changing data
  DYNAMIC: 1000 * 60 * 2, // 2 minutes for frequently changing data
  REAL_TIME: 1000 * 30, // 30 seconds for real-time data
} as const

// Optimized hook for social stats with caching
export const useOptimizedSocialStats = (userAddress?: string) => {
  return useQuery({
    queryKey: ['socialStats', userAddress],
    queryFn: async () => {
      // SECURITY: No longer directly accessing wallet addresses
      // Instead use the secure social stats functions from useSecureSocialStats
      return {
        posts: 0,
        likes: 0,
        shares: 0,
        followers: 0,
        following: 0,
        reports: 0,
      }
    },
    staleTime: CACHE_TIMES.SEMI_STATIC,
    enabled: !!userAddress,
  })
}

// Optimized hook for profile data with smart refetching
export const useOptimizedProfile = (address?: string) => {
  return useQuery({
    queryKey: ['profile', address],
    queryFn: async () => {
      // This would typically fetch from Supabase with caching
      return null
    },
    staleTime: CACHE_TIMES.SEMI_STATIC,
    enabled: !!address,
  })
}

// Optimized hook for global feed with pagination
export const useOptimizedGlobalFeed = (limit: number = 20, offset: number = 0) => {
  return useQuery({
    queryKey: ['globalFeed', limit, offset],
    queryFn: async () => {
      // This would fetch cached/optimized feed data
      return []
    },
    staleTime: CACHE_TIMES.DYNAMIC,
    placeholderData: (previousData) => previousData, // Keep old data while fetching new
  })
}

// Performance monitoring for query performance
export const useQueryPerformanceMonitor = () => {
  return {
    trackQueryTime: (queryKey: string, startTime: number) => {
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Log slow queries in development
      if (process.env.NODE_ENV === 'development' && duration > 1000) {
        console.warn(`Slow query detected: ${queryKey} took ${duration}ms`)
      }
      
      // Track in analytics
      if (typeof window !== 'undefined' && 'gtag' in window) {
        // @ts-expect-error: gtag is not defined on window
        window.gtag('event', 'query_performance', {
          query_key: queryKey,
          duration_ms: Math.round(duration),
        })
      }
    }
  }
}