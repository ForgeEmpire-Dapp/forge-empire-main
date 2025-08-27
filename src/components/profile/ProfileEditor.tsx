import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useProfile, ProfileData } from '@/hooks/useProfile'
import { Eye, Users, Lock } from 'lucide-react'

interface ProfileEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ProfileEditor = ({ open, onOpenChange }: ProfileEditorProps) => {
  const { profile, saving, saveProfile } = useProfile()
  
  const [formData, setFormData] = useState({
    username: profile?.username || '',
    display_name: profile?.display_name || '',
    bio: profile?.bio || '',
    location: profile?.location || '',
    website: profile?.website || '',
    visibility: profile?.visibility || 'public' as 'public' | 'friends' | 'private',
    twitter: profile?.social_links?.twitter || '',
    discord: profile?.social_links?.discord || '',
    github: profile?.social_links?.github || ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const profileData: Partial<ProfileData> = {
      username: formData.username,
      display_name: formData.display_name,
      bio: formData.bio,
      location: formData.location,
      website: formData.website,
      visibility: formData.visibility,
      social_links: {
        twitter: formData.twitter,
        discord: formData.discord,
        github: formData.github
      }
    }

    const result = await saveProfile(profileData)
    if (!result.error) {
      onOpenChange(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your profile information and social links.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => handleChange('username', e.target.value)}
              placeholder="Enter your username"
              maxLength={32}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) => handleChange('display_name', e.target.value)}
              placeholder="Your display name"
              maxLength={64}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              placeholder="Tell us about yourself..."
              maxLength={200}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="Where are you based?"
              maxLength={64}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) => handleChange('website', e.target.value)}
              placeholder="https://yourwebsite.com"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Social Links</Label>
            
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label htmlFor="twitter" className="text-xs">Twitter</Label>
                <Input
                  id="twitter"
                  value={formData.twitter}
                  onChange={(e) => handleChange('twitter', e.target.value)}
                  placeholder="@username"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="discord" className="text-xs">Discord</Label>
                <Input
                  id="discord"
                  value={formData.discord}
                  onChange={(e) => handleChange('discord', e.target.value)}
                  placeholder="username#1234"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="github" className="text-xs">GitHub</Label>
                <Input
                  id="github"
                  value={formData.github}
                  onChange={(e) => handleChange('github', e.target.value)}
                  placeholder="username"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Profile Visibility</Label>
            <RadioGroup
              value={formData.visibility}
              onValueChange={(value) => setFormData(prev => ({ ...prev, visibility: value as 'public' | 'friends' | 'private' }))}
              className="space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="public" />
                <Label htmlFor="public" className="flex items-center gap-1 text-sm">
                  <Eye className="h-3 w-3" />
                  Public
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="friends" id="friends" disabled />
                <Label htmlFor="friends" className="flex items-center gap-1 opacity-50 text-sm">
                  <Users className="h-3 w-3" />
                  Friends (Soon)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="private" id="private" />
                <Label htmlFor="private" className="flex items-center gap-1 text-sm">
                  <Lock className="h-3 w-3" />
                  Private
                </Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}