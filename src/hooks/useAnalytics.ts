import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAccount } from 'wagmi'

export interface AnalyticsData {
  profileViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  followerGrowth: number
  engagementRate: number
  lastActiveAt: Date
  joinedAt: Date
  topContent: {
    type: string
    title: string
    engagement: number
  }[]
}

export const useAnalytics = (address?: string) => {
  const { address: connectedAddress } = useAccount()
  const userAddress = address || connectedAddress

  const { data: analytics, isLoading: loading, error } = useQuery<AnalyticsData, Error>({
    queryKey: ['analytics', userAddress],
    queryFn: async () => {
      if (!userAddress) throw new Error('User address is required')

      const { data, error } = await supabase
        .rpc('get_user_analytics', { user_address: userAddress })

      if (error) {
        throw new Error(error.message)
      }

      return {
        ...data,
        lastActiveAt: new Date(data.lastActiveAt),
        joinedAt: new Date(data.joinedAt),
      }
    },
    enabled: !!userAddress,
  })

  return { analytics, loading, error }
}
