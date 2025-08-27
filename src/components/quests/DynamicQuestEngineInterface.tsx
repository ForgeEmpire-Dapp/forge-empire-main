import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useDynamicQuests } from '@/hooks/useDynamicQuests';
import { Loader2, Plus, Award, CheckCircle, RefreshCw, Settings, Pause, Play, Maximize, Gift, Wallet } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useUserRole } from '@/hooks/useContractRoles';

export const DynamicQuestEngineInterface = () => {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const {
    activeQuests,
    completedQuests,
    maxActiveQuests,
    nextQuestId,
    nextTemplateId,
    isPaused,
    xpEngineAddress,
    hasQuestManagerRole,
    createQuestTemplate,
    generateQuestsForUser,
    completeQuest,
    claimQuestReward,
    isProcessing,
    isConnected: isHookConnected,
    refetchActiveQuests,
    refetchCompletedQuests,
  } = useDynamicQuests();

  // Admin roles
  const { hasRole: hasAdminRole } = useUserRole('DynamicQuestEngine', address, 'DEFAULT_ADMIN_ROLE');
  const { hasRole: hasAlgorithmUpdaterRole } = useUserRole('DynamicQuestEngine', address, 'ALGORITHM_UPDATER_ROLE');

  // State for Create Quest Template
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateCategory, setTemplateCategory] = useState('0'); // Default to 0 (TRADING)
  const [templateQuestType, setTemplateQuestType] = useState('0'); // Default to 0 (ACHIEVEMENT)
  const [templateDifficulty, setTemplateDifficulty] = useState('0'); // Default to 0 (EASY)
  const [templateBaseReward, setTemplateBaseReward] = useState('');
  const [templateTimeLimit, setTemplateTimeLimit] = useState('');
  const [templateParameters, setTemplateParameters] = useState(''); // Comma-separated bigints
  const [templateRequirements, setTemplateRequirements] = useState(''); // Comma-separated strings

  // State for Generate Quests for User
  const [generateUserAddress, setGenerateUserAddress] = useState('');
  const [generateCount, setGenerateCount] = useState('');

  // State for Complete Quest
  const [completeQuestId, setCompleteQuestId] = useState('');
  const [completeUserAddress, setCompleteUserAddress] = useState('');
  const [completeFinalValue, setCompleteFinalValue] = useState('');

  // State for Claim Quest Reward
  const [claimQuestId, setClaimQuestId] = useState('');

  // State for Admin Functions
  const [newMaxActiveQuests, setNewMaxActiveQuests] = useState('');
  const [levelWeight, setLevelWeight] = useState('');
  const [categoryWeight, setCategoryWeight] = useState('');
  const [successRateWeight, setSuccessRateWeight] = useState('');
  const [timeWeight, setTimeWeight] = useState('');
  const [diversityWeight, setDiversityWeight] = useState('');
  const [difficultyWeight, setDifficultyWeight] = useState('');

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col items-center justify-center text-center">
            <Gift className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Connect wallet to access Dynamic Quest Engine Interface</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleCreateQuestTemplate = async () => {
    try {
      const params = templateParameters.split(',').filter(p => p.trim() !== '').map(BigInt);
      const reqs = templateRequirements.split(',').filter(r => r.trim() !== '');
      await createQuestTemplate(
        templateName,
        templateDescription,
        parseInt(templateCategory),
        parseInt(templateQuestType),
        parseInt(templateDifficulty),
        BigInt(templateBaseReward),
        BigInt(templateTimeLimit),
        params,
        reqs
      );
      // Clear form
      setTemplateName('');
      setTemplateDescription('');
      setTemplateBaseReward('');
      setTemplateTimeLimit('');
      setTemplateParameters('');
      setTemplateRequirements('');
    } catch (error) {
      toast({ title: "Error", description: `Failed to create template: ${error.message}`, variant: "destructive" });
    }
  };

  const handleGenerateQuestsForUser = async () => {
    try {
      await generateQuestsForUser(generateUserAddress as `0x${string}`, BigInt(generateCount));
      setGenerateUserAddress('');
      setGenerateCount('');
    } catch (error) {
      toast({ title: "Error", description: `Failed to generate quests: ${error.message}`, variant: "destructive" });
    }
  };

  const handleCompleteQuest = async () => {
    try {
      await completeQuest(BigInt(completeQuestId), completeUserAddress as `0x${string}`, BigInt(completeFinalValue));
      setCompleteQuestId('');
      setCompleteUserAddress('');
      setCompleteFinalValue('');
    } catch (error) {
      toast({ title: "Error", description: `Failed to complete quest: ${error.message}`, variant: "destructive" });
    }
  };

  const handleClaimQuestReward = async () => {
    try {
      await claimQuestReward(BigInt(claimQuestId));
      setClaimQuestId('');
    } catch (error) {
      toast({ title: "Error", description: `Failed to claim reward: ${error.message}`, variant: "destructive" });
    }
  };

  // Admin Handlers (placeholders for now, need to add functions to hook)
  const handleUpdateMaxActiveQuests = async () => {
    // await updateMaxActiveQuests(BigInt(newMaxActiveQuests));
    toast({ title: "Not Implemented", description: "updateMaxActiveQuests is not yet implemented in the hook.", variant: "destructive" });
  };

  const handleUpdatePersonalizationWeights = async () => {
    // await updatePersonalizationWeights(BigInt(levelWeight), BigInt(categoryWeight), BigInt(successRateWeight), BigInt(timeWeight), BigInt(diversityWeight), BigInt(difficultyWeight));
    toast({ title: "Not Implemented", description: "updatePersonalizationWeights is not yet implemented in the hook.", variant: "destructive" });
  };

  const handlePauseQuesting = async () => {
    // await pauseQuesting();
    toast({ title: "Not Implemented", description: "pauseQuesting is not yet implemented in the hook.", variant: "destructive" });
  };

  const handleUnpauseQuesting = async () => {
    // await unpauseQuesting();
    toast({ title: "Not Implemented", description: "unpauseQuesting is not yet implemented in the hook.", variant: "destructive" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Dynamic Quest Engine Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {maxActiveQuests !== undefined ? maxActiveQuests.toString() : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Max Active Quests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">
                {nextQuestId !== undefined ? nextQuestId.toString() : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Next Quest ID</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {nextTemplateId !== undefined ? nextTemplateId.toString() : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Next Template ID</div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4" />
              <span>Processing: {isProcessing ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Pause className="w-4 h-4" />
              <span>Paused: {isPaused ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Wallet className="w-4 h-4" />
              <span>XP Engine: {xpEngineAddress ? xpEngineAddress.slice(0, 6) + '...' + xpEngineAddress.slice(-4) : 'N/A'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasQuestManagerRole && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Quest Template
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input id="template-name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Quest Name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea id="template-description" value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} placeholder="Quest Description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template-category">Category</Label>
                <Select value={templateCategory} onValueChange={setTemplateCategory}>
                  <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">TRADING</SelectItem>
                    <SelectItem value="1">SOCIAL</SelectItem>
                    <SelectItem value="2">GOVERNANCE</SelectItem>
                    <SelectItem value="3">STAKING</SelectItem>
                    <SelectItem value="4">GUILD</SelectItem>
                    <SelectItem value="5">LEARNING</SelectItem>
                    <SelectItem value="6">BRIDGE</SelectItem>
                    <SelectItem value="7">NFT</SelectItem>
                    <SelectItem value="8">DEFI</SelectItem>
                    <SelectItem value="9">GAMING</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-quest-type">Quest Type</Label>
                <Select value={templateQuestType} onValueChange={setTemplateQuestType}>
                  <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">ACHIEVEMENT</SelectItem>
                    <SelectItem value="1">COLLECTION</SelectItem>
                    <SelectItem value="2">SOCIAL_REACH</SelectItem>
                    <SelectItem value="3">TIME_BASED</SelectItem>
                    <SelectItem value="4">COLLABORATION</SelectItem>
                    <SelectItem value="5">SKILL_BASED</SelectItem>
                    <SelectItem value="6">EXPLORATION</SelectItem>
                    <SelectItem value="7">MILESTONE</SelectItem>
                    <SelectItem value="8">CREATIVE</SelectItem>
                    <SelectItem value="9">COMPETITIVE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template-difficulty">Difficulty</Label>
                <Select value={templateDifficulty} onValueChange={setTemplateDifficulty}>
                  <SelectTrigger><SelectValue placeholder="Select Difficulty" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">EASY</SelectItem>
                    <SelectItem value="1">MEDIUM</SelectItem>
                    <SelectItem value="2">HARD</SelectItem>
                    <SelectItem value="3">EPIC</SelectItem>
                    <SelectItem value="4">LEGENDARY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-base-reward">Base Reward</Label>
                <Input id="template-base-reward" type="number" value={templateBaseReward} onChange={(e) => setTemplateBaseReward(e.target.value)} placeholder="Base Reward (XP)" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-time-limit">Time Limit (seconds)</Label>
              <Input id="template-time-limit" type="number" value={templateTimeLimit} onChange={(e) => setTemplateTimeLimit(e.target.value)} placeholder="Time Limit" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-parameters">Parameters (comma-separated BigInts)</Label>
              <Input id="template-parameters" value={templateParameters} onChange={(e) => setTemplateParameters(e.target.value)} placeholder="e.g., 100,200,300" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-requirements">Requirements (comma-separated strings)</Label>
              <Input id="template-requirements" value={templateRequirements} onChange={(e) => setTemplateRequirements(e.target.value)} placeholder="e.g., 'Reach Level 5', 'Complete Tutorial'" />
            </div>
            <Button onClick={handleCreateQuestTemplate} disabled={isProcessing} className="w-full">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      )}

      {hasQuestManagerRole && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Generate Quests for User
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="generate-user-address">User Address</Label>
              <Input id="generate-user-address" value={generateUserAddress} onChange={(e) => setGenerateUserAddress(e.target.value)} placeholder="0x..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="generate-count">Number of Quests to Generate (1-5)</Label>
              <Input id="generate-count" type="number" value={generateCount} onChange={(e) => setGenerateCount(e.target.value)} placeholder="e.g., 3" />
            </div>
            <Button onClick={handleGenerateQuestsForUser} disabled={isProcessing} className="w-full">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate Quests
            </Button>
          </CardContent>
        </Card>
      )}

      {hasQuestManagerRole && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Complete Quest
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="complete-quest-id">Quest ID</Label>
              <Input id="complete-quest-id" type="number" value={completeQuestId} onChange={(e) => setCompleteQuestId(e.target.value)} placeholder="Quest ID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complete-user-address">User Address</Label>
              <Input id="complete-user-address" value={completeUserAddress} onChange={(e) => setCompleteUserAddress(e.target.value)} placeholder="0x..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complete-final-value">Final Value</Label>
              <Input id="complete-final-value" type="number" value={completeFinalValue} onChange={(e) => setCompleteFinalValue(e.target.value)} placeholder="Final Value" />
            </div>
            <Button onClick={handleCompleteQuest} disabled={isProcessing} className="w-full">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Quest
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Claim Quest Reward
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="claim-quest-id">Quest ID</Label>
            <Input id="claim-quest-id" type="number" value={claimQuestId} onChange={(e) => setClaimQuestId(e.target.value)} placeholder="Quest ID" />
          </div>
          <Button onClick={handleClaimQuestReward} disabled={isProcessing} className="w-full">
            {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            <Award className="w-4 h-4 mr-2" />
            Claim Reward
          </Button>
        </CardContent>
      </Card>

      {(hasAdminRole || hasAlgorithmUpdaterRole) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Admin Functions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasAdminRole && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-max-active-quests">Update Max Active Quests</Label>
                  <Input id="new-max-active-quests" type="number" value={newMaxActiveQuests} onChange={(e) => setNewMaxActiveQuests(e.target.value)} placeholder="New Max Active Quests" />
                </div>
                <Button onClick={handleUpdateMaxActiveQuests} disabled={isProcessing} className="w-full">
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  <Maximize className="w-4 h-4 mr-2" />
                  Update Max Active Quests
                </Button>
                <div className="flex gap-2">
                  <Button onClick={handlePauseQuesting} disabled={isProcessing || isPaused} className="flex-1">
                    {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    <Pause className="w-4 h-4 mr-2" />
                    Pause Questing
                  </Button>
                  <Button onClick={handleUnpauseQuesting} disabled={isProcessing || !isPaused} className="flex-1">
                    {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    <Play className="w-4 h-4 mr-2" />
                    Unpause Questing
                  </Button>
                </div>
              </div>
            )}
            {hasAlgorithmUpdaterRole && (
              <div className="space-y-4">
                <Label>Update Personalization Weights (Sum to 100)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Input type="number" value={levelWeight} onChange={(e) => setLevelWeight(e.target.value)} placeholder="Level Weight" />
                  <Input type="number" value={categoryWeight} onChange={(e) => setCategoryWeight(e.target.value)} placeholder="Category Weight" />
                  <Input type="number" value={successRateWeight} onChange={(e) => setSuccessRateWeight(e.target.value)} placeholder="Success Rate Weight" />
                  <Input type="number" value={timeWeight} onChange={(e) => setTimeWeight(e.target.value)} placeholder="Time Weight" />
                  <Input type="number" value={diversityWeight} onChange={(e) => setDiversityWeight(e.target.value)} placeholder="Diversity Weight" />
                  <Input type="number" value={difficultyWeight} onChange={(e) => setDifficultyWeight(e.target.value)} placeholder="Difficulty Weight" />
                </div>
                <Button onClick={handleUpdatePersonalizationWeights} disabled={isProcessing} className="w-full">
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  <Settings className="w-4 h-4 mr-2" />
                  Update Weights
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};