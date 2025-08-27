export interface Message {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: Date
  audioTranscript?: boolean
}

export interface VoiceChatWidgetProps {
  className?: string
}

export interface PerformanceMetrics {
  latency: number
  messagesProcessed: number
  errorCount: number
  connectionUptime: number
}

export interface VoiceSettings {
  personality: string
  volume: number
}
