import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { supabase } from '@/integrations/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'
import { toast } from '@/hooks/use-toast'

interface RealtimeSyncConfig {
  /** Channel name for real-time updates */
  channel: string
  /** Events to listen for */
  events: string[]
  /** Callback when data changes */
  onDataChange?: (payload: unknown) => void
  /** Enable real-time sync */
  enabled?: boolean
}

/**
 * Real-time data synchronization hook for live updates
 * Integrates with Supabase real-time for WebSocket connections
 */
export const useRealtimeSync = ({
  channel,
  events,
  onDataChange,
  enabled = true
}: RealtimeSyncConfig) => {
  const { address } = useAccount()
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!enabled || !address) return

    // Create channel with user-specific room
    const channelName = `${channel}:${address}`
    channelRef.current = supabase.channel(channelName)

    // Listen for connection status
    channelRef.current
      .on('presence', { event: 'sync' }, () => {
        setIsConnected(true)
      })
      .on('presence', { event: 'join' }, () => {
        setIsConnected(true)
      })
      .on('presence', { event: 'leave' }, () => {
        setIsConnected(false)
      })

    // Listen for configured events
    events.forEach(event => {
      channelRef.current.on('broadcast', { event }, (payload: unknown) => {
        setLastUpdate(new Date())
        onDataChange?.(payload)
      })
    })

    // Subscribe to channel
    channelRef.current.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true)
      } else if (status === 'CHANNEL_ERROR') {
        setIsConnected(false)
        toast({
          title: "Connection Issue",
          description: "Lost real-time connection. Data may be stale.",
          variant: "destructive"
        })
      }
    })

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        setIsConnected(false)
      }
    }
  }, [channel, events, onDataChange, enabled, address])

  const broadcast = (event: string, payload: unknown) => {
    if (channelRef.current && isConnected) {
      channelRef.current.send({
        type: 'broadcast',
        event,
        payload
      })
    }
  }

  return {
    isConnected,
    lastUpdate,
    broadcast,
    connectionStatus: isConnected ? 'connected' : 'disconnected'
  }
}