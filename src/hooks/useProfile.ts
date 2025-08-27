import { useState } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { logger, logUserAction } from '@/utils/logger'

export interface ProfileData {
  id?: string
  user_id?: string
  user_address: string
  username?: string
  bio?: string
  avatar_url?: string
  banner_url?: string
  social_links?: Record<string, string> | null
  display_name?: string
  location?: string
  website?: string
  visibility?: 'public' | 'friends' | 'private'
  showEmail?: boolean
  showWallet?: boolean
  emailNotifications?: boolean
  postLikes?: boolean
  postComments?: boolean
  newFollowers?: boolean
  questComplete?: boolean
  achievements?: boolean
  weeklyDigest?: boolean
  allowDirectMessages?: boolean
  showOnlineStatus?: boolean
  publicActivity?: boolean
  created_at?: string
  updated_at?: string
}

export const useProfile = (targetAddress?: string) => {
  const { address: connectedAddress } = useAccount()
  const { user, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const address = targetAddress || connectedAddress

  
  const [saving, setSaving] = useState(false)

  const { data: profile, isLoading: loading, error } = useQuery<ProfileData | null, Error>({
    queryKey: ['profile', address, isAuthenticated],
    queryFn: async () => {
      if (!address) return null

      try {
        const isOwnProfile = connectedAddress?.toLowerCase() === address.toLowerCase()

        if (isOwnProfile && isAuthenticated) {
          const { data, error } = await supabase.rpc('get_own_profile')
          if (error) {
            logger.error('Error fetching own profile', { error: error.message })
            throw error
          }
          return data && data.length > 0 ? {
            ...data[0],
            social_links: data[0].social_links as Record<string, string> | null,
            visibility: data[0].visibility as 'public' | 'friends' | 'private'
          } : null
        } else if (isAuthenticated) {
          const { data, error } = await supabase.rpc('get_public_profile', {
            profile_user_address: address.toLowerCase()
          })
          if (error) {
            logger.error('Error fetching public profile', { error: error.message, targetAddress: address })
            throw error
          }
          return data && data.length > 0 ? {
            ...data[0],
            user_address: data[0].user_address || address.toLowerCase(),
            social_links: data[0].social_links as Record<string, string> | null,
            visibility: data[0].visibility as 'public' | 'friends' | 'private'
          } : null
        } else {
          const { data, error } = await supabase.rpc('get_public_profile_safe', {
            profile_user_address: address.toLowerCase()
          })
          if (error) {
            logger.error('Error fetching public profile by address', { error: error.message, address })
            throw error
          }
          return data && data.length > 0 ? {
            ...data[0],
            user_address: address.toLowerCase(),
            social_links: data[0].social_links as Record<string, string> | null,
            visibility: data[0].visibility as 'public' | 'friends' | 'private'
          } : null
        }
      } catch (err) {
        logger.error('Error in profile fetch', { error: err instanceof Error ? err.message : 'Unknown error', targetAddress: address })
        throw err
      }
    },
    enabled: !!address,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // use useEnhancedDataFetching if needed
  })

  // Save profile data - requires authentication
  const saveProfile = async (profileData: Partial<ProfileData>) => {
    if (!address) return { error: 'No wallet connected' }
    if (!isAuthenticated) return { error: 'Authentication required to save profile' }

    setSaving(true)
    try {
      // For new profiles, use the secure function
      if (!profile?.id) {
        const profileDataJson = {
          username: profileData.username,
          bio: profileData.bio,
          display_name: profileData.display_name,
          location: profileData.location,
          website: profileData.website,
          social_links: profileData.social_links || {}
        }

        const { data, error } = await supabase.rpc('create_profile_with_wallet', {
          wallet_address: address,
          profile_data: profileDataJson
        })

        if (error) {
          logger.error('Error creating profile', { error: error.message })
          toast({
            title: 'Error',
            description: 'Failed to create profile. Please try again.',
            variant: 'destructive'
          })
          return { error }
        }

        // Fetch the created profile using secure function
        const { data: newProfileData, error: fetchError } = await supabase.rpc('get_own_profile')

        if (fetchError) {
          logger.error('Error fetching new profile after creation', { error: fetchError.message })
          return { error: fetchError }
        }

        if (newProfileData && newProfileData.length > 0) {
          const transformedProfile = {
            ...newProfileData[0],
            social_links: newProfileData[0].social_links as Record<string, string> | null,
            visibility: newProfileData[0].visibility as 'public' | 'friends' | 'private'
          }
          // setProfile(transformedProfile) // React Query manages this
          toast({
            title: 'Success',
            description: 'Profile created successfully!'
          })
          return { data: newProfileData[0] }
        } else {
          return { error: 'Profile not found after creation' }
        }
      } else {
        // Update existing profile
        const dataToSave = {
          ...profileData,
          updated_at: new Date().toISOString(),
        }

        const result = await supabase
          .from('profiles')
          .update(dataToSave)
          .eq('user_id', user?.id)
          .select()
          .single()

        if (result.error) {
          logger.error('Error updating profile', { error: result.error.message })
          toast({
            title: 'Error',
            description: 'Failed to update profile. Please try again.',
            variant: 'destructive'
          })
          return { error: result.error }
        }

        const transformedProfile = {
          ...result.data,
          social_links: result.data.social_links as Record<string, string> | null,
          visibility: result.data.visibility as 'public' | 'friends' | 'private'
        }
        // setProfile(transformedProfile) // React Query manages this
        toast({
          title: 'Success',
          description: 'Profile updated successfully!'
        })
        return { data: result.data }
      }
    } catch (error) {
      logger.error('Profile save error', { error: error instanceof Error ? error.message : 'Unknown error' })
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive'
      })
      return { error }
    } finally {
      setSaving(false)
    }
  }

  // Upload file to storage - requires authentication
  const uploadFile = async (file: File, bucket: 'avatars' | 'banners') => {
    if (!address) return { error: 'No wallet connected' }
    if (!isAuthenticated) return { error: 'Authentication required to upload files' }

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${address.toLowerCase()}/image.${fileExt}`

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true })

      if (error) {
        logger.error('Error uploading file', { error: error.message, bucket })
        return { error }
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName)

      return { data: publicUrl }
    } catch (error) {
      logger.error('File upload error', { error: error instanceof Error ? error.message : 'Unknown error', bucket })
      return { error }
    }
  }

  const isOwnProfile = connectedAddress?.toLowerCase() === address?.toLowerCase()

  return {
    profile,
    loading,
    saving,
    saveProfile,
    uploadFile,
    isOwnProfile,
    hasProfile: !!profile
  }
}