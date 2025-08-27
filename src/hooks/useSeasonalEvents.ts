import { useReadContract, useWriteContract } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/web3'

const EVENTS_ABI = [
  {
    inputs: [],
    name: 'nextEventId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getActiveEvents',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'eventId', type: 'uint256' }],
    name: 'getEventInfo',
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'eventType', type: 'uint8' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'maxParticipants', type: 'uint256' },
      { name: 'currentParticipants', type: 'uint256' },
      { name: 'xpReward', type: 'uint256' },
      { name: 'active', type: 'bool' },
      { name: 'started', type: 'bool' },
      { name: 'ended', type: 'bool' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'eventId', type: 'uint256' },
      { name: 'user', type: 'address' }
    ],
    name: 'getUserEventProgress',
    outputs: [
      { name: 'registered', type: 'bool' },
      { name: 'progress', type: 'uint256' },
      { name: 'completed', type: 'bool' },
      { name: 'claimed', type: 'bool' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserStats',
    outputs: [
      { name: 'eventsParticipated', type: 'uint256' },
      { name: 'eventsCompleted', type: 'uint256' },
      { name: 'totalXPEarned', type: 'uint256' },
      { name: 'rank', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getGlobalStats',
    outputs: [
      { name: 'totalEvents', type: 'uint256' },
      { name: 'activeEvents', type: 'uint256' },
      { name: 'totalParticipants', type: 'uint256' },
      { name: 'totalXPDistributed', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'eventType', type: 'uint8' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'maxParticipants', type: 'uint256' },
      { name: 'xpReward', type: 'uint256' },
      { name: 'badgeReward', type: 'uint256' },
      { name: 'requirements', type: 'string[]' },
      { name: 'thresholds', type: 'uint256[]' },
      { name: 'isPublic', type: 'bool' },
      { name: 'autoStart', type: 'bool' },
      { name: 'requiredLevel', type: 'uint256' }
    ],
    name: 'createEvent',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'eventId', type: 'uint256' }],
    name: 'registerForEvent',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'eventId', type: 'uint256' }],
    name: 'claimRewards',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const

export const useSeasonalEvents = () => {
  const { writeContract } = useWriteContract()

  // Read functions
  const { data: nextEventId } = useReadContract({
    address: CONTRACT_ADDRESSES.SeasonalEvents as `0x${string}`,
    abi: EVENTS_ABI,
    functionName: 'nextEventId',
  })

  const { data: activeEvents } = useReadContract({
    address: CONTRACT_ADDRESSES.SeasonalEvents as `0x${string}`,
    abi: EVENTS_ABI,
    functionName: 'getActiveEvents',
  })

  const { data: globalStats } = useReadContract({
    address: CONTRACT_ADDRESSES.SeasonalEvents as `0x${string}`,
    abi: EVENTS_ABI,
    functionName: 'getGlobalStats',
  })

  // Write functions (temporarily disabled due to TypeScript config)
  const registerForEvent = async (eventId: number) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to register for events.",
        variant: "destructive"
      })
      return
    }

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.SeasonalEvents as `0x${string}`,
        abi: EVENTS_ABI,
        functionName: 'registerForEvent',
        args: [BigInt(eventId)],
        chain: config.chains[0],
        account: address,
      })
      toast({
        title: "Registration Successful!",
        description: "You have successfully registered for the event.",
      })
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Registration Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  const claimRewards = async (eventId: number) => {
    if (!address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to claim rewards.",
        variant: "destructive"
      })
      return
    }

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.SeasonalEvents as `0x${string}`,
        abi: EVENTS_ABI,
        functionName: 'claimRewards',
        args: [BigInt(eventId)],
        chain: config.chains[0],
        account: address,
      })
      toast({
        title: "Rewards Claimed!",
        description: "Your event rewards have been claimed successfully.",
      })
    } catch (error: unknown) {
      const decodedError = decodeContractError(error)
      toast({
        title: "Reward Claiming Failed",
        description: decodedError,
        variant: "destructive",
      })
    }
  }

  return {
    nextEventId: nextEventId ? Number(nextEventId) : 0,
    activeEvents: activeEvents?.map(id => Number(id)) || [],
    globalStats: globalStats ? {
      totalEvents: Number(globalStats[0]),
      activeEvents: Number(globalStats[1]),
      totalParticipants: Number(globalStats[2]),
      totalXPDistributed: Number(globalStats[3])
    } : null,
    registerForEvent,
    claimRewards
  }
}

export const useEventInfo = (eventId: number) => {
  const { data: eventInfo } = useReadContract({
    address: CONTRACT_ADDRESSES.SeasonalEvents as `0x${string}`,
    abi: EVENTS_ABI,
    functionName: 'getEventInfo',
    args: [BigInt(eventId)],
    query: { 
      enabled: eventId > 0 
    },
  })

  return eventInfo ? {
    name: eventInfo[0],
    description: eventInfo[1],
    eventType: Number(eventInfo[2]),
    startTime: Number(eventInfo[3]),
    endTime: Number(eventInfo[4]),
    maxParticipants: Number(eventInfo[5]),
    currentParticipants: Number(eventInfo[6]),
    xpReward: Number(eventInfo[7]),
    active: eventInfo[8],
    started: eventInfo[9],
    ended: eventInfo[10]
  } : null
}

export const useUserEventProgress = (eventId: number, userAddress?: string) => {
  const { data: progress } = useReadContract({
    address: CONTRACT_ADDRESSES.SeasonalEvents as `0x${string}`,
    abi: EVENTS_ABI,
    functionName: 'getUserEventProgress',
    args: [BigInt(eventId), userAddress as `0x${string}`],
    query: { 
      enabled: eventId > 0 && !!userAddress 
    },
  })

  return progress ? {
    registered: progress[0],
    progress: Number(progress[1]),
    completed: progress[2],
    claimed: progress[3]
  } : null
}

export const useUserEventStats = (userAddress?: string) => {
  const { data: stats } = useReadContract({
    address: CONTRACT_ADDRESSES.SeasonalEvents as `0x${string}`,
    abi: EVENTS_ABI,
    functionName: 'getUserStats',
    args: [userAddress as `0x${string}`],
    query: { 
      enabled: !!userAddress 
    },
  })

  return stats ? {
    eventsParticipated: Number(stats[0]),
    eventsCompleted: Number(stats[1]),
    totalXPEarned: Number(stats[2]),
    rank: Number(stats[3])
  } : null
}