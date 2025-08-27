import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { 
  Settings, 
  Play, 
  Pause, 
  Users, 
  Trophy, 
  BarChart3, 
  CheckCircle,
  Clock,
  Star
} from 'lucide-react'
import { useOnboardingQuests, useStepConfig, useStepCompletionCount } from '@/hooks/useOnboardingQuests'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useToast } from '@/hooks/use-toast'
import { CONTRACT_ADDRESSES } from '@/config/web3'

interface StepConfig {
  title: string;
  description: string;
  instructions: string;
  xpReward: bigint;
  badgeURI: string;
  isActive: boolean;
  timeLimit: bigint;
}

const StepConfigCard = ({ stepNumber }: { stepNumber: number }) => {
  const { data: stepConfig } = useStepConfig(stepNumber)
  const { data: completionCount } = useStepCompletionCount(stepNumber)
  const { abi, contractAddress } = useOnboardingQuests()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructions: '',
    xpReward: '',
    badgeURI: '',
    isActive: true,
    timeLimit: ''
  })

  const { writeContractAsync } = useWriteContract()
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash })

  const config = stepConfig as StepConfig | undefined
  const count = completionCount as bigint | undefined

  const updateStepConfig = async () => {
    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: 'updateStepConfig',
        args: [
          stepNumber,
          formData.title,
          formData.description,
          formData.instructions,
          BigInt(formData.xpReward || '0'),
          formData.badgeURI,
          formData.isActive,
          BigInt(formData.timeLimit || '0')
        ],
      })
      setTxHash(hash)
      toast({ title: 'Update sent', description: `Hash: ${hash.slice(0, 10)}...` })
      setIsEditing(false)
    } catch (error: unknown) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
    }
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Step {stepNumber} not configured
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Step {stepNumber}: {config.title}
              {config.isActive ? (
                <Badge variant="default">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </CardTitle>
            <CardDescription>{config.description}</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{Number(config.xpReward)}</div>
            <div className="text-xs text-muted-foreground">XP Reward</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!isEditing ? (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Instructions</Label>
                <p className="mt-1">{config.instructions}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Badge URI</Label>
                <p className="mt-1 font-mono text-xs">{config.badgeURI || 'None'}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Time Limit: {Number(config.timeLimit)}s</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Completed: {count ? Number(count) : 0}</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setFormData({
                    title: config.title,
                    description: config.description,
                    instructions: config.instructions,
                    xpReward: config.xpReward.toString(),
                    badgeURI: config.badgeURI,
                    isActive: config.isActive,
                    timeLimit: config.timeLimit.toString()
                  })
                  setIsEditing(true)
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="xpReward">XP Reward</Label>
                <Input
                  id="xpReward"
                  type="number"
                  value={formData.xpReward}
                  onChange={(e) => setFormData(prev => ({ ...prev, xpReward: e.target.value }))}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                value={formData.instructions}
                onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="badgeURI">Badge URI</Label>
                <Input
                  id="badgeURI"
                  value={formData.badgeURI}
                  onChange={(e) => setFormData(prev => ({ ...prev, badgeURI: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="timeLimit">Time Limit (seconds)</Label>
                <Input
                  id="timeLimit"
                  type="number"
                  value={formData.timeLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, timeLimit: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={updateStepConfig} disabled={isConfirming}>
                {isConfirming ? 'Updating...' : 'Update Step'}
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const OnboardingQuestsInterface = () => {
  const { 
    stats, 
    totalStarted, 
    totalCompleted, 
    isPaused, 
    xpEngineAddress, 
    badgeMinterAddress,
    isProcessing,
    abi,
    contractAddress
  } = useOnboardingQuests()
  
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash })

  const pauseContract = async () => {
    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: 'pause',
        args: [],
      })
      setTxHash(hash)
      toast({ title: 'Pause sent', description: `Hash: ${hash.slice(0, 10)}...` })
    } catch (error: unknown) {
      toast({ title: 'Pause failed', description: error.message, variant: 'destructive' })
    }
  }

  const unpauseContract = async () => {
    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: 'unpause',
        args: [],
      })
      setTxHash(hash)
      toast({ title: 'Unpause sent', description: `Hash: ${hash.slice(0, 10)}...` })
    } catch (error: unknown) {
      toast({ title: 'Unpause failed', description: error.message, variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          OnboardingQuests Contract Admin
        </CardTitle>
        <CardDescription>
          Manage onboarding quest configurations and monitor system status
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="steps">Step Configs</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="controls">Controls</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <div className="text-sm font-medium">Total Started</div>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {totalStarted ? Number(totalStarted) : '0'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <div className="text-sm font-medium">Total Completed</div>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {totalCompleted ? Number(totalCompleted) : '0'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-accent" />
                    <div className="text-sm font-medium">Completion Rate</div>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {totalStarted && totalCompleted 
                      ? `${Math.round((Number(totalCompleted) / Number(totalStarted)) * 100)}%`
                      : '0%'
                    }
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${isPaused ? 'bg-destructive' : 'bg-success'}`} />
                    <div className="text-sm font-medium">Status</div>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {isPaused ? 'Paused' : 'Active'}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Contract Integrations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-4 w-4 text-accent" />
                      <div className="font-medium">XP Engine</div>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {xpEngineAddress || 'Not configured'}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="h-4 w-4 text-warning" />
                      <div className="font-medium">Badge Minter</div>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {badgeMinterAddress || 'Not configured'}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="steps" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Step Configurations</h3>
              {[0, 1, 2, 3, 4].map(stepNumber => (
                <StepConfigCard key={stepNumber} stepNumber={stepNumber} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Quest Analytics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats && (
                  <>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground">Stat A</div>
                        <div className="text-2xl font-bold">{Number(stats[0])}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground">Stat B</div>
                        <div className="text-2xl font-bold">{Number(stats[1])}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground">Stat C</div>
                        <div className="text-2xl font-bold">{Number(stats[2])}</div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="controls" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">System Controls</h3>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Contract Status</h4>
                      <p className="text-sm text-muted-foreground">
                        {isPaused ? 'Contract is currently paused' : 'Contract is active'}
                      </p>
                    </div>
                    <Button
                      variant={isPaused ? "default" : "destructive"}
                      onClick={isPaused ? unpauseContract : pauseContract}
                      disabled={isProcessing || isConfirming}
                    >
                      {isPaused ? (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Unpause
                        </>
                      ) : (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}