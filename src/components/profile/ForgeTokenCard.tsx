import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Coins, Send, TrendingUp } from 'lucide-react'
import { useForgeToken } from '@/hooks/useForgeToken'
import { useAccount } from 'wagmi'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const ForgeTokenCard = () => {
  const { address } = useAccount()
  const { balance, symbol, transferTokens, isPending } = useForgeToken()
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [isTransferOpen, setIsTransferOpen] = useState(false)

  if (!address) {
    return null
  }

  const handleTransfer = async () => {
    if (transferTo && transferAmount) {
      await transferTokens(transferTo, transferAmount)
      setIsTransferOpen(false)
      setTransferTo('')
      setTransferAmount('')
    }
  }

  const balanceNumber = parseFloat(balance)
  const formattedBalance = balanceNumber.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  })

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" />
          FORGE Tokens
        </CardTitle>
        <Badge variant="secondary" className="bg-primary/10 text-primary">
          {symbol}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Balance</span>
            <span className="text-2xl font-bold">{formattedBalance}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="w-4 h-4" />
            Main utility token of the ecosystem
          </div>
        </div>

        <div className="pt-2">
          <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" variant="outline">
                <Send className="w-4 h-4 mr-2" />
                Transfer Tokens
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transfer FORGE Tokens</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient Address</Label>
                  <Input
                    id="recipient"
                    placeholder="0x..."
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                  />
                  <div className="text-sm text-muted-foreground">
                    Available: {formattedBalance} {symbol}
                  </div>
                </div>
                <Button 
                  onClick={handleTransfer}
                  disabled={!transferTo || !transferAmount || isPending}
                  className="w-full"
                >
                  {isPending ? 'Transferring...' : 'Transfer'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}