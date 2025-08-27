// Replace all console.* calls with secure logger in production only
import { logger } from './logger'

// Only override in production builds to avoid development issues
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  // Create wrapper functions that match console API
  const logWrapper = (...args: unknown[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')
    logger.debug(message)
  }

  const errorWrapper = (...args: unknown[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')
    logger.error(message)
  }

  const warnWrapper = (...args: unknown[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')
    logger.warn(message)
  }

  const infoWrapper = (...args: unknown[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')
    logger.info(message)
  }

  // Override console methods safely
  try {
    console.log = logWrapper
    console.error = errorWrapper
    console.warn = warnWrapper
    console.info = infoWrapper
  } catch (error) {
    // Fallback if console override fails
    logger.warn('Failed to override console methods', { error: error?.toString() })
  }
}

export {}