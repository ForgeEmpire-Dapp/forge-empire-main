import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { readContract } from '@wagmi/core';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { abi as guildAbi } from '@/contract-abi/modules/GuildCore.sol/GuildCore.json';
import { config } from '@/config/web3';
import { toast } from 'sonner';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { parseEther } from 'viem';

export const useGuild = () => {
  const [guilds, setGuilds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const guildContract = useMemo(() => ({
    address: CONTRACT_ADDRESSES.GuildCore as `0x${string}`,
    abi: guildAbi,
  }), []);

  const { data: nextGuildId } = useReadContract({ ...guildContract, functionName: 'nextGuildId' });
  const { data: guildCreationFee } = useReadContract({ ...guildContract, functionName: 'guildCreationFee' });
  const { data: minRequiredXP } = useReadContract({ ...guildContract, functionName: 'minRequiredXP' });
  const { data: maxGuildSize } = useReadContract({ ...guildContract, functionName: 'maxGuildSize' });

  const fetchAllGuilds = useCallback(async () => {
    if (nextGuildId === undefined) return;
    setIsLoading(true);
    try {
      const guildPromises = [];
      for (let i = 1; i < Number(nextGuildId); i++) {
        guildPromises.push(readContract(config, { ...guildContract, functionName: 'getGuild', args: [BigInt(i)] }));
      }
      const rawGuilds = await Promise.all(guildPromises);
      setGuilds(rawGuilds.filter(g => g.isActive));
    } catch (error) {
      toast.error('Failed to fetch guilds.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [nextGuildId, guildContract]);

  useEffect(() => {
    fetchAllGuilds();
  }, [fetchAllGuilds]);

  const { writeContractAsync: createGuild, data: createGuildHash } = useWriteContract();
  const { isLoading: isCreatingGuild } = useWaitForTransactionReceipt({ hash: createGuildHash });

  const handleCreateGuild = async (name: string, description: string, requiredXP: number) => {
    try {
      await createGuild({
        ...guildContract,
        functionName: 'createGuild',
        args: [name, description, BigInt(requiredXP)],
        value: guildCreationFee,
      });
      toast.success('Guild created successfully!');
      fetchAllGuilds();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error('Failed to create guild', { description: errorMessage });
    }
  };

  return {
    guilds,
    isLoading,
    refetchGuilds: fetchAllGuilds,
    createGuild: handleCreateGuild,
    isCreatingGuild,
    nextGuildId: nextGuildId ? Number(nextGuildId) : 0,
    guildCreationFee,
    minRequiredXP,
    maxGuildSize,
  };
};

export const useGuildInfo = (guildId: number | null) => {
  const guildContract = useMemo(() => ({
    address: CONTRACT_ADDRESSES.GuildCore as `0x${string}`,
    abi: guildAbi,
  }), []);

  const { data: guild, isLoading: isLoadingGuild } = useReadContract({
    ...guildContract,
    functionName: 'getGuild',
    args: guildId ? [BigInt(guildId)] : undefined,
    query: { enabled: !!guildId && guildId > 0 },
  });

  const { data: memberAddresses, isLoading: isLoadingMembers } = useReadContract({
    ...guildContract,
    functionName: 'getGuildMembers',
    args: guildId ? [BigInt(guildId)] : undefined,
    query: { enabled: !!guildId && guildId > 0 },
  });

  const [members, setMembers] = useState([]);
  useEffect(() => {
    const fetchMembers = async () => {
      if (!memberAddresses || !guildId) return;
      const memberPromises = memberAddresses.map(address => readContract(config, { ...guildContract, functionName: 'getMember', args: [BigInt(guildId), address] }));
      const memberDetails = await Promise.all(memberPromises);
      setMembers(memberDetails);
    };
    fetchMembers();
  }, [memberAddresses, guildId, guildContract]);

  const { writeContractAsync: joinGuild, data: joinGuildHash } = useWriteContract();
  const { isLoading: isJoining } = useWaitForTransactionReceipt({ hash: joinGuildHash });

  const handleJoinGuild = async () => {
    try {
      await joinGuild({ ...guildContract, functionName: 'joinGuild', args: [BigInt(guildId)] });
      toast.success('Successfully joined guild!');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error('Failed to join guild', { description: errorMessage });
    }
  };

  return {
    guild,
    members,
    isLoading: isLoadingGuild || isLoadingMembers,
    joinGuild: handleJoinGuild,
    isJoining,
  };
};

export const useUserGuild = (userAddress?: string) => {
  const { address } = useAccount();
  const targetAddress = userAddress || address;

  const { data: userGuildId } = useReadContract({
    address: CONTRACT_ADDRESSES.GuildCore as `0x${string}`,
    abi: guildAbi,
    functionName: 'getUserGuild',
    args: [targetAddress!],
    query: { enabled: !!targetAddress },
  });

  return userGuildId ? Number(userGuildId) : 0;
};