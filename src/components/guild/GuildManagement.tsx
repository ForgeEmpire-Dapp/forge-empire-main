import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Crown, Users, Trophy, Star, Plus, Settings, UserPlus, MessageSquare, Loader2 } from 'lucide-react';
import { useGuild, useGuildInfo, useUserGuild } from '@/hooks/useGuild';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';

export const GuildManagement = () => {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedGuildId, setSelectedGuildId] = useState<number | null>(null);
  const [showCreateGuild, setShowCreateGuild] = useState(false);

  const { guilds, isLoading: isLoadingGuilds, createGuild, isCreatingGuild, nextGuildId, guildCreationFee, minRequiredXP, maxGuildSize } = useGuild();
  const userGuildId = useUserGuild(address);
  const { guild: myGuild, members: myGuildMembers, isLoading: isLoadingMyGuild, joinGuild, isJoining } = useGuildInfo(userGuildId);
  const { guild: selectedGuild, members: selectedGuildMembers, isLoading: isLoadingSelectedGuild, joinGuild: joinSelectedGuild, isJoining: isJoiningSelected } = useGuildInfo(selectedGuildId);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'leader': return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'officer': return <Star className="h-4 w-4 text-blue-500" />;
      default: return <Users className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'leader': return 'bg-yellow-100 text-yellow-800';
      case 'officer': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const CreateGuildDialog = () => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const handleCreate = async () => {
      await createGuild(name, description, Number(minRequiredXP));
      setShowCreateGuild(false);
    };

    return (
      <Dialog open={showCreateGuild} onOpenChange={setShowCreateGuild}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Guild</DialogTitle>
            <DialogDescription>Start your own guild community. Fee: {guildCreationFee ? formatEther(guildCreationFee) : '0'} ETH</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Guild Name</label>
              <Input placeholder="Enter guild name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea placeholder="Describe your guild's purpose and goals" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="flex space-x-4">
              <Button onClick={() => setShowCreateGuild(false)} variant="outline" className="flex-1">Cancel</Button>
              <Button onClick={handleCreate} className="flex-1" disabled={isCreatingGuild}>
                {isCreatingGuild && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Guild
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* ... Header and Stats Overview ... */}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="browse">Browse Guilds</TabsTrigger>
          <TabsTrigger value="my-guild">My Guild</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          {isLoadingGuilds ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {guilds.map((guild) => (
                <Card key={guild.guildId} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedGuildId(Number(guild.guildId))}>
                  <CardHeader><CardTitle>{guild.name}</CardTitle><CardDescription>{guild.description}</CardDescription></CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline" onClick={(e) => { e.stopPropagation(); joinSelectedGuild(); }} disabled={isJoiningSelected}>Join Guild</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-guild" className="space-y-4">
          {isLoadingMyGuild ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
          ) : myGuild ? (
            <Card>
              <CardHeader><CardTitle>{myGuild.name}</CardTitle><CardDescription>{myGuild.description}</CardDescription></CardHeader>
              <CardContent>
                <h4>Members</h4>
                <ul>
                  {myGuildMembers.map(member => (
                    <li key={member.memberAddress}>{member.memberAddress} - {member.role}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : (
            <p>You are not in a guild.</p>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          {/* ... Leaderboard Content ... */}
        </TabsContent>
      </Tabs>

      {selectedGuild && (
        <Dialog open={!!selectedGuild} onOpenChange={() => setSelectedGuildId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedGuild.name}</DialogTitle>
              <DialogDescription>{selectedGuild.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium">Members ({selectedGuildMembers.length} / {Number(maxGuildSize)})</h4>
                <Progress value={(selectedGuildMembers.length / Number(maxGuildSize)) * 100} className="w-full" />
              </div>
              <div className="max-h-48 overflow-y-auto">
                <ul>
                  {selectedGuildMembers.map(member => (
                    <li key={member.memberAddress} className="flex items-center justify-between py-1">
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={`https://i.pravatar.cc/150?u=${member.memberAddress}`} />
                          <AvatarFallback>{member.memberAddress.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span>{member.memberAddress}</span>
                      </div>
                      <Badge className={getRoleBadgeColor(member.role)}>{member.role}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
              <Button className="w-full" onClick={joinSelectedGuild} disabled={isJoiningSelected}>
                {isJoiningSelected && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Join Guild
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <CreateGuildDialog />
    </div>
  );
};