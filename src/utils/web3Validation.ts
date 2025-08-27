import { isAddress, formatEther, parseEther } from 'viem'
import { ValidationError, validateAddress, validateAmount, validateString } from './validation'

// Enhanced Web3-specific validation utilities

export interface Web3ValidationContext {
  chainId?: number
  blockNumber?: bigint
  gasPrice?: bigint
  userAddress?: string
}

export interface TransactionValidationOptions {
  maxGasLimit?: bigint
  minValue?: bigint
  maxValue?: bigint
  allowedTokens?: string[]
  requiresApproval?: boolean
}

/**
 * Validates Web3 transaction parameters before execution
 */
export const validateTransactionParams = (
  params: {
    to?: string
    value?: bigint | string
    data?: string
    gasLimit?: bigint
  },
  options: TransactionValidationOptions = {}
): void => {
  const {
    maxGasLimit = 500000n,
    minValue = 0n,
    maxValue = parseEther('1000'), // 1000 ETH max
  } = options

  // Validate recipient address
  if (params.to) {
    validateAddress(params.to)
  }

  // Validate transaction value
  if (params.value !== undefined) {
    const valueAmount = typeof params.value === 'string' 
      ? parseEther(params.value) 
      : params.value

    if (valueAmount < minValue) {
      throw new ValidationError(`Transaction value must be at least ${formatEther(minValue)} ETH`)
    }

    if (valueAmount > maxValue) {
      throw new ValidationError(`Transaction value exceeds maximum of ${formatEther(maxValue)} ETH`)
    }
  }

  // Validate gas limit
  if (params.gasLimit && params.gasLimit > maxGasLimit) {
    throw new ValidationError(`Gas limit ${params.gasLimit} exceeds maximum ${maxGasLimit}`)
  }

  // Validate transaction data
  if (params.data && params.data.length > 0 && !params.data.startsWith('0x')) {
    throw new ValidationError('Transaction data must be valid hex string')
  }
}

/**
 * Validates token-specific parameters
 */
export const validateTokenParams = (
  amount: bigint | string,
  tokenAddress?: string,
  decimals: number = 18
): bigint => {
  // Validate token address if provided
  if (tokenAddress) {
    validateAddress(tokenAddress)
  }

  // Convert and validate amount
  const tokenAmount = typeof amount === 'string' 
    ? parseEther(amount) 
    : amount

  // Check for reasonable token amount bounds
  const maxTokenAmount = BigInt(10) ** BigInt(decimals + 6) // 1M tokens with decimals
  if (tokenAmount > maxTokenAmount) {
    throw new ValidationError(`Token amount exceeds maximum allowed`)
  }

  return validateAmount(tokenAmount, 'token amount')
}

/**
 * Validates NFT/Badge minting parameters
 */
export const validateMintParams = (
  recipient: string,
  tokenURI: string,
  options: {
    maxURILength?: number
    allowedSchemes?: string[]
  } = {}
): void => {
  const { maxURILength = 500, allowedSchemes = ['https://', 'ipfs://'] } = options

  // Validate recipient
  validateAddress(recipient)

  // Validate token URI
  validateString(tokenURI, 'Token URI', { 
    minLength: 10, 
    maxLength: maxURILength 
  })

  // Check URI scheme
  const hasValidScheme = allowedSchemes.some(scheme => 
    tokenURI.toLowerCase().startsWith(scheme)
  )

  if (!hasValidScheme) {
    throw new ValidationError(
      `Token URI must start with one of: ${allowedSchemes.join(', ')}`
    )
  }
}

/**
 * Validates quest creation parameters
 */
export const validateQuestParams = (
  title: string,
  description: string,
  xpReward: bigint,
  requirements: string[]
): void => {
  // Validate basic quest data
  validateString(title, 'Quest title', { minLength: 3, maxLength: 100 })
  validateString(description, 'Quest description', { minLength: 10, maxLength: 1000 })

  // Validate XP reward
  if (xpReward <= 0n) {
    throw new ValidationError('XP reward must be greater than zero')
  }

  const maxXPReward = 10000n // Reasonable max XP per quest
  if (xpReward > maxXPReward) {
    throw new ValidationError(`XP reward cannot exceed ${maxXPReward}`)
  }

  // Validate requirements
  if (requirements.length === 0) {
    throw new ValidationError('Quest must have at least one requirement')
  }

  if (requirements.length > 10) {
    throw new ValidationError('Quest cannot have more than 10 requirements')
  }

  requirements.forEach((req, index) => {
    validateString(req, `Requirement ${index + 1}`, { 
      minLength: 3, 
      maxLength: 200 
    })
  })
}

/**
 * Validates profile data
 */
export const validateProfileParams = (
  username: string,
  bio: string,
  socialLinks: string[]
): void => {
  // Validate username
  validateString(username, 'Username', { minLength: 3, maxLength: 30 })

  // Username should be alphanumeric with underscores
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new ValidationError('Username can only contain letters, numbers, and underscores')
  }

  // Validate bio
  validateString(bio, 'Bio', { minLength: 0, maxLength: 500, required: false })

  // Validate social links
  if (socialLinks.length > 5) {
    throw new ValidationError('Cannot have more than 5 social links')
  }

  socialLinks.forEach((link, index) => {
    if (link.trim()) {
      // Basic URL validation
      try {
        new URL(link)
      } catch {
        throw new ValidationError(`Social link ${index + 1} is not a valid URL`)
      }
    }
  })
}

/**
 * Validates staking parameters
 */
export const validateStakingParams = (
  amount: bigint,
  duration?: number
): void => {
  validateAmount(amount, 'staking amount')

  if (duration !== undefined) {
    if (duration < 1) {
      throw new ValidationError('Staking duration must be at least 1 day')
    }

    if (duration > 365) {
      throw new ValidationError('Staking duration cannot exceed 365 days')
    }
  }
}

/**
 * Validates tip jar parameters
 */
export const validateTipParams = (
  recipient: string,
  amount: bigint,
  message?: string,
  senderAddress?: string
): void => {
  validateAddress(recipient)
  validateAmount(amount, 'tip amount')

  // Prevent self-tipping
  if (senderAddress && recipient.toLowerCase() === senderAddress.toLowerCase()) {
    throw new ValidationError('Cannot send tip to yourself')
  }

  // Validate tip message
  if (message) {
    validateString(message, 'Tip message', { 
      minLength: 0, 
      maxLength: 280, 
      required: false 
    })
  }
}

/**
 * Batch validation for multiple recipients/amounts
 */
export const validateBatchParams = <T>(
  items: T[],
  maxBatchSize: number = 100,
  itemName: string = 'item'
): void => {
  if (items.length === 0) {
    throw new ValidationError(`Batch cannot be empty`)
  }

  if (items.length > maxBatchSize) {
    throw new ValidationError(`Batch size cannot exceed ${maxBatchSize} ${itemName}s`)
  }
}

/**
 * Validates array parameters are equal length (for batch operations)
 */
export const validateArrayLengthsMatch = (
  array1: unknown[],
  array2: unknown[],
  name1: string,
  name2: string
): void => {
  if (array1.length !== array2.length) {
    throw new ValidationError(`${name1} and ${name2} arrays must have the same length`)
  }
}

/**
 * Validates token ID parameters
 */
export const validateTokenId = (tokenId: bigint | string | number): bigint => {
  const bigintTokenId = typeof tokenId === 'bigint' ? tokenId : BigInt(tokenId.toString())
  
  if (bigintTokenId < 0n) {
    throw new ValidationError('Token ID must be non-negative')
  }
  
  return bigintTokenId
}