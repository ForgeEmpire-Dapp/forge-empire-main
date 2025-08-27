import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCommunityRewards } from '@/hooks/useCommunityRewards';
import { Loader2, Gift, Wallet, DollarSign, Send } from 'lucide-react';
import { useAccount } from 'wagmi';

export const CommunityRewardsInterface = () => {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const {
    rewardToken,
    totalRewardsDistributed,
    vestingWalletFactory,
    hasDepositorRole,
    hasDistributorRole,
    depositRewards,
    distributeVestedRewards,
    isProcessing,
    refetchRewardToken,
    refetchTotalRewardsDistributed,
    refetchVestingWalletFactory,
  } = useCommunityRewards();

  const [depositAmount, setDepositAmount] = useState('');
  const [distributeBeneficiary, setDistributeBeneficiary] = useState('');
  const [distributeAmount, setDistributeAmount] = useState('');
  const [distributeDuration, setDistributeDuration] = useState('');

  const handleDeposit = async () => {
    if (!depositAmount || isNaN(Number(depositAmount))) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }
    await depositRewards(BigInt(depositAmount));
    setDepositAmount('');
  };

  const handleDistribute = async () => {
    if (!distributeBeneficiary || !distributeBeneficiary.startsWith('0x') || distributeBeneficiary.length !== 42) {
      toast({ title: "Invalid Beneficiary Address", description: "Please enter a valid Ethereum address.", variant: "destructive" });
      return;
    }
    if (!distributeAmount || isNaN(Number(distributeAmount))) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }
    if (!distributeDuration || isNaN(Number(distributeDuration))) {
      toast({ title: "Invalid Duration", description: "Please enter a valid duration in seconds.", variant: "destructive" });
      return;
    }
    await distributeVestedRewards(distributeBeneficiary as `0x${string}`, BigInt(distributeAmount), BigInt(distributeDuration));
    setDistributeBeneficiary('');
    setDistributeAmount('');
    setDistributeDuration('');
  };

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col items-center justify-center text-center">
            <Gift className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Connect wallet to access Community Rewards Interface</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Community Rewards Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {rewardToken ? rewardToken.toString() : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Reward Token</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">
                {totalRewardsDistributed !== undefined ? totalRewardsDistributed.toString() : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Total Distributed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {vestingWalletFactory ? vestingWalletFactory.toString() : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Vesting Factory</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasDepositorRole && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Deposit Rewards
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deposit-amount">Amount to Deposit</Label>
              <Input
                id="deposit-amount"
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <Button onClick={handleDeposit} disabled={isProcessing || !depositAmount} className="w-full">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <DollarSign className="w-4 h-4 mr-2" />
              Deposit Rewards
            </Button>
          </CardContent>
        </Card>
      )}

      {hasDistributorRole && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Distribute Vested Rewards
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="beneficiary-address">Beneficiary Address</Label>
              <Input
                id="beneficiary-address"
                type="text"
                value={distributeBeneficiary}
                onChange={(e) => setDistributeBeneficiary(e.target.value)}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="distribute-amount">Amount to Distribute</Label>
              <Input
                id="distribute-amount"
                type="number"
                value={distributeAmount}
                onChange={(e) => setDistributeAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="distribute-duration">Vesting Duration (seconds)</Label>
              <Input
                id="distribute-duration"
                type="number"
                value={distributeDuration}
                onChange={(e) => setDistributeDuration(e.target.value)}
                placeholder="e.g., 31536000 for 1 year"
              />
            </div>
            <Button onClick={handleDistribute} disabled={isProcessing || !distributeBeneficiary || !distributeAmount || !distributeDuration} className="w-full">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Send className="w-4 h-4 mr-2" />
              Distribute Rewards
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};