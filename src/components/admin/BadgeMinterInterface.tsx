import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { 
  useBadgeSystem, 
  useBadgeXpRequirement, 
  useBadgeTokenURI, 
  useBadgeOwner 
} from '@/hooks/useBadgeSystem'
import { useAccount } from 'wagmi'
import { 
  Award, 
  Users, 
  Settings,
  Loader2,
  Plus,
  Star,
  Shield,
  Zap,
  Database
} from 'lucide-react'
import { logComponentError } from '@/utils/secureLogger'

export const BadgeMinterInterface = () => {
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const {
    badgeBalance,
    currentTokenId,
    maxBatchSize,
    isPaused,
    xpEngineAddress,
    mintBadge,
    mintBadgeWithRequirements,
    batchMintBadges,
    setBadgeXpRequirement,
    isProcessing
  } = useBadgeSystem()

  // Single mint state
  const [mintTo, setMintTo] = useState('')
  const [tokenURI, setTokenURI] = useState('')

  // XP requirement mint state
  const [xpMintTo, setXpMintTo] = useState('')
  const [xpBadgeId, setXpBadgeId] = useState('')
  const [xpTokenURI, setXpTokenURI] = useState('')

  // Batch mint state
  const [batchRecipients, setBatchRecipients] = useState('')
  const [batchTokenURIs, setBatchTokenURIs] = useState('')

  // XP requirement setting state
  const [requirementBadgeId, setRequirementBadgeId] = useState('')
  const [requirementXpAmount, setRequirementXpAmount] = useState('')

  // Badge inspection state
  const [inspectTokenId, setInspectTokenId] = useState('')

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col items-center justify-center text-center">
            <Award className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Connect wallet to access Badge Minter</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const handleMintBadge = async () => {
    if (!mintTo || !tokenURI) {
      toast({
        title: "Invalid Input",
        description: "Please enter both recipient address and token URI.",
        variant: "destructive"
      })
      return
    }

    try {
      await mintBadge(mintTo as `0x${string}`, tokenURI)
      setMintTo('')
      setTokenURI('')
    } catch (error) {
      logComponentError('BadgeMinterInterface', 'mint badge', error)
    }
  }

  const handleMintWithRequirements = async () => {
    if (!xpMintTo || !xpBadgeId || !xpTokenURI) {
      toast({
        title: "Invalid Input",
        description: "Please fill in all required fields.",
        variant: "destructive"
      })
      return
    }

    try {
      await mintBadgeWithRequirements(
        xpMintTo as `0x${string}`, 
        BigInt(xpBadgeId), 
        xpTokenURI
      )
      setXpMintTo('')
      setXpBadgeId('')
      setXpTokenURI('')
    } catch (error) {
      logComponentError('BadgeMinterInterface', 'mint badge with requirements', error)
    }
  }

  const handleBatchMint = async () => {
    if (!batchRecipients || !batchTokenURIs) {
      toast({
        title: "Invalid Input",
        description: "Please enter both recipients and token URIs.",
        variant: "destructive"
      })
      return
    }

    try {
      const recipients = batchRecipients.split('\n').map(addr => addr.trim()).filter(addr => addr) as `0x${string}`[]
      const uris = batchTokenURIs.split('\n').map(uri => uri.trim()).filter(uri => uri)

      if (recipients.length !== uris.length) {
        toast({
          title: "Mismatch Error",
          description: "Number of recipients must match number of token URIs.",
          variant: "destructive"
        })
        return
      }

      await batchMintBadges(recipients, uris)
      setBatchRecipients('')
      setBatchTokenURIs('')
    } catch (error) {
      logComponentError('BadgeMinterInterface', 'batch mint', error)
    }
  }

  const handleSetXpRequirement = async () => {
    if (!requirementBadgeId || !requirementXpAmount) {
      toast({
        title: "Invalid Input",
        description: "Please enter both badge ID and XP amount.",
        variant: "destructive"
      })
      return
    }

    try {
      await setBadgeXpRequirement(BigInt(requirementBadgeId), BigInt(requirementXpAmount))
      setRequirementBadgeId('')
      setRequirementXpAmount('')
    } catch (error) {
      logComponentError('BadgeMinterInterface', 'set XP requirement', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Contract Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Badge Minter Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {Number(badgeBalance || 0n)}
              </div>
              <div className="text-xs text-muted-foreground">Your Badges</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">
                {Number(currentTokenId || 0n)}
              </div>
              <div className="text-xs text-muted-foreground">Current Token ID</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">
                {Number(maxBatchSize || 0n)}
              </div>
              <div className="text-xs text-muted-foreground">Max Batch Size</div>
            </div>
            <div className="text-center">
              <Badge variant={isPaused ? "destructive" : "default"} className="text-lg px-3 py-1">
                {isPaused ? (
                  <>
                    <Shield className="w-4 h-4 mr-1" />
                    Paused
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4 mr-1" />
                    Active
                  </>
                )}
              </Badge>
              <div className="text-xs text-muted-foreground mt-1">Contract Status</div>
            </div>
          </div>
          {xpEngineAddress && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>XP Engine: {xpEngineAddress}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="mint" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="mint">Mint Badge</TabsTrigger>
          <TabsTrigger value="xp-mint">XP Badge</TabsTrigger>
          <TabsTrigger value="batch">Batch Mint</TabsTrigger>
          <TabsTrigger value="requirements">Set Requirements</TabsTrigger>
          <TabsTrigger value="inspect">Inspect Badge</TabsTrigger>
        </TabsList>

        {/* Simple Mint Tab */}
        <TabsContent value="mint">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Mint Single Badge
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mintTo">Recipient Address</Label>
                <Input
                  id="mintTo"
                  placeholder="0x..."
                  value={mintTo}
                  onChange={(e) => setMintTo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tokenURI">Token URI (metadata)</Label>
                <Input
                  id="tokenURI"
                  placeholder="https://... or ipfs://..."
                  value={tokenURI}
                  onChange={(e) => setTokenURI(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleMintBadge}
                disabled={isProcessing || !mintTo || !tokenURI}
                className="w-full"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Mint Badge
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* XP Badge Mint Tab */}
        <TabsContent value="xp-mint">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                Mint Badge with XP Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="xpMintTo">Recipient Address</Label>
                <Input
                  id="xpMintTo"
                  placeholder="0x..."
                  value={xpMintTo}
                  onChange={(e) => setXpMintTo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="xpBadgeId">Badge ID</Label>
                <Input
                  id="xpBadgeId"
                  type="number"
                  placeholder="1"
                  value={xpBadgeId}
                  onChange={(e) => setXpBadgeId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="xpTokenURI">Token URI (metadata)</Label>
                <Input
                  id="xpTokenURI"
                  placeholder="https://... or ipfs://..."
                  value={xpTokenURI}
                  onChange={(e) => setXpTokenURI(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleMintWithRequirements}
                disabled={isProcessing || !xpMintTo || !xpBadgeId || !xpTokenURI}
                className="w-full"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Star className="w-4 h-4 mr-2" />
                )}
                Mint XP Badge
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batch Mint Tab */}
        <TabsContent value="batch">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Batch Mint Badges
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Max batch size: {Number(maxBatchSize || 0n)} badges
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batchRecipients">Recipients (one per line)</Label>
                  <Textarea
                    id="batchRecipients"
                    placeholder="0x...&#10;0x...&#10;0x..."
                    value={batchRecipients}
                    onChange={(e) => setBatchRecipients(e.target.value)}
                    rows={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batchTokenURIs">Token URIs (one per line)</Label>
                  <Textarea
                    id="batchTokenURIs"
                    placeholder="https://...&#10;https://...&#10;https://..."
                    value={batchTokenURIs}
                    onChange={(e) => setBatchTokenURIs(e.target.value)}
                    rows={5}
                  />
                </div>
              </div>
              <Button 
                onClick={handleBatchMint}
                disabled={isProcessing || !batchRecipients || !batchTokenURIs}
                className="w-full"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Users className="w-4 h-4 mr-2" />
                )}
                Batch Mint Badges
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* XP Requirements Tab */}
        <TabsContent value="requirements">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Set Badge XP Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="requirementBadgeId">Badge ID</Label>
                <Input
                  id="requirementBadgeId"
                  type="number"
                  placeholder="1"
                  value={requirementBadgeId}
                  onChange={(e) => setRequirementBadgeId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requirementXpAmount">Required XP Amount</Label>
                <Input
                  id="requirementXpAmount"
                  type="number"
                  placeholder="1000"
                  value={requirementXpAmount}
                  onChange={(e) => setRequirementXpAmount(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleSetXpRequirement}
                disabled={isProcessing || !requirementBadgeId || !requirementXpAmount}
                className="w-full"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Settings className="w-4 h-4 mr-2" />
                )}
                Set XP Requirement
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Badge Inspector Tab */}
        <TabsContent value="inspect">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Inspect Badge
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inspectTokenId">Token ID</Label>
                <Input
                  id="inspectTokenId"
                  type="number"
                  placeholder="1"
                  value={inspectTokenId}
                  onChange={(e) => setInspectTokenId(e.target.value)}
                />
              </div>
              {inspectTokenId && (
                <BadgeInspector tokenId={BigInt(inspectTokenId)} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Component to inspect badge details
const BadgeInspector = ({ tokenId }: { tokenId: bigint }) => {
  const { data: owner } = useBadgeOwner(tokenId)
  const { data: tokenURI } = useBadgeTokenURI(tokenId)
  const { data: xpRequirement } = useBadgeXpRequirement(tokenId)

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
      <h4 className="font-medium">Badge #{tokenId.toString()}</h4>
      <Separator />
      <div className="grid gap-2">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Owner:</span>
          <span className="text-sm font-mono">{owner || 'Not found'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Token URI:</span>
          <span className="text-sm font-mono">{tokenURI || 'Not set'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">XP Requirement:</span>
          <span className="text-sm font-mono">
            {xpRequirement ? `${xpRequirement.toString()} XP` : 'No requirement'}
          </span>
        </div>
      </div>
    </div>
  )
}