
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { config } from '@/config/web3'
import { useToast } from '@/hooks/use-toast'
import { logger, logUserAction, logTransaction } from '@/utils/logger'
import { useMemo } from 'react'
import ForgePassABI from '@/contract-abi/ForgePass.sol/ForgePass.json'

const FORGE_PASS_ABI = ForgePassABI.abi

export interface ForgePassDetails {
  tokenId: bigint
  tier: number
  expirationTime: bigint
  isActive: boolean
  tokenURI?: string
}

export const useGetPassDetails = (tokenId: bigint) => {
  const { data: details, isLoading: isLoadingDetails } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgePass as `0x${string}`,
    abi: FORGE_PASS_ABI,
    functionName: 'passDetails',
    args: [tokenId],
    query: { enabled: !!tokenId }
  })

  const { data: isActive, isLoading: isLoadingActive } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgePass as `0x${string}`,
    abi: FORGE_PASS_ABI,
    functionName: 'isPassActive',
    args: [tokenId],
    query: { enabled: !!tokenId }
  })

  const { data: tokenURI, isLoading: isLoadingURI } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgePass as `0x${string}`,
    abi: FORGE_PASS_ABI,
    functionName: 'tokenURI',
    args: [tokenId],
    query: { enabled: !!tokenId }
  })

  const passDetails = useMemo(() => {
    if (details) {
      return {
        tokenId,
        tier: details[1],
        expirationTime: details[0],
        isActive: isActive || false,
        tokenURI
      } as ForgePassDetails
    }
    return null
  }, [details, isActive, tokenURI, tokenId])

  return {
    passDetails,
    isLoading: isLoadingDetails || isLoadingActive || isLoadingURI
  }
}

export const useForgePass = () => {
  const { address } = useAccount()
  const { toast } = useToast()

  // Get user's pass count
  const { data: passBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgePass as `0x${string}`,
    abi: FORGE_PASS_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  })

  // Get user's passes
  const { data: userPasses, refetch: refetchPasses } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgePass as `0x${string}`,
    abi: FORGE_PASS_ABI,
    functionName: 'tokenOfOwnerByIndex',
    args: address && passBalance ? [address, 0n] : undefined,
    query: { enabled: !!address && !!passBalance && passBalance > 0n }
  })

  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: CONTRACT_ADDRESSES.ForgePass as `0x${string}`,
    abi: FORGE_PASS_ABI,
    functionName: 'totalSupply',
  })

  // Write functions
  const { writeContract: mint, data: mintHash } = useWriteContract()
  const { writeContract: renew, data: renewHash } = useWriteContract()
  const { writeContract: upgrade, data: upgradeHash } = useWriteContract()
  const { writeContract: batchMint, data: batchMintHash } = useWriteContract()

  const { writeContract: setTokenURIWrite, data: setTokenURIHash } = useWriteContract();

  const { isLoading: isSettingTokenURI } = useWaitForTransactionReceipt({ 
    hash: setTokenURIHash, 
    onSuccess: () => {
      toast.success('Token URI set successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to set token URI: ${error.message}`);
    }
  });

  const { writeContract: pauseWrite, data: pauseHash } = useWriteContract();

  const { isLoading: isPausing } = useWaitForTransactionReceipt({ 
    hash: pauseHash, 
    onSuccess: () => {
      toast.success('Forge Pass paused successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to pause Forge Pass: ${error.message}`);
    }
  });

  const { writeContract: unpauseWrite, data: unpauseHash } = useWriteContract();

  const { isLoading: isUnpausing } = useWaitForTransactionReceipt({ 
    hash: unpauseHash, 
    onSuccess: () => {
      toast.success('Forge Pass unpaused successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to unpause Forge Pass: ${error.message}`);
    }
  });

  const { isLoading: isMintPending } = useWaitForTransactionReceipt({
    hash: mintHash
  })

  const { isLoading: isRenewPending } = useWaitForTransactionReceipt({
    hash: renewHash
  })

  const { isLoading: isUpgradePending } = useWaitForTransactionReceipt({
    hash: upgradeHash
  })

  const { isLoading: isBatchMintPending } = useWaitForTransactionReceipt({
    hash: batchMintHash
  })

  const mintPass = async (to: `0x${string}`, tier: number, duration: number) => {
    try {
      logUserAction('forge_pass_mint', { to, tier: tier.toString(), duration: duration.toString() })
      await mint({
        address: CONTRACT_ADDRESSES.ForgePass as `0x${string}`,
        abi: FORGE_PASS_ABI,
        functionName: 'mintPass',
        args: [to, tier, BigInt(duration)],
        chain: config.chains[0],
        account: address,
      })
      toast({
        title: "Pass Minting Initiated",
        description: `Minting Tier ${tier} pass...`
      })
    } catch (error: unknown) {
      toast({
        title: "Minting Failed",
        description: error instanceof Error ? error.message : "Failed to mint pass",
        variant: "destructive"
      })
    }
  }

  const renewPass = async (tokenId: bigint, duration: number) => {
    try {
      logUserAction('forge_pass_renew', { tokenId: tokenId.toString(), duration: duration.toString() })
      await renew({
        address: CONTRACT_ADDRESSES.ForgePass as `0x${string}`,
        abi: FORGE_PASS_ABI,
        functionName: 'renewPass',
        args: [tokenId, BigInt(duration)],
        chain: config.chains[0],
        account: address,
      })
      toast({
        title: "Pass Renewal Initiated",
        description: "Renewing your pass..."
      })
    } catch (error: unknown) {
      toast({
        title: "Renewal Failed",
        description: error instanceof Error ? error.message : "Failed to renew pass",
        variant: "destructive"
      })
    }
  }

  const upgradePass = async (tokenId: bigint, newTier: number) => {
    try {
      logUserAction('forge_pass_upgrade', { tokenId: tokenId.toString(), newTier: newTier.toString() })
      await upgrade({
        address: CONTRACT_ADDRESSES.ForgePass as `0x${string}`,
        abi: FORGE_PASS_ABI,
        functionName: 'upgradePass',
        args: [tokenId, newTier],
        chain: config.chains[0],
        account: address,
      })
      toast({
        title: "Pass Upgrade Initiated",
        description: `Upgrading to Tier ${newTier}...`
      })
    } catch (error: unknown) {
      toast({
        title: "Upgrade Failed",
        description: error instanceof Error ? error.message : "Failed to upgrade pass",
        variant: "destructive"
      })
    }
  }

  const batchMintPass = async (recipients: `0x${string}`[], tiers: number[], durations: number[]) => {
    try {
      logUserAction('forge_pass_batch_mint', { recipients: recipients.length })
      await batchMint({
        address: CONTRACT_ADDRESSES.ForgePass as `0x${string}`,
        abi: FORGE_PASS_ABI,
        functionName: 'batchMintPass',
        args: [recipients, tiers, durations.map(d => BigInt(d))],
        chain: config.chains[0],
        account: address,
      })
      toast({
        title: "Batch Minting Initiated",
        description: `Minting ${recipients.length} passes...`
      })
    } catch (error: unknown) {
      toast({
        title: "Batch Minting Failed",
        description: error instanceof Error ? error.message : "Failed to batch mint passes",
        variant: "destructive"
      })
    }
  }

  // Helper to get tier name
  const getTierName = (tier: number) => {
    switch (tier) {
      case 1: return 'Bronze'
      case 2: return 'Silver'
      case 3: return 'Gold'
      case 4: return 'Platinum'
      case 5: return 'Diamond'
      default: return 'Unknown'
    }
  }

  // Helper to get tier color
  const getTierColor = (tier: number) => {
    switch (tier) {
      case 1: return 'text-amber-600'
      case 2: return 'text-gray-400'
      case 3: return 'text-yellow-500'
      case 4: return 'text-purple-500'
      case 5: return 'text-blue-500'
      default: return 'text-muted-foreground'
    }
  }

  return {
    // Data
    passBalance: passBalance ? Number(passBalance) : 0,
    userPasses,
    totalSupply: totalSupply ? Number(totalSupply) : 0,

    // Functions
    mintPass,
    renewPass,
    upgradePass,
    batchMintPass,
    getTierName,
    getTierColor,
    refetchBalance,
    refetchPasses,
    refetchTotalSupply,

    // Loading states
    isMintPending,
    isRenewPending,
    isUpgradePending,
    isBatchMintPending,
    setTokenURI: (tokenId: bigint, newURI: string) => {
      setTokenURIWrite({
        address: CONTRACT_ADDRESSES.ForgePass as `0x${string}`,
        abi: FORGE_PASS_ABI,
        functionName: 'setTokenURI',
        args: [tokenId, newURI],
        chain: config.chains[0],
        account: address,
      });
    },
    isSettingTokenURI,
    pause: () => {
      pauseWrite({
        address: CONTRACT_ADDRESSES.ForgePass as `0x${string}`,
        abi: FORGE_PASS_ABI,
        functionName: 'pause',
        chain: config.chains[0],
        account: address,
      });
    },
    isPausing,
    unpause: () => {
      unpauseWrite({
        address: CONTRACT_ADDRESSES.ForgePass as `0x${string}`,
        abi: FORGE_PASS_ABI,
        functionName: 'unpause',
        chain: config.chains[0],
        account: address,
      });
    },
    isUnpausing,
  }
}
