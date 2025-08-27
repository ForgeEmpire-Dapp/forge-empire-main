import { useEffect, useRef, useCallback } from 'react'
import { useActiveTabRefetch } from './useActiveTabRefetch'

interface PerformanceConfig {
  /** Component name for debugging */
  componentName: string
  /** Enable performance monitoring */
  enabled?: boolean
  /** Max refresh rate in ms */
  maxRefreshRate?: number
}

/**
 * Optimized performance hook that prevents excessive re-renders and API calls
 */
export const useOptimizedPerformance = ({
  componentName,
  enabled = true,
  maxRefreshRate = 30000 // 30 seconds minimum between refreshes
}: PerformanceConfig) => {
  const isActiveTab = useActiveTabRefetch()
  const lastRefreshRef = useRef<number>(0)
  const refreshCountRef = useRef<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Throttled refresh function
  const throttledRefresh = useCallback((refreshFn: () => void) => {
    if (!enabled) return

    const now = Date.now()
    const timeSinceLastRefresh = now - lastRefreshRef.current

    if (timeSinceLastRefresh >= maxRefreshRate) {
      refreshFn()
      lastRefreshRef.current = now
      refreshCountRef.current += 1
      
      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.debug(`${componentName}: Refresh #${refreshCountRef.current}, active tab: ${isActiveTab}`)
      }
    }
  }, [enabled, maxRefreshRate, componentName, isActiveTab])

  // Cleanup intervals on unmount
  useEffect(() => {
    const interval = intervalRef.current
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [])

  // Performance monitoring
  const getPerformanceMetrics = useCallback(() => {
    return {
      refreshCount: refreshCountRef.current,
      lastRefresh: lastRefreshRef.current,
      isActiveTab,
      componentName
    }
  }, [isActiveTab, componentName])

  return {
    throttledRefresh,
    getPerformanceMetrics,
    isActiveTab,
    refreshCount: refreshCountRef.current
  }
}