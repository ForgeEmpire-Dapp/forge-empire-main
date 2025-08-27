import { useCallback, useMemo, useRef } from 'react'
import { logger } from '@/utils/logger'

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const renderCount = useRef(0)
  const lastRenderTime = useRef(Date.now())

  renderCount.current += 1

  // Log excessive re-renders in development
  if (process.env.NODE_ENV === 'development') {
    const now = Date.now()
    const timeSinceLastRender = now - lastRenderTime.current
    
    if (renderCount.current > 10 && timeSinceLastRender < 100) {
      logger.warn('Excessive re-renders detected', {
        component: componentName,
        renderCount: renderCount.current,
        timeSinceLastRender
      })
    }
    
    lastRenderTime.current = now
  }

  return {
    renderCount: renderCount.current
  }
}

// Memoization helpers
export const useStableCallback = <T extends (...args: unknown[]) => unknown>(callback: T): T => {
  const callbackRef = useRef(callback)
  callbackRef.current = callback
  
  return useCallback((...args: unknown[]) => {
    
    return callbackRef.current(...args)
  }, []) as T
}

// Debounced callback for performance
export const useDebouncedCallback = <T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>()
  
  return useCallback((...args: unknown[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay]) as T
}

// Optimized list renderer with virtualization hints
export const useOptimizedList = <T>(
  items: T[],
  getItemId: (item: T) => string | number,
  maxVisibleItems = 50
) => {
  const stableGetItemId = useCallback(getItemId, [])
  
  const optimizedItems = useMemo(() => {
    // For very large lists, only render visible items
    if (items.length > maxVisibleItems) {
      logger.debug('Large list detected, consider virtualization', {
        itemCount: items.length,
        maxVisible: maxVisibleItems
      })
    }
    
    return items.map(item => ({
      item,
      key: stableGetItemId(item)
    }))
  }, [items, stableGetItemId, maxVisibleItems])

  return optimizedItems
}

// Memory usage tracker (development only)
export const useMemoryTracker = (componentName: string) => {
  if (process.env.NODE_ENV === 'development' && 'memory' in performance) {
    const memoryInfo = (performance as Performance & { memory: PerformanceEntryList }).memory
    
    if (memoryInfo.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB threshold
      logger.warn('High memory usage detected', {
        component: componentName,
        usedHeapSize: `${Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024)}MB`,
        totalHeapSize: `${Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024)}MB`
      })
    }
  }
}

// Bundle size analyzer helper
export const lazyWithPreload = <T extends React.ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>
) => {
  const LazyComponent = React.lazy(importFn)
  
  // Add preload method
  ;(LazyComponent as T & { preload: typeof importFn }).preload = importFn
  
  return LazyComponent
}

// Export React for lazy loading
import React from 'react'