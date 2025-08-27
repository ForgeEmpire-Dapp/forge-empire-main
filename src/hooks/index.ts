// Core Hooks
export { useAuth } from './useAuth'
export { useProfile } from './useProfile'
export { useToast } from './use-toast'
export { useIsMobile } from './use-mobile'

// Enhanced Data Fetching & Real-time
export { useActiveTabRefetch } from './useActiveTabRefetch'
export { useEnhancedDataFetching } from './useEnhancedDataFetching'
export { useRealtimeSync } from './useRealtimeSync'
export { useDataFreshness } from './useDataFreshness'

// Analytics & Performance
// Removed export for useAnalytics as it has been consolidated into useEnhancedAnalytics.
export * from './useEnhancedAnalytics'
export { usePerformanceMonitor } from './usePerformance'
export * from './useOptimizedQueries'

// Blockchain & Web3
export { useXPSystem } from './useXPSystem'
export { useForgeToken } from './useForgeToken'
export { useForgePass } from './useForgePass'
export { useStakingInteractions } from './useStakingInteractions'
export { useStakingRewards } from './useStakingRewards'
export { useWalletAchievements } from './useWalletAchievements'

// Contract Interactions
export * from './contracts'
export { useForgeFeeManager } from './useForgeFeeManager'
export { useForgeTokenManager } from './useForgeTokenManager'
export { useForgeUtilityManager } from './useForgeUtilityManager'

// Social & Community
export * from './useSocial'
export * from './useRealtimeSocial'

export * from './useSecureSocialStats'
export { useCommunityDAO } from './useCommunityDAO'
export { useCommunityRewards } from './useCommunityRewards'
export { useDAOInteractions } from './useDAOInteractions'
export { useKudos } from './useKudos'

// Quests & Achievements
export { useOnboardingQuests } from './useOnboardingQuests'
export { useQuestInteractions } from './useQuestInteractions'
export { useQuestRegistry } from './useQuestRegistry'
export { useDynamicQuests } from './useDynamicQuests'

// Streaks & Events
export { useStreakCore } from './useStreaks'
export { useStreakInteractions } from './useStreakInteractions'
export { useSeasonalEvents } from './useSeasonalEvents'

// DeFi & Trading
export { useLiquidityPools } from './useLiquidityPools'

// Marketplace & NFTs
export { useMarketplace } from './useMarketplace'

// Guilds & Groups
export { useGuild } from './useGuild'

// Profile & Media
export { useProfileRegistry } from './useProfileRegistry'
export { useLocalProfileMedia } from './useLocalProfileMedia'

// Notifications
export * from './useNotifications'