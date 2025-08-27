import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAccount, useReadContract, useSimulateContract, useWaitForTransactionReceipt, useWriteContract, useChainId } from 'wagmi'
import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { CONTRACT_ADDRESSES } from '@/config/web3'
import { parseUnits } from 'viem'
import { Wallet, Coins, HandCoins } from 'lucide-react'

const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [
    { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }
  ], outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [
    { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }
  ], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const

const TIPJAR_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_amount', type: 'uint256' }], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_amount', type: 'uint256' }], outputs: [] },
  { name: 'tip', type: 'function', stateMutability: 'nonpayable', inputs: [
    { name: '_recipient', type: 'address' }, { name: '_amount', type: 'uint256' }
  ], outputs: [] },
  { name: 'getDepositedBalance', type: 'function', stateMutability: 'view', inputs: [{ name: '_user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'getTipsReceived', type: 'function', stateMutability: 'view', inputs: [{ name: '_user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const

export const TipJarCard = () => {
  const { address, isConnected } = useAccount()
  const { toast } = useToast()

  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined)

  const { data: decimals } = useReadContract({
    address: CONTRACT_ADDRESSES.MockERC20 as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
  })

  const parsedAmount = useMemo(() => {
    if (!amount || !decimals) return undefined
    try { return parseUnits(amount as `${number}`, Number(decimals)) } catch { return undefined }
  }, [amount, decimals])

  const { data: tokenBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.MockERC20 as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: allowance } = useReadContract({
    address: CONTRACT_ADDRESSES.MockERC20 as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.TipJar] : undefined,
    query: { enabled: !!address },
  })

  const { data: deposited } = useReadContract({
    address: CONTRACT_ADDRESSES.TipJar as `0x${string}`,
    abi: TIPJAR_ABI,
    functionName: 'getDepositedBalance',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: tipsReceived } = useReadContract({
    address: CONTRACT_ADDRESSES.TipJar as `0x${string}`,
    abi: TIPJAR_ABI,
    functionName: 'getTipsReceived',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const needsApproval = useMemo(() => {
    if (!parsedAmount) return false
    const current = allowance ? BigInt(allowance as bigint) : 0n
    return current < parsedAmount
  }, [allowance, parsedAmount])

  const approveSim = useSimulateContract({
    address: CONTRACT_ADDRESSES.MockERC20 as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: parsedAmount ? [CONTRACT_ADDRESSES.TipJar as `0x${string}`, parsedAmount] : undefined,
    query: { enabled: isConnected && !!parsedAmount && needsApproval },
  })

  const depositSim = useSimulateContract({
    address: CONTRACT_ADDRESSES.TipJar as `0x${string}`,
    abi: TIPJAR_ABI,
    functionName: 'deposit',
    args: parsedAmount ? [parsedAmount] : undefined,
    query: { enabled: isConnected && !!parsedAmount && !needsApproval },
  })

  const withdrawSim = useSimulateContract({
    address: CONTRACT_ADDRESSES.TipJar as `0x${string}`,
    abi: TIPJAR_ABI,
    functionName: 'withdraw',
    args: parsedAmount ? [parsedAmount] : undefined,
    query: { enabled: isConnected && !!parsedAmount },
  })

  const tipSim = useSimulateContract({
    address: CONTRACT_ADDRESSES.TipJar as `0x${string}`,
    abi: TIPJAR_ABI,
    functionName: 'tip',
    args: recipient && parsedAmount ? [recipient as `0x${string}`, parsedAmount] : undefined,
    query: { enabled: isConnected && !!recipient && !!parsedAmount },
  })

  const { writeContractAsync, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, isError, error } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (isSuccess) {
      toast({ title: 'Success', description: 'Transaction confirmed.' })
      setTxHash(undefined)
      setAmount('')
    }
  }, [isSuccess, toast])

  useEffect(() => {
    if (isError && error) {
      toast({ title: 'Transaction failed', description: error.message, variant: 'destructive' })
    }
  }, [isError, error, toast])

  const sendTx = async (prepared?: unknown) => {
    if (!prepared) {
      toast({ title: 'Unable to prepare', description: 'Missing or invalid inputs.', variant: 'destructive' })
      return
    }
    try {
      const hash = await writeContractAsync(prepared)
      setTxHash(hash)
      toast({ title: 'Transaction sent', description: `Hash: ${hash.slice(0, 10)}…` })
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'User rejected or wallet error.'
      toast({ title: 'Transaction rejected', description: errorMessage, variant: 'destructive' })
    }
  }

  const onDeposit = async () => {
    if (needsApproval) return sendTx(approveSim.data?.request)
    return sendTx(depositSim.data?.request)
  }

  const onWithdraw = async () => sendTx(withdrawSim.data?.request)
  const onTip = async () => sendTx(tipSim.data?.request)

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="w-5 h-5" />
          Tip Jar (ERC20)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isConnected && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Wallet className="w-4 h-4" /> Connect your wallet to use Tip Jar.
          </div>
        )}

        {isConnected && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Your ERC20 balance</Label>
                <div className="text-sm text-muted-foreground">
                  {tokenBalance ? tokenBalance.toString() : '—'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Deposited in TipJar</Label>
                <div className="text-sm text-muted-foreground">
                  {deposited ? deposited.toString() : '—'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tips received</Label>
                <div className="text-sm text-muted-foreground">
                  {tipsReceived ? tipsReceived.toString() : '—'}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tip-amount">Amount</Label>
                <Input id="tip-amount" placeholder="10.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>

              <div className="flex gap-2">
                <Button onClick={onDeposit} disabled={!parsedAmount || isPending || isConfirming} className="flex-1">
                  <HandCoins className="w-4 h-4 mr-2" />
                  {needsApproval ? 'Approve' : 'Deposit'}
                </Button>
                <Button variant="outline" onClick={onWithdraw} disabled={!parsedAmount || isPending || isConfirming} className="flex-1">
                  Withdraw
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tip-recipient">Tip recipient</Label>
                <Input id="tip-recipient" placeholder="0x..." value={recipient} onChange={(e) => setRecipient(e.target.value)} />
              </div>
              <Button onClick={onTip} disabled={!recipient || !parsedAmount || isPending || isConfirming} className="w-full">
                Send Tip
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
