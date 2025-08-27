// Input validation utilities for smart contract interactions
import { isAddress } from 'viem'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

// Address validation
export const validateAddress = (address: string): string => {
  if (!address) {
    throw new ValidationError('Address is required')
  }
  
  if (!isAddress(address)) {
    throw new ValidationError('Invalid Ethereum address format')
  }
  
  return address.toLowerCase()
}

// Amount validation for token operations
export const validateAmount = (amount: bigint | string | number, context = 'amount'): bigint => {
  const bigintAmount = typeof amount === 'bigint' ? amount : BigInt(amount.toString())
  
  if (bigintAmount <= 0n) {
    throw new ValidationError(`${context} must be greater than zero`)
  }
  
  // Check for reasonable upper bounds (adjust based on token decimals)
  const maxAmount = BigInt('1000000000000000000000000') // 1M with 18 decimals
  if (bigintAmount > maxAmount) {
    throw new ValidationError(`${context} exceeds maximum allowed value`)
  }
  
  return bigintAmount
}

// String validation for names, descriptions, etc.
export const validateString = (value: string, fieldName: string, options: {
  minLength?: number
  maxLength?: number
  required?: boolean
} = {}): string => {
  const { minLength = 0, maxLength = 500, required = true } = options
  
  if (required && !value?.trim()) {
    throw new ValidationError(`${fieldName} is required`)
  }
  
  if (!value) return ''
  
  const trimmed = value.trim()
  
  if (trimmed.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters`)
  }
  
  if (trimmed.length > maxLength) {
    throw new ValidationError(`${fieldName} must be no more than ${maxLength} characters`)
  }
  
  // Basic XSS protection
  if (/<script|javascript:|on\w+=/i.test(trimmed)) {
    throw new ValidationError(`${fieldName} contains invalid content`)
  }
  
  return trimmed
}

// Proposal validation
export const validateProposal = (description: string, target?: string): void => {
  validateString(description, 'Proposal description', { minLength: 10, maxLength: 1000 })
  
  if (target) {
    validateAddress(target)
  }
}

// Quest validation
export const validateQuestData = (title: string, description: string): void => {
  validateString(title, 'Quest title', { minLength: 3, maxLength: 100 })
  validateString(description, 'Quest description', { minLength: 10, maxLength: 500 })
}

// Token ID validation
export const validateTokenId = (tokenId: bigint | string | number): bigint => {
  const bigintTokenId = typeof tokenId === 'bigint' ? tokenId : BigInt(tokenId.toString())
  
  if (bigintTokenId < 0n) {
    throw new ValidationError('Token ID must be non-negative')
  }
  
  return bigintTokenId
}

// Guild validation
export const validateGuildData = (name: string, description: string, maxMembers: number): void => {
  validateString(name, 'Guild name', { minLength: 3, maxLength: 50 })
  validateString(description, 'Guild description', { minLength: 10, maxLength: 200 })
  
  if (maxMembers < 2 || maxMembers > 1000) {
    throw new ValidationError('Guild max members must be between 2 and 1000')
  }
}

// Marketplace listing validation
export const validateListingData = (price: bigint, paymentToken?: string): void => {
  validateAmount(price, 'listing price')
  
  if (paymentToken) {
    validateAddress(paymentToken)
  }
}

// Time validation
export const validateFutureTimestamp = (timestamp: number, fieldName: string): number => {
  const now = Math.floor(Date.now() / 1000)
  
  if (timestamp <= now) {
    throw new ValidationError(`${fieldName} must be in the future`)
  }
  
  // Don't allow timestamps more than 10 years in the future
  const maxFuture = now + (10 * 365 * 24 * 60 * 60)
  if (timestamp > maxFuture) {
    throw new ValidationError(`${fieldName} is too far in the future`)
  }
  
  return timestamp
}