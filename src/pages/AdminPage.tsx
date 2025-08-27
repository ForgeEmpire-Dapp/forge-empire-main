import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommunityDAOInterface } from '@/components/admin/CommunityDAOInterface';
import { ProfileRegistryInterface } from '@/components/admin/ProfileRegistryInterface';
import { CommunityRewardsInterface } from '@/components/rewards/CommunityRewardsInterface';
import { DynamicQuestEngineInterface } from '@/components/quests/DynamicQuestEngineInterface';
import { ForgePassInterface } from '@/components/forge/ForgePassInterface'; // Assuming this is also an admin interface

const AdminPage = () => {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
      <Tabs defaultValue="profile-registry" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile-registry">Profile Registry</TabsTrigger>
          <TabsTrigger value="community-dao">Community DAO</TabsTrigger>
          <TabsTrigger value="community-rewards">Community Rewards</TabsTrigger>
          <TabsTrigger value="dynamic-quests">Dynamic Quests</TabsTrigger>
          <TabsTrigger value="forge-pass">Forge Pass</TabsTrigger>
        </TabsList>
        <TabsContent value="profile-registry">
          <ProfileRegistryInterface />
        </TabsContent>
        <TabsContent value="community-dao">
          <CommunityDAOInterface />
        </TabsContent>
        <TabsContent value="community-rewards">
          <CommunityRewardsInterface />
        </TabsContent>
        <TabsContent value="dynamic-quests">
          <DynamicQuestEngineInterface />
        </TabsContent>
        <TabsContent value="forge-pass">
          <ForgePassInterface />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;