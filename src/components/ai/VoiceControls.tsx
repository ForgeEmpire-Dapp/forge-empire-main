import { Button } from '@/components/ui/button'
import { Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceControlsProps {
  isRecording: boolean
  isConnected: boolean
  startRecording: () => void
  stopRecording: () => void
}

export const VoiceControls = ({ isRecording, isConnected, startRecording, stopRecording }: VoiceControlsProps) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={!isConnected}
        className={cn(
          "flex-1",
          isRecording && "bg-destructive hover:bg-destructive/90"
        )}
      >
        {isRecording ? (
          <>
            <MicOff className="w-4 h-4 mr-2" />
            Stop Recording
          </>
        ) : (
          <>
            <Mic className="w-4 h-4 mr-2" />
            Start Voice Chat
          </>
        )}
      </Button>
    </div>
  )
}
