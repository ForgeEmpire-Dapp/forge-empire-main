import { useState, useRef, useEffect, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { logger, logWebSocketEvent } from '@/utils/logger'
import { secureLog, logComponentError } from '@/utils/secureLogger'
import { Message, VoiceSettings, PerformanceMetrics } from './types'

export const useVoiceSocket = (addMessage: (type: 'user' | 'ai', content: string, audioTranscript?: boolean) => void, userLevel: bigint | undefined, userXP: bigint | undefined, address: `0x${string}` | undefined) => {
  const { toast } = useToast()
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({ personality: 'alloy', volume: 0.8 })
  const [metrics, setMetrics] = useState<PerformanceMetrics>({ latency: 0, messagesProcessed: 0, errorCount: 0, connectionUptime: 0 })
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectionStartTime = useRef<number>(0)
  const lastMessageTime = useRef<number>(0)

  const updatePerformanceMetrics = useCallback(() => {
    const now = Date.now()
    if (lastMessageTime.current > 0) {
      const latency = now - lastMessageTime.current
      setMetrics(prev => ({ ...prev, latency, messagesProcessed: prev.messagesProcessed + 1, connectionUptime: connectionStartTime.current > 0 ? now - connectionStartTime.current : 0 }))
    }
    lastMessageTime.current = now
  }, [])

  const connectToChat = useCallback(() => {
    const wsUrl = "wss://alcelhwkxdtchrnscdpf.functions.supabase.co/realtime-chat"
    secureLog.log("Attempting WebSocket connection", { component: 'VoiceChatWidget' })
    connectionStartTime.current = Date.now()
    wsRef.current = new WebSocket(wsUrl)

    wsRef.current.onopen = () => {
      const { voiceSettings, address, userLevel, userXP } = stateRef.current
      secureLog.log("WebSocket connected successfully", { component: 'VoiceChatWidget' })
      setIsConnected(true)
      setIsReconnecting(false)
      
      const voiceUpdate = { type: "session.update", session: { voice: voiceSettings.personality } }
      wsRef.current?.send(JSON.stringify(voiceUpdate))
      
      const greeting = address 
        ? `Hello! I'm your AI assistant for Avax Forge Empire. I can see you're Level ${userLevel ? Number(userLevel) : 'N/A'} with ${userXP ? Number(userXP) : 0} XP. How can I help you today?`
        : 'Hello! I\'m your AI assistant for Avax Forge Empire. Connect your wallet to get personalized assistance with quests, stats, and more!'
      addMessage('ai', greeting)
    }

    wsRef.current.onmessage = async (event) => {
      updatePerformanceMetrics()
      
      const data = JSON.parse(event.data)
      secureLog.log("Received WebSocket message", { component: 'VoiceChatWidget', messageType: data.type })
      
      if (data.type === 'response.audio.delta') {
        secureLog.log("Received audio delta", { component: 'VoiceChatWidget' })
        const binaryString = atob(data.delta)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        
        // if (audioQueueRef.current && !isMuted) {
        //   // Apply volume control
        //   const volumeBytes = new Uint8Array(bytes.length)
        //   for (let i = 0; i < bytes.length; i += 2) {
        //     const sample = (bytes[i] | (bytes[i + 1] << 8)) - 32768
        //     const volumeAdjusted = Math.round(sample * voiceSettings.volume)
        //     const clamped = Math.max(-32768, Math.min(32767, volumeAdjusted)) + 32768
        //     volumeBytes[i] = clamped & 0xFF
        //     volumeBytes[i + 1] = (clamped >> 8) & 0xFF
        //   }
        //   await audioQueueRef.current.addToQueue(volumeBytes)
        // }
      } else if (data.type === 'response.audio_transcript.delta') {
        secureLog.log("Received transcript delta", { component: 'VoiceChatWidget' })
        // setCurrentTranscript(prev => prev + data.delta)
      } else if (data.type === 'response.audio_transcript.done') {
        secureLog.log("Transcript completed", { component: 'VoiceChatWidget' })
        // if (currentTranscript.trim()) {
        //   addMessage('ai', currentTranscript.trim(), true)
        //   setCurrentTranscript('')
        // }
      } else if (data.type === 'input_audio_buffer.speech_started') {
        secureLog.log("Speech started", { component: 'VoiceChatWidget' })
      } else if (data.type === 'input_audio_buffer.speech_stopped') {
        secureLog.log("Speech stopped", { component: 'VoiceChatWidget' })
      } else if (data.type === 'response.created') {
        secureLog.log("Response created", { component: 'VoiceChatWidget' })
      } else if (data.type === 'response.done') {
        secureLog.log("Response completed", { component: 'VoiceChatWidget' })
      } else if (data.type === 'error') {
        logComponentError('VoiceChatWidget', 'WebSocket', data.message)
        addMessage('ai', `Error: ${data.message}`)
        setMetrics(prev => ({ ...prev, errorCount: prev.errorCount + 1 }))
      }
    }

    wsRef.current.onerror = (error) => {
      logComponentError('VoiceChatWidget', 'WebSocket connection', 'Connection error')
      setIsConnected(false)
      stateRef.current.toast({ title: "Connection Error", description: "Lost connection to AI service. Attempting to reconnect...", variant: "destructive" })
      stateRef.current.attemptReconnect()
    }

    wsRef.current.onclose = (event) => {
      secureLog.log("WebSocket closed", { component: 'VoiceChatWidget', code: event.code, clean: event.wasClean })
      setIsConnected(false)
      
      // Only attempt reconnect if it wasn't a clean close
      if (event.code !== 1000) {
        secureLog.log("Attempting reconnection", { component: 'VoiceChatWidget' })
        stateRef.current.attemptReconnect()
      }
    }
  }, [addMessage, updatePerformanceMetrics])

  const attemptReconnect = useCallback(() => {
    const { isReconnecting, metrics } = stateRef.current
    if (isReconnecting) return
    
    const maxRetries = 5
    if (metrics.errorCount >= maxRetries) {
      logger.warn("Max reconnection attempts reached", { errorCount: metrics.errorCount })
      stateRef.current.toast({ title: "Connection Failed", description: "Unable to connect to AI service. Please refresh the page to try again.", variant: "destructive" })
      return
    }
    
    setIsReconnecting(true)
    setMetrics(prev => ({ ...prev, errorCount: prev.errorCount + 1 }))
    
    const delay = Math.min(3000 * Math.pow(1.5, metrics.errorCount), 30000)
    
    reconnectTimeoutRef.current = setTimeout(() => {
      logWebSocketEvent('reconnection_attempt', { attempt: metrics.errorCount + 1, maxRetries })
      stateRef.current.connectToChat()
      setIsReconnecting(false)
    }, delay)
  }, [])

  const stateRef = useRef({ isReconnecting, metrics, toast, voiceSettings, userLevel, userXP, address, connectToChat, attemptReconnect })
  useEffect(() => {
    stateRef.current = { isReconnecting, metrics, toast, voiceSettings, userLevel, userXP, address, connectToChat, attemptReconnect }
  })

  useEffect(() => {
    connectToChat()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connectToChat])

  return {
    wsRef,
    isConnected,
    isReconnecting,
    metrics,
    voiceSettings,
    setVoiceSettings,
    connectToChat,
    resetConnection: () => {
      setMetrics(prev => ({ ...prev, errorCount: 0 }))
      setIsReconnecting(false)
      connectToChat()
    }
  }
}
