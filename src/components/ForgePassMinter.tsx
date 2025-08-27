
import { useState } from 'react'
import { useForgePass } from '@/hooks/useForgePass'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAccount } from 'wagmi'

export const ForgePassMinter = () => {
  const {
    mintPass,
    renewPass,
    upgradePass,
    batchMintPass,
    setTokenURI,
    pause,
    unpause,
    isMintPending,
    isRenewPending,
    isUpgradePending,
    isBatchMintPending,
    isSettingTokenURI,
    isPausing,
    isUnpausing,
  } = useForgePass()
  const { address } = useAccount()

  const [toAddress, setToAddress] = useState('')
  const [tier, setTier] = useState('1')
  const [duration, setDuration] = useState('30')
  const [tokenId, setTokenId] = useState('1')
  const [newTier, setNewTier] = useState('2')
  const [renewDuration, setRenewDuration] = useState('30')
  const [uri, setUri] = useState('')
  const [batchRecipients, setBatchRecipients] = useState('')
  const [batchTiers, setBatchTiers] = useState('')
  const [batchDurations, setBatchDurations] = useState('')

  const handleMint = () => {
    if (toAddress && tier && duration) {
      mintPass(toAddress as `0x${string}`, parseInt(tier), parseInt(duration) * 86400)
    }
  }

  const handleRenew = () => {
    if (tokenId && renewDuration) {
      renewPass(BigInt(tokenId), parseInt(renewDuration) * 86400)
    }
  }

  const handleUpgrade = () => {
    if (tokenId && newTier) {
      upgradePass(BigInt(tokenId), parseInt(newTier))
    }
  }

  const handleBatchMint = () => {
    const recipients = batchRecipients.split(',').map(a => a.trim()) as `0x${string}`[]
    const tiers = batchTiers.split(',').map(t => parseInt(t.trim()))
    const durations = batchDurations.split(',').map(d => parseInt(d.trim()) * 86400)
    if (recipients.length > 0 && recipients.length === tiers.length && tiers.length === durations.length) {
      batchMintPass(recipients, tiers, durations)
    }
  }

  const handleSetTokenURI = () => {
    if (tokenId && uri) {
      setTokenURI(BigInt(tokenId), uri)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
      {/* Mint Pass */}
      <Card>
        <CardHeader>
          <CardTitle>Mint Forge Pass</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Recipient Address"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
          />
          <Input
            placeholder="Tier (1-5)"
            type="number"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
          />
          <Input
            placeholder="Duration (days)"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
          <Button onClick={handleMint} disabled={isMintPending}>
            {isMintPending ? 'Minting...' : 'Mint Pass'}
          </Button>
        </CardContent>
      </Card>

      {/* Upgrade Pass */}
      <Card>
        <CardHeader>
          <CardTitle>Upgrade Forge Pass</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Token ID"
            type="number"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
          />
          <Input
            placeholder="New Tier"
            type="number"
            value={newTier}
            onChange={(e) => setNewTier(e.target.value)}
          />
          <Button onClick={handleUpgrade} disabled={isUpgradePending}>
            {isUpgradePending ? 'Upgrading...' : 'Upgrade Pass'}
          </Button>
        </CardContent>
      </Card>

      {/* Renew Pass */}
      <Card>
        <CardHeader>
          <CardTitle>Renew Forge Pass</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Token ID"
            type="number"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
          />
          <Input
            placeholder="Renewal Duration (days)"
            type="number"
            value={renewDuration}
            onChange={(e) => setRenewDuration(e.target.value)}
          />
          <Button onClick={handleRenew} disabled={isRenewPending}>
            {isRenewPending ? 'Renewing...' : 'Renew Pass'}
          </Button>
        </CardContent>
      </Card>

      {/* Set Token URI */}
      <Card>
        <CardHeader>
          <CardTitle>Set Token URI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Token ID"
            type="number"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
          />
          <Input
            placeholder="New Token URI"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
          />
          <Button onClick={handleSetTokenURI} disabled={isSettingTokenURI}>
            {isSettingTokenURI ? 'Setting URI...' : 'Set Token URI'}
          </Button>
        </CardContent>
      </Card>

      {/* Batch Mint Passes */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Batch Mint Forge Passes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Recipient Addresses (comma-separated)"
            value={batchRecipients}
            onChange={(e) => setBatchRecipients(e.target.value)}
          />
          <Input
            placeholder="Tiers (comma-separated)"
            value={batchTiers}
            onChange={(e) => setBatchTiers(e.target.value)}
          />
          <Input
            placeholder="Durations in days (comma-separated)"
            value={batchDurations}
            onChange={(e) => setBatchDurations(e.target.value)}
          />
          <Button onClick={handleBatchMint} disabled={isBatchMintPending}>
            {isBatchMintPending ? 'Batch Minting...' : 'Batch Mint Passes'}
          </Button>
        </CardContent>
      </Card>

      {/* Admin Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Controls</CardTitle>
        </CardHeader>
        <CardContent className="flex space-x-4">
          <Button onClick={pause} disabled={isPausing}>
            {isPausing ? 'Pausing...' : 'Pause'}
          </Button>
          <Button onClick={unpause} disabled={isUnpausing}>
            {isUnpausing ? 'Unpausing...' : 'Unpause'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
