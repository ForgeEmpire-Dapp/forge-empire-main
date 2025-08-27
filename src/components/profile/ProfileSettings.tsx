import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, 
  Shield, 
  Bell, 
  Eye, 
  Users, 
  Lock,
  Globe,
  Mail,
  MessageSquare,
  Heart,
  Share,
  Trash2
} from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { toast } from 'sonner'

interface ProfileSettingsProps {
  className?: string
}

export const ProfileSettings = ({ className = '' }: ProfileSettingsProps) => {
  const { profile, saveProfile } = useProfile()
  const [loading, setLoading] = useState(false)
  
  // Settings state
  const [settings, setSettings] = useState({
    // Privacy Settings
    profileVisibility: profile?.visibility || 'public',
    showEmail: false,
    showWallet: true,
    
    // Notification Settings
    emailNotifications: true,
    postLikes: true,
    postComments: true,
    newFollowers: true,
    questComplete: true,
    achievements: true,
    weeklyDigest: true,
    
    // Social Settings
    allowDirectMessages: true,
    showOnlineStatus: true,
    publicActivity: true
  })

  const handleSettingChange = (key: string, value: boolean | string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSaveSettings = async () => {
    setLoading(true)
    try {
      // In a real app, you'd save these to a user_settings table
      // For now, we'll just save the visibility setting to the profile
      const result = await saveProfile(settings)
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      toast.success('Settings saved successfully!')
    } catch (error: unknown) {
      toast.error(error.message || 'Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = () => {
    // This would open a confirmation dialog
    toast.error('Account deletion feature coming soon')
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Privacy Settings */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Visibility
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Profile Visibility</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Control who can see your profile and posts
              </p>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="public"
                    name="visibility"
                    checked={settings.profileVisibility === 'public'}
                    onChange={() => handleSettingChange('profileVisibility', 'public')}
                    className="radio"
                  />
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <Label htmlFor="public">Public</Label>
                    <Badge variant="outline" className="text-xs">
                      Recommended
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="friends"
                    name="visibility"
                    disabled
                    className="radio opacity-50"
                  />
                  <div className="flex items-center gap-2 opacity-50">
                    <Users className="h-4 w-4" />
                    <Label htmlFor="friends">Friends Only</Label>
                    <Badge variant="secondary" className="text-xs">
                      Coming Soon
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="private"
                    name="visibility"
                    checked={settings.profileVisibility === 'private'}
                    onChange={() => handleSettingChange('profileVisibility', 'private')}
                    className="radio"
                  />
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    <Label htmlFor="private">Private</Label>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="show-email">Show Email Address</Label>
                  <p className="text-sm text-muted-foreground">
                    Display your email on your public profile
                  </p>
                </div>
                <Switch
                  id="show-email"
                  checked={settings.showEmail}
                  onCheckedChange={(checked) => handleSettingChange('showEmail', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="show-wallet">Show Wallet Address</Label>
                  <p className="text-sm text-muted-foreground">
                    Display your wallet address on your profile
                  </p>
                </div>
                <Switch
                  id="show-wallet"
                  checked={settings.showWallet}
                  onCheckedChange={(checked) => handleSettingChange('showWallet', checked)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email updates about your activity
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={settings.emailNotifications}
              onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-medium">Activity Notifications</Label>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4" />
                <Label htmlFor="post-likes">Post Likes</Label>
              </div>
              <Switch
                id="post-likes"
                checked={settings.postLikes}
                onCheckedChange={(checked) => handleSettingChange('postLikes', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <Label htmlFor="post-comments">Post Comments</Label>
              </div>
              <Switch
                id="post-comments"
                checked={settings.postComments}
                onCheckedChange={(checked) => handleSettingChange('postComments', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <Label htmlFor="new-followers">New Followers</Label>
              </div>
              <Switch
                id="new-followers"
                checked={settings.newFollowers}
                onCheckedChange={(checked) => handleSettingChange('newFollowers', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social Settings */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Social Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="direct-messages">Allow Direct Messages</Label>
              <p className="text-sm text-muted-foreground">
                Let other users send you private messages
              </p>
            </div>
            <Switch
              id="direct-messages"
              checked={settings.allowDirectMessages}
              onCheckedChange={(checked) => handleSettingChange('allowDirectMessages', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="online-status">Show Online Status</Label>
              <p className="text-sm text-muted-foreground">
                Display when you're active in the app
              </p>
            </div>
            <Switch
              id="online-status"
              checked={settings.showOnlineStatus}
              onCheckedChange={(checked) => handleSettingChange('showOnlineStatus', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="public-activity">Public Activity Feed</Label>
              <p className="text-sm text-muted-foreground">
                Show your activity in the global feed
              </p>
            </div>
            <Switch
              id="public-activity"
              checked={settings.publicActivity}
              onCheckedChange={(checked) => handleSettingChange('publicActivity', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Settings */}
      <div className="flex justify-between items-center">
        <Button
          variant="destructive"
          onClick={handleDeleteAccount}
          className="flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Delete Account
        </Button>
        
        <Button
          onClick={handleSaveSettings}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}