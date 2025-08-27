import { useState } from 'react'
import { logComponentError } from '@/utils/secureLogger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useXPSystem } from '@/hooks/useXPSystem'
import { useAccount } from 'wagmi'
import { 
  Award, 
  Users, 
  Minus, 
  Database,
  Pause,
  Play,
  Settings,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react'

export const XPEngineInterface = () => {
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const {
    userXP,
    userLevel,
    totalXPAwarded,
    isPaused,
    maxBatchSize,
    hasAwarderRole,
    awardXP,
    awardXPBatch,
    spendXP,
    isProcessing
  } = useXPSystem()

  // Single XP award state
  const [targetUser, setTargetUser] = useState('')
  const [xpAmount, setXpAmount] = useState('')

  // Batch XP award state
  const [batchUsers, setBatchUsers] = useState<string>('')
  const [batchAmounts, setBatchAmounts] = useState<string>('')

  // Spend XP state
  const [spendAmount, setSpendAmount] = useState('')

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col items-center justify-center text-center">
            <Settings className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Connect wallet to access XP Engine</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const handleAwardXP = async () => {
    if (!targetUser || !xpAmount) {
      toast({
        title: "Invalid Input",
        description: "Please enter both user address and XP amount.",
        variant: "destructive"
      })
      return
    }

    try {
      await awardXP(targetUser as `0x${string}`, BigInt(xpAmount))
      setTargetUser('')
      setXpAmount('')
    } catch (error) {
      logComponentError('XPEngineInterface', 'Award XP', error)
    }
  }

  const handleBatchAwardXP = async () => {
    if (!batchUsers || !batchAmounts) {
      toast({
        title: "Invalid Input",
        description: "Please enter both users and amounts.",
        variant: "destructive"
      })
      return
    }

    try {
      const users = batchUsers.split('\n').map(u => u.trim()).filter(u => u) as `0x${string}`[]
      const amounts = batchAmounts.split('\n').map(a => a.trim()).filter(a => a).map(a => BigInt(a))

      if (users.length !== amounts.length) {
        toast({
          title: "Mismatch Error",
          description: "Number of users must match number of amounts.",
          variant: "destructive"
        })
        return
      }

      if (maxBatchSize && users.length > Number(maxBatchSize)) {
        toast({
          title: "Batch Size Exceeded",
          description: `Maximum batch size is ${maxBatchSize}.`,
          variant: "destructive"
        })
        return
      }

      await awardXPBatch(users, amounts)
      setBatchUsers('')
      setBatchAmounts('')
    } catch (error) {
      logComponentError('XPEngineInterface', 'Batch award XP', error)
    }
  }

  const handleSpendXP = async () => {
    if (!spendAmount) {
      toast({
        title: "Invalid Input",
        description: "Please enter XP amount to spend.",
        variant: "destructive"
      })
      return
    }

    const amount = BigInt(spendAmount)
    if (userXP && amount > userXP) {
      toast({
        title: "Insufficient XP",
        description: "You don't have enough XP to spend.",
        variant: "destructive"
      })
      return
    }

    try {
      await spendXP(amount)
      setSpendAmount('')
    } catch (error) {
      logComponentError('XPEngineInterface', 'Spend XP', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Contract Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            XP Engine Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {Number(userXP || 0n).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Your XP</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">
                {Number(userLevel || 0n)}
              </div>
              <div className="text-xs text-muted-foreground">Your Level</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">
                {Number(totalXPAwarded || 0n).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Total Platform XP</div>
            </div>
            <div className="text-center">
              <Badge variant={isPaused ? "destructive" : "default"} className="text-lg px-3 py-1">
                {isPaused ? (
                  <>
                    <Pause className="w-4 h-4 mr-1" />
                    Paused
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    Active
                  </>
                )}
              </Badge>
              <div className="text-xs text-muted-foreground mt-1">Contract Status</div>
            </div>
            <div className="text-center">
              <Badge variant={hasAwarderRole ? "default" : "outline"} className="text-lg px-3 py-1">
                {hasAwarderRole ? (
                  <>
                    <Award className="w-4 h-4 mr-1" />
                    Granted
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4 mr-1" />
                    Denied
                  </>
                )}
              </Badge>
              <div className="text-xs text-muted-foreground mt-1">XP Awarder Role</div>
            </div>
          </div>
          
          {/* Security alerts */}
          {isPaused && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive font-medium">
                ⚠️ Contract is paused - transactions will fail
              </p>
            </div>
          )}
          
          {hasAwarderRole === false && (
            <div className="mt-4 p-3 bg-muted border border-border rounded-lg">
              <p className="text-sm text-muted-foreground">
                ℹ️ You don't have XP_AWARDER_ROLE - you can only spend your own XP
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single XP Award */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Award XP to User
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="targetUser">User Address</Label>
              <Input
                id="targetUser"
                placeholder="0x..."
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="xpAmount">XP Amount</Label>
              <Input
                id="xpAmount"
                type="number"
                placeholder="100"
                value={xpAmount}
                onChange={(e) => setXpAmount(e.target.value)}
              />
            </div>
          </div>
          <Button 
            onClick={handleAwardXP}
            disabled={isProcessing || !targetUser || !xpAmount || isPaused || hasAwarderRole === false}
            className="w-full"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Award XP
          </Button>
        </CardContent>
      </Card>

      {/* Batch XP Award */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Batch Award XP
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground mb-2">
            Max batch size: {Number(maxBatchSize || 0n)} users
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="batchUsers">User Addresses (one per line)</Label>
              <Textarea
                id="batchUsers"
                placeholder="0x...&#10;0x...&#10;0x..."
                value={batchUsers}
                onChange={(e) => setBatchUsers(e.target.value)}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batchAmounts">XP Amounts (one per line)</Label>
              <Textarea
                id="batchAmounts"
                placeholder="100&#10;200&#10;150"
                value={batchAmounts}
                onChange={(e) => setBatchAmounts(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <Button 
            onClick={handleBatchAwardXP}
            disabled={isProcessing || !batchUsers || !batchAmounts || isPaused || hasAwarderRole === false}
            className="w-full"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Users className="w-4 h-4 mr-2" />
            )}
            Batch Award XP
          </Button>
        </CardContent>
      </Card>

      {/* Spend XP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Minus className="w-5 h-5" />
            Spend Your XP
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="spendAmount">XP Amount to Spend</Label>
            <Input
              id="spendAmount"
              type="number"
              placeholder="50"
              value={spendAmount}
              onChange={(e) => setSpendAmount(e.target.value)}
              max={Number(userXP || 0n)}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Available XP: {Number(userXP || 0n).toLocaleString()}
          </div>
          <Button 
            onClick={handleSpendXP}
            disabled={isProcessing || !spendAmount || Number(spendAmount) > Number(userXP || 0n) || isPaused}
            variant="outline"
            className="w-full"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Spend XP
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}