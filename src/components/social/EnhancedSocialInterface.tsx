import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { avalancheFuji } from 'wagmi/chains'
import { useState } from 'react'
import { toast } from 'sonner'
import { CONTRACT_ADDRESSES } from '@/config/web3'
import { Heart, Share2, MessageCircle, UserPlus, UserMinus, Flag, Eye } from 'lucide-react'
import { useSocial, useSocialStats, useUserPosts, useGlobalFeed, usePost, useIsFollowing, usePostInteractionStatus } from '@/hooks/useSocial'

const SOCIAL_GRAPH_ABI = [
  {
    name: 'createPost',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'content', type: 'string' }],
    outputs: []
  },
  {
    name: 'followUser',
    type: 'function', 
    stateMutability: 'nonpayable',
    inputs: [{ name: 'userToFollow', type: 'address' }],
    outputs: []
  },
  {
    name: 'unfollowUser',
    type: 'function',
    stateMutability: 'nonpayable', 
    inputs: [{ name: 'userToUnfollow', type: 'address' }],
    outputs: []
  },
  {
    name: 'likePost',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'postId', type: 'uint256' }],
    outputs: []
  },
  {
    name: 'unlikePost',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'postId', type: 'uint256' }],
    outputs: []
  },
  {
    name: 'sharePost',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'postId', type: 'uint256' }],
    outputs: []
  },
  {
    name: 'reportPost',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'postId', type: 'uint256' }],
    outputs: []
  },
  {
    name: 'getFollowers',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'address[]' }]
  },
  {
    name: 'getFollowing',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'address[]' }]
  }
] as const

interface PostCardProps {
  postId: number
  userAddress?: string
}

const PostCard = ({ postId, userAddress }: PostCardProps) => {
  const { post } = usePost(postId)
  const { hasLiked, hasShared } = usePostInteractionStatus(postId, userAddress)
  const { likePost, unlikePost, sharePost } = useSocial()
  const { writeContract } = useWriteContract()

  if (!post) return null

  const handleReport = async () => {
    if (!userAddress) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
        abi: SOCIAL_GRAPH_ABI,
        functionName: 'reportPost',
        args: [BigInt(postId)],
        chain: avalancheFuji,
        account: userAddress as `0x${string}`
      })
      toast.success('Post reported')
    } catch (error) {
      toast.error('Failed to report post')
    }
  }

  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex justify-between items-start mb-3">
          <div className="text-sm text-muted-foreground">
            {post.author.slice(0, 6)}...{post.author.slice(-4)}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(post.timestamp * 1000).toLocaleDateString()}
          </div>
        </div>
        
        <p className="mb-4 text-foreground">{post.content}</p>
        
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => hasLiked ? unlikePost(postId) : likePost(postId)}
            className={hasLiked ? "text-red-500" : ""}
          >
            <Heart className={`w-4 h-4 mr-1 ${hasLiked ? "fill-current" : ""}`} />
            {post.likes}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => sharePost(postId)}
            className={hasShared ? "text-blue-500" : ""}
          >
            <Share2 className="w-4 h-4 mr-1" />
            {post.shares}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReport}
          >
            <Flag className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export const EnhancedSocialInterface = () => {
  const { address, isConnected } = useAccount()
  const { createPost, followUser, unfollowUser, isPending } = useSocial()
  const { stats } = useSocialStats(address)
  const { postIds } = useUserPosts(address)
  const { feedPostIds } = useGlobalFeed(20)
  
  const [postContent, setPostContent] = useState('')
  const [followAddress, setFollowAddress] = useState('')
  const [viewUserAddress, setViewUserAddress] = useState('')

  // Following/Followers data
  const { data: followers } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'getFollowers',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  })

  const { data: following } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph as `0x${string}`,
    abi: SOCIAL_GRAPH_ABI,
    functionName: 'getFollowing', 
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  })

  const isFollowingUser = useIsFollowing(address, viewUserAddress)
  const { stats: viewUserStats } = useSocialStats(viewUserAddress)
  const { postIds: viewUserPosts } = useUserPosts(viewUserAddress)

  const handleCreatePost = async () => {
    if (!postContent.trim()) {
      toast.error('Post content cannot be empty')
      return
    }
    
    await createPost(postContent)
    setPostContent('')
  }

  const handleFollow = async () => {
    if (!followAddress) {
      toast.error('Please enter a user address')
      return
    }
    
    await followUser(followAddress)
    setFollowAddress('')
  }

  const handleUnfollow = async () => {
    if (!followAddress) {
      toast.error('Please enter a user address')
      return
    }
    
    await unfollowUser(followAddress)
    setFollowAddress('')
  }

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Please connect your wallet to access the social features.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* User Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Your Social Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats?.posts || 0}</div>
              <div className="text-sm text-muted-foreground">Posts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats?.followers || 0}</div>
              <div className="text-sm text-muted-foreground">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats?.following || 0}</div>
              <div className="text-sm text-muted-foreground">Following</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats?.likes || 0}</div>
              <div className="text-sm text-muted-foreground">Likes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats?.shares || 0}</div>
              <div className="text-sm text-muted-foreground">Shares</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="create">Create Post</TabsTrigger>
          <TabsTrigger value="feed">Global Feed</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="profile">View Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New Post</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="What's on your mind?"
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  rows={4}
                />
              </div>
              <Button 
                onClick={handleCreatePost} 
                disabled={isPending || !postContent.trim()}
                className="w-full"
              >
                {isPending ? 'Creating...' : 'Create Post'}
              </Button>
            </CardContent>
          </Card>

          {/* User's Posts */}
          <Card>
            <CardHeader>
              <CardTitle>Your Posts ({postIds.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {postIds.length > 0 ? (
                <div className="space-y-4">
                  {postIds.slice(0, 5).map(postId => (
                    <PostCard key={postId} postId={postId} userAddress={address} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No posts yet. Create your first post!</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Feed</CardTitle>
            </CardHeader>
            <CardContent>
              {feedPostIds.length > 0 ? (
                <div className="space-y-4">
                  {feedPostIds.slice(0, 10).map(postId => (
                    <PostCard key={postId} postId={postId} userAddress={address} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No posts in the global feed yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Follow/Unfollow Users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="follow-address">User Address</Label>
                <Input
                  id="follow-address"
                  placeholder="0x..."
                  value={followAddress}
                  onChange={(e) => setFollowAddress(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleFollow} 
                  disabled={isPending || !followAddress}
                  className="flex-1"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Follow
                </Button>
                <Button 
                  onClick={handleUnfollow} 
                  disabled={isPending || !followAddress}
                  variant="outline"
                  className="flex-1"
                >
                  <UserMinus className="w-4 h-4 mr-2" />
                  Unfollow
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Followers/Following Lists */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Followers ({(followers as string[])?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {followers && (followers as string[]).length > 0 ? (
                  <div className="space-y-2">
                    {(followers as string[]).slice(0, 5).map((follower, index) => (
                      <div key={index} className="text-sm">
                        {follower.slice(0, 6)}...{follower.slice(-4)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No followers yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Following ({(following as string[])?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {following && (following as string[]).length > 0 ? (
                  <div className="space-y-2">
                    {(following as string[]).slice(0, 5).map((followed, index) => (
                      <div key={index} className="text-sm">
                        {followed.slice(0, 6)}...{followed.slice(-4)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Not following anyone yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>View User Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="view-address">User Address</Label>
                <Input
                  id="view-address"
                  placeholder="0x..."
                  value={viewUserAddress}
                  onChange={(e) => setViewUserAddress(e.target.value)}
                />
              </div>
              
              {viewUserAddress && viewUserStats && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">
                        {viewUserAddress.slice(0, 6)}...{viewUserAddress.slice(-4)}
                      </h3>
                      {viewUserAddress !== address && (
                        <Badge variant={isFollowingUser ? "default" : "outline"}>
                          {isFollowingUser ? "Following" : "Not Following"}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold">{viewUserStats.posts}</div>
                        <div className="text-sm text-muted-foreground">Posts</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{viewUserStats.followers}</div>
                        <div className="text-sm text-muted-foreground">Followers</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{viewUserStats.following}</div>
                        <div className="text-sm text-muted-foreground">Following</div>
                      </div>
                    </div>

                    {viewUserPosts.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-medium">Recent Posts</h4>
                        {viewUserPosts.slice(0, 3).map(postId => (
                          <PostCard key={postId} postId={postId} userAddress={address} />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}