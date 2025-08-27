import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocalProfileMedia } from '@/hooks/useLocalProfileMedia'
import { useToast } from '@/hooks/use-toast'

interface ProfileMediaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  address?: string
}

const MAX_DIM = 1024

async function fileToOptimizedDataUrl(file: File): Promise<string> {
  const img = document.createElement('img')
  const url = URL.createObjectURL(file)
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = url
    })

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No canvas context')

    let { naturalWidth: w, naturalHeight: h } = img
    if (w > MAX_DIM || h > MAX_DIM) {
      if (w > h) {
        h = Math.round((h * MAX_DIM) / w)
        w = MAX_DIM
      } else {
        w = Math.round((w * MAX_DIM) / h)
        h = MAX_DIM
      }
    }
    canvas.width = w
    canvas.height = h
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.9)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const ProfileMediaDialog = ({ open, onOpenChange, address }: ProfileMediaDialogProps) => {
  const { toast } = useToast()
  const { avatarUrl, bannerUrl, setAvatar, setBanner } = useLocalProfileMedia(address)
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(avatarUrl)
  const [bannerPreview, setBannerPreview] = useState<string | undefined>(bannerUrl)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const bannerInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setAvatarPreview(avatarUrl)
      setBannerPreview(bannerUrl)
    }
  }, [open, avatarUrl, bannerUrl])

  const onSelectAvatar = async (file?: File) => {
    if (!file) return
    const dataUrl = await fileToOptimizedDataUrl(file)
    setAvatarPreview(dataUrl)
  }

  const onSelectBanner = async (file?: File) => {
    if (!file) return
    const dataUrl = await fileToOptimizedDataUrl(file)
    setBannerPreview(dataUrl)
  }

  const onSave = () => {
    setAvatar(avatarPreview)
    setBanner(bannerPreview)
    toast({ title: 'Profile media saved', description: 'Your avatar and banner were updated locally.' })
    onOpenChange(false)
  }

  const clearAvatar = () => setAvatarPreview(undefined)
  const clearBanner = () => setBannerPreview(undefined)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Profile Media</DialogTitle>
          <DialogDescription>Upload a profile picture and a banner. Stored locally for now.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Profile Picture</Label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-full overflow-hidden bg-muted">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile avatar preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No image</div>
                )}
              </div>
              <div className="flex gap-2">
                <Input ref={avatarInputRef} type="file" accept="image/*" onChange={(e) => onSelectAvatar(e.target.files?.[0])} />
                <Button variant="outline" onClick={clearAvatar}>Remove</Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Profile Banner</Label>
            <div className="rounded-lg overflow-hidden bg-muted aspect-[3/1]">
              {bannerPreview ? (
                <img src={bannerPreview} alt="Profile banner preview" className="h-full w-full object-cover" />
              ) : (
                <div className="h-24 w-full flex items-center justify-center text-sm text-muted-foreground">No banner</div>
              )}
            </div>
            <div className="flex gap-2">
              <Input ref={bannerInputRef} type="file" accept="image/*" onChange={(e) => onSelectBanner(e.target.files?.[0])} />
              <Button variant="outline" onClick={clearBanner}>Remove</Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
