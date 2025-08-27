import { useReadContract } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import BadgeMinterABI from '@/contract-abi/BadgeMinter.sol/BadgeMinter.json'
import QuestRegistryABI from '@/contract-abi/QuestRegistry.sol/QuestRegistry.json'
import ProfileRegistryABI from '@/contract-abi/ProfileRegistry.sol/ProfileRegistry.json'

// ABI references
const BADGE_MINTER_ABI = BadgeMinterABI.abi
const QUEST_REGISTRY_ABI = QuestRegistryABI.abi
const PROFILE_REGISTRY_ABI = ProfileRegistryABI.abi

/**
 * Hook to dynamically fetch contract roles instead of using hardcoded values
 */
export const useContractRoles = (contractName: keyof typeof CONTRACT_ADDRESSES) => {
  const contractAddress = CONTRACT_ADDRESSES[contractName] as `0x${string}`
  
  // Get ABI based on contract
  const getABI = () => {
    switch (contractName) {
      case 'BadgeMinter':
        return BADGE_MINTER_ABI
      case 'QuestRegistry':
        return QUEST_REGISTRY_ABI
      case 'ProfileRegistry':
        return PROFILE_REGISTRY_ABI
      default:
        return BADGE_MINTER_ABI // fallback
    }
  }

  const abi = getABI()

  // Fetch DEFAULT_ADMIN_ROLE (common across all contracts)
  const { data: defaultAdminRole } = useReadContract({
    address: contractAddress,
    abi,
    functionName: 'DEFAULT_ADMIN_ROLE',
    query: {
      staleTime: 60000 * 60, // 1 hour - roles rarely change
    },
  })

  // Fetch MINTER_ROLE (for BadgeMinter)
  const { data: minterRole } = useReadContract({
    address: contractAddress,
    abi,
    functionName: 'MINTER_ROLE',
    query: {
      enabled: contractName === 'BadgeMinter',
      staleTime: 60000 * 60,
    },
  })

  // Fetch QUEST_CREATOR_ROLE (for QuestRegistry)
  const { data: questCreatorRole } = useReadContract({
    address: contractAddress,
    abi,
    functionName: 'QUEST_CREATOR_ROLE',
    query: {
      enabled: contractName === 'QuestRegistry',
      staleTime: 60000 * 60,
    },
  })

  // Fetch UPDATER_ROLE (for ProfileRegistry)
  const { data: updaterRole } = useReadContract({
    address: contractAddress,
    abi,
    functionName: 'UPDATER_ROLE',
    query: {
      enabled: contractName === 'ProfileRegistry',
      staleTime: 60000 * 60,
    },
  })

  return {
    defaultAdminRole: defaultAdminRole as `0x${string}` | undefined,
    minterRole: minterRole as `0x${string}` | undefined,
    questCreatorRole: questCreatorRole as `0x${string}` | undefined,
    updaterRole: updaterRole as `0x${string}` | undefined,
    isLoading: !defaultAdminRole, // At minimum, all contracts should have DEFAULT_ADMIN_ROLE
  }
}

/**
 * Hook to check if a user has a specific role on a contract
 */
export const useUserRole = (
  contractName: keyof typeof CONTRACT_ADDRESSES,
  userAddress: `0x${string}` | undefined,
  roleType: 'admin' | 'minter' | 'questCreator' | 'updater'
) => {
  const contractAddress = CONTRACT_ADDRESSES[contractName] as `0x${string}`
  const { defaultAdminRole, minterRole, questCreatorRole, updaterRole } = useContractRoles(contractName)
  
  // Get the appropriate role hash
  const getRoleHash = () => {
    switch (roleType) {
      case 'admin':
        return defaultAdminRole
      case 'minter':
        return minterRole
      case 'questCreator':
        return questCreatorRole
      case 'updater':
        return updaterRole
      default:
        return defaultAdminRole
    }
  }

  const roleHash = getRoleHash()
  const abi = getContractABI(contractName)

  const { data: hasRole, isLoading } = useReadContract({
    address: contractAddress,
    abi,
    functionName: 'hasRole',
    args: roleHash && userAddress ? [roleHash, userAddress] : undefined,
    query: {
      enabled: !!roleHash && !!userAddress,
      refetchInterval: 30000, // Check every 30 seconds
    },
  })

  return {
    hasRole: !!hasRole,
    isLoading: isLoading || !roleHash,
    roleHash,
  }
}

// Helper function to get correct ABI
const getContractABI = (contractName: keyof typeof CONTRACT_ADDRESSES) => {
  switch (contractName) {
    case 'BadgeMinter':
      return BADGE_MINTER_ABI
    case 'QuestRegistry':
      return QUEST_REGISTRY_ABI
    case 'ProfileRegistry':
      return PROFILE_REGISTRY_ABI
    default:
      return BADGE_MINTER_ABI
  }
}