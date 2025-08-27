import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Coins, TrendingUp, Lock, Gift, Loader2 } from 'lucide-react';
import { useStakingRewards } from '@/hooks/useStakingRewards';
import { useAccount } from 'wagmi';
import { ConnectWalletEmpty } from '@/components/states/EmptyStates';

export const EnhancedStakingInterface = () => {
  const { address } = useAccount();
  const {
    userStaked,
    userRewards,
    totalStaked,
    stakeTokens,
    unstakeTokens,
    claimStakingRewards,
    isApproving,
    isStakePending,
    isUnstakePending,
    isClaimPending,
  } = useStakingRewards();

  const [amount, setAmount] = useState('');

  if (!address) {
    return <ConnectWalletEmpty />;
  }

  const isProcessing = isApproving || isStakePending || isUnstakePending || isClaimPending;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
          Staking Dashboard
        </h1>
        <p className="text-xl text-muted-foreground">
          Stake your FORGE tokens to earn rewards.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Coins className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Staked</p>
                <p className="text-2xl font-bold">{totalStaked} FORGE</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your Staked Amount</p>
                <p className="text-2xl font-bold">{userStaked} FORGE</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Gift className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your Rewards</p>
                <p className="text-2xl font-bold">{userRewards} FORGE</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Manage Your Stake
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="stake">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="stake">Stake</TabsTrigger>
              <TabsTrigger value="unstake">Unstake</TabsTrigger>
            </TabsList>
            <TabsContent value="stake" className="mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stake-amount">Amount to Stake</Label>
                  <Input
                    id="stake-amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => stakeTokens(amount)}
                  disabled={isProcessing || !amount}
                  className="w-full"
                >
                  {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                  {isApproving ? 'Approving...' : isStakePending ? 'Staking...' : 'Stake Tokens'}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="unstake" className="mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="unstake-amount">Amount to Unstake</Label>
                  <Input
                    id="unstake-amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => unstakeTokens(amount)}
                  disabled={isProcessing || !amount}
                  className="w-full"
                >
                  {isUnstakePending ? 'Unstaking...' : 'Unstake Tokens'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 border-t pt-6">
            <Button
              onClick={() => claimStakingRewards()}
              disabled={isProcessing || userRewards === '0'}
              className="w-full"
              variant="outline"
            >
              {isClaimPending ? 'Claiming...' : 'Claim Rewards'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
