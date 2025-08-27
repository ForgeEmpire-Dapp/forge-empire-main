import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { readContract } from '@wagmi/core';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { abi as tokenManagerAbi } from '@/contract-abi/TokenManagerCore.sol/TokenManagerCore.json';
import erc20Abi from '@/abis/ERC20.json'; // A generic ERC20 ABI
import { config } from '@/config/web3';
import { toast } from 'sonner';

export const useTokenManager = () => {
  const { address } = useAccount();

  const tokenManagerContract = {
    address: CONTRACT_ADDRESSES.TokenManagerCore as `0x${string}`,
    abi: tokenManagerAbi,
  };

  const { writeContractAsync: launchToken, data: launchTokenHash } = useWriteContract();
  const { isLoading: isLaunching } = useWaitForTransactionReceipt({ hash: launchTokenHash });

  const handleLaunchToken = async (tokenAddress: string) => {
    try {
      // Fetch token details from the provided address
      const name = await readContract(config, { address: tokenAddress as `0x${string}`, abi: erc20Abi, functionName: 'name' });
      const symbol = await readContract(config, { address: tokenAddress as `0x${string}`, abi: erc20Abi, functionName: 'symbol' });
      const totalSupply = await readContract(config, { address: tokenAddress as `0x${string}`, abi: erc20Abi, functionName: 'totalSupply' });

      await launchToken({
        ...tokenManagerContract,
        functionName: 'launchToken',
        args: [tokenAddress as `0x${string}`, name, symbol, totalSupply],
      });

      toast.success('Token registered successfully!');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error('Failed to register token', { description: errorMessage });
    }
  };

  return {
    launchToken: handleLaunchToken,
    isLaunching,
  };
};