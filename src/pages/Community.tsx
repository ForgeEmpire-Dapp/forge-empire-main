import React from 'react'
import { PageLayout } from '@/components/layout/PageLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EnhancedDAOGovernance } from '@/components/dao/EnhancedDAOGovernance'
import { GuildManagement } from '@/components/guild/GuildManagement'
import { CommunityForum } from '@/components/community/CommunityForum'
import { SocialTabs } from '@/components/social/SocialTabs'

export default function Community() {
  return (
    <PageLayout
      title="Community Hub"
      description="Connect with builders, share achievements, and collaborate on projects in the Avalanche ecosystem"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-6">
          <h1 className="text-3xl font-bold mb-2">Community Hub</h1>
          <p className="text-muted-foreground">
            Connect with builders, participate in governance, and join guilds in the ecosystem
          </p>
        </div>

        {/* Navigation Tabs */}
        <Tabs defaultValue="social" className="space-y-6">
          <div className="flex justify-center">
            <TabsList className="grid w-full max-w-lg grid-cols-4">
              <TabsTrigger value="social" className="text-sm">Social Hub</TabsTrigger>
              <TabsTrigger value="governance" className="text-sm">Governance</TabsTrigger>
              <TabsTrigger value="guilds" className="text-sm">Guilds</TabsTrigger>
              <TabsTrigger value="forum" className="text-sm">Forum</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="social" className="space-y-6">
            <SocialTabs />
          </TabsContent>

          <TabsContent value="governance" className="space-y-6">
            <EnhancedDAOGovernance />
          </TabsContent>

          <TabsContent value="guilds" className="space-y-6">
            <GuildManagement />
          </TabsContent>

          <TabsContent value="forum" className="space-y-6">
            <CommunityForum />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  )
}