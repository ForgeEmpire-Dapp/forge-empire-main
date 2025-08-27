import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  User, 
  Trophy, 
  Zap, 
  Star,
  Copy,
  ExternalLink,
  Calendar,
  MapPin,
  Globe,
  Twitter,
  Github,
  ArrowLeft,
  Share,
  Users,
  MessageSquare,
  Heart,
  Repeat,
  UserPlus,
  UserMinus,
  Send
} from "lucide-react"
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useProfile } from '@/hooks/useProfile'
import { useUserXP, useUserLevel, useUserBadges } from '@/hooks/contracts'
import { useProfileRegistry } from '@/hooks/useProfileRegistry'
import { useState } from 'react'
import { ProfileShare } from './ProfileShare'
import { useToast } from '@/hooks/use-toast'
import { 
  useSocialStats, 
  useUserPosts as useSocialUserPosts, 
  usePost, 
  useIsFollowing as useSocialIsFollowing,
  useSocial,
  useActivityFeed 
} from '@/hooks/useSocial'
import { PostCard } from '@/components/social/PostCard'
import { PostCreator } from '@/components/social/PostCreator'
import { FollowButton } from '@/components/social/FollowButton' // Added FollowButton for consistency

interface EnhancedProfileViewerProps {
  address?: string
}

export const EnhancedProfileViewer = ({ address }: EnhancedProfileViewerProps) => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { address: connectedAddress } = useAccount()
  const { profile, loading } = useProfile(address)
  const profileRegistry = useProfileRegistry()
  const { stats: socialStats } = useSocialStats(address) // Use useSocialStats for all social stats
  const { followUser, unfollowUser, isPending: socialProcessing } = useSocial() // Use useSocial for follow/unfollow actions
  const { data: isFollowingData } = useSocialIsFollowing(connectedAddress, address) // Use useSocialIsFollowing from useSocial.ts
  const { postIds: userPostsData } = useSocialUserPosts(address) // Use useSocialUserPosts from useSocial.ts
  const { feedPostIds } = useActivityFeed(address, 10) // Use useActivityFeed from useSocial.ts

  const [shareOpen, setShareOpen] = useState(false)

  const postIds = userPostsData ? Array.from(userPostsData as readonly bigint[]) : []
  // feedPostIds is now directly from useActivityFeed

  // Check if viewing own profile
  const isOwnProfile = connectedAddress?.toLowerCase() === address?.toLowerCase()

  // Get real contract data
  const { data: xpValue = 0n } = useUserXP()
  const { data: levelValue = 1n } = useUserLevel()
  const { badgeCount } = useUserBadges()

  // Extract on-chain username if available
  const onChainUsername = null // Profile data would come from contract
  const isFollowingUser = !!isFollowingData

  // Convert bigint to number for calculations
  const xpNum = Number(xpValue)
  const levelNum = Number(levelValue)
  
  const nextLevelXP = levelNum * 1000
  const currentLevelXP = (levelNum - 1) * 1000
  const progressToNext = nextLevelXP > 0 ? ((xpNum - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100 : 0

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const copyAddress = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      toast({
        title: 'Copied!',
        description: 'Address copied to clipboard'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy address',
        variant: 'destructive'
      })
    }
  }

  // Removed handleFollowToggle as FollowButton component now handles follow/unfollow logic internally.

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!address) {
    return (
      <div className="text-center py-12">
        <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-xl font-semibold mb-2">Invalid Profile</h3>
        <p className="text-muted-foreground mb-4">The profile address is invalid or missing.</p>
        <Button onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Home
        </Button>
      </div>
    )
  }

  return (
    <section className="py-10">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {profile?.display_name || profile?.username || "Anonymous User"}
            </h1>
            <p className="text-muted-foreground">User Profile</p>
          </div>
        </div>
        
        {!isOwnProfile && connectedAddress && (
          <FollowButton 
            targetUser={address as `0x${string}`}
            showFollowerCount={false} // Follower count is displayed in social stats section
            className="hover-scale"
          />
        )}
      </div>

      {/* Banner */}
      {profile?.banner_url ? (
        <div className="rounded-xl overflow-hidden h-40 md:h-48 mb-8">
          <img src={profile.banner_url} alt="Profile banner" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden h-40 md:h-48 mb-8 bg-muted" />
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Profile Info Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-gradient-card border-primary/20">
            <CardHeader className="text-center">
              <Avatar className="w-24 h-24 mx-auto mb-4 border-4 border-primary/30">
                {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="Profile avatar" /> : null}
                <AvatarFallback className="text-2xl bg-gradient-primary text-primary-foreground">
                  {(onChainUsername || profile?.username) ? 
                    (onChainUsername || profile?.username)!.slice(0, 2).toUpperCase() : 
                    address.slice(2, 4).toUpperCase()
                  }
                </AvatarFallback>
              </Avatar>
              <CardTitle className="text-2xl">
                {profile?.display_name || onChainUsername || profile?.username || "Anonymous User"}
              </CardTitle>
              {onChainUsername && (
                <div className="mb-2">
                  <Badge variant="secondary" className="text-xs">
                    @{onChainUsername}
                  </Badge>
                </div>
              )}
              <p className="text-muted-foreground">
                {profile?.bio || "No bio available"}
              </p>
              
              {/* Social Stats */}
              <div className="grid grid-cols-3 gap-2 pt-4">
                <div className="text-center group cursor-pointer hover-scale">
                  <div className="text-lg font-bold text-primary group-hover:text-primary/80 transition-colors">
                    {socialStats?.followers || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Followers</div>
                </div>
                <div className="text-center group cursor-pointer hover-scale">
                  <div className="text-lg font-bold text-secondary group-hover:text-secondary/80 transition-colors">
                    {socialStats?.following || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Following</div>
                </div>
                <div className="text-center group cursor-pointer hover-scale">
                  <div className="text-lg font-bold text-accent group-hover:text-accent/80 transition-colors">
                    {socialStats?.posts || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Posts</div>
                </div>
              </div>

              {/* Location */}
              {profile?.location && (
                <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{profile.location}</span>
                </div>
              )}

              {/* Social Links */}
              {(profile?.website || profile?.social_links?.twitter || profile?.social_links?.github) && (
                <div className="flex items-center justify-center gap-3 mt-2">
                  {profile?.website && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(profile.website, '_blank')}>
                      <Globe className="w-4 h-4" />
                    </Button>
                  )}
                  {profile?.social_links?.twitter && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(`https://twitter.com/${profile.social_links?.twitter.replace('@', '')}`, '_blank')}>
                      <Twitter className="w-4 h-4" />
                    </Button>
                  )}
                  {profile?.social_links?.github && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(`https://github.com/${profile.social_links?.github}`, '_blank')}>
                      <Github className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Wallet Address */}
              <div className="flex items-center space-x-2 p-3 bg-background rounded-lg">
                <span className="text-sm font-mono flex-1">{formatAddress(address)}</span>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={copyAddress}
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={() => {
                    const w = window.open(`https://testnet.snowtrace.io/address/${address}`, '_blank', 'noopener,noreferrer')
                    if (w) w.opener = null
                  }}
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>

              {/* Action Button */}
              <div className="pt-4">
                <Button variant="outline" className="w-full" onClick={() => setShareOpen(true)}>
                  <Share className="w-4 h-4 mr-2" />
                  Share Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Post Creator for Own Profile */}
          {isOwnProfile && (
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-6">
                <PostCreator placeholder="Share your thoughts with the community..." />
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="posts">Posts</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="achievements">Achievements</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* XP & Level Progress */}
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="w-5 h-5" />
                    <span>Experience & Progress</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                      <div className="text-center">
                        <div className="text-4xl font-bold mb-2">{xpNum.toLocaleString()}</div>
                        <p className="text-muted-foreground">Total Experience Points</p>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span>Current Level</span>
                          <Badge variant="outline" className="text-lg px-3 py-1">
                            Level {levelNum}
                          </Badge>
                        </div>
                        
                        {levelNum < 10 && (
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span>Progress to Level {levelNum + 1}</span>
                              <span>{Math.round(progressToNext)}%</span>
                            </div>
                            <Progress value={progressToNext} className="h-3" />
                          </div>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Social Stats Overview */}
              {socialStats && (socialStats.posts ?? 0) > 0 && (
                <Card className="bg-gradient-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="w-5 h-5" />
                      <span>Social Statistics</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-primary mb-2">
                          <MessageSquare className="w-8 h-8 mx-auto mb-1" />
                          {socialStats.posts}
                        </div>
                        <p className="text-sm text-muted-foreground">Posts Created</p>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-destructive mb-2">
                          <Heart className="w-8 h-8 mx-auto mb-1" />
                          {socialStats.likes}
                        </div>
                        <p className="text-sm text-muted-foreground">Likes Given</p>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-secondary mb-2">
                          <Repeat className="w-8 h-8 mx-auto mb-1" />
                          {socialStats.shares}
                        </div>
                        <p className="text-sm text-muted-foreground">Shares Made</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Posts Tab */}
            <TabsContent value="posts" className="space-y-6">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5" />
                    <span>User Posts</span>
                    <Badge variant="outline">{postIds.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {postIds.length > 0 ? (
                    <div className="space-y-4">
                      {postIds.slice(0, 5).map((postId) => (
                        <PostCard key={postId} postId={postId} className="border-border/30" />
                      ))}
                      {postIds.length > 5 && (
                        <Button variant="outline" className="w-full">
                          View All {postIds.length} Posts
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No posts yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-6">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5" />
                    <span>Recent Activity</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {feedPostIds.length > 0 ? (
                    <div className="space-y-4">
                      {feedPostIds.map((postId) => (
                        <PostCard key={Number(postId)} postId={Number(postId)} className="border-border/30" />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No recent activity</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Achievements Tab */}
            <TabsContent value="achievements" className="space-y-6">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Trophy className="w-5 h-5" />
                    <span>Badge Collection</span>
                    <Badge variant="outline">{badgeCount} / 12</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {badgeCount > 0 ? (
                      Array.from({ length: badgeCount }).map((_, badgeIndex) => (
                        <Card key={`badge-${badgeIndex}-${address}`} className="bg-background border-border/50 hover:border-primary/30 transition-all duration-300">
                          <CardContent className="p-4 text-center">
                            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-accent flex items-center justify-center">
                              <Trophy className="w-8 h-8 text-accent-foreground" />
                            </div>
                            <h4 className="font-semibold mb-1">Achievement Badge</h4>
                            <Badge variant="outline" className="mb-2 text-xs">
                              Earned
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              Blockchain verified
                            </p>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="col-span-full text-center py-8">
                        <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No badges earned yet</p>
                      </div>
                    )}
                    
                    {/* Locked Badge Slots */}
                    {Array.from({ length: Math.max(0, 12 - badgeCount) }).map((_, emptyIndex) => (
                      <Card key={`locked-${emptyIndex}-${address || 'unknown'}`} className="bg-background border-dashed border-border opacity-50">
                        <CardContent className="p-4 text-center">
                          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                            <Star className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <h4 className="font-semibold mb-1 text-muted-foreground">Locked</h4>
                          <p className="text-xs text-muted-foreground">
                            Complete quests to unlock
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ProfileShare
        open={shareOpen}
        onOpenChange={setShareOpen}
        address={address}
        username={onChainUsername || profile?.username}
      />
    </section>
  )
}

// Helper component for post previews
const PostPreview = ({ postId }: { postId: number }) => {
  const { post } = usePost(postId)

  if (!post) return null

  return (
    <Card className="bg-background border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-xs">
              {post.author.slice(2, 4).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
              <span className="font-mono">{post.author.slice(0, 6)}...{post.author.slice(-4)}</span>
              <span>•</span>
              <span>{new Date(post.timestamp * 1000).toLocaleDateString()}</span>
            </div>
            <p className="text-sm mb-2 break-words">{post.content}</p>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Heart className="w-4 h-4" />
                <span>{post.likes}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Repeat className="w-4 h-4" />
                <span>{post.shares}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}