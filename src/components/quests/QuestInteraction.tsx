import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAccount, useSimulateContract, useWaitForTransactionReceipt, useWriteContract, SimulateContractReturnType } from 'wagmi'
import { Wallet } from 'lucide-react'
import { useOnboardingQuests } from '@/hooks/useOnboardingQuests'
import { useUserLevel, useUserXP } from '@/hooks/contracts'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useEffect, useMemo, useState } from 'react'
import { CONTRACT_ADDRESSES } from '@/config/web3'

const ONBOARDING_ABI = [
  { name: 'startOnboarding', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'completeStep', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'step', type: 'uint8' }], outputs: [] },
] as const

export const QuestInteraction = () => {
  const { isConnected } = useAccount()
  const { nextStep, stats } = useOnboardingQuests()
  const { toast } = useToast()

  const { refetch: refetchXP } = useUserXP()
  const { refetch: refetchLevel } = useUserLevel()

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined)
  const stepId = useMemo(() => (nextStep ? Number(nextStep[0]) : undefined), [nextStep])

  const simStart = useSimulateContract({
    address: CONTRACT_ADDRESSES.OnboardingQuests as `0x${string}`,
    abi: ONBOARDING_ABI,
    functionName: 'startOnboarding',
    args: [],
    query: { enabled: !!isConnected },
  })

  const simComplete = useSimulateContract({
    address: CONTRACT_ADDRESSES.OnboardingQuests as `0x${string}`,
    abi: ONBOARDING_ABI,
    functionName: 'completeStep',
    args: stepId !== undefined ? [stepId] : undefined,
    query: { enabled: !!isConnected && stepId !== undefined },
  })

  const { writeContractAsync, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, isError, error } = useWaitForTransactionReceipt({ hash: txHash })

useEffect(() => {
  if (isSuccess) {
    toast({ title: 'Success', description: 'Quest action confirmed on-chain.' })
    refetchXP?.()
    refetchLevel?.()
    setTxHash(undefined)
  }
}, [isSuccess, refetchXP, refetchLevel, toast])

  useEffect(() => {
    if (isError && error) {
      toast({ title: 'Transaction failed', description: error.message, variant: 'destructive' })
    }
  }, [isError, error, toast])

  const sendTx = async (prepared?: SimulateContractReturnType['request']) => {
    if (!prepared) {
      toast({ title: 'Unable to prepare', description: 'Connect wallet or try again.', variant: 'destructive' })
      return
    }
    try {
      const hash = await writeContractAsync(prepared)
      setTxHash(hash)
      toast({ title: 'Transaction sent', description: `Hash: ${hash.slice(0, 10)}…` })
    } catch (e: unknown) {
      toast({ title: 'Transaction rejected', description: e?.message ?? 'User rejected or wallet error.', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interactive Quests</CardTitle>
        <CardDescription>
          Complete guided steps to earn XP and badges. Live data is fetched from the OnboardingQuests contract.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected && (
          <div className="text-center p-4 bg-muted rounded-lg">
            <Wallet className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Connect your wallet to start completing quests</p>
          </div>
        )}

        {isConnected && (
          <div className="space-y-4">
            {/* Stats (generic labels due to limited context) */}
            {stats && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">Stat A: {Number(stats[0])}</Badge>
                <Badge variant="outline">Stat B: {Number(stats[1])}</Badge>
                <Badge variant="outline">Stat C: {Number(stats[2])}</Badge>
              </div>
            )}

            {/* Next step */}
            {nextStep ? (
              <div className="p-4 border rounded-lg bg-background">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium">Next Step</div>
                  <Badge variant="secondary">Step {Number(nextStep[0])}</Badge>
                </div>
                <div className="font-semibold">{nextStep[1]?.title}</div>
                <p className="text-sm text-muted-foreground mt-1">{nextStep[1]?.description}</p>
                <div className="text-xs text-muted-foreground mt-2">XP Reward: {Number(nextStep[1]?.xpReward || 0)}</div>

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => sendTx(simStart.data?.request)} disabled={isPending || isConfirming}>
                    Start Onboarding
                  </Button>
                  <Button onClick={() => sendTx(simComplete.data?.request)} disabled={isPending || isConfirming || stepId === undefined}>
                    Complete Step {stepId}
                  </Button>
                </div>
              </div>
            ) : (
              isConnected && (
                <div className="p-4 border rounded-lg bg-background text-sm text-muted-foreground">
                  All onboarding steps are complete. Great job!
                  <div className="mt-3">
                    <Button variant="outline" onClick={() => sendTx(simStart.data?.request)} disabled={isPending || isConfirming}>
                      Restart Onboarding
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
