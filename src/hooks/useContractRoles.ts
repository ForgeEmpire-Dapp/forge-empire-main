import { useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { ABIS } from '@/config/abis';

export const useUserRole = (contractName: keyof typeof CONTRACT_ADDRESSES, userAddress: `0x${string}` | undefined, roleName: string) => {
  const contractAddress = CONTRACT_ADDRESSES[contractName];
  const abi = ABIS[contractName];

  const { data, isLoading } = useReadContract({
    address: contractAddress,
    abi: abi,
    functionName: 'hasRole',
    args: [roleName, userAddress],
    query: {
      enabled: !!userAddress && !!contractAddress && !!abi,
    },
  });

  return { hasRole: data, isLoading };
};