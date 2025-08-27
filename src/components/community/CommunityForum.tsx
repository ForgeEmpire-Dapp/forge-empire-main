import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MessageSquare, ThumbsUp, Pin, Clock, Users, TrendingUp, Plus, Search } from 'lucide-react'
import { useSocial, useGlobalFeed, usePost as useSocialPost, useComments as useSocialComments, usePostInteractionStatus, useUserPosts } from '@/hooks/useSocial'
import { useQueries } from '@tanstack/react-query'
import { useProfile } from '@/hooks/useProfile'
import { useAccount } from 'wagmi'
import { formatDistanceToNow } from 'date-fns'

interface ForumPost {
  id: number
  title: string
  content: string
  author: string
  authorAvatar: string
  category: string
  tags: string[]
  likes: number
  replies: number
  views: number
  createdAt: string
  lastActivity: string
  isPinned: boolean
  isLocked: boolean
}

interface Reply {
  id: number
  content: string
  author: string
  authorAvatar: string
  likes: number
  createdAt: string
}

const categories = [
  { name: "All", count: 0 }, // Count will be dynamic
  { name: "DeFi", count: 0 },
  { name: "Quests", count: 0 },
  { name: "Governance", count: 0 },
  { name: "General", count: 0 }
]

export const CommunityForum = () => {
  const { address } = useAccount()
  const { createPost, likePost, addComment, isCreatingPost, isLikingPost, isAddingComment } = useSocial()
  const { feedPostIds, isLoading: isLoadingFeed } = useGlobalFeed(100) // Fetch a reasonable number of posts
  const { totalPosts, socialStats } = useSocial()

  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [newPostContent, setNewPostContent] = useState('')
  const [newReplyContent, setNewReplyContent] = useState('')
  const [newPostTitle, setNewPostTitle] = useState('')
  const [newPostCategory, setNewPostCategory] = useState('General')
  const [newPostTags, setNewPostTags] = useState('')

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'DeFi': return 'bg-blue-100 text-blue-800'
      case 'Quests': return 'bg-green-100 text-green-800'
      case 'Governance': return 'bg-purple-100 text-purple-800'
      case 'General': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return
    // For now, combine title, category, and tags into content as SocialGraph.sol only takes content
    const fullContent = `Title: ${newPostTitle}\nCategory: ${newPostCategory}\nTags: ${newPostTags}\n\n${newPostContent}`
    await createPost(fullContent)
    setNewPostContent('')
    setNewPostTitle('')
    setNewPostCategory('General')
    setNewPostTags('')
    setShowCreatePost(false)
  }

  const handleLikePost = async (postId: number) => {
    await likePost(BigInt(postId))
  }

  const handleAddReply = async (postId: number) => {
    if (!newReplyContent.trim()) return
    await addComment(BigInt(postId), newReplyContent)
    setNewReplyContent('')
    // Optionally, refetch comments for the selected post
  }

  const posts = usePostData(feedPostIds)

  const filteredPosts = posts.filter(post => 
    (selectedCategory === 'All' || post.category === selectedCategory) &&
    (searchQuery === '' || post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
     post.content.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Community Forum
          </h1>
          <p className="text-muted-foreground mt-2">
            Connect with the community, share knowledge, and discuss the latest topics
          </p>
        </div>
        <Button 
          onClick={() => setShowCreatePost(true)}
          className="bg-gradient-to-r from-primary to-secondary text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Post
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category.name}
              variant={selectedCategory === category.name ? "default" : "outline"}
              onClick={() => setSelectedCategory(category.name)}
              className="whitespace-nowrap"
            >
              {category.name} ({category.count})
            </Button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Posts</p>
                <p className="text-2xl font-bold">{socialStats?.posts || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">N/A</p> {/* Active users not directly from contract */}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Posts Today</p>
                <p className="text-2xl font-bold">N/A</p> {/* Posts today not directly from contract */}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <ThumbsUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Likes</p>
                <p className="text-2xl font-bold">{socialStats?.totalLikes || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        {isLoadingFeed ? (
          <p>Loading posts...</p>
        ) : filteredPosts.length === 0 ? (
          <p className="text-muted-foreground text-center">No posts found.</p>
        ) : (
          filteredPosts.map((post) => (
            <Card key={post.id} className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedPost(post)}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      {post.isPinned && <Pin className="h-4 w-4 text-primary" />}
                      <h3 className="text-lg font-semibold hover:text-primary transition-colors">
                        {post.title}
                      </h3>
                      <Badge className={getCategoryColor(post.category)}>
                        {post.category}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={post.authorAvatar} />
                        <AvatarFallback>{post.author.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <p className="font-medium">{post.author}</p>
                        <p className="text-muted-foreground">{post.createdAt}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <ThumbsUp className="h-4 w-4" />
                        <span>{post.likes}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>{post.replies}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span>{post.views} views</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>Last: {post.lastActivity}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Post Detail Modal */}
      {selectedPost && (
        <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center space-x-2">
                {selectedPost.isPinned && <Pin className="h-4 w-4 text-primary" />}
                <DialogTitle className="text-xl">{selectedPost.title}</DialogTitle>
                <Badge className={getCategoryColor(selectedPost.category)}>
                  {selectedPost.category}
                </Badge>
              </div>
              <DialogDescription>{selectedPost.content.substring(0, 150)}...</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Original Post */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedPost.authorAvatar} />
                    <AvatarFallback>{selectedPost.author.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedPost.author}</p>
                    <p className="text-sm text-muted-foreground">{selectedPost.createdAt}</p>
                  </div>
                </div>
                <p className="text-foreground">{selectedPost.content}</p>
                <div className="flex flex-wrap gap-1">
                  {selectedPost.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center space-x-4 pt-2">
                  <Button variant="outline" size="sm" onClick={() => handleLikePost(selectedPost.id)} disabled={isLikingPost}>
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    Like ({selectedPost.likes})
                  </Button>
                  <Button variant="outline" size="sm">
                    Reply
                  </Button>
                </div>
              </div>

              {/* Replies */}
              <div className="border-t pt-6 space-y-4">
                <h4 className="font-medium text-lg">Replies ({selectedPost.replies})</h4>
                
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Reply system will be integrated with smart contracts soon</p>
                </div>

                {/* Reply Form */}
                <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                  <h5 className="font-medium">Add a Reply</h5>
                  <Textarea placeholder="Write your reply..." value={newReplyContent} onChange={(e) => setNewReplyContent(e.target.value)} />
                  <Button onClick={() => handleAddReply(selectedPost.id)} disabled={isAddingComment}>Post Reply</Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Post Modal */}
      {showCreatePost && (
        <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Post</DialogTitle>
              <DialogDescription>
                Share your thoughts, ask questions, or start a discussion
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Post title" value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} />
              <select className="w-full p-2 border rounded-md" value={newPostCategory} onChange={(e) => setNewPostCategory(e.target.value)}>
                <option value="General">Select Category</option>
                <option value="DeFi">DeFi</option>
                <option value="Quests">Quests</option>
                <option value="Governance">Governance</option>
                <option value="General">General</option>
              </select>
              <Textarea placeholder="Write your post content..." rows={6} value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} />
              <Input placeholder="Tags (comma separated)" value={newPostTags} onChange={(e) => setNewPostTags(e.target.value)} />
              <div className="flex space-x-4">
                <Button onClick={() => setShowCreatePost(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleCreatePost} disabled={isCreatingPost} className="flex-1">{isCreatingPost ? 'Creating...' : 'Create Post'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// Helper hook to fetch post data for multiple post IDs
const usePostData = (postIds: number[]) => {
  const { profile: authorProfile } = useProfile()

  const postQueries = useQueries({
    queries: postIds.map(postId => ({
      queryKey: ['post', postId],
      queryFn: () => useSocialPost(postId).post, // Assuming useSocialPost returns { post: ... }
      enabled: !!postId && postId > 0,
    })),
  })

  const commentQueries = useQueries({
    queries: postIds.map(postId => ({
      queryKey: ['comments', postId],
      queryFn: () => useSocialComments(postId).comments, // Assuming useSocialComments returns { comments: ... }
      enabled: !!postId && postId > 0,
    })),
  })

  const posts = React.useMemo(() => {
    const fetchedPosts: ForumPost[] = []
    for (let i = 0; i < postIds.length; i++) {
      const postData = postQueries[i]?.data
      const comments = commentQueries[i]?.data

      if (postData) {
        const contentLines = postData.content.split('\n')
        let title = ''
        let category = 'General'
        let tags: string[] = []
        let actualContent = postData.content

        if (contentLines[0]?.startsWith('Title:')) {
          title = contentLines[0].replace('Title:', '').trim()
          if (contentLines[1]?.startsWith('Category:')) {
            category = contentLines[1].replace('Category:', '').trim()
            if (contentLines[2]?.startsWith('Tags:')) {
              tags = contentLines[2].replace('Tags:', '').split(',').map(tag => tag.trim())
              actualContent = contentLines.slice(4).join('\n')
            } else {
              actualContent = contentLines.slice(2).join('\n')
            }
          } else {
            actualContent = contentLines.slice(1).join('\n')
          }
        }

        fetchedPosts.push({
          id: postIds[i],
          title: title || `Post ${postIds[i]}`, 
          content: actualContent,
          author: authorProfile?.name || postData.author,
          authorAvatar: authorProfile?.avatar || '/placeholder-avatar-1.jpg',
          category: category,
          tags: tags,
          likes: postData.likes,
          replies: comments?.length || 0,
          views: 0, // SocialGraph.sol doesn't track views directly
          createdAt: formatDistanceToNow(new Date(Number(postData.timestamp) * 1000), { addSuffix: true }),
          lastActivity: formatDistanceToNow(new Date(Number(postData.timestamp) * 1000), { addSuffix: true }), // Needs to be updated with last comment/like activity
          isPinned: false, // SocialGraph.sol doesn't track pinned status
          isLocked: false, // SocialGraph.sol doesn't track locked status
        })
      }
    }
    return fetchedPosts
  }, [postIds, postQueries, commentQueries, authorProfile])

  return posts
}
