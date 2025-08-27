// Production-safe logging utility
// Replaces all console.log statements with secure, conditional logging

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  component?: string
  action?: string
  userId?: string
  [key: string]: unknown
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  
  private log(level: LogLevel, message: string, context?: LogContext) {
    if (!this.isDevelopment && level === 'debug') {
      return // Never log debug in production
    }
    
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      message,
      ...(context && this.sanitizeContext(context))
    }
    
    // In development, use console
    if (this.isDevelopment) {
      const method = level === 'debug' ? 'log' : level
      console[method](`[${level.toUpperCase()}]`, message, context)
      return
    }
    
    // In production, could send to monitoring service
    // this.sendToMonitoring(logEntry)
  }
  
  private sanitizeContext(context: LogContext): LogContext {
    const sanitized = { ...context }
    
    // Remove sensitive data
    delete sanitized.privateKey
    delete sanitized.password
    delete sanitized.apiKey
    delete sanitized.secret
    delete sanitized.token
    
    // Truncate wallet addresses for privacy
    if (sanitized.walletAddress) {
      sanitized.walletAddress = `${sanitized.walletAddress.slice(0, 6)}...${sanitized.walletAddress.slice(-4)}`
    }
    
    return sanitized
  }
  
  debug(message: string, context?: LogContext) {
    this.log('debug', message, context)
  }
  
  info(message: string, context?: LogContext) {
    this.log('info', message, context)
  }
  
  warn(message: string, context?: LogContext) {
    this.log('warn', message, context)
  }
  
  error(message: string, context?: LogContext) {
    this.log('error', message, context)
  }
}

export const logger = new Logger()

// Convenience functions for common use cases
export const logTransaction = (action: string, txHash?: string, error?: Error) => {
  if (error) {
    logger.error(`Transaction failed: ${action}`, { 
      action, 
      txHash: txHash ? `${txHash.slice(0, 6)}...` : undefined,
      error: error.message 
    })
  } else {
    logger.info(`Transaction successful: ${action}`, { 
      action, 
      txHash: txHash ? `${txHash.slice(0, 6)}...` : undefined 
    })
  }
}

export const logUserAction = (action: string, context?: LogContext) => {
  logger.info(`User action: ${action}`, { action, ...context })
}

export const logWebSocketEvent = (event: string, context?: LogContext) => {
  logger.debug(`WebSocket: ${event}`, { event, ...context })
}