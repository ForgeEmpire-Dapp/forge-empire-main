import { useEffect } from 'react'
import { useAccount } from 'wagmi'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from './useAuth'

interface AnalyticsEvent {
  event_name: string
  event_properties: Record<string, unknown>
}

class SecureEnhancedAnalyticsService {
  private batchSize = 10
  private flushInterval = 30000 // 30 seconds
  private events: (AnalyticsEvent & { user_id: string })[] = []
  private batchTimer: NodeJS.Timeout | null = null

  constructor() {
    // Auto-flush events periodically
    this.batchTimer = setInterval(() => {
      this.flush()
    }, this.flushInterval)
  }

  track(event: string, properties: Record<string, unknown> = {}, userId?: string) {
    // Only track if user is authenticated
    if (!userId) {
      // Skip tracking - no authenticated user
      return
    }

    const analyticsEvent = {
      event_name: event,
      user_id: userId,
      event_properties: {
        ...properties,
        timestamp: Date.now(),
        // Remove sensitive tracking data for privacy
      },
    }

    this.events.push(analyticsEvent)
    // Event tracked

    // Flush if we hit batch size
    if (this.events.length >= this.batchSize) {
      this.flush()
    }
  }

  private async flush() {
    if (this.events.length === 0) return

    const eventsToSend = [...this.events]
    this.events = []

    try {
      // Store in Supabase with proper user_id - all events now have user_id
      const { error } = await supabase
        .from('analytics_events')
        .insert(eventsToSend)

      if (error) throw error

      // Flushed events to Supabase successfully
    } catch (error) {
      // Failed to flush analytics events - put events back
      this.events.unshift(...eventsToSend)
    }
  }

  destroy() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
      this.batchTimer = null
    }
    this.flush()
  }
}

export const enhancedAnalytics = new SecureEnhancedAnalyticsService()

export const useEnhancedAnalytics = () => {
  const { address } = useAccount()
  const { user } = useAuth()

  const trackEvent = (event: string, properties: Record<string, unknown> = {}) => {
    if (user?.id) {
      // Remove sensitive data for privacy and security
      const sanitizedProperties = { ...properties }
      delete sanitizedProperties.wallet_address
      delete sanitizedProperties.privateKey
      delete sanitizedProperties.password
      delete sanitizedProperties.secret
      delete sanitizedProperties.token
      
      enhancedAnalytics.track(event, sanitizedProperties, user.id)
    } else {
      // Cannot track event - user not authenticated
    }
  }

  const trackPageView = (page: string, additionalProps: Record<string, unknown> = {}) => {
    trackEvent('page_view', { 
      page, 
      path: window.location.pathname,
      // Removed search params and full URL for privacy
      ...additionalProps 
    })
  }

  const trackSocialAction = (action: string, details: Record<string, unknown> = {}) => {
    trackEvent('social_action', { action, ...details })
  }

  const trackQuestAction = (action: string, questId?: string, additionalProps: Record<string, unknown> = {}) => {
    trackEvent('quest_action', { action, questId, ...additionalProps })
  }

  const trackProfileAction = (action: string, details: Record<string, unknown> = {}) => {
    trackEvent('profile_action', { action, ...details })
  }

  const trackUserInteraction = (component: string, action: string, details: Record<string, unknown> = {}) => {
    trackEvent('user_interaction', { component, action, ...details })
  }

  const trackPerformance = (metric: string, value: number, details: Record<string, unknown> = {}) => {
    trackEvent('performance_metric', { metric, value, ...details })
  }

  const trackError = (error: string, context: string, details: Record<string, unknown> = {}) => {
    trackEvent('error', { error, context, ...details })
  }

  // Track wallet connection/disconnection without storing wallet address
  useEffect(() => {
    if (address && user?.id) {
      enhancedAnalytics.track('wallet_connected', { action: 'wallet_connected' }, user.id)
    }
  }, [address, user?.id])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      enhancedAnalytics.destroy()
    }
  }, [])

  return {
    trackEvent,
    trackPageView,
    trackSocialAction,
    trackQuestAction,
    trackProfileAction,
    trackUserInteraction,
    trackPerformance,
    trackError,
  }
}