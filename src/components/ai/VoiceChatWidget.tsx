import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAccount } from 'wagmi'
import { useUserXP, useUserLevel, useUserBadges, useTokenBalance } from '@/hooks/contracts'
import { useOnboardingQuests } from '@/hooks/useOnboardingQuests'
import { useToast } from '@/components/ui/use-toast'
import { logger, logUserAction, logWebSocketEvent } from '@/utils/logger'
import { secureLog, logComponentError } from '@/utils/secureLogger'
import { Message, VoiceChatWidgetProps } from './types'
import { AudioRecorder } from './AudioRecorder'
import { AudioQueue } from './AudioQueue'
import { encodeAudioForAPI } from './utils'
import { useVoiceSocket } from './useVoiceSocket'
import { VoiceChatHeader } from './VoiceChatHeader'
import { MessageArea } from './MessageArea'
import { VoiceControls } from './VoiceControls'
import { QuickActions } from './QuickActions'

export const VoiceChatWidget = ({ className }: VoiceChatWidgetProps) => {
  const { address } = useAccount()
  const { toast } = useToast()
  
  // Contract hooks for real data
  const { data: userXP } = useUserXP()
  const { data: userLevel } = useUserLevel()
  const { badgeCount } = useUserBadges()
  const { data: tokenBalance } = useTokenBalance()
  const { nextStep } = useOnboardingQuests()
  
  // UI States
  const [isRecording, setIsRecording] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentTranscript, setCurrentTranscript] = useState('')
  
  const addMessage = (type: 'user' | 'ai', content: string, audioTranscript = false) => {
    const message: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      audioTranscript
    }
    setMessages(prev => [...prev, message])
  }

  const { 
    wsRef, 
    isConnected, 
    isReconnecting, 
    metrics, 
    voiceSettings, 
    setVoiceSettings, 
    connectToChat, 
    resetConnection 
  } = useVoiceSocket(addMessage, userLevel, userXP, address)
  
  // Refs
  const recorderRef = useRef<AudioRecorder | null>(null)
  const audioQueueRef = useRef<AudioQueue | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Initialize audio context and queue
  useEffect(() => {
    audioContextRef.current = new AudioContext({ sampleRate: 24000 })
    audioQueueRef.current = new AudioQueue(audioContextRef.current)
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const startRecording = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      logComponentError('VoiceChatWidget', 'send audio', 'WebSocket not connected')
      return
    }

    try {
      secureLog.log("Starting recording", { component: 'VoiceChatWidget' })
      recorderRef.current = new AudioRecorder((audioData) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const encodedAudio = encodeAudioForAPI(audioData)
          const audioEvent = {
            type: 'input_audio_buffer.append',
            audio: encodedAudio
          }
          wsRef.current.send(JSON.stringify(audioEvent))
        }
      })

      await recorderRef.current.start()
      setIsRecording(true)
    } catch (error) {
      logComponentError('VoiceChatWidget', 'start recording', error as Error)
    }
  }

  const stopRecording = () => {
    secureLog.log("Stopping recording", { component: 'VoiceChatWidget' })
    if (recorderRef.current) {
      recorderRef.current.stop()
      recorderRef.current = null
    }
    setIsRecording(false)
  }

  const sendTextMessage = (text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      logComponentError('VoiceChatWidget', 'send text', 'WebSocket not connected')
      return
    }

    secureLog.log("Sending text message", { component: 'VoiceChatWidget' })
    addMessage('user', text)

    const messageEvent = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text
          }
        ]
      }
    }

    wsRef.current.send(JSON.stringify(messageEvent))
    wsRef.current.send(JSON.stringify({ type: 'response.create' }))
  }

  const handleQuickAction = (action: string) => {
    const realUserData = {
      level: userLevel ? Number(userLevel) : 0,
      xp: userXP ? Number(userXP) : 0,
      badges: badgeCount,
      tokens: tokenBalance ? Number(tokenBalance) / Math.pow(10, 18) : 0,
      nextQuest: nextStep?.[1]?.title || 'None available'
    }
    
    const quickActions = {
      stats: `My current stats: Level ${realUserData.level}, ${realUserData.xp} XP, ${realUserData.badges} badges, ${realUserData.tokens.toFixed(2)} tokens. Tell me how I'm progressing!`,
      quests: `I have ${realUserData.badges} badges and my next quest is "${realUserData.nextQuest}". What should I focus on?`,
      leaderboard: "Show me the current leaderboard and where I rank",
      badges: `I have ${realUserData.badges} badges. Explain how the badge system works and what I should aim for next`,
      streaks: "Tell me about daily streaks and how they help with XP and rewards",
      staking: `I have ${realUserData.tokens.toFixed(2)} SFORGE tokens. Explain staking benefits and strategies`,
      dao: "How does the DAO work and how can I participate in governance?"
    }
    
    const message = quickActions[action as keyof typeof quickActions]
    if (message) {
      sendTextMessage(message)
    }
  }

  const handleVoiceChange = (newVoice: string) => {
    setVoiceSettings(prev => ({ ...prev, personality: newVoice }))
    
    // Send voice update to backend
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const voiceUpdate = {
        type: "session.update",
        session: {
          voice: newVoice
        }
      }
      wsRef.current.send(JSON.stringify(voiceUpdate))
      
      toast({
        title: "Voice Updated",
        description: `Changed to ${newVoice} personality`
      })
    }
  }

  return (
    <Card className={cn("bg-gradient-card border-border/50", className)}>
      <VoiceChatHeader 
        isConnected={isConnected} 
        isReconnecting={isReconnecting} 
        isMuted={isMuted} 
        setIsMuted={setIsMuted} 
        metrics={metrics} 
        voiceSettings={voiceSettings} 
        handleVoiceChange={handleVoiceChange} 
        resetConnection={resetConnection} 
        connectToChat={connectToChat} 
      />

      <CardContent className="space-y-4">
        <MessageArea messages={messages} currentTranscript={currentTranscript} />
        <VoiceControls 
          isRecording={isRecording} 
          isConnected={isConnected} 
          startRecording={startRecording} 
          stopRecording={stopRecording} 
        />
        <QuickActions isConnected={isConnected} handleQuickAction={handleQuickAction} />
        
        {/* Performance Metrics */}
        {isConnected && metrics.messagesProcessed > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>Messages: {metrics.messagesProcessed}</span>
            <span>Errors: {metrics.errorCount}</span>
            <span>Uptime: {Math.round(metrics.connectionUptime / 1000)}s</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}