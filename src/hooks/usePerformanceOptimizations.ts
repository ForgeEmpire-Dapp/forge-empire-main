// Performance optimization utilities for React components and hooks
import { useMemo, useCallback, useRef, useEffect } from 'react'

/**
 * Debounced value hook - prevents excessive updates
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Throttled callback hook - limits function execution frequency
 */
export const useThrottle = <T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T => {
  const lastCall = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now()
      
      if (now - lastCall.current >= delay) {
        lastCall.current = now
        return callback(...args)
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        
        timeoutRef.current = setTimeout(() => {
          lastCall.current = Date.now()
          callback(...args)
        }, delay - (now - lastCall.current))
      }
    }) as T,
    [callback, delay]
  )
}

/**
 * Memoized callback that persists across renders
 */
export const useStableCallback = <T extends (...args: unknown[]) => unknown>(
  callback: T
): T => {
  const callbackRef = useRef(callback)
  
  useEffect(() => {
    callbackRef.current = callback
  })
  
  return useCallback(
    ((...args: Parameters<T>) => callbackRef.current(...args)) as T,
    []
  )
}

/**
 * Previous value hook - access previous render's value
 */
export const usePrevious = <T>(value: T): T | undefined => {
  const ref = useRef<T>()
  
  useEffect(() => {
    ref.current = value
  })
  
  return ref.current
}

/**
 * Array memoization with deep equality check
 */
export const useMemoizedArray = <T>(array: T[]): T[] => {
  const stringified = JSON.stringify(array)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => array, [stringified])
}

/**
 * Object memoization with deep equality check
 */
export const useMemoizedObject = <T extends Record<string, unknown>>(obj: T): T => {
  const stringified = JSON.stringify(obj)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => obj, [stringified])
}

/**
 * Intersection Observer hook for lazy loading
 */
export const useIntersectionObserver = (
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [hasIntersected, setHasIntersected] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isElementIntersecting = entry.isIntersecting
        setIsIntersecting(isElementIntersecting)
        
        if (isElementIntersecting && !hasIntersected) {
          setHasIntersected(true)
        }
      },
      options
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [elementRef, options, hasIntersected])

  return { isIntersecting, hasIntersected }
}

/**
 * Local storage hook with serialization
 */
export const useLocalStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      return initialValue
    }
  })

  const setValue = useCallback(
    (value: T) => {
      try {
        setStoredValue(value)
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch (error) {
        console.error(`Error saving to localStorage:`, error)
      }
    },
    [key]
  )

  return [storedValue, setValue]
}

import { useState } from 'react'