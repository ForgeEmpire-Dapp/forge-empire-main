// Secure replacement for console.log usage
// This replaces direct console usage with the existing logger utility

import { logger } from './logger'

// Replacements for console methods
export const secureLog = {
  log: (message: string, context?: Record<string, unknown>) => {
    logger.debug(message, context)
  },
  
  error: (message: string, error?: Error | string, context?: Record<string, unknown>) => {
    logger.error(message, { 
      error: typeof error === 'string' ? error : error?.message,
      ...context 
    })
  },
  
  warn: (message: string, context?: Record<string, unknown>) => {
    logger.warn(message, context)
  },
  
  info: (message: string, context?: Record<string, unknown>) => {
    logger.info(message, context)
  }
}

// Convenience function for component errors
export const logComponentError = (component: string, action: string, error: Error | string) => {
  secureLog.error(`${component}: ${action} failed`, error, { component, action })
}

// Convenience function for transaction logging
export const logTransaction = (action: string, result: 'success' | 'failed', txHash?: string) => {
  if (result === 'success') {
    secureLog.info(`Transaction completed: ${action}`, { action, txHash })
  } else {
    secureLog.error(`Transaction failed: ${action}`, undefined, { action, txHash })
  }
}