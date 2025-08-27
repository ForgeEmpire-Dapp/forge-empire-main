import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Crown, Calendar, Sparkles, Plus, Loader2 } from 'lucide-react'
import { useForgePass, useGetPassDetails } from '@/hooks/useForgePass'
import { useAccount } from 'wagmi'
import { useEffect } from 'react'

export const ForgePassCard = () => {
  const { address } = useAccount()
  const { 
    passBalance, 
    userPasses, 
    getTierName, 
    getTierColor,
    refetchBalance,
    refetchPasses 
  } = useForgePass()

  const { passDetails, isLoading: detailsLoading } = useGetPassDetails(userPasses as bigint)

  useEffect(() => {
    if (address) {
      refetchBalance()
      refetchPasses()
    }
  }, [address, refetchBalance, refetchPasses])

  if (!address) {
    return null
  }

  const formatExpirationDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000)
    return date.toLocaleDateString()
  }

  const isExpired = (timestamp: bigint) => {
    return Date.now() > Number(timestamp) * 1000
  }

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          Forge Pass
        </CardTitle>
        <Badge variant="secondary" className="bg-primary/10 text-primary">
          NFT
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {passBalance === 0 ? (
          <div className="text-center py-6">
            <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-2">No Forge Pass</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get a Forge Pass to unlock premium features and enhanced rewards
            </p>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Get Pass
            </Button>
          </div>
        ) : detailsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading pass details...</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Passes Owned</span>
              <span className="font-semibold">{passBalance}</span>
            </div>
            
            {passDetails && (
              <div className="space-y-3 p-4 bg-background/50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tier</span>
                  <Badge className={getTierColor(passDetails.tier)}>
                    {getTierName(passDetails.tier)}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <Badge variant={passDetails.isActive ? "default" : "destructive"}>
                    {passDetails.isActive ? "Active" : "Expired"}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Expires
                  </span>
                  <span className={`text-sm ${
                    isExpired(passDetails.expirationTime) 
                      ? 'text-destructive' 
                      : 'text-muted-foreground'
                  }`}>
                    {formatExpirationDate(passDetails.expirationTime)}
                  </span>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    Renew
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    Upgrade
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}