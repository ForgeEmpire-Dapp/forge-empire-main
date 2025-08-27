import { useState } from 'react'
import { logComponentError } from '@/utils/secureLogger'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { avalancheFuji } from 'wagmi/chains'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Target,
  Plus,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info
} from 'lucide-react'
import { CONTRACT_ADDRESSES } from '@/config/web3'
import { useQuestSystemStatus, useQuest } from '@/hooks/useQuestRegistry'
import { toast } from 'sonner'

const QUEST_REGISTRY_ABI = [
  {
    name: 'createQuest',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_questType', type: 'uint8' },
      { name: '_description', type: 'string' },
      { name: '_parameters', type: 'bytes' },
      { name: '_xpReward', type: 'uint256' },
      { name: '_badgeIdReward', type: 'uint256' },
      { name: '_isRepeatable', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'updateQuest',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_questId', type: 'uint256' },
      { name: '_questType', type: 'uint8' },
      { name: '_description', type: 'string' },
      { name: '_parameters', type: 'bytes' },
      { name: '_xpReward', type: 'uint256' },
      { name: '_badgeIdReward', type: 'uint256' },
      { name: '_isRepeatable', type: 'bool' },
      { name: '_isActive', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'pause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'unpause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const

const QuestViewer = ({ questId }: { questId: bigint }) => {
  const { data: questData, isLoading, error } = useQuest(questId)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading quest data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !questData) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load quest data. Quest may not exist.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const [questType, description, parameters, xpReward, badgeIdReward, isRepeatable, isActive] = questData as [
    number, string, string, bigint, bigint, boolean, boolean
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Quest #{questId.toString()}
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Active" : "Inactive"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Quest Type</Label>
            <p className="text-sm text-muted-foreground">Type {questType}</p>
          </div>
          <div>
            <Label className="text-sm font-medium">XP Reward</Label>
            <p className="text-sm text-muted-foreground">{xpReward.toString()} XP</p>
          </div>
        </div>
        
        <div>
          <Label className="text-sm font-medium">Description</Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Badge Reward</Label>
            <p className="text-sm text-muted-foreground">
              {badgeIdReward > 0n ? `Badge ID: ${badgeIdReward.toString()}` : "No badge reward"}
            </p>
          </div>
          <div>
            <Label className="text-sm font-medium">Repeatable</Label>
            <p className="text-sm text-muted-foreground">{isRepeatable ? "Yes" : "No"}</p>
          </div>
        </div>
        
        {parameters && (
          <div>
            <Label className="text-sm font-medium">Parameters</Label>
            <p className="text-sm text-muted-foreground font-mono break-all">{parameters}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const QuestRegistryInterface = () => {
  const { address, isConnected } = useAccount()
  const { xpEngine, badgeMinter, isPaused } = useQuestSystemStatus()
  const [isProcessing, setIsProcessing] = useState(false)
  const [viewQuestId, setViewQuestId] = useState('')
  
  // Quest creation form
  const [questType, setQuestType] = useState('0')
  const [description, setDescription] = useState('')
  const [parameters, setParameters] = useState('0x')
  const [xpReward, setXpReward] = useState('')
  const [badgeIdReward, setBadgeIdReward] = useState('0')
  const [isRepeatable, setIsRepeatable] = useState(false)

  const { writeContract, data: hash, error } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash })

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to access the Quest Registry interface.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const handleCreateQuest = async () => {
    if (!description.trim() || !xpReward) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      setIsProcessing(true)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.QuestRegistry as `0x${string}`,
        abi: QUEST_REGISTRY_ABI,
        functionName: 'createQuest',
        args: [
          parseInt(questType),
          description,
          parameters as `0x${string}`,
          BigInt(xpReward),
          BigInt(badgeIdReward),
          isRepeatable
        ],
        chain: avalancheFuji,
        account: address!,
      })

      toast.success("Quest creation transaction submitted")
      
      // Reset form
      setDescription('')
      setParameters('0x')
      setXpReward('')
      setBadgeIdReward('0')
      setIsRepeatable(false)
    } catch (error) {
      logComponentError('QuestRegistryInterface', 'Quest creation', error)
      toast.error("Failed to create quest")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTogglePause = async () => {
    try {
      setIsProcessing(true)
      
      await writeContract({
        address: CONTRACT_ADDRESSES.QuestRegistry as `0x${string}`,
        abi: QUEST_REGISTRY_ABI,
        functionName: isPaused ? 'unpause' : 'pause',
        args: [],
        chain: avalancheFuji,
        account: address!,
      })

      toast.success(`Quest Registry ${isPaused ? 'unpaused' : 'paused'}`)
    } catch (error) {
      logComponentError('QuestRegistryInterface', 'Pause toggle', error)
      toast.error("Failed to toggle pause state")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6" />
            Quest Registry Admin Interface
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className={isPaused ? "border-destructive" : "border-success"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Quest Registry Status: <strong>{isPaused ? "PAUSED" : "ACTIVE"}</strong>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">XP Engine Contract</Label>
              <p className="text-sm text-muted-foreground font-mono break-all">
                {xpEngine || 'Loading...'}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Badge Minter Contract</Label>
              <p className="text-sm text-muted-foreground font-mono break-all">
                {badgeMinter || 'Loading...'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Contract Paused</Label>
              <p className="text-sm text-muted-foreground">
                {isPaused ? "Yes" : "No"}
              </p>
            </div>
            <Button
              onClick={handleTogglePause}
              disabled={isProcessing || isConfirming}
              variant={isPaused ? "default" : "destructive"}
            >
              {isProcessing || isConfirming ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {isPaused ? "Unpause Contract" : "Pause Contract"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quest Viewer */}
      <Card>
        <CardHeader>
          <CardTitle>Quest Viewer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Quest ID"
              value={viewQuestId}
              onChange={(e) => setViewQuestId(e.target.value)}
              type="number"
            />
            <Button 
              onClick={() => setViewQuestId(viewQuestId)}
              disabled={!viewQuestId}
            >
              View Quest
            </Button>
          </div>
          
          {viewQuestId && !isNaN(Number(viewQuestId)) && (
            <QuestViewer questId={BigInt(viewQuestId)} />
          )}
        </CardContent>
      </Card>

      {/* Quest Creation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Quest
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="questType">Quest Type</Label>
              <Input
                id="questType"
                type="number"
                min="0"
                max="255"
                value={questType}
                onChange={(e) => setQuestType(e.target.value)}
                placeholder="0"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="xpReward">XP Reward *</Label>
              <Input
                id="xpReward"
                type="number"
                min="1"
                value={xpReward}
                onChange={(e) => setXpReward(e.target.value)}
                placeholder="100"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the quest objectives and requirements"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="parameters">Parameters (hex)</Label>
              <Input
                id="parameters"
                value={parameters}
                onChange={(e) => setParameters(e.target.value)}
                placeholder="0x"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="badgeIdReward">Badge ID Reward</Label>
              <Input
                id="badgeIdReward"
                type="number"
                min="0"
                value={badgeIdReward}
                onChange={(e) => setBadgeIdReward(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isRepeatable"
              checked={isRepeatable}
              onCheckedChange={setIsRepeatable}
            />
            <Label htmlFor="isRepeatable">Repeatable Quest</Label>
          </div>

          <Separator />

          <Button
            onClick={handleCreateQuest}
            disabled={isProcessing || isConfirming || !description.trim() || !xpReward}
            className="w-full"
          >
            {isProcessing || isConfirming ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Create Quest
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Transaction failed. Please try again.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}