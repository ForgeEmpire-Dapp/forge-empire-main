import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RefreshCw, Wifi, WifiOff, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { DataState } from '@/hooks/useDataFreshness'

interface DataStatusIndicatorProps {
  /** Current data state */
  state: DataState
  /** Last update timestamp */
  lastUpdate?: Date | null
  /** Whether real-time connection is active */
  isRealtime?: boolean
  /** Callback to refresh data */
  onRefresh?: () => void
  /** Show refresh button */
  showRefresh?: boolean
  /** Compact mode (smaller display) */
  compact?: boolean
  /** Custom className */
  className?: string
}

export const DataStatusIndicator = ({
  state,
  lastUpdate,
  isRealtime = false,
  onRefresh,
  showRefresh = true,
  compact = false,
  className
}: DataStatusIndicatorProps) => {
  const getStatusInfo = () => {
    switch (state) {
      case 'fresh':
        return {
          icon: CheckCircle,
          text: 'Data Fresh',
          variant: 'default' as const,
          color: 'text-green-600'
        }
      case 'stale':
        return {
          icon: Clock,
          text: 'Data Stale',
          variant: 'secondary' as const,
          color: 'text-yellow-600'
        }
      case 'loading':
        return {
          icon: RefreshCw,
          text: 'Loading...',
          variant: 'outline' as const,
          color: 'text-blue-600'
        }
      case 'error':
        return {
          icon: AlertCircle,
          text: 'Error',
          variant: 'destructive' as const,
          color: 'text-red-600'
        }
      default:
        return {
          icon: AlertCircle,
          text: 'Unknown',
          variant: 'outline' as const,
          color: 'text-gray-600'
        }
    }
  }

  const statusInfo = getStatusInfo()
  const Icon = statusInfo.icon
  const isLoading = state === 'loading'

  const getTooltipText = () => {
    const baseText = statusInfo.text
    if (lastUpdate) {
      const timeAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 1000)
      const timeText = timeAgo < 60 
        ? `${timeAgo}s ago`
        : timeAgo < 3600
        ? `${Math.floor(timeAgo / 60)}m ago`
        : `${Math.floor(timeAgo / 3600)}h ago`
      
      return `${baseText} • Updated ${timeText}${isRealtime ? ' • Real-time' : ''}`
    }
    return baseText
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "flex items-center gap-1 transition-all duration-200",
              className
            )}>
              <div className="relative">
                <Icon className={cn(
                  "h-4 w-4 transition-colors",
                  statusInfo.color,
                  isLoading && "animate-spin"
                )} />
                {isRealtime && (
                  <Wifi className="h-2 w-2 absolute -top-1 -right-1 text-green-500" />
                )}
              </div>
              {showRefresh && onRefresh && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                >
                  <RefreshCw className={cn(
                    "h-3 w-3",
                    isLoading && "animate-spin"
                  )} />
                </Button>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipText()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className={cn(
      "flex items-center gap-2 animate-fade-in",
      className
    )}>
      <Badge 
        variant={statusInfo.variant}
        className={cn(
          "flex items-center gap-1 transition-all duration-200",
          state === 'fresh' && "hover-scale"
        )}
      >
        <Icon className={cn(
          "h-3 w-3",
          isLoading && "animate-spin"
        )} />
        <span>{statusInfo.text}</span>
        {isRealtime && <Wifi className="h-3 w-3" />}
      </Badge>
      
      {lastUpdate && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground">
                {Math.floor((Date.now() - lastUpdate.getTime()) / 1000)}s ago
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Last updated: {lastUpdate.toLocaleTimeString()}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {showRefresh && onRefresh && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className={cn(
            "transition-all duration-200",
            !isLoading && "hover-scale"
          )}
        >
          <RefreshCw className={cn(
            "h-4 w-4",
            isLoading && "animate-spin"
          )} />
        </Button>
      )}
    </div>
  )
}