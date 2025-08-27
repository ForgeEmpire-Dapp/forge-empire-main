
// Application constants
export const APP_CONFIG = {
  // Social
  MAX_POST_LENGTH: 500,
  POSTS_PER_PAGE: 20,
  MAX_USERNAME_LENGTH: 20,
  
  // Performance
  DEBOUNCE_DELAY: 300,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  
  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  
  // UI
  ANIMATION_DURATION: 200,
  TOAST_DURATION: 3000,
  
  // Validation
  MIN_POST_LENGTH: 1,
  MIN_USERNAME_LENGTH: 3,
  
  // Network
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const

export const TRENDING_CONFIG = {
  WEIGHT_LIKES: 1,
  WEIGHT_SHARES: 2,
  WEIGHT_COMMENTS: 1.5,
  WEIGHT_RECENCY: 0.5,
  TIME_DECAY_HOURS: 24,
  MIN_INTERACTIONS: 3,
} as const

export const ANALYTICS_CONFIG = {
  BATCH_SIZE: 10,
  FLUSH_INTERVAL: 30000, // 30 seconds
  MAX_STORED_EVENTS: 1000,
  ENABLE_DEBUG: false,
} as const

export const RARITY_COLORS = {
  common: 'text-muted-foreground',
  uncommon: 'text-green-500',
  rare: 'text-blue-500',
  epic: 'text-purple-500',
  legendary: 'text-orange-500',
  mythic: 'text-red-500',
} as const

export const SUPPORTED_NETWORKS = {
  AVALANCHE: {
    id: 43114,
    name: 'Avalanche',
    symbol: 'AVAX',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorerUrl: 'https://snowtrace.io',
  },
  FUJI: {
    id: 43113,
    name: 'Avalanche Fuji',
    symbol: 'AVAX',
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    explorerUrl: 'https://testnet.snowtrace.io',
  },
} as const

export const SOCIAL_FEATURES = {
  ENABLED: true,
  ALLOW_MEDIA: false, // Future feature
  ALLOW_HASHTAGS: false, // Future feature
  ALLOW_MENTIONS: false, // Future feature
  MODERATION: true,
} as const

export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: 'Please connect your wallet to continue',
  INSUFFICIENT_FUNDS: 'Insufficient funds for this transaction',
  TRANSACTION_FAILED: 'Transaction failed. Please try again',
  NETWORK_ERROR: 'Network error. Please check your connection',
  INVALID_INPUT: 'Invalid input. Please check your data',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  NOT_FOUND: 'Resource not found',
  RATE_LIMITED: 'Too many requests. Please wait and try again',
} as const

export const SUCCESS_MESSAGES = {
  POST_CREATED: 'Post created successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  FOLLOW_SUCCESS: 'Followed successfully!',
  UNFOLLOW_SUCCESS: 'Unfollowed successfully!',
  QUEST_COMPLETED: 'Quest completed successfully!',
  ACHIEVEMENT_UNLOCKED: 'Achievement unlocked!',
  TRANSACTION_SUCCESS: 'Transaction completed successfully!',
} as const
