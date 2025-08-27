import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAccount } from 'wagmi'
import { NFTBadge } from '@/components/profile/BadgeGallery'

export const useAchievements = (address?: string) => {
  const { address: connectedAddress } = useAccount()
  const userAddress = address || connectedAddress

  const { data: achievements, isLoading: loading, error } = useQuery<NFTBadge[], Error>({
    queryKey: ['achievements', userAddress],
    queryFn: async () => {
      if (!userAddress) return []

      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_address', userAddress)

      if (error) {
        throw new Error(error.message)
      }

      return data.map(item => ({ ...item, earnedAt: new Date(item.earnedAt) }))
    },
    enabled: !!userAddress,
  })

  return { achievements, loading, error }
}
