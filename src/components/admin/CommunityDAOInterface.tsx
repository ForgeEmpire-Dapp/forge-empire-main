import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCommunityDAO } from '@/hooks/useCommunityDAO';
import { Loader2, Settings, Users, Percent, Clock, DollarSign, Ban } from 'lucide-react';
import { useAccount } from 'wagmi';

export const CommunityDAOInterface = () => {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const {
    setVotingPeriodDuration,
    setQuorumPercentage,
    setTotalVoters,
    setBlacklistedTarget,
    setMaxProposalValue,
    isSettingVotingPeriodDuration,
    isSettingQuorumPercentage,
    isSettingTotalVoters,
    isSettingBlacklistedTarget,
    isSettingMaxProposalValue,
  } = useCommunityDAO();

  const [newVotingPeriod, setNewVotingPeriod] = useState('');
  const [newQuorumPercentage, setNewQuorumPercentage] = useState('');
  const [newTotalVoters, setNewTotalVoters] = useState('');
  const [targetAddress, setTargetAddress] = useState('');
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const [newMaxProposalValue, setNewMaxProposalValue] = useState('');

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col items-center justify-center text-center">
            <Users className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Connect wallet to access DAO Admin Interface</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSetVotingPeriod = async () => {
    if (!newVotingPeriod || isNaN(Number(newVotingPeriod))) {
      toast({ title: "Invalid Input", description: "Please enter a valid number for voting period.", variant: "destructive" });
      return;
    }
    await setVotingPeriodDuration(BigInt(newVotingPeriod));
    setNewVotingPeriod('');
  };

  const handleSetQuorumPercentage = async () => {
    if (!newQuorumPercentage || isNaN(Number(newQuorumPercentage))) {
      toast({ title: "Invalid Input", description: "Please enter a valid number for quorum percentage.", variant: "destructive" });
      return;
    }
    await setQuorumPercentage(BigInt(newQuorumPercentage));
    setNewQuorumPercentage('');
  };

  const handleSetTotalVoters = async () => {
    if (!newTotalVoters || isNaN(Number(newTotalVoters))) {
      toast({ title: "Invalid Input", description: "Please enter a valid number for total voters.", variant: "destructive" });
      return;
    }
    await setTotalVoters(BigInt(newTotalVoters));
    setNewTotalVoters('');
  };

  const handleSetBlacklistedTarget = async () => {
    if (!targetAddress || !targetAddress.startsWith('0x') || targetAddress.length !== 42) {
      toast({ title: "Invalid Address", description: "Please enter a valid Ethereum address.", variant: "destructive" });
      return;
    }
    await setBlacklistedTarget(targetAddress as `0x${string}`, isBlacklisted);
    setTargetAddress('');
  };

  const handleSetMaxProposalValue = async () => {
    if (!newMaxProposalValue || isNaN(Number(newMaxProposalValue))) {
      toast({ title: "Invalid Input", description: "Please enter a valid number for max proposal value.", variant: "destructive" });
      return;
    }
    await setMaxProposalValue(BigInt(newMaxProposalValue));
    setNewMaxProposalValue('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            DAO Admin Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Set Voting Period Duration */}
          <div className="space-y-2">
            <Label htmlFor="voting-period">Voting Period Duration (seconds)</Label>
            <Input
              id="voting-period"
              type="number"
              value={newVotingPeriod}
              onChange={(e) => setNewVotingPeriod(e.target.value)}
              placeholder="e.g., 86400 for 1 day"
            />
            <Button onClick={handleSetVotingPeriod} disabled={isSettingVotingPeriodDuration || !newVotingPeriod} className="w-full">
              {isSettingVotingPeriodDuration && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Clock className="w-4 h-4 mr-2" />
              Set Voting Period
            </Button>
          </div>

          {/* Set Quorum Percentage */}
          <div className="space-y-2">
            <Label htmlFor="quorum-percentage">Quorum Percentage (1-100)</Label>
            <Input
              id="quorum-percentage"
              type="number"
              value={newQuorumPercentage}
              onChange={(e) => setNewQuorumPercentage(e.target.value)}
              placeholder="e.g., 50 for 50%"
            />
            <Button onClick={handleSetQuorumPercentage} disabled={isSettingQuorumPercentage || !newQuorumPercentage} className="w-full">
              {isSettingQuorumPercentage && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Percent className="w-4 h-4 mr-2" />
              Set Quorum Percentage
            </Button>
          </div>

          {/* Set Total Voters */}
          <div className="space-y-2">
            <Label htmlFor="total-voters">Total Eligible Voters</Label>
            <Input
              id="total-voters"
              type="number"
              value={newTotalVoters}
              onChange={(e) => setNewTotalVoters(e.target.value)}
              placeholder="e.g., 1000"
            />
            <Button onClick={handleSetTotalVoters} disabled={isSettingTotalVoters || !newTotalVoters} className="w-full">
              {isSettingTotalVoters && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Users className="w-4 h-4 mr-2" />
              Set Total Voters
            </Button>
          </div>

          {/* Set Max Proposal Value */}
          <div className="space-y-2">
            <Label htmlFor="max-proposal-value">Max Proposal Value (wei)</Label>
            <Input
              id="max-proposal-value"
              type="number"
              value={newMaxProposalValue}
              onChange={(e) => setNewMaxProposalValue(e.target.value)}
              placeholder="e.g., 1000000000000000000 for 1 ETH"
            />
            <Button onClick={handleSetMaxProposalValue} disabled={isSettingMaxProposalValue || !newMaxProposalValue} className="w-full">
              {isSettingMaxProposalValue && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <DollarSign className="w-4 h-4 mr-2" />
              Set Max Proposal Value
            </Button>
          </div>

          {/* Blacklist Target Address */}
          <div className="space-y-2">
            <Label htmlFor="target-address">Target Address to Blacklist/Whitelist</Label>
            <Input
              id="target-address"
              type="text"
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              placeholder="0x..."
            />
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-blacklisted"
                checked={isBlacklisted}
                onChange={(e) => setIsBlacklisted(e.target.checked)}
                className="form-checkbox h-4 w-4 text-primary"
              />
              <Label htmlFor="is-blacklisted">Blacklist Address</Label>
            </div>
            <Button onClick={handleSetBlacklistedTarget} disabled={isSettingBlacklistedTarget || !targetAddress} className="w-full">
              {isSettingBlacklistedTarget && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Ban className="w-4 h-4 mr-2" />
              Update Blacklist Status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};