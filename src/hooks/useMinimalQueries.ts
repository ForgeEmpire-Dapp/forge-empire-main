import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { useActiveTabRefetch } from './useActiveTabRefetch'

// Conservative cache times for different data types
export const MINIMAL_CACHE_TIMES = {
  STATIC: 1000 * 60 * 30, // 30 minutes for static data
  SEMI_STATIC: 1000 * 60 * 10, // 10 minutes for semi-static data
  DYNAMIC: 1000 * 60 * 5, // 5 minutes for dynamic data
  USER_SPECIFIC: 1000 * 60 * 2, // 2 minutes for user-specific data
} as const

interface MinimalQueryConfig<T> extends Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> {
  queryKey: string[]
  queryFn: () => Promise<T>
  cacheTime?: keyof typeof MINIMAL_CACHE_TIMES
  refetchOnActiveTab?: boolean
}

/**
 * Minimal query hook that reduces unnecessary API calls
 */
export const useMinimalQuery = <T>({
  queryKey,
  queryFn,
  cacheTime = 'DYNAMIC',
  refetchOnActiveTab = false,
  ...options
}: MinimalQueryConfig<T>) => {
  const isActiveTab = useActiveTabRefetch()

  return useQuery({
    queryKey,
    queryFn,
    staleTime: MINIMAL_CACHE_TIMES[cacheTime],
    gcTime: MINIMAL_CACHE_TIMES[cacheTime] * 2, // Keep in cache longer
    refetchOnWindowFocus: false, // Disable aggressive refetching
    refetchOnMount: false, // Only fetch if stale
    refetchInterval: false, // No auto-refetch
    refetchIntervalInBackground: false,
    refetchOnReconnect: 'always', // Only refetch on reconnect
    retry: 1, // Limit retries
    retryDelay: 5000, // 5 second delay between retries
    enabled: refetchOnActiveTab ? isActiveTab : true,
    ...options
  })
}

/**
 * Hook for user-specific data with minimal refetching
 */
export const useMinimalUserQuery = <T>(
  userAddress: string | undefined,
  queryKey: string[],
  queryFn: () => Promise<T>,
  options?: Partial<MinimalQueryConfig<T>>
) => {
  return useMinimalQuery({
    queryKey: ['user', userAddress, ...queryKey],
    queryFn,
    cacheTime: 'USER_SPECIFIC',
    enabled: !!userAddress,
    ...options
  })
}