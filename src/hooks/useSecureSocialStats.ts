import { useQuery } from '@tanstack/react-query'
import { logger } from '@/utils/logger'
import { supabase } from '@/integrations/supabase/client'

// Secure hook for getting social stats that protects wallet addresses
export const useSecureSocialStats = (profileId?: string) => {
  return useQuery({
    queryKey: ['secureSocialStats', profileId],
    queryFn: async () => {
      if (!profileId) return null

      const { data, error } = await supabase.rpc('get_social_stats_by_profile', {
        profile_id: profileId
      })

      if (error) {
        logger.error('Error fetching social stats', { error: error?.message, profileId })
        return null
      }

      return data?.[0] || {
        posts_count: 0,
        likes_count: 0,
        shares_count: 0,
        followers_count: 0,
        following_count: 0,
        last_updated: null
      }
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Hook for getting public social stats (with hashed addresses for privacy)
export const usePublicSocialStats = () => {
  return useQuery({
    queryKey: ['publicSocialStats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_social_stats')

      if (error) {
        logger.error('Error fetching public social stats', { error: error?.message })
        return []
      }

      return data || []
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Hook for getting own social stats (authenticated users only)
export const useOwnSocialStats = (userAddress?: string) => {
  return useQuery({
    queryKey: ['ownSocialStats', userAddress],
    queryFn: async () => {
      if (!userAddress) return null

      // Get own profile first
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_address', userAddress.toLowerCase())
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .limit(1)

      if (!profiles?.[0]) return null

      // Then get social stats using the secure function
      const { data, error } = await supabase.rpc('get_social_stats_by_profile', {
        profile_id: profiles[0].id
      })

      if (error) {
        logger.error('Error fetching own social stats', { error: error?.message, userAddress })
        return null
      }

      return data?.[0] || {
        posts_count: 0,
        likes_count: 0,
        shares_count: 0,
        followers_count: 0,
        following_count: 0,
        last_updated: null
      }
    },
    enabled: !!userAddress,
    staleTime: 2 * 60 * 1000, // 2 minutes for own stats
  })
}