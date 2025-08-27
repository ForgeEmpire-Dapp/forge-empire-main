import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useForgePass } from '@/hooks/useForgePass';
import { Loader2, Plus, Award, RefreshCw, Pause, Play, Upload, UserCheck } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useUserRole } from '@/hooks/useContractRoles';

export const ForgePassInterface = () => {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const {
    passBalance,
    totalSupply,
    mintPass,
    renewPass,
    upgradePass,
    batchMintPass,
    getTierName,
    getTierColor,
    isMintPending,
    isRenewPending,
    isUpgradePending,
    isBatchMintPending,
    refetchBalance,
    refetchPasses,
    refetchTotalSupply,
  } = useForgePass();

  // Admin roles
  const { hasRole: hasMinterRole } = useUserRole('ForgePass', address, 'MINTER_ROLE');
  const { hasRole: hasUpgraderRole } = useUserRole('ForgePass', address, 'UPGRADER_ROLE');
  const { hasRole: hasPauserRole } = useUserRole('ForgePass', address, 'PAUSER_ROLE');
  const { hasRole: hasAdminRole } = useUserRole('ForgePass', address, 'DEFAULT_ADMIN_ROLE');

  // State for Mint Pass
  const [mintToAddress, setMintToAddress] = useState('');
  const [mintTier, setMintTier] = useState('1');
  const [mintDuration, setMintDuration] = useState('');

  // State for Renew Pass
  const [renewTokenId, setRenewTokenId] = useState('');
  const [renewDuration, setRenewDuration] = useState('');

  // State for Upgrade Pass
  const [upgradeTokenId, setUpgradeTokenId] = useState('');
  const [upgradeNewTier, setUpgradeNewTier] = useState('1');

  // State for Batch Mint Pass
  const [batchRecipients, setBatchRecipients] = useState(''); // Comma-separated addresses
  const [batchTiers, setBatchTiers] = useState(''); // Comma-separated numbers
  const [batchDurations, setBatchDurations] = useState(''); // Comma-separated numbers

  // State for Set Token URI
  const [setUriTokenId, setSetUriTokenId] = useState('');
  const [newTokenURI, setNewTokenURI] = useState('');

  // State for Pause/Unpause
  const [isPaused, setIsPaused] = useState(false); // This should come from hook

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col items-center justify-center text-center">
            <Award className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Connect wallet to access Forge Pass Interface</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleMintPass = async () => {
    if (!mintToAddress || !mintToAddress.startsWith('0x') || mintToAddress.length !== 42) {
      toast({ title: "Invalid Address", description: "Please enter a valid Ethereum address.", variant: "destructive" });
      return;
    }
    if (!mintDuration || isNaN(Number(mintDuration))) {
      toast({ title: "Invalid Duration", description: "Please enter a valid duration in seconds.", variant: "destructive" });
      return;
    }
    await mintPass(mintToAddress as `0x${string}`, parseInt(mintTier), parseInt(mintDuration));
    setMintToAddress('');
    setMintDuration('');
  };

  const handleRenewPass = async () => {
    if (!renewTokenId || isNaN(Number(renewTokenId))) {
      toast({ title: "Invalid Token ID", description: "Please enter a valid token ID.", variant: "destructive" });
      return;
    }
    if (!renewDuration || isNaN(Number(renewDuration))) {
      toast({ title: "Invalid Duration", description: "Please enter a valid duration in seconds.", variant: "destructive" });
      return;
    }
    await renewPass(BigInt(renewTokenId), parseInt(renewDuration));
    setRenewTokenId('');
    setRenewDuration('');
  };

  const handleUpgradePass = async () => {
    if (!upgradeTokenId || isNaN(Number(upgradeTokenId))) {
      toast({ title: "Invalid Token ID", description: "Please enter a valid token ID.", variant: "destructive" });
      return;
    }
    await upgradePass(BigInt(upgradeTokenId), parseInt(upgradeNewTier));
    setUpgradeTokenId('');
  };

  const handleBatchMintPass = async () => {
    const recipientsArray = batchRecipients.split(',').map(addr => addr.trim() as `0x${string}`);
    const tiersArray = batchTiers.split(',').map(tier => parseInt(tier.trim()));
    const durationsArray = batchDurations.split(',').map(duration => parseInt(duration.trim()));

    if (recipientsArray.length === 0 || tiersArray.length === 0 || durationsArray.length === 0) {
      toast({ title: "Invalid Input", description: "All batch fields must be filled.", variant: "destructive" });
      return;
    }
    if (recipientsArray.length !== tiersArray.length || recipientsArray.length !== durationsArray.length) {
      toast({ title: "Input Mismatch", description: "Recipient, tier, and duration arrays must have same length.", variant: "destructive" });
      return;
    }

    await batchMintPass(recipientsArray, tiersArray, durationsArray);
    setBatchRecipients('');
    setBatchTiers('');
    setBatchDurations('');
  };

  const handleSetTokenURI = async () => {
    // This function is not yet implemented in the hook
    toast({ title: "Not Implemented", description: "setTokenURI is not yet implemented in the hook.", variant: "destructive" });
  };

  const handlePause = async () => {
    // This function is not yet implemented in the hook
    toast({ title: "Not Implemented", description: "pause is not yet implemented in the hook.", variant: "destructive" });
  };

  const handleUnpause = async () => {
    // This function is not yet implemented in the hook
    toast({ title: "Not Implemented", description: "unpause is not yet implemented in the hook.", variant: "destructive" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Forge Pass Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {passBalance !== undefined ? passBalance.toString() : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Your Passes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">
                {totalSupply !== undefined ? totalSupply.toString() : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Total Supply</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {isPaused ? 'Yes' : 'No'}
              </div>
              <div className="text-xs text-muted-foreground">Paused</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasMinterRole && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Mint Pass
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mint-to-address">Recipient Address</Label>
              <Input id="mint-to-address" value={mintToAddress} onChange={(e) => setMintToAddress(e.target.value)} placeholder="0x..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mint-tier">Tier</Label>
              <Select value={mintTier} onValueChange={setMintTier}>
                <SelectTrigger><SelectValue placeholder="Select Tier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Bronze (Tier 1)</SelectItem>
                  <SelectItem value="2">Silver (Tier 2)</SelectItem>
                  <SelectItem value="3">Gold (Tier 3)</SelectItem>
                  <SelectItem value="4">Platinum (Tier 4)</SelectItem>
                  <SelectItem value="5">Diamond (Tier 5)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mint-duration">Duration (seconds)</Label>
              <Input id="mint-duration" type="number" value={mintDuration} onChange={(e) => setMintDuration(e.target.value)} placeholder="e.g., 31536000 for 1 year" />
            </div>
            <Button onClick={handleMintPass} disabled={isMintPending || !mintToAddress || !mintDuration} className="w-full">
              {isMintPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Plus className="w-4 h-4 mr-2" />
              Mint Pass
            </Button>
          </CardContent>
        </Card>
      )}

      {hasMinterRole && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Batch Mint Pass
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-recipients">Recipients (comma-separated addresses)</Label>
              <Input id="batch-recipients" value={batchRecipients} onChange={(e) => setBatchRecipients(e.target.value)} placeholder="0x..., 0x..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-tiers">Tiers (comma-separated numbers)</Label>
              <Input id="batch-tiers" value={batchTiers} onChange={(e) => setBatchTiers(e.target.value)} placeholder="e.g., 1,2,3" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-durations">Durations (comma-separated seconds)</Label>
              <Input id="batch-durations" value={batchDurations} onChange={(e) => setBatchDurations(e.target.value)} placeholder="e.g., 31536000, 604800" />
            </div>
            <Button onClick={handleBatchMintPass} disabled={isBatchMintPending || !batchRecipients || !batchTiers || !batchDurations} className="w-full">
              {isBatchMintPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Plus className="w-4 h-4 mr-2" />
              Batch Mint Pass
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Renew Pass
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="renew-token-id">Token ID</Label>
            <Input id="renew-token-id" type="number" value={renewTokenId} onChange={(e) => setRenewTokenId(e.target.value)} placeholder="Token ID" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="renew-duration">Duration (seconds)</Label>
            <Input id="renew-duration" type="number" value={renewDuration} onChange={(e) => setRenewDuration(e.target.value)} placeholder="e.g., 31536000 for 1 year" />
          </div>
          <Button onClick={handleRenewPass} disabled={isRenewPending || !renewTokenId || !renewDuration} className="w-full">
            {isRenewPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            <RefreshCw className="w-4 h-4 mr-2" />
            Renew Pass
          </Button>
        </CardContent>
      </Card>

      {hasUpgraderRole && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upgrade Pass
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upgrade-token-id">Token ID</Label>
              <Input id="upgrade-token-id" type="number" value={upgradeTokenId} onChange={(e) => setUpgradeTokenId(e.target.value)} placeholder="Token ID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upgrade-new-tier">New Tier</Label>
              <Select value={upgradeNewTier} onValueChange={setUpgradeNewTier}>
                <SelectTrigger><SelectValue placeholder="Select New Tier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Bronze (Tier 1)</SelectItem>
                  <SelectItem value="2">Silver (Tier 2)</SelectItem>
                  <SelectItem value="3">Gold (Tier 3)</SelectItem>
                  <SelectItem value="4">Platinum (Tier 4)</SelectItem>
                  <SelectItem value="5">Diamond (Tier 5)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpgradePass} disabled={isUpgradePending || !upgradeTokenId} className="w-full">
              {isUpgradePending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Upload className="w-4 h-4 mr-2" />
              Upgrade Pass
            </Button>
          </CardContent>
        </Card>
      )}

      {hasAdminRole && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Set Token URI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="set-uri-token-id">Token ID</Label>
              <Input id="set-uri-token-id" type="number" value={setUriTokenId} onChange={(e) => setSetUriTokenId(e.target.value)} placeholder="Token ID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-token-uri">New Token URI</Label>
              <Input id="new-token-uri" value={newTokenURI} onChange={(e) => setNewTokenURI(e.target.value)} placeholder="ipfs://... or https://..." />
            </div>
            <Button onClick={handleSetTokenURI} disabled={isProcessing || !setUriTokenId || !newTokenURI} className="w-full">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <UserCheck className="w-4 h-4 mr-2" />
              Set Token URI
            </Button>
          </CardContent>
        </Card>
      )}

      {hasPauserRole && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pause className="w-5 h-5" />
              Pause/Unpause Contract
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={handlePause} disabled={isProcessing || isPaused} className="flex-1">
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
              <Button onClick={handleUnpause} disabled={isProcessing || !isPaused} className="flex-1">
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                <Play className="w-4 h-4 mr-2" />
                Unpause
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};