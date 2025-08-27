import { PageLayout } from '@/components/layout/PageLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OnChainProfileViewer } from '@/components/profile/OnChainProfileViewer'
import { ProfileEditor } from '@/components/profile/ProfileEditor'
import { ProfileActivityFeed } from '@/components/profile/ProfileActivityFeed'
import { ProfileSettings } from '@/components/profile/ProfileSettings'
import { ProfileAnalytics } from '@/components/profile/ProfileAnalytics'
import { ForgeTokenCard } from '@/components/profile/ForgeTokenCard'
import { ForgePassCard } from '@/components/profile/ForgePassCard'
import { BadgeGallery } from '@/components/profile/BadgeGallery'
import { UserPostFeed } from '@/components/social/UserPostFeed'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  User, 
  Settings, 
  Plus, 
  MessageSquare, 
  TrendingUp, 
  Trophy,
  Activity,
  Grid3X3,
  Star
} from 'lucide-react'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useProfileRegistry } from '@/hooks/useProfileRegistry'
import { useSocialStats } from '@/hooks/useSocial'
import { ProfileEditorDialog } from '@/components/profile/ProfileEditorDialog'

import { useAchievements } from '@/hooks/useAchievements'

const ProfilePage = () => {
  const { address, isConnected } = useAccount()
  const { username: onChainUsername, hasProfile: hasOnChainProfile } = useProfileRegistry()
  const { stats } = useSocialStats(address)
  const { achievements, loading: achievementsLoading } = useAchievements(address)
  const [showEditor, setShowEditor] = useState(false)
  const [showUsernameEditor, setShowUsernameEditor] = useState(false)

  if (!isConnected) {
    return (
      <PageLayout 
        title="Your Profile"
        description="Manage your identity, view achievements, and track your progress in the Avalanche ecosystem"
      >
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <User className="w-16 h-16 text-muted-foreground mb-6" />
              <h3 className="text-2xl font-semibold mb-3">Connect Your Wallet</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Please connect your wallet to view and manage your profile in the Avalanche ecosystem.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout 
      title="Your Profile"
      description="Manage your identity, view achievements, and track your progress in the Avalanche ecosystem"
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Profile Header with Enhanced UI */}
        <div className="relative">
          <OnChainProfileViewer address={address} />
          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditor(true)}
              className="bg-background/80 backdrop-blur-sm border-primary/20 hover:border-primary/40"
            >
              <Settings className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6 text-center">
              <MessageSquare className="h-8 w-8 mx-auto mb-3 text-primary" />
              <div className="text-2xl font-bold">{stats?.posts || 0}</div>
              <p className="text-sm text-muted-foreground">Posts</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6 text-center">
              <Star className="h-8 w-8 mx-auto mb-3 text-primary" />
              <div className="text-2xl font-bold">{stats?.likes || 0}</div>
              <p className="text-sm text-muted-foreground">Likes</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-3 text-primary" />
              <div className="text-2xl font-bold">{stats?.followers || 0}</div>
              <p className="text-sm text-muted-foreground">Followers</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6 text-center">
              <Trophy className="h-8 w-8 mx-auto mb-3 text-primary" />
              <div className="text-2xl font-bold">{achievements?.length || 0}</div>
              <p className="text-sm text-muted-foreground">Achievements</p>
            </CardContent>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="xl:col-span-3">
            <Tabs defaultValue="posts" className="w-full">
              <TabsList className="grid w-full grid-cols-5 bg-card border border-border/50">
                <TabsTrigger value="posts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Posts
                </TabsTrigger>
                <TabsTrigger value="achievements" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Trophy className="w-4 h-4 mr-2" />
                  Achievements
                </TabsTrigger>
                <TabsTrigger value="activity" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Activity className="w-4 h-4 mr-2" />
                  Activity
                </TabsTrigger>
                <TabsTrigger value="analytics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="posts" className="mt-6">
                <Card className="bg-gradient-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Your Posts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <UserPostFeed address={address} />
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="achievements" className="mt-6">
                <BadgeGallery 
                  badges={achievements || []} 
                />
              </TabsContent>
              
              <TabsContent value="activity" className="mt-6">
                <ProfileActivityFeed />
              </TabsContent>
              
              <TabsContent value="analytics" className="mt-6">
                <ProfileAnalytics userAddress={address} />
              </TabsContent>
              
              <TabsContent value="settings" className="mt-6">
                <ProfileSettings />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Username Card */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="w-4 h-4" />
                  Username
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {hasOnChainProfile && onChainUsername ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-primary/20">
                      <span className="font-mono text-sm text-primary">@{onChainUsername}</span>
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                        Verified
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowUsernameEditor(true)}
                      className="w-full"
                    >
                      <Settings className="w-3 h-3 mr-2" />
                      Edit Username
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Set your on-chain username to establish your identity in the ecosystem
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
            
            {/* Digital Assets */}
            <div className="space-y-4">
              <ForgeTokenCard />
              <ForgePassCard />
            </div>

            {/* Quick Actions */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Grid3X3 className="w-4 h-4" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <Button variant="outline" className="w-full justify-start" size="sm" asChild>
                  <a href="/social">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Community Hub
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm" asChild>
                  <a href="/leaderboard">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    View Leaderboard
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm" asChild>
                  <a href="/quests">
                    <Trophy className="w-4 h-4 mr-2" />
                    Explore Quests
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modals */}
        <ProfileEditor 
          open={showEditor} 
          onOpenChange={setShowEditor}
        />
        
        <ProfileEditorDialog
          open={showUsernameEditor}
          onOpenChange={setShowUsernameEditor}
          initialValues={{ username: onChainUsername || "" }}
          hasProfile={hasOnChainProfile}
        />
      </div>
    </PageLayout>
  )
}

export default ProfilePage