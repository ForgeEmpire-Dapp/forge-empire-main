import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAccount } from 'wagmi'

export interface ActivityItem {
  id: string
  type: 'post' | 'like' | 'share' | 'achievement' | 'quest' | 'follow' | 'badge'
  title: string
  description?: string
  timestamp: Date
  xpEarned?: number
  icon?: React.ReactNode
  metadata?: Record<string, unknown>
}

export const useActivity = (address?: string) => {
  const { address: connectedAddress } = useAccount()
  const userAddress = address || connectedAddress

  const { data: activities, isLoading: loading, error } = useQuery<ActivityItem[], Error>({
    queryKey: ['activity', userAddress],
    queryFn: async () => {
      if (!userAddress) return []

      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_address', userAddress)
        .order('timestamp', { ascending: false })

      if (error) {
        throw new Error(error.message)
      }

      return data.map(item => ({ ...item, timestamp: new Date(item.timestamp) }))
    },
    enabled: !!userAddress,
  })

  return { activities, loading, error }
}
