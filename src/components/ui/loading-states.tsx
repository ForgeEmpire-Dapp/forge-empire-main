import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCcw, CheckCircle, AlertCircle, Clock } from 'lucide-react'

export interface LoadingState {
  loading: boolean
  error?: string | null
  success?: boolean
}

interface LoadingButtonProps {
  loading: boolean
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  loadingText?: string
}

export const LoadingButton = ({ 
  loading, 
  children, 
  onClick,
  disabled,
  variant = 'default',
  size = 'default',
  className = '',
  loadingText
}: LoadingButtonProps) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      variant={variant}
      size={size}
      className={`${className} transition-all duration-200`}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {loading ? (loadingText || 'Loading...') : children}
    </Button>
  )
}

interface AsyncButtonProps extends LoadingButtonProps {
  onAsyncClick: () => Promise<void>
  successMessage?: string
  errorMessage?: string
  showFeedback?: boolean
}

export const AsyncButton = ({ 
  onAsyncClick,
  children,
  successMessage = 'Success!',
  errorMessage = 'Something went wrong',
  showFeedback = true,
  ...buttonProps 
}: AsyncButtonProps) => {
  const [state, setState] = useState<LoadingState>({ loading: false })

  const handleClick = async () => {
    setState({ loading: true, error: null, success: false })
    
    try {
      await onAsyncClick()
      if (showFeedback) {
        setState({ loading: false, success: true })
        setTimeout(() => setState({ loading: false }), 2000)
      } else {
        setState({ loading: false })
      }
    } catch (error) {
      setState({ 
        loading: false, 
        error: error instanceof Error ? error.message : errorMessage 
      })
      setTimeout(() => setState({ loading: false }), 3000)
    }
  }

  const getContent = () => {
    if (state.loading) return 'Loading...'
    if (state.success) return successMessage
    if (state.error) return 'Failed'
    return children
  }

  const getIcon = () => {
    if (state.loading) return <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    if (state.success) return <CheckCircle className="mr-2 h-4 w-4 text-success" />
    if (state.error) return <AlertCircle className="mr-2 h-4 w-4 text-destructive" />
    return null
  }

  return (
    <Button
      {...buttonProps}
      onClick={handleClick}
      disabled={buttonProps.disabled || state.loading}
      variant={state.error ? 'destructive' : state.success ? 'default' : buttonProps.variant}
      className={`${buttonProps.className} transition-all duration-200`}
    >
      {getIcon()}
      {getContent()}
    </Button>
  )
}

interface LoadingCardProps {
  loading: boolean
  title?: string
  children: React.ReactNode
  error?: string | null
  onRetry?: () => void
  className?: string
  skeleton?: React.ReactNode
}

export const LoadingCard = ({ 
  loading, 
  title, 
  children, 
  error, 
  onRetry,
  className = '',
  skeleton
}: LoadingCardProps) => {
  if (loading) {
    return (
      <Card className={`${className} animate-pulse`}>
        {title && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-4 h-4 bg-muted rounded shimmer"></div>
              <div className="w-32 h-5 bg-muted rounded shimmer"></div>
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          {skeleton || (
            <div className="space-y-4">
              <div className="w-full h-4 bg-muted rounded shimmer"></div>
              <div className="w-3/4 h-4 bg-muted rounded shimmer"></div>
              <div className="w-1/2 h-4 bg-muted rounded shimmer"></div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={`${className} border-destructive/50`}>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <div>
              <h3 className="font-semibold">Error Loading Data</h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            {onRetry && (
              <Button onClick={onRetry} variant="outline" size="sm">
                <RefreshCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`${className} animate-fade-in`}>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
}

interface StatusIndicatorProps {
  status: 'loading' | 'success' | 'error' | 'pending'
  text?: string
  className?: string
}

export const StatusIndicator = ({ status, text, className = '' }: StatusIndicatorProps) => {
  const configs = {
    loading: {
      icon: Loader2,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      animate: 'animate-spin',
      defaultText: 'Processing...'
    },
    success: {
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
      animate: '',
      defaultText: 'Completed'
    },
    error: {
      icon: AlertCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      animate: '',
      defaultText: 'Failed'
    },
    pending: {
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      animate: '',
      defaultText: 'Pending'
    }
  }

  const config = configs[status]
  const Icon = config.icon

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}>
        <Icon className={`h-4 w-4 ${config.color} ${config.animate}`} />
      </div>
      {text && (
        <span className={`text-sm ${config.color}`}>
          {text || config.defaultText}
        </span>
      )}
    </div>
  )
}

interface ProgressFeedbackProps {
  steps: Array<{
    id: string
    label: string
    status: 'pending' | 'loading' | 'success' | 'error'
  }>
  className?: string
}

export const ProgressFeedback = ({ steps, className = '' }: ProgressFeedbackProps) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center gap-3">
          <StatusIndicator status={step.status} />
          <div className="flex-1">
            <span className={`text-sm ${
              step.status === 'success' ? 'text-success' : 
              step.status === 'error' ? 'text-destructive' :
              step.status === 'loading' ? 'text-primary' : 
              'text-muted-foreground'
            }`}>
              {step.label}
            </span>
          </div>
          {step.status === 'success' && (
            <Badge variant="secondary" className="text-xs">
              Done
            </Badge>
          )}
        </div>
      ))}
    </div>
  )
}