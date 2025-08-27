import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAccount, useChainId } from 'wagmi'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Send, Award } from 'lucide-react'
import { avalancheFuji } from 'wagmi/chains'
import { isAddress } from 'viem'
import { useKudos, useGetKudos } from '@/hooks/useKudos'

export const KudosCard = () => {
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const wrongChain = chainId !== avalancheFuji.id
  const { toast } = useToast()
  const [recipient, setRecipient] = useState('')
  const [lookupAddress, setLookupAddress] = useState('')

  const { userKudos, sendKudos, isProcessing } = useKudos()
  const { kudos: lookupKudos } = useGetKudos(isAddress(lookupAddress) ? lookupAddress : undefined)

  const validRecipient = isAddress(recipient)

  const onSend = async () => {
    if (!validRecipient) {
      toast({ title: 'Invalid Address', description: 'Please enter a valid recipient address.', variant: 'destructive' })
      return
    }
    await sendKudos(recipient as `0x${string}`)
    setRecipient('')
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Send Kudos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {wrongChain && (
            <p className="text-xs text-destructive">Switch to Avalanche Fuji to send transactions.</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="kudos-to">Recipient Address</Label>
            <Input id="kudos-to" placeholder="0x..." value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            {recipient && !validRecipient && (
              <p className="text-xs text-destructive">Enter a valid 0x address.</p>
            )}
          </div>
          <Button onClick={onSend} disabled={!isConnected || wrongChain || isProcessing || !validRecipient} className="w-full">
            {isProcessing ? 'Sending…' : 'Send Kudos'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            View Kudos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {address && (
            <div className="p-4 bg-primary/5 rounded-lg">
              <p className="text-sm text-muted-foreground">Your Kudos</p>
              <p className="text-2xl font-bold text-primary">{userKudos ? Number(userKudos).toLocaleString() : '0'}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="lookup-address">Check Kudos for Address</Label>
            <Input
              id="lookup-address"
              placeholder="0x..."
              value={lookupAddress}
              onChange={(e) => setLookupAddress(e.target.value)}
            />
            {lookupAddress && !isAddress(lookupAddress) && (
              <p className="text-xs text-destructive">Enter a valid 0x address.</p>
            )}
            {isAddress(lookupAddress) && lookupKudos !== undefined && (
              <div className="p-3 bg-secondary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Kudos Received</p>
                <p className="text-xl font-semibold">{Number(lookupKudos).toLocaleString()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
