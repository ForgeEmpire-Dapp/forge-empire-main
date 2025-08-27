import { useState, useEffect, useRef } from 'react'

interface DataFreshnessConfig {
  /** Maximum age before data is considered stale (ms) */
  maxAge?: number
  /** Enable freshness tracking */
  enabled?: boolean
}

export type DataState = 'fresh' | 'stale' | 'loading' | 'error'

/**
 * Track data freshness and provide visual feedback for stale data
 */
export const useDataFreshness = ({
  maxAge = 30000, // 30 seconds default
  enabled = true
}: DataFreshnessConfig = {}) => {
  const [dataState, setDataState] = useState<DataState>('loading')
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Mark data as fresh after successful fetch
  const markFresh = () => {
    if (!enabled) return
    
    const now = new Date()
    setLastFetch(now)
    setDataState('fresh')

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set timeout to mark as stale
    timeoutRef.current = setTimeout(() => {
      setDataState('stale')
    }, maxAge)
  }

  // Mark data as loading
  const markLoading = () => {
    if (!enabled) return
    setDataState('loading')
  }

  // Mark data as error
  const markError = () => {
    if (!enabled) return
    setDataState('error')
  }

  // Get age of data in seconds
  const getDataAge = () => {
    if (!lastFetch) return null
    return Math.floor((Date.now() - lastFetch.getTime()) / 1000)
  }

  // Check if data needs refresh
  const needsRefresh = () => {
    if (!lastFetch) return true
    return Date.now() - lastFetch.getTime() > maxAge
  }

  // Get visual indicator classes based on state
  const getStateClasses = () => {
    switch (dataState) {
      case 'fresh':
        return 'border-green-200 bg-green-50 text-green-800'
      case 'stale':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800'
      case 'loading':
        return 'border-blue-200 bg-blue-50 text-blue-800'
      case 'error':
        return 'border-red-200 bg-red-50 text-red-800'
      default:
        return ''
    }
  }

  // Get indicator icon
  const getStateIcon = () => {
    switch (dataState) {
      case 'fresh':
        return '🟢'
      case 'stale':
        return '🟡'
      case 'loading':
        return '🔄'
      case 'error':
        return '🔴'
      default:
        return '⚪'
    }
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    dataState,
    lastFetch,
    markFresh,
    markLoading,
    markError,
    getDataAge,
    needsRefresh,
    getStateClasses,
    getStateIcon,
    isStale: dataState === 'stale',
    isFresh: dataState === 'fresh',
    isLoading: dataState === 'loading',
    hasError: dataState === 'error'
  }
}