
import { useAccount, useReadContract } from 'wagmi'
import XPEngineABI from '@/contract-abi/XPEngine.sol/XPEngine.json'
import BadgeMinterABI from '@/contract-abi/BadgeMinter.sol/BadgeMinter.json'
import MockERC20ABI from '@/contract-abi/mocks/MockERC20.sol/MockERC20.json'
import { CONTRACT_ADDRESSES } from '@/config/contracts'

// Simple contract hooks that work with the existing wagmi setup
export const useUserXP = () => {
  const { address } = useAccount()
  
  return useReadContract({
    address: CONTRACT_ADDRESSES.XPEngine as `0x${string}`,
    abi: XPEngineABI.abi,
    functionName: 'getXP',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 6000,
    },
  })
}

export const useUserLevel = () => {
  const { address } = useAccount()
  
  return useReadContract({
    address: CONTRACT_ADDRESSES.XPEngine as `0x${string}`,
    abi: XPEngineABI.abi,
    functionName: 'getLevel',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 6000,
    },
  })
}

export const useUserBadges = () => {
  const { address } = useAccount()
  
  const { data: badgeCount } = useReadContract({
    address: CONTRACT_ADDRESSES.BadgeMinter as `0x${string}`,
    abi: BadgeMinterABI.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  return {
    badgeCount: badgeCount ? Number(badgeCount) : 0,
  }
}

export const useTokenBalance = () => {
  const { address } = useAccount()
  
  return useReadContract({
    address: CONTRACT_ADDRESSES.MockERC20 as `0x${string}`,
    abi: MockERC20ABI.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 6000,
    },
  })
}
