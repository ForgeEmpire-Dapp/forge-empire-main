import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/hooks/use-toast'
import { Camera, Upload, X } from 'lucide-react'
import { logger, logUserAction } from '@/utils/logger'

interface MediaUploaderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const MediaUploader = ({ open, onOpenChange }: MediaUploaderProps) => {
  const { profile, saving, saveProfile, uploadFile } = useProfile()
  const { toast } = useToast()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setAvatarPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setBannerFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setBannerPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    let avatar_url = profile?.avatar_url
    let banner_url = profile?.banner_url

    try {
      // Upload avatar if changed
      if (avatarFile) {
        const result = await uploadFile(avatarFile, 'avatars')
        if (result.error) {
          logger.error('Avatar upload failed', { error: result.error.message })
          toast({
            title: 'Upload Failed',
            description: 'Failed to upload avatar. Please try again.',
            variant: 'destructive'
          })
          return
        }
        avatar_url = result.data
      }

      // Upload banner if changed
      if (bannerFile) {
        const result = await uploadFile(bannerFile, 'banners')
        if (result.error) {
          logger.error('Banner upload failed', { error: result.error.message })
          toast({
            title: 'Upload Failed', 
            description: 'Failed to upload banner. Please try again.',
            variant: 'destructive'
          })
          return
        }
        banner_url = result.data
      }

      // Save profile with new URLs
      const result = await saveProfile({ avatar_url, banner_url })
      if (!result.error) {
        onOpenChange(false)
        // Reset state
        setAvatarFile(null)
        setBannerFile(null)
        setAvatarPreview(null)
        setBannerPreview(null)
      }
    } catch (error) {
      logger.error('Media upload error', { error: error instanceof Error ? error.message : 'Unknown error' })
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while uploading media.',
        variant: 'destructive'
      })
    }
  }

  const clearAvatar = () => {
    setAvatarFile(null)
    setAvatarPreview(null)
  }

  const clearBanner = () => {
    setBannerFile(null)
    setBannerPreview(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Profile Media</DialogTitle>
          <DialogDescription>
            Upload your avatar and banner images. They will be stored securely in Supabase Storage.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Upload */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Profile Avatar</Label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-muted border-2 border-border">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                ) : profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Current avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="cursor-pointer"
                />
                {avatarPreview && (
                  <Button type="button" variant="outline" size="sm" onClick={clearAvatar}>
                    <X className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Banner Upload */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Profile Banner</Label>
            <div className="space-y-3">
              <div className="w-full h-32 rounded-lg overflow-hidden bg-muted border-2 border-border">
                {bannerPreview ? (
                  <img src={bannerPreview} alt="Banner preview" className="w-full h-full object-cover" />
                ) : profile?.banner_url ? (
                  <img src={profile.banner_url} alt="Current banner" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleBannerChange}
                  className="cursor-pointer flex-1"
                />
                {bannerPreview && (
                  <Button type="button" variant="outline" size="sm" onClick={clearBanner}>
                    <X className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || (!avatarFile && !bannerFile)}>
              {saving ? 'Uploading...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}