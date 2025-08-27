import { ProfileEditor } from './ProfileEditor'
import { OnChainProfileViewer } from './OnChainProfileViewer'
import { ForgeTokenCard } from './ForgeTokenCard'
import { ForgePassCard } from './ForgePassCard'
import { BadgeGallery } from './BadgeGallery'
import { useProfile } from '@/hooks/useProfile'
import { useAccount } from 'wagmi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Settings, Plus, MessageSquare, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { ProfileEditorDialog } from './ProfileEditorDialog'
import { useProfileRegistry } from '@/hooks/useProfileRegistry'
import { UserPostFeed } from '../social/UserPostFeed'

export const ProfileSection = () => {
  const { address, isConnected } = useAccount()
  const { profile, loading } = useProfile()
  const { username: onChainUsername, hasProfile: hasOnChainProfile } = useProfileRegistry()
  const [showEditor, setShowEditor] = useState(false)
  const [showUsernameEditor, setShowUsernameEditor] = useState(false)

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Please connect your wallet to view and manage your profile.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Loading profile...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Main Profile Header */}
      <div className="w-full">
        <OnChainProfileViewer address={address} />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Actions */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Profile Settings
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditor(true)}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {!profile ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Complete your profile to connect with the community.
                  </p>
                  <Button 
                    onClick={() => setShowEditor(true)}
                    className="w-full"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Profile
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your profile is visible to the community.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Your Posts */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="w-5 h-5" />
                Your Posts
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <UserPostFeed address={address} />
            </CardContent>
          </Card>

          {/* Achievements */}
          <BadgeGallery 
            badges={[
              {
                id: '1',
                name: 'First Quest',
                description: 'Completed your first quest in Avax Forge Empire',
                rarity: 'common',
                category: 'quest',
                earnedAt: new Date(),
                xpReward: 50
              },
              {
                id: '2', 
                name: 'Social Butterfly',
                description: 'Made 10 social interactions with the community',
                rarity: 'rare',
                category: 'social',
                earnedAt: new Date(),
                xpReward: 100
              },
              {
                id: '3',
                name: 'Week Warrior',
                description: 'Maintained a 7-day activity streak',
                rarity: 'epic',
                category: 'achievement',
                earnedAt: new Date(),
                xpReward: 250
              }
            ]} 
          />
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* On-Chain Username */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-4 h-4" />
                Username
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {hasOnChainProfile && onChainUsername ? (
                <div>
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded-md">
                    <span className="font-mono text-sm text-primary">@{onChainUsername}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowUsernameEditor(true)}
                    >
                      <Settings className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Set your on-chain username
                  </p>
                  <Button 
                    onClick={() => setShowUsernameEditor(true)}
                    className="w-full"
                    size="sm"
                  >
                    <Plus className="w-3 h-3 mr-2" />
                    Create Username
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Tokens & Assets */}
          <div className="space-y-4">
            <ForgeTokenCard />
            <ForgePassCard />
          </div>

          {/* Community Standing */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4" />
                Community Rank
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-3">
                See how you rank against others
              </p>
              <Button variant="outline" className="w-full" size="sm" asChild>
                <a href="/leaderboard">View Leaderboard</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Profile Editor Modal */}
      <ProfileEditor 
        open={showEditor} 
        onOpenChange={setShowEditor}
      />
      
      {/* On-Chain Username Editor */}
      <ProfileEditorDialog
        open={showUsernameEditor}
        onOpenChange={setShowUsernameEditor}
        initialValues={{ username: onChainUsername || "" }}
        hasProfile={hasOnChainProfile}
      />
    </div>
  )
}