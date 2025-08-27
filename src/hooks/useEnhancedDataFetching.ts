import { useActiveTabRefetch } from './useActiveTabRefetch'
import { useEffect, useRef } from 'react'

interface EnhancedRefetchConfig {
  /** Function to call for immediate refetch */
  refetchImmediate: () => void
  /** Function to call for background refetch */
  refetchBackground?: () => void
  /** Aggressive refetch interval in ms (when active) */
  aggressiveInterval?: number
  /** Conservative refetch interval in ms (when inactive) */
  conservativeInterval?: number
  /** Enable the enhanced refetching */
  enabled?: boolean
}

/**
 * Multi-tier data refetching strategy for GameFi interfaces
 * - Aggressive refetching when user is actively engaged
 * - Conservative refetching when tab is in background
 */
export const useEnhancedDataFetching = ({
  refetchImmediate,
  refetchBackground,
  aggressiveInterval = 60000, // 1 minute for active (conservative default)
  conservativeInterval = 300000, // 5 minutes for background (very conservative)
  enabled = true
}: EnhancedRefetchConfig) => {
  const isActiveTab = useActiveTabRefetch()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!enabled) return

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Set up appropriate refetch strategy
    if (isActiveTab) {
      // Aggressive refetching for active users
      intervalRef.current = setInterval(() => {
        refetchImmediate()
      }, aggressiveInterval)
    } else {
      // Conservative refetching for background tabs
      intervalRef.current = setInterval(() => {
        if (refetchBackground) {
          refetchBackground()
        } else {
          refetchImmediate() // Fallback to immediate refetch
        }
      }, conservativeInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isActiveTab, refetchImmediate, refetchBackground, aggressiveInterval, conservativeInterval, enabled])

  // Immediate refetch when tab becomes active
  useEffect(() => {
    if (isActiveTab && enabled) {
      refetchImmediate()
    }
  }, [isActiveTab, refetchImmediate, enabled])

  return {
    isActiveTab,
    currentStrategy: isActiveTab ? 'aggressive' : 'conservative',
    intervalTime: isActiveTab ? aggressiveInterval : conservativeInterval
  }
}