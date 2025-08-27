import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Coins, RefreshCw, ExternalLink } from 'lucide-react'
import { useMockERC20 } from '@/hooks/useMockERC20'
import { useAccount } from 'wagmi'

export const MockERC20Interface = () => {
  const { address } = useAccount()
  const { 
    address: contractAddress,
    balance, 
    formattedBalance,
    symbol, 
    name,
    decimals,
    refetchBalance,
    isConnected
  } = useMockERC20()

  if (!isConnected) {
    return (
      <Card className="bg-gradient-card border-border/50">
        <CardContent className="p-6 text-center">
          <Coins className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Connect your wallet to view MockERC20 token details</p>
        </CardContent>
      </Card>
    )
  }

  const openInExplorer = () => {
    window.open(`https://testnet.snowtrace.io/address/${contractAddress}`, '_blank')
  }

  const handleRefresh = () => {
    refetchBalance()
  }

  return (
    <div className="space-y-6">
      {/* Contract Info */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Coins className="w-6 h-6 text-primary" />
            {name} ({symbol})
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              ERC20
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={openInExplorer}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Your Balance</p>
              <p className="text-2xl font-bold">{formattedBalance} {symbol}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Decimals</p>
              <p className="text-xl font-semibold">{decimals}</p>
            </div>
          </div>
          
          <div className="space-y-2 pt-4 border-t border-border/50">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Contract Address:</span>
            </div>
            <p className="text-xs font-mono text-muted-foreground break-all">
              {contractAddress}
            </p>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">About MockERC20</h4>
            <p className="text-sm text-muted-foreground">
              This is a test ERC20 token deployed on Avalanche Fuji testnet. It currently has 0 total supply, 
              meaning no tokens have been minted yet. The contract supports standard ERC20 functions including 
              minting new tokens.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Contract Details */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="outline">Contract Status</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Network:</span>
              <p className="font-semibold">Avalanche Fuji</p>
            </div>
            <div>
              <span className="text-muted-foreground">Chain ID:</span>
              <p className="font-semibold">43113</p>
            </div>
            <div>
              <span className="text-muted-foreground">Standard:</span>
              <p className="font-semibold">ERC20</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Active
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}