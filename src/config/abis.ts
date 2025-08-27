import CommunityDAOABI from '@/abis/CommunityDAO.json';
import ProfileRegistryV2ABI from '@/contract-abi/ProfileRegistryV2.sol/ProfileRegistryV2.json';
import CommunityRewardsABI from '@/contract-abi/CommunityRewards.sol/CommunityRewards.json';
import BadgeMinterABI from '@/contract-abi/BadgeMinter.sol/BadgeMinter.json';

export const ABIS = {
  CommunityDAO: CommunityDAOABI.abi,
  ProfileRegistry: ProfileRegistryV2ABI.abi,
  CommunityRewards: CommunityRewardsABI.abi,
  BadgeMinter: BadgeMinterABI.abi,
  // Add other ABIs as needed
};