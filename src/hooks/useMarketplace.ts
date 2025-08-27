import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { readContract } from '@wagmi/core';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { abi as marketplaceAbi } from '@/contract-abi/modules/MarketplaceCore.sol/MarketplaceCore.json';
import erc721Abi from '@/abis/ERC721.json'; // A generic ERC721 ABI is needed for approve and tokenURI
import { config } from '@/config/web3';
import { toast } from 'sonner';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { parseEther, formatEther } from 'viem';

export const useMarketplace = () => {
  const { address } = useAccount();
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const marketplaceContract = useMemo(() => ({
    address: CONTRACT_ADDRESSES.MarketplaceCore as `0x${string}`,
    abi: marketplaceAbi,
  }), []);

  const { data: nextListingId } = useReadContract({
    ...marketplaceContract,
    functionName: 'nextListingId',
  });

  const fetchAllListings = useCallback(async () => {
    if (nextListingId === undefined) return;
    setIsLoading(true);
    try {
      const listingPromises = [];
      for (let i = 1; i < Number(nextListingId); i++) {
        listingPromises.push(readContract(config, { ...marketplaceContract, functionName: 'getListing', args: [BigInt(i)] }));
      }
      const rawListings = await Promise.all(listingPromises);

      const activeListings = rawListings.filter(l => l.status === 0); // Assuming 0 is Active status

      const listingsWithMetadata = await Promise.all(activeListings.map(async (listing) => {
        try {
          const tokenURI = await readContract(config, { address: listing.nftContract, abi: erc721Abi, functionName: 'tokenURI', args: [listing.tokenId] });
          const metadataResponse = await fetch(tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/'));
          const metadata = await metadataResponse.json();
          return { ...listing, ...metadata };
        } catch (error) {
          console.error('Failed to fetch metadata for token:', listing.tokenId, error);
          return { ...listing, name: `NFT #${listing.tokenId}`, description: 'No metadata available.', image: '' };
        }
      }));

      setListings(listingsWithMetadata);
    } catch (error) {
      toast.error('Failed to fetch marketplace listings.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [nextListingId, marketplaceContract]);

  useEffect(() => {
    fetchAllListings();
  }, [fetchAllListings]);

  const { writeContractAsync: approve, data: approveHash } = useWriteContract();
  const { writeContractAsync: listItem, data: listItemHash } = useWriteContract();
  const { writeContractAsync: buyNow, data: buyNowHash } = useWriteContract();

  const { isLoading: isApproving } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isListing } = useWaitForTransactionReceipt({ hash: listItemHash });
  const { isLoading: isBuying } = useWaitForTransactionReceipt({ hash: buyNowHash });

  const handleListItem = async (nftContract: string, tokenId: number, price: string) => {
    try {
      // Approve marketplace to handle the NFT
      await approve({
        address: nftContract as `0x${string}`,
        abi: erc721Abi,
        functionName: 'approve',
        args: [marketplaceContract.address, BigInt(tokenId)],
      });

      // List the item
      await listItem({
        ...marketplaceContract,
        functionName: 'listItem',
        args: [
          nftContract as `0x${string}`,
          BigInt(tokenId),
          parseEther(price),
          '0x0000000000000000000000000000000000000000', // Assuming native currency payment
          0, // FixedPrice listing type
          0, // duration (0 for indefinite)
          0, // reservePrice
          0, // buyNowPrice
        ],
      });

      toast.success('NFT listed successfully!');
      fetchAllListings();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error('Failed to list NFT', { description: errorMessage });
    }
  };

  const handleBuyItem = async (listingId: number, price: bigint) => {
    try {
      await buyNow({
        ...marketplaceContract,
        functionName: 'buyNow',
        args: [BigInt(listingId)],
        value: price,
      });
      toast.success('NFT purchased successfully!');
      fetchAllListings();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error('Failed to purchase NFT', { description: errorMessage });
    }
  };

  return {
    listings,
    isLoading,
    refetchListings: fetchAllListings,
    listItem: handleListItem,
    buyItem: handleBuyItem,
    isApproving,
    isListing,
    isBuying,
    isConnected: !!address,
  };
};