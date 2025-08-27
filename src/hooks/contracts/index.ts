// Contract Hooks
export { useBadgeSystem } from './useBadgeSystem'
export { useProfileRegistry } from './useProfileRegistry'
export { useQuestRegistry } from './useQuestRegistry'
export { useSocialGraph } from './useSocialGraph'
export { useTipJar } from './useTipJar'
export { useContractRoles, useUserRole } from './useContractRoles'

// Re-export existing hooks from parent contracts file
export { useUserXP, useUserLevel, useUserBadges, useTokenBalance } from '../contracts'

// Types
export type { Quest } from './useQuestRegistry'