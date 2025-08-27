import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { supabase } from '@/integrations/supabase/client'
import { useEnhancedAnalytics } from './useEnhancedAnalytics' // Consolidated analytics service
import { handleError } from '@/utils/standardErrorHandler'
import { useAuth } from './useAuth'

export interface Notification {
  id: string
  type: 'like' | 'follow' | 'mention' | 'quest_complete' | 'achievement'
  title: string
  message: string
  data: Record<string, unknown>
  read: boolean
  created_at: string
}

export const useNotifications = () => {
  const { address } = useAccount()
  const { trackEvent } = useEnhancedAnalytics() // Using the consolidated analytics service
  const { user } = useAuth()
  

  const queryClient = useQueryClient()

  const { data: notifications = [], isLoading: loading, refetch: fetchNotifications } = useQuery<Notification[]>({ 
    queryKey: ['notifications', address],
    queryFn: async () => {
      if (!address) return []

      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error

        return (data || []).map(item => ({
          ...item,
          data: item.data as Record<string, unknown>
        })) as Notification[]
      } catch (error) {
        handleError(error, { component: 'useNotifications', action: 'Fetch notifications' })
        return []
      }
    },
    enabled: !!address,
    staleTime: 60 * 1000, // 1 minute
  })

  const unreadCount = notifications.filter(n => !n.read).length

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['notifications', address] })

      trackEvent('notification_read', { notificationId })
    } catch (error) {
      handleError(error, { component: 'useNotifications', action: 'Mark notification as read' })
    }
  }

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false)

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['notifications', address] })

      trackEvent('notifications_mark_all_read')
    } catch (error) {
      handleError(error, { component: 'useNotifications', action: 'Mark all notifications as read' })
    }
  }

  // Real-time notifications subscription
  useEffect(() => {
    if (!address) return

    // Get current user to filter notifications
    const setupSubscription = async () => {
      if (!user?.id) return

      const channel = supabase
        .channel('notifications_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload: { new: Notification }) => {
            const newNotification = payload.new
            queryClient.setQueryData(['notifications', address], (oldNotifications: Notification[] | undefined) => {
              return [newNotification, ...(oldNotifications || [])]
            })
            
            trackEvent('notification_received', {
              type: newNotification.type,
              notificationId: newNotification.id
            })
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }

    let cleanupFn: (() => void) | undefined;
    setupSubscription().then(fn => {
      cleanupFn = fn;
    });

    return () => {
      // Ensure cleanupFn is defined before calling it
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [address, user?.id, trackEvent, queryClient])

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  }
}

// Helper function to create notifications via secure edge function
export const createNotification = async (
  type: Notification['type'],
  title: string,
  message: string,
  data: Record<string, unknown> = {},
  queryClient: QueryClient // Add queryClient as an argument
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User must be authenticated')

    const { data: result, error } = await supabase.functions.invoke('realtime-notifications', {
      body: {
        type,
        userId: user.id,
        title,
        message,
        data,
      },
    })

    if (error) throw error

    // Invalidate notifications query to refetch and show the new notification
    queryClient.invalidateQueries({ queryKey: ['notifications', user.id] })

    return { data: result?.notification, error: null }
  } catch (error: unknown) {
    handleError(error, { component: 'useNotifications', action: 'Create notification' })
    return { data: null, error }
  }
}