import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Camera, Upload, Image, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useProfile } from '@/hooks/useProfile'

interface BannerUploaderProps {
  currentBanner?: string
  onBannerUpdate?: (url: string) => void
  className?: string
}

export const BannerUploader = ({ 
  currentBanner, 
  onBannerUpdate,
  className = '' 
}: BannerUploaderProps) => {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { profile, saveProfile } = useProfile()

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB')
      return
    }

    setUploading(true)
    setPreviewUrl(URL.createObjectURL(file))

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${profile?.id || 'temp'}-banner-${Date.now()}.${fileExt}`
      const filePath = `banners/${fileName}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('banners')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('banners')
        .getPublicUrl(filePath)

      // Update profile with new banner URL
      if (profile) {
        const result = await saveProfile({ banner_url: publicUrl })
        if (result.error) {
          throw new Error(result.error)
        }
      }

      onBannerUpdate?.(publicUrl)
      toast.success('Banner updated successfully!')
      
    } catch (error: unknown) {
      console.error('Error uploading banner:', error)
      toast.error(error.message || 'Failed to upload banner')
      setPreviewUrl(null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveBanner = async () => {
    try {
      if (profile) {
        const result = await saveProfile({ banner_url: null })
        if (result.error) {
          throw new Error(result.error)
        }
      }
      
      setPreviewUrl(null)
      onBannerUpdate?.('')
      toast.success('Banner removed successfully!')
    } catch (error: unknown) {
      toast.error('Failed to remove banner')
    }
  }

  const displayBanner = previewUrl || currentBanner

  return (
    <Card className={`relative h-48 overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20 ${className}`}>
      {displayBanner ? (
        <>
          <img 
            src={displayBanner} 
            alt="Profile banner" 
            className="h-full w-full object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              size="icon"
              variant="secondary"
              onClick={handleFileSelect}
              disabled={uploading}
              className="h-8 w-8 bg-background/80 hover:bg-background/90"
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Camera className="h-3 w-3" />
              )}
            </Button>
            <Button
              size="icon"
              variant="secondary"
              onClick={handleRemoveBanner}
              disabled={uploading}
              className="h-8 w-8 bg-background/80 hover:bg-background/90"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <Image className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Add a banner image</p>
          <Button
            variant="outline"
            onClick={handleFileSelect}
            disabled={uploading}
            className="bg-background/80 hover:bg-background/90"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Banner
              </>
            )}
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </Card>
  )
}