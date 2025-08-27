// Migration guide for verification_status_safe security fix
import { supabase } from '@/integrations/supabase/client'
// The view has been replaced with a secure function

// OLD INSECURE USAGE (DO NOT USE):
// const { data } = await supabase.from('verification_status_safe').select('*')

// NEW SECURE USAGE:
export const getVerificationStatus = async (targetUserId?: string) => {
  const { data, error } = await supabase.rpc('get_verification_status_safe', {
    target_user_id: targetUserId || null
  })
  
  if (error) {
    console.error('Error fetching verification status:', error)
    return null
  }
  
  return data
}

// Examples:
// Get current user's verification status
// const userStatus = await getVerificationStatus()

// Get specific user's status (admin/service role only)
// const specificUserStatus = await getVerificationStatus('user-uuid-here')

// The function automatically enforces security:
// - Regular users: Can only see their own data
// - Service role: Can see all data
// - Unauthenticated: No access