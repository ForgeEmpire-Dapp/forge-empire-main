import { useAccount, useReadContract } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/web3'

const STREAK_CORE_ABI = [
  {
    name: 'recordActivity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'streakType', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    name: 'getCurrentStreak',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'streakType', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'uint32' }],
  },
  {
    name: 'getLongestStreak',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'streakType', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'uint32' }],
  },
  {
    name: 'hasRecordedToday',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'streakType', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'userStreaks',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'streakType', type: 'uint8' },
    ],
    outputs: [
      { name: 'currentStreak', type: 'uint32' },
      { name: 'longestStreak', type: 'uint32' },
      { name: 'lastActiveDay', type: 'uint32' },
    ],
  },
  {
    name: 'recordDailyLogin',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'recordQuestCompletion',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'recordSocialInteraction',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'recordGovernanceParticipation',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'recordTradingActivity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'streakFreezes',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'streakType', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'uint32' }],
  },
  {
    name: 'useStreakFreeze',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'streakType', type: 'uint8' }],
    outputs: [],
  },
  {
    name: 'addStreakFreezes',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'streakType', type: 'uint8' },
      { name: 'amount', type: 'uint32' },
    ],
    outputs: [],
  },
  {
    name: 'paused',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const STREAK_REWARDS_ABI = [
  {
    name: 'claimReward',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'streakType', type: 'uint8' },
      { name: 'threshold', type: 'uint32' },
    ],
    outputs: [],
  },
  {
    name: 'claimAllRewards',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'streakType', type: 'uint8' }],
    outputs: [],
  },
  {
    name: 'getAvailableRewards',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'streakType', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'uint32[]' }],
  },
  {
    name: 'claimedRewards',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'streakType', type: 'uint8' },
      { name: 'threshold', type: 'uint32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'streakRewards',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'streakType', type: 'uint8' },
      { name: 'threshold', type: 'uint32' },
    ],
    outputs: [
      { name: 'xpReward', type: 'uint32' },
      { name: 'multiplier', type: 'uint32' },
      { name: 'badgeId', type: 'uint32' },
      { name: 'isActive', type: 'bool' },
    ],
  },
  {
    name: 'getRewardThresholds',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'streakType', type: 'uint8' }],
    outputs: [{ name: '', type: 'uint32[]' }],
  },
  {
    name: 'rewardBadgeURIs',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'streakType', type: 'uint8' },
      { name: 'threshold', type: 'uint32' },
    ],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'activeMultipliers',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'streakType', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'uint32' }],
  },
  {
    name: 'applyBonusXP',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'streakType', type: 'uint8' },
      { name: 'baseXP', type: 'uint32' },
    ],
    outputs: [],
  },
  {
    name: 'configureReward',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'streakType', type: 'uint8' },
      { name: 'threshold', type: 'uint32' },
      { name: 'xpReward', type: 'uint32' },
      { name: 'multiplier', type: 'uint32' },
      { name: 'badgeURI', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'xpEngine',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'badgeMinter',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'streakCore',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'paused',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const STREAK_MILESTONES_ABI = [
  {
    name: 'claimMilestone',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'milestoneId', type: 'uint32' }],
    outputs: [],
  },
  {
    name: 'claimAllMilestones',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'getAvailableMilestones',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint32[]' }],
  },
  {
    name: 'getMilestoneDetails',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'milestoneId', type: 'uint32' }],
    outputs: [
      { name: 'requiredDays', type: 'uint32' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'specialReward', type: 'uint32' },
      { name: 'badgeURI', type: 'string' },
      { name: 'isGlobal', type: 'bool' },
      { name: 'isActive', type: 'bool' },
    ],
  },
  {
    name: 'achievedMilestones',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'milestoneId', type: 'uint32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'milestoneCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint32' }],
  },
  {
    name: 'getActiveMilestones',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint32[]' }],
  },
  {
    name: 'totalStreakDays',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint32' }],
  },
  {
    name: 'hasEpicStreak',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'hasLegendaryStreak',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'configureMilestone',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'milestoneId', type: 'uint32' },
      { name: 'requiredDays', type: 'uint32' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'specialReward', type: 'uint32' },
      { name: 'badgeURI', type: 'string' },
      { name: 'isGlobal', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'updateTotalStreakDays',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [],
  },
  {
    name: 'xpEngine',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'badgeMinter',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'streakCore',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'paused',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// Streak types enum (matching the contract)
export const STREAK_TYPES = {
  DAILY_LOGIN: 0,
  QUEST_COMPLETION: 1,
  SOCIAL_INTERACTION: 2,
  GOVERNANCE_PARTICIPATION: 3,
  TRADING_ACTIVITY: 4,
} as const

// Backward compatibility alias
export const ACTIVITY_TYPES = STREAK_TYPES

export const useStreakCore = () => {
  const { address } = useAccount()

  const useActivityStreak = (streakType: number) => {
    const { data: currentStreak } = useReadContract({
      address: CONTRACT_ADDRESSES.StreakCore as `0x${string}`,
      abi: STREAK_CORE_ABI,
      functionName: 'getCurrentStreak',
      args: address ? [address, streakType] : undefined,
      query: { enabled: !!address },
    })

    const { data: longestStreak } = useReadContract({
      address: CONTRACT_ADDRESSES.StreakCore as `0x${string}`,
      abi: STREAK_CORE_ABI,
      functionName: 'getLongestStreak',
      args: address ? [address, streakType] : undefined,
      query: { enabled: !!address },
    })

    const { data: hasRecordedToday } = useReadContract({
      address: CONTRACT_ADDRESSES.StreakCore as `0x${string}`,
      abi: STREAK_CORE_ABI,
      functionName: 'hasRecordedToday',
      args: address ? [address, streakType] : undefined,
      query: { enabled: !!address },
    })

    return {
      currentStreak,
      longestStreak,
      hasRecordedToday,
    }
  }

  return {
    useActivityStreak,
    contractAddress: CONTRACT_ADDRESSES.StreakCore as `0x${string}`,
    abi: STREAK_CORE_ABI,
  }
}

export const useStreakRewards = () => {
  const { address } = useAccount()

  const useActivityRewards = (streakType: number) => {
    const { data: availableRewards } = useReadContract({
      address: CONTRACT_ADDRESSES.StreakRewards as `0x${string}`,
      abi: STREAK_REWARDS_ABI,
      functionName: 'getAvailableRewards',
      args: address ? [address, streakType] : undefined,
      query: { enabled: !!address },
    })

    const { data: rewardThresholds } = useReadContract({
      address: CONTRACT_ADDRESSES.StreakRewards as `0x${string}`,
      abi: STREAK_REWARDS_ABI,
      functionName: 'getRewardThresholds',
      args: [streakType],
      query: { enabled: true },
    })

    const { data: activeMultipliers } = useReadContract({
      address: CONTRACT_ADDRESSES.StreakRewards as `0x${string}`,
      abi: STREAK_REWARDS_ABI,
      functionName: 'activeMultipliers',
      args: address ? [address, streakType] : undefined,
      query: { enabled: !!address },
    })

    return {
      availableRewards: availableRewards as number[] | undefined,
      rewardThresholds: rewardThresholds as number[] | undefined,
      activeMultipliers: activeMultipliers as number | undefined,
    }
  }

  return {
    useActivityRewards,
    contractAddress: CONTRACT_ADDRESSES.StreakRewards as `0x${string}`,
    abi: STREAK_REWARDS_ABI,
  }
}

export const useStreakMilestones = () => {
  const { address } = useAccount()

  const { data: availableMilestones } = useReadContract({
    address: CONTRACT_ADDRESSES.StreakMilestones as `0x${string}`,
    abi: STREAK_MILESTONES_ABI,
    functionName: 'getAvailableMilestones',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: activeMilestones } = useReadContract({
    address: CONTRACT_ADDRESSES.StreakMilestones as `0x${string}`,
    abi: STREAK_MILESTONES_ABI,
    functionName: 'getActiveMilestones',
    query: { enabled: true },
  })

  const { data: milestoneCount } = useReadContract({
    address: CONTRACT_ADDRESSES.StreakMilestones as `0x${string}`,
    abi: STREAK_MILESTONES_ABI,
    functionName: 'milestoneCount',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: totalStreakDays } = useReadContract({
    address: CONTRACT_ADDRESSES.StreakMilestones as `0x${string}`,
    abi: STREAK_MILESTONES_ABI,
    functionName: 'totalStreakDays',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: hasEpicStreak } = useReadContract({
    address: CONTRACT_ADDRESSES.StreakMilestones as `0x${string}`,
    abi: STREAK_MILESTONES_ABI,
    functionName: 'hasEpicStreak',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: hasLegendaryStreak } = useReadContract({
    address: CONTRACT_ADDRESSES.StreakMilestones as `0x${string}`,
    abi: STREAK_MILESTONES_ABI,
    functionName: 'hasLegendaryStreak',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  return {
    availableMilestones: availableMilestones as number[] | undefined,
    activeMilestones: activeMilestones as number[] | undefined,
    milestoneCount: milestoneCount as number | undefined,
    totalStreakDays: totalStreakDays as number | undefined,
    hasEpicStreak: hasEpicStreak as boolean | undefined,
    hasLegendaryStreak: hasLegendaryStreak as boolean | undefined,
    contractAddress: CONTRACT_ADDRESSES.StreakMilestones as `0x${string}`,
    abi: STREAK_MILESTONES_ABI,
  }
}