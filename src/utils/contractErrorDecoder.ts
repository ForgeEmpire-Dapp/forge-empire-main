// Contract error decoding utilities for better UX
import { logger } from './logger'

export const decodeContractError = (error: unknown, contractName?: string): string => {
  if (!error) {
    return 'Unknown error occurred'
  }

  let errorMessage = ''
  let errorName = ''
  let userMessage = ''

  // Handle different error formats
  if (typeof error === 'string') {
    errorMessage = error
  } else if (error.message) {
    errorMessage = error.message
  } else if (error.reason) {
    errorMessage = error.reason
  } else if (error.details) {
    errorMessage = error.details
  } else if (error.data?.message) {
    errorMessage = error.data.message
  }

  // Extract error name from various formats
  if (error.name) {
    errorName = error.name
  } else {
    // Try to extract from revert reason
    const revertMatch = errorMessage.match(/reverted with reason string ['"](.+?)['"]/)
    if (revertMatch) {
      errorName = revertMatch[1]
    } else {
      // Try to extract from custom error
      const customMatch = errorMessage.match(/reverted with custom error ['"](.+?)['"]/)
      if (customMatch) {
        errorName = customMatch[1]
      }
    }
  }

  // Map common errors to user-friendly messages
  const commonErrorMappings: Record<string, string> = {
    'AccessControlUnauthorizedAccount': 'You do not have permission to perform this action.',
    'EnforcedPause': 'This feature is currently paused. Please try again later.',
    'InsufficientXP': 'You do not have enough XP for this action.',
    'ZeroXPAmount': 'XP amount must be greater than zero.',
    'ZeroAddressUser': 'Invalid user address provided.',
    'ArrayLengthMismatch': 'Input arrays must have the same length.',
    'BatchSizeExceeded': 'Batch size exceeds the maximum allowed limit.',
    'ERC721InvalidOwner': 'You are not the owner of this token.',
    'ERC721InsufficientApproval': 'Token approval required for this action.',
    'ProfileAlreadyExists': 'A profile already exists for this user.',
    'ProfileDoesNotExist': 'No profile found for this user.',
    'QuestAlreadyCompleted': 'This quest has already been completed.',
    'QuestNotActive': 'This quest is not currently active.',
    'CannotSendKudosToSelf': 'You cannot send kudos to yourself.',
    'InsufficientBalance': 'Insufficient balance for this transaction.',
    'TransferFailed': 'Transfer failed. Please try again.',
    'user rejected transaction': 'Transaction was cancelled by user.',
    'insufficient funds': 'Insufficient funds to complete this transaction.',
  }

  // Check for mapped errors first
  for (const [key, message] of Object.entries(commonErrorMappings)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase()) || errorName.toLowerCase().includes(key.toLowerCase())) {
      userMessage = message
      break
    }
  }

  // If no mapping found, provide a generic but helpful message
  if (!userMessage) {
    if (errorMessage.includes('reverted')) {
      userMessage = 'Transaction failed due to contract validation. Please check your inputs and try again.'
    } else if (errorMessage.includes('gas')) {
      userMessage = 'Transaction failed due to insufficient gas. Please try again with more gas.'
    } else if (errorMessage.includes('network')) {
      userMessage = 'Network error. Please check your connection and try again.'
    } else if (errorMessage.includes('timeout')) {
      userMessage = 'Transaction timed out. Please try again.'
    } else {
      userMessage = 'Transaction failed. Please try again.'
    }
  }

  // Log the error for debugging
  try {
    logger.error('Contract Error', {
      contractName,
      errorName,
      errorMessage,
      userMessage,
      originalError: error
    })
  } catch (logError) {
    console.error('Failed to log contract error:', logError)
  }

  // Return user-friendly message
  return userMessage
}