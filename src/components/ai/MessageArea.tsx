import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Message } from './types'

interface MessageAreaProps {
  messages: Message[]
  currentTranscript: string
}

export const MessageArea = ({ messages, currentTranscript }: MessageAreaProps) => {
  return (
    <ScrollArea className="h-64 w-full rounded-md border p-4">
      <div className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex items-start gap-2",
              message.type === 'user' ? "justify-end" : "justify-start"
            )}
          >
            {message.type === 'ai' && (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Bot className="w-3 h-3 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-lg p-3 text-sm",
                message.type === 'user'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              <p>{message.content}</p>
              {message.audioTranscript && (
                <Badge variant="outline" className="mt-1 text-xs">
                  Voice
                </Badge>
              )}
            </div>
            {message.type === 'user' && (
              <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                <User className="w-3 h-3 text-secondary" />
              </div>
            )}
          </div>
        ))}
        
        {/* Current transcript */}
        {currentTranscript && (
          <div className="flex items-start gap-2 opacity-70">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Bot className="w-3 h-3 text-primary" />
            </div>
            <div className="max-w-[80%] rounded-lg p-3 text-sm bg-muted">
              <p>{currentTranscript}...</p>
              <Badge variant="outline" className="mt-1 text-xs">
                Generating...
              </Badge>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
