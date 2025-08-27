import { toast } from 'sonner'
import { logger } from './logger'

export interface QueuedTransaction {
  id: string
  description: string
  execute: () => Promise<unknown>
  retryCount: number
  timestamp: number
  priority: 'low' | 'medium' | 'high'
  resolve?: (value: unknown) => void
  reject?: (reason?: unknown) => void
}

export interface TransactionQueueConfig {
  maxConcurrent: number
  maxRetries: number
  retryDelay: number
  timeout: number
}

export class TransactionQueue {
  private queue: QueuedTransaction[] = []
  private processing: Set<string> = new Set()
  private config: TransactionQueueConfig
  private isProcessing = false

  constructor(config: Partial<TransactionQueueConfig> = {}) {
    this.config = {
      maxConcurrent: 1,
      maxRetries: 3,
      retryDelay: 2000,
      timeout: 60000,
      ...config
    }
  }

  /**
   * Add a transaction to the queue
   */
  async add(
    execute: () => Promise<unknown>,
    options: {
      description: string
      priority?: 'low' | 'medium' | 'high'
      immediate?: boolean
    }
  ): Promise<unknown> {
    const { description, priority = 'medium', immediate = false } = options

    const transaction: QueuedTransaction = {
      id: this.generateId(),
      description,
      execute,
      retryCount: 0,
      timestamp: Date.now(),
      priority
    }

    if (immediate && this.processing.size < this.config.maxConcurrent) {
      return this.executeTransaction(transaction)
    }

    // Add to queue with priority ordering
    this.insertByPriority(transaction)
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue()
    }

    return new Promise((resolve, reject) => {
      transaction.resolve = resolve
      transaction.reject = reject
    })
  }

  /**
   * Process the transaction queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return
    
    this.isProcessing = true

    while (this.queue.length > 0 && this.processing.size < this.config.maxConcurrent) {
      const transaction = this.queue.shift()
      if (!transaction) continue

      this.executeTransaction(transaction)
    }

    // Check again after a delay if queue has items
    if (this.queue.length > 0) {
      setTimeout(() => {
        this.isProcessing = false
        this.processQueue()
      }, 1000)
    } else {
      this.isProcessing = false
    }
  }

  /**
   * Execute a single transaction
   */
  private async executeTransaction(transaction: QueuedTransaction): Promise<unknown> {
    this.processing.add(transaction.id)

    try {
      logger.info(`Executing transaction: ${transaction.description}`)
      
      // Add timeout wrapper
      const result = await Promise.race([
        transaction.execute(),
        this.createTimeoutPromise(transaction.id)
      ])

      if (transaction.resolve) {
        transaction.resolve(result)
      }

      toast.success('Transaction completed', {
        description: transaction.description
      })

      return result

    }     catch (error: unknown) {
      logger.error(`Transaction failed: ${transaction.description}`, { 
        error: error.message,
        retryCount: transaction.retryCount 
      })

      // Retry logic
      if (transaction.retryCount < this.config.maxRetries) {
        transaction.retryCount++
        
        setTimeout(() => {
          this.processing.delete(transaction.id)
          this.insertByPriority(transaction)
          this.processQueue()
        }, this.config.retryDelay * transaction.retryCount)

        toast.warning(`Transaction failed - Retrying (${transaction.retryCount}/${this.config.maxRetries})`, {
          description: transaction.description
        })

        return
      }

      // Max retries exceeded
      if (transaction.reject) {
        transaction.reject(error)
      }

      toast.error('Transaction failed', {
        description: `${transaction.description} - ${error.message || 'Unknown error'}`
      })

    } finally {
      this.processing.delete(transaction.id)
      
      // Continue processing queue
      setTimeout(() => {
        this.processQueue()
      }, 500)
    }
  }

  /**
   * Insert transaction by priority
   */
  private insertByPriority(transaction: QueuedTransaction): void {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    
    let insertIndex = this.queue.length
    for (let i = 0; i < this.queue.length; i++) {
      const existingPriority = priorityOrder[this.queue[i].priority]
      const newPriority = priorityOrder[transaction.priority]
      
      if (newPriority > existingPriority) {
        insertIndex = i
        break
      }
    }
    
    this.queue.splice(insertIndex, 0, transaction)
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(transactionId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Transaction ${transactionId} timed out after ${this.config.timeout}ms`))
      }, this.config.timeout)
    })
  }

  /**
   * Generate unique transaction ID
   */
  private generateId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing.size,
      maxConcurrent: this.config.maxConcurrent
    }
  }

  /**
   * Clear all pending transactions
   */
  clear(): void {
    this.queue.forEach(tx => {
      if (tx.reject) {
        tx.reject(new Error('Transaction queue cleared'))
      }
    })
    this.queue = []
  }
}

// Global transaction queue instance
export const globalTransactionQueue = new TransactionQueue({
  maxConcurrent: 1,
  maxRetries: 3,
  retryDelay: 2000,
  timeout: 60000
})