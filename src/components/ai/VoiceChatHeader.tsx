import { CardTitle, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Mic, MicOff, Volume2, VolumeX, MessageSquare, Bot, User, Wifi, WifiOff, Activity } from 'lucide-react'
import { VoiceSettings, PerformanceMetrics } from './types'

interface VoiceChatHeaderProps {
  isConnected: boolean
  isReconnecting: boolean
  isMuted: boolean
  setIsMuted: (isMuted: boolean) => void
  metrics: PerformanceMetrics
  voiceSettings: VoiceSettings
  handleVoiceChange: (newVoice: string) => void
  resetConnection: () => void
  connectToChat: () => void
}

export const VoiceChatHeader = ({ isConnected, isReconnecting, isMuted, setIsMuted, metrics, voiceSettings, handleVoiceChange, resetConnection, connectToChat }: VoiceChatHeaderProps) => {
  return (
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          AI Assistant
          {isReconnecting && <Badge variant="outline" className="animate-pulse">Reconnecting...</Badge>}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? "default" : "destructive"} className="flex items-center gap-1">
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          {metrics.errorCount >= 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetConnection}
              className="text-xs"
            >
              Retry
            </Button>
          )}
          {!isConnected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={connectToChat}
              className="text-xs"
            >
              Connect
            </Button>
          )}
        </div>
      </div>
      
      {/* Voice Settings & Performance */}
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Voice:</label>
          <Select value={voiceSettings.personality} onValueChange={handleVoiceChange}>
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alloy">Alloy</SelectItem>
              <SelectItem value="echo">Echo</SelectItem>
              <SelectItem value="fable">Fable</SelectItem>
              <SelectItem value="onyx">Onyx</SelectItem>
              <SelectItem value="nova">Nova</SelectItem>
              <SelectItem value="shimmer">Shimmer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {metrics.latency > 0 && (
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <Activity className="w-3 h-3" />
            {metrics.latency}ms
          </Badge>
        )}
      </div>
    </CardHeader>
  )
}
