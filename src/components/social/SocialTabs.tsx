import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, MessageSquare, TrendingUp, Heart } from 'lucide-react'
import { useAccount } from 'wagmi'
import { useSocialStats } from '@/hooks/useSocial'
import { useRealtimeSocial } from '@/hooks/useRealtimeSocial'
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics'
import { PostCreator } from './PostCreator'
import { UnifiedSocialFeed } from './UnifiedSocialFeed'
import { PersonalFeed } from './PersonalFeed'
import { EnhancedTrendingFeed } from './EnhancedTrendingFeed'
import { StatsSkeleton } from '@/components/ui/optimized-loading'
import { withErrorBoundary } from '@/components/ui/error-fallback'
import { usePerformanceMonitor } from '@/hooks/usePerformance'

const SocialTabsComponent = () => {
  usePerformanceMonitor('SocialTabs')
  
  const { address } = useAccount()
  const { stats } = useSocialStats(address)
  const { trackPageView } = useEnhancedAnalytics()
  
  // Enable real-time updates
  useRealtimeSocial()
  
  // Track page view
  React.useEffect(() => {
    trackPageView('social_hub')
  }, [trackPageView])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <Users className="h-5 w-5 mx-auto mb-2 text-primary" />
              <div className="text-lg font-semibold">{stats?.followers || 0}</div>
              <p className="text-xs text-muted-foreground">Followers</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <MessageSquare className="h-5 w-5 mx-auto mb-2 text-primary" />
              <div className="text-lg font-semibold">{stats?.posts || 0}</div>
              <p className="text-xs text-muted-foreground">Posts</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <Heart className="h-5 w-5 mx-auto mb-2 text-primary" />
              <div className="text-lg font-semibold">{stats?.likes || 0}</div>
              <p className="text-xs text-muted-foreground">Likes</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-5 w-5 mx-auto mb-2 text-primary" />
              <div className="text-lg font-semibold">{stats?.shares || 0}</div>
              <p className="text-xs text-muted-foreground">Shares</p>
            </CardContent>
          </Card>
        </div>

      {/* Post Creator */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Share Your Thoughts</CardTitle>
          <CardDescription>Connect with the Avalanche community</CardDescription>
        </CardHeader>
        <CardContent>
          <PostCreator />
        </CardContent>
      </Card>

      {/* Tabbed Feed */}
      <Tabs defaultValue="global" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-card border border-border/50">
          <TabsTrigger value="global" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Global Feed
          </TabsTrigger>
          <TabsTrigger value="personal" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            My Feed
          </TabsTrigger>
          <TabsTrigger value="trending" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Trending
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="global" className="mt-6">
          <UnifiedSocialFeed showHeader={false} limit={20} />
        </TabsContent>
        
        <TabsContent value="personal" className="mt-6">
          <PersonalFeed />
        </TabsContent>
        
        <TabsContent value="trending" className="mt-6">
          <EnhancedTrendingFeed />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export const SocialTabs = withErrorBoundary(SocialTabsComponent, 'SocialTabs')