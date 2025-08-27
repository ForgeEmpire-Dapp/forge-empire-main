import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain, Connector } from 'wagmi'
import { handleError } from '@/utils/standardErrorHandler'
import { avalancheFuji } from 'wagmi/chains'
import { Button } from '@/components/ui/button'
import { Wallet, LogOut, RefreshCcw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export const WalletConnect = () => {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const { toast } = useToast()

  const onSwitch = () => {
    try {
      switchChain({ chainId: avalancheFuji.id })
    } catch (e: unknown) {
      toast({ title: 'Failed to switch network', description: e?.message || 'Please switch to Avalanche Fuji in your wallet.', variant: 'destructive' })
    }
  }

  if (isConnected) {
    const wrongChain = chainId !== avalancheFuji.id
    return (
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2 px-3 py-2 bg-card border rounded-lg">
          <Wallet className="w-4 h-4" />
          <span className="text-sm font-medium">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </div>
        {wrongChain && (
          <Button variant="destructive" size="sm" onClick={onSwitch} disabled={isSwitching}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            {isSwitching ? 'Switching…' : 'Switch to Fuji'}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => disconnect()}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  const handleConnect = async (connector: Connector) => {
    try {
      await connect({ connector })
    } catch (error: unknown) {
      handleError(error, { component: 'WalletConnect', action: 'Connect wallet' })
      toast({
        title: 'Connection Failed',
        description: error?.message || 'Failed to connect wallet. Please try again.',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="flex space-x-2">
      {connectors.map((connector) => (
        <Button
          key={connector.uid}
          onClick={() => handleConnect(connector)}
          disabled={isPending}
          variant="default"
          size="sm"
        >
          <Wallet className="w-4 h-4 mr-2" />
          {isPending ? 'Connecting…' : connector.name}
        </Button>
      ))}
      {connectError && (
        <div className="text-xs text-destructive mt-1">
          Connection failed: {connectError.message}
        </div>
      )}
    </div>
  )
}
