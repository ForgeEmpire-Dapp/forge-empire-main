// Standardized error handling utilities for consistent error management across the app
import { toast } from 'sonner'
import { logger } from './logger'

export interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  [key: string]: unknown
}

export interface ErrorHandlerOptions {
  showToast?: boolean
  toastTitle?: string
  toastDescription?: string
  variant?: 'default' | 'destructive'
  logLevel?: 'error' | 'warn' | 'info'
}

/**
 * Standardized error handler that logs and optionally shows toast notifications
 */
export const handleError = (
  error: Error | string | unknown,
  context: ErrorContext = {},
  options: ErrorHandlerOptions = {}
) => {
  const {
    showToast = true,
    toastTitle = 'Error',
    toastDescription,
    variant = 'destructive',
    logLevel = 'error'
  } = options

  // Extract error message
  const errorMessage = error instanceof Error 
    ? error.message 
    : typeof error === 'string' 
    ? error 
    : 'An unexpected error occurred'

  // Log the error with context
  logger[logLevel](`${context.component || 'Unknown'}: ${context.action || 'Action'} failed`, {
    error: errorMessage,
    ...context
  })

  // Show toast notification if enabled
  if (showToast) {
    toast(toastTitle, {
      description: toastDescription || errorMessage,
      style: variant === 'destructive' ? { 
        background: 'hsl(var(--destructive))', 
        color: 'hsl(var(--destructive-foreground))' 
      } : undefined
    })
  }

  // Return standardized error object
  return {
    error: errorMessage,
    context,
    timestamp: new Date().toISOString()
  }
}

/**
 * Async wrapper that handles promise rejections consistently
 */
export const withErrorHandling = async <T>(
  asyncFn: () => Promise<T>,
  context: ErrorContext,
  options: ErrorHandlerOptions = {}
): Promise<{ data?: T; error?: string }> => {
  try {
    const data = await asyncFn()
    return { data }
  } catch (error) {
    const result = handleError(error, context, options)
    return { error: result.error }
  }
}

/**
 * Component error wrapper for consistent error boundaries
 */
export const componentErrorHandler = (
  component: string,
  action: string
) => (error: Error | string | unknown) => {
  return handleError(error, { component, action }, {
    toastTitle: `${component} Error`,
    toastDescription: `Failed to ${action.toLowerCase()}. Please try again.`
  })
}

/**
 * Transaction error handler with specific blockchain context
 */
export const transactionErrorHandler = (
  txType: string,
  txHash?: string
) => (error: Error | string | unknown) => {
  return handleError(error, { 
    component: 'Transaction',
    action: txType,
    txHash: txHash ? `${txHash.slice(0, 6)}...` : undefined
  }, {
    toastTitle: 'Transaction Failed',
    toastDescription: `${txType} transaction failed. Please check your wallet and try again.`
  })
}

/**
 * API error handler for backend/supabase errors
 */
export const apiErrorHandler = (
  endpoint: string,
  method: string = 'GET'
) => (error: Error | string | unknown) => {
  return handleError(error, {
    component: 'API',
    action: `${method} ${endpoint}`,
    endpoint,
    method
  }, {
    toastTitle: 'API Error',
    toastDescription: 'Failed to communicate with server. Please check your connection.'
  })
}