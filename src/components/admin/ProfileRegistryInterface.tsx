import { useState } from 'react'
import { logComponentError } from '@/utils/secureLogger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useProfileRegistry, useAddressForUsername } from '@/hooks/useProfileRegistry'
import { useBadgeTokenURI } from '@/hooks/useBadgeSystem'
import { useAccount } from 'wagmi'
import { 
  User, 
  Award, 
  Search,
  Settings,
  Loader2,
  Plus,
  Minus,
  UserCheck,
  Database,
  Shield,
  Trash2
} from 'lucide-react'

export const ProfileRegistryInterface = () => {
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const {
    username,
    badges,
    verifiedBadges,
    badgeMinterAddress,
    twitterHandle,
    hasProfile,
    setUsername,
    addBadgeToProfile,
    removeBadgeFromProfile,
    cleanupInvalidBadges,
    setTwitterHandle,
    isProcessing
  } = useProfileRegistry()

  // Username management state
  const [newUsername, setNewUsername] = useState('')

  // Badge management state
  const [badgeTokenId, setBadgeTokenId] = useState('')
  const [removeBadgeTokenId, setRemoveBadgeTokenId] = useState('')

  // Username lookup state
  const [lookupUsername, setLookupUsername] = useState('')
  const [inspectAddress, setInspectAddress] = useState('')

  // Twitter handle state
  const [newTwitterHandle, setNewTwitterHandle] = useState('')

  // Lookup hooks
  const { data: addressFromUsername } = useAddressForUsername(lookupUsername)
  const inspectedProfile = useProfileRegistry(inspectAddress || undefined)

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col items-center justify-center text-center">
            <User className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Connect wallet to access Profile Registry</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const handleSetUsername = async () => {
    if (!newUsername.trim()) {
      toast({
        title: "Invalid Username",
        description: "Please enter a valid username.",
        variant: "destructive"
      })
      return
    }

    try {
      await setUsername(newUsername.trim())
      setNewUsername('')
    } catch (error) {
      logComponentError('ProfileRegistryInterface', 'Set username', error)
    }
  }

  const handleAddBadge = async () => {
    if (!badgeTokenId) {
      toast({
        title: "Invalid Token ID",
        description: "Please enter a valid badge token ID.",
        variant: "destructive"
      })
      return
    }

    try {
      await addBadgeToProfile(BigInt(badgeTokenId))
      setBadgeTokenId('')
    } catch (error) {
      logComponentError('ProfileRegistryInterface', 'Add badge', error)
    }
  }

  const handleRemoveBadge = async () => {
    if (!removeBadgeTokenId) {
      toast({
        title: "Invalid Token ID",
        description: "Please enter a valid badge token ID to remove.",
        variant: "destructive"
      })
      return
    }

    try {
      await removeBadgeFromProfile(BigInt(removeBadgeTokenId))
      setRemoveBadgeTokenId('')
    } catch (error) {
      logComponentError('ProfileRegistryInterface', 'Remove badge', error)
    }
  }

  const handleCleanupBadges = async () => {
    try {
      await cleanupInvalidBadges()
    } catch (error) {
      logComponentError('ProfileRegistryInterface', 'Cleanup badges', error)
    }
  }

  const handleSetTwitterHandle = async () => {
    if (!newTwitterHandle.trim()) {
      toast({
        title: "Invalid Twitter Handle",
        description: "Please enter a valid Twitter handle.",
        variant: "destructive"
      })
      return
    }

    try {
      await setTwitterHandle(newTwitterHandle.trim())
      setNewTwitterHandle('')
    } catch (error) {
      logComponentError('ProfileRegistryInterface', 'Set Twitter handle', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Profile Registry Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {username || 'No Username'}
              </div>
              <div className="text-xs text-muted-foreground">Your Username</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">
                {badges?.length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Profile Badges</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {verifiedBadges?.length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Verified Badges</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">
                {twitterHandle || 'Not Set'}
              </div>
              <div className="text-xs text-muted-foreground">Twitter Handle</div>
            </div>
          </div>
          {badgeMinterAddress && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-green-500" />
                <span>Badge Minter: {badgeMinterAddress}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile Management</TabsTrigger>
          <TabsTrigger value="badges">Badge Management</TabsTrigger>
          <TabsTrigger value="lookup">Username Lookup</TabsTrigger>
          <TabsTrigger value="inspect">Inspect Profile</TabsTrigger>
        </TabsList>

        {/* Profile Management Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Username Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasProfile && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Current Username: {username}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="newUsername">Set New Username</Label>
                <Input
                  id="newUsername"
                  placeholder="Enter username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={handleSetUsername}
                disabled={isProcessing || !newUsername.trim()}
                className="w-full"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <User className="w-4 h-4 mr-2" />
                )}
                {hasProfile ? 'Update Username' : 'Set Username'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.5 2.25C10.5 2.08431 10.3657 1.95 10.2 1.95H1.8C1.63431 1.95 1.5 2.08431 1.5 2.25V10.65C1.5 10.8157 1.63431 10.95 1.8 10.95H10.2C10.3657 10.95 10.5 10.8157 10.5 10.65V6.45H12.5C12.6657 6.45 12.8 6.31569 12.8 6.15V2.25C12.8 2.08431 12.6657 1.95 12.5 1.95H10.5ZM10.2 2.55H12.2V6.15H10.5V5.85C10.5 5.68431 10.3657 5.55 10.2 5.55H2.1C1.93431 5.55 1.8 5.68431 1.8 5.85V10.65H2.1V6.45H10.2C10.3657 6.45 10.5 6.31569 10.5 6.15V2.55H10.2Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
                Twitter Handle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {twitterHandle && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.5 2.25C10.5 2.08431 10.3657 1.95 10.2 1.95H1.8C1.63431 1.95 1.5 2.08431 1.5 2.25V10.65C1.5 10.8157 1.63431 10.95 1.8 10.95H10.2C10.3657 10.95 10.5 10.8157 10.5 10.65V6.45H12.5C12.6657 6.45 12.8 6.31569 12.8 6.15V2.25C12.8 2.08431 12.6657 1.95 12.5 1.95H10.5ZM10.2 2.55H12.2V6.15H10.5V5.85C10.5 5.68431 10.3657 5.55 10.2 5.55H2.1C1.93431 5.55 1.8 5.68431 1.8 5.85V10.65H2.1V6.45H10.2C10.3657 6.45 10.5 6.31569 10.5 6.15V2.55H10.2Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
                    <span className="text-sm font-medium text-blue-800">
                      Current Twitter Handle: {twitterHandle}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="newTwitterHandle">Set New Twitter Handle</Label>
                <Input
                  id="newTwitterHandle"
                  placeholder="Enter Twitter handle"
                  value={newTwitterHandle}
                  onChange={(e) => setNewTwitterHandle(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={handleSetTwitterHandle}
                disabled={isProcessing || !newTwitterHandle.trim()}
                className="w-full"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.5 2.25C10.5 2.08431 10.3657 1.95 10.2 1.95H1.8C1.63431 1.95 1.5 2.08431 1.5 2.25V10.65C1.5 10.8157 1.63431 10.95 1.8 10.95H10.2C10.3657 10.95 10.5 10.8157 10.5 10.65V6.45H12.5C12.6657 6.45 12.8 6.31569 12.8 6.15V2.25C12.8 2.08431 12.6657 1.95 12.5 1.95H10.5ZM10.2 2.55H12.2V6.15H10.5V5.85C10.5 5.68431 10.3657 5.55 10.2 5.55H2.1C1.93431 5.55 1.8 5.68431 1.8 5.85V10.65H2.1V6.45H10.2C10.3657 6.45 10.5 6.31569 10.5 6.15V2.55H10.2Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
                )}
                {twitterHandle ? 'Update Twitter Handle' : 'Set Twitter Handle'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Badge Management Tab */}
        <TabsContent value="badges">
          <div className="space-y-6">
            {/* Current Badges */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Your Profile Badges
                </CardTitle>
              </CardHeader>
              <CardContent>
                {badges && badges.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {badges.map((badgeId) => (
                      <BadgeDisplay 
                        key={badgeId.toString()} 
                        tokenId={badgeId}
                        isVerified={verifiedBadges?.includes(badgeId) || false}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Award className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No badges on profile yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add Badge */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add Badge to Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="badgeTokenId">Badge Token ID</Label>
                  <Input
                    id="badgeTokenId"
                    type="number"
                    placeholder="Enter badge token ID"
                    value={badgeTokenId}
                    onChange={(e) => setBadgeTokenId(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleAddBadge}
                  disabled={isProcessing || !badgeTokenId}
                  className="w-full"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Add Badge to Profile
                </Button>
              </CardContent>
            </Card>

            {/* Remove Badge */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Minus className="w-5 h-5" />
                  Remove Badge from Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="removeBadgeTokenId">Badge Token ID to Remove</Label>
                  <Input
                    id="removeBadgeTokenId"
                    type="number"
                    placeholder="Enter badge token ID to remove"
                    value={removeBadgeTokenId}
                    onChange={(e) => setRemoveBadgeTokenId(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleRemoveBadge}
                  disabled={isProcessing || !removeBadgeTokenId}
                  variant="outline"
                  className="w-full"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Minus className="w-4 h-4 mr-2" />
                  )}
                  Remove Badge from Profile
                </Button>
              </CardContent>
            </Card>

            {/* Cleanup Badges */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Cleanup Invalid Badges
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Remove any badges from your profile that are no longer valid or owned.
                </p>
                <Button 
                  onClick={handleCleanupBadges}
                  disabled={isProcessing}
                  variant="outline"
                  className="w-full"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Cleanup Invalid Badges
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Username Lookup Tab */}
        <TabsContent value="lookup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Username Lookup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lookupUsername">Username to Lookup</Label>
                <Input
                  id="lookupUsername"
                  placeholder="Enter username"
                  value={lookupUsername}
                  onChange={(e) => setLookupUsername(e.target.value)}
                />
              </div>
              
              {lookupUsername && addressFromUsername && (
                <div className="p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">Lookup Result</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Username:</span>
                    <span className="text-sm font-mono">{lookupUsername}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Address:</span>
                    <span className="text-sm font-mono">{addressFromUsername as string}</span>
                  </div>
                </div>
              )}

              {lookupUsername && !addressFromUsername && (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">Username not found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inspect Profile Tab */}
        <TabsContent value="inspect">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Inspect Any Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inspectAddress">Address to Inspect</Label>
                <Input
                  id="inspectAddress"
                  placeholder="0x..."
                  value={inspectAddress}
                  onChange={(e) => setInspectAddress(e.target.value)}
                />
              </div>
              
              {inspectAddress && inspectedProfile && (
                <ProfileInspector profile={inspectedProfile} address={inspectAddress} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Component to display a single badge
const BadgeDisplay = ({ tokenId, isVerified }: { tokenId: bigint; isVerified: boolean }) => {
  const { data: tokenURI } = useBadgeTokenURI(tokenId)

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center">
          <Award className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <div className="font-medium">Badge #{tokenId.toString()}</div>
          <div className="text-xs text-muted-foreground">
            {tokenURI || 'No metadata'}
          </div>
        </div>
      </div>
      {isVerified && (
        <Badge variant="default" className="text-xs">
          <UserCheck className="w-3 h-3 mr-1" />
          Verified
        </Badge>
      )}
    </div>
  )
}

interface InspectedProfile {
  username: string | undefined;
  badges: bigint[] | undefined;
  verifiedBadges: bigint[] | undefined;
  hasProfile: boolean;
  twitterHandle: string | undefined;
}

// Component to inspect any profile
const ProfileInspector = ({ profile, address }: { profile: InspectedProfile; address: string }) => {
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
      <h4 className="font-medium">Profile for {address}</h4>
      <Separator />
      <div className="grid gap-2">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Username:</span>
          <span className="text-sm font-mono">{profile.username || 'Not set'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Has Profile:</span>
          <span className="text-sm">{profile.hasProfile ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Total Badges:</span>
          <span className="text-sm">{profile.badges?.length || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Verified Badges:</span>
          <span className="text-sm">{profile.verifiedBadges?.length || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Twitter Handle:</span>
          <span className="text-sm font-mono">{profile.twitterHandle || 'Not set'}</span>
        </div>
      </div>
      
      {profile.badges && profile.badges.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium">Badge IDs:</h5>
          <div className="flex flex-wrap gap-1">
            {profile.badges.map((badgeId: bigint) => (
              <Badge key={badgeId.toString()} variant="outline" className="text-xs">
                #{badgeId.toString()}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}