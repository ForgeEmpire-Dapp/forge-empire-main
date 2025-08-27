import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface UserAnalyticsSummary {
  event_name: string
  event_count: number
  first_seen: string
  last_seen: string
}

interface AnalyticsSecurityStatus {
  total_events: number
  events_with_pii: number
  events_anonymized: number
  oldest_event_date: string
  retention_compliance: boolean
}

export const useSecureAnalytics = () => {
  const { toast } = useToast()

  // Hook for users to view their own analytics summary (secure)
  const { data: userAnalytics, isLoading: isLoadingUserAnalytics, error: userAnalyticsError } = useQuery({
    queryKey: ['user-analytics-summary'],
    queryFn: async (): Promise<UserAnalyticsSummary[]> => {
      const { data, error } = await supabase
        .rpc('get_user_analytics_summary', { days_back: 30 })

      if (error) {
        console.error('Error fetching user analytics:', error)
        throw error
      }

      return data || []
    },
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Hook for admins to check security status
  const { data: securityStatus, isLoading: isLoadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['analytics-security-status'],
    queryFn: async (): Promise<AnalyticsSecurityStatus | null> => {
      const { data, error } = await supabase
        .rpc('get_analytics_security_status')

      if (error) {
        console.error('Error fetching security status:', error)
        return null
      }

      return data?.[0] || null
    },
    retry: 1,
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: false, // Only fetch when explicitly called by admins
  })

  // Function to trigger cleanup (admin only)
  const triggerCleanup = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('analytics-cleanup')

      if (error) {
        toast({
          title: "Cleanup Failed",
          description: `Error: ${error.message}`,
          variant: "destructive",
        })
        return false
      }

      if (data.success) {
        toast({
          title: "Analytics Cleanup Completed",
          description: data.message || "Data cleanup and anonymization completed successfully",
        })
        refetchStatus() // Refresh security status
        return true
      } else {
        toast({
          title: "Cleanup Failed",
          description: data.error || "Unknown error during cleanup",
          variant: "destructive",
        })
        return false
      }
    } catch (error: unknown) {
      console.error('Cleanup trigger error:', error)
      toast({
        title: "Cleanup Error",
        description: error.message || "Failed to trigger analytics cleanup",
        variant: "destructive",
      })
      return false
    }
  }

  // Function to track events securely (automatically minimized)
  const trackSecureEvent = async (eventName: string, properties: Record<string, unknown> = {}) => {
    try {
      // Note: The trigger will automatically minimize sensitive data
      const { error } = await supabase
        .from('analytics_events')
        .insert({
          event_name: eventName,
          event_properties: properties,
          page_url: window.location.pathname,
          user_agent: navigator.userAgent,
        })

      if (error) {
        console.error('Error tracking event:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Event tracking error:', error)
      return false
    }
  }

  return {
    // User data
    userAnalytics,
    isLoadingUserAnalytics,
    userAnalyticsError,
    
    // Admin functions
    securityStatus,
    isLoadingStatus,
    refetchStatus,
    triggerCleanup,
    
    // Secure tracking
    trackSecureEvent,
  }
}