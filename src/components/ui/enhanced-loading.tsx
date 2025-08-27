import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingCardProps {
  isLoading: boolean
  error?: string | null
  children: ReactNode
  className?: string
  onRetry?: () => void
  retryText?: string
  loadingText?: string
  emptyStateText?: string
  showEmptyState?: boolean
}

export const LoadingCard = ({
  isLoading,
  error,
  children,
  className,
  onRetry,
  retryText = 'Try Again',
  loadingText = 'Loading...',
  emptyStateText = 'No data available',
  showEmptyState = false
}: LoadingCardProps) => {
  if (isLoading) {
    return (
      <Card className={cn('animate-fade-in', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">{loadingText}</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn('animate-fade-in', className)}>
        <CardContent className="py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              {onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="ml-4"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {retryText}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (showEmptyState) {
    return (
      <Card className={cn('animate-fade-in', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-center">{emptyStateText}</p>
        </CardContent>
      </Card>
    )
  }

  return <div className={cn('animate-fade-in', className)}>{children}</div>
}

interface StatusBadgeProps {
  status: 'loading' | 'success' | 'error' | 'pending'
  text?: string
  className?: string
}

export const StatusBadge = ({ status, text, className }: StatusBadgeProps) => {
  const statusConfig = {
    loading: {
      icon: Loader2,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      animation: 'animate-spin',
      defaultText: 'Loading...'
    },
    success: {
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
      animation: '',
      defaultText: 'Complete'
    },
    error: {
      icon: AlertCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      animation: '',
      defaultText: 'Error'
    },
    pending: {
      icon: RefreshCw,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      animation: 'animate-pulse',
      defaultText: 'Pending'
    }
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium',
      config.bgColor,
      config.color,
      className
    )}>
      <Icon className={cn('w-4 h-4', config.animation)} />
      <span>{text || config.defaultText}</span>
    </div>
  )
}

interface ProgressCardProps {
  title: string
  description?: string
  progress: number
  status?: 'loading' | 'success' | 'error' | 'pending'
  className?: string
  children?: ReactNode
}

export const ProgressCard = ({
  title,
  description,
  progress,
  status = 'pending',
  className,
  children
}: ProgressCardProps) => {
  return (
    <Card className={cn('animate-fade-in', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <StatusBadge status={status} />
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}