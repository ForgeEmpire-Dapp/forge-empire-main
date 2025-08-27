import { Component, ReactNode } from 'react'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { logger } from '@/utils/logger'

interface ErrorFallbackProps {
  error?: Error
  resetError?: () => void
  componentName?: string
  children?: ReactNode
}

interface ErrorFallbackState {
  hasError: boolean
  error?: Error
}

export class ErrorFallback extends Component<ErrorFallbackProps, ErrorFallbackState> {
  constructor(props: ErrorFallbackProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorFallbackState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Component error boundary triggered', {
      component: this.props.componentName || 'Unknown',
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    })
  }

  render() {
    if (this.state.hasError || this.props.error) {
      const error = this.state.error || this.props.error
      
      return (
        <Card className="bg-gradient-card border-destructive/20 max-w-lg mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              {process.env.NODE_ENV === 'development' 
                ? error?.message || 'An unexpected error occurred'
                : 'We\'re working to fix this issue. Please try again.'
              }
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Page
              </Button>
              {this.props.resetError && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={this.props.resetError}
                >
                  Try Again
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

// HOC for wrapping components with error boundary
// eslint-disable-next-line react-refresh/only-export-components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent = (props: P) => (
    <ErrorFallback componentName={componentName}>
      <Component {...props} />
    </ErrorFallback>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${componentName || Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Simple error fallback for smaller components
export const SimpleErrorFallback = ({ 
  error, 
  resetError, 
  message = "Something went wrong" 
}: {
  error?: Error
  resetError?: () => void
  message?: string
}) => (
  <div className="p-4 text-center text-sm text-muted-foreground space-y-2">
    <p>{message}</p>
    {resetError && (
      <Button variant="ghost" size="sm" onClick={resetError}>
        Try again
      </Button>
    )}
  </div>
)