import { useState } from 'react'
import { handleError } from '@/utils/standardErrorHandler'
import { useAccount } from 'wagmi'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, X, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics' // Consolidated analytics service

interface ProfileMediaUploaderProps {
  type: 'avatar' | 'banner'
  currentUrl?: string
  onUploadComplete: (url: string) => void
  className?: string
}

export const ProfileMediaUploader = ({
  type,
  currentUrl,
  onUploadComplete,
  className = ''
}: ProfileMediaUploaderProps) => {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const { address } = useAccount()
  const { trackProfileAction } = useEnhancedAnalytics() // Using the consolidated analytics service

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !address) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    setUploading(true)
    
    try {
      // Create file path: {type}s/{userAddress}/{timestamp}-{filename}
      const timestamp = Date.now()
      const fileExt = file.name.split('.').pop()
      const fileName = `${timestamp}-${type}.${fileExt}`
      const filePath = `${address}/${fileName}`

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from(type === 'avatar' ? 'avatars' : 'banners')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        handleError(error, { component: 'ProfileMediaUploader', action: 'Upload file' })
        toast.error(`Failed to upload ${type}`)
        return
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(type === 'avatar' ? 'avatars' : 'banners')
        .getPublicUrl(data.path)

      setPreviewUrl(publicUrl)
      onUploadComplete(publicUrl)
      
      // Track analytics
      trackProfileAction('media_uploaded', { 
        type, 
        fileSize: file.size,
        fileType: file.type 
      })
      
      toast.success(`${type === 'avatar' ? 'Avatar' : 'Banner'} uploaded successfully!`)
    } catch (error) {
      handleError(error, { component: 'ProfileMediaUploader', action: 'Handle file drop' })
      toast.error(`Failed to upload ${type}`)
    } finally {
      setUploading(false)
    }
  }

  const removeImage = () => {
    setPreviewUrl(null)
    onUploadComplete('')
    trackProfileAction('media_removed', { type })
  }

  const displayUrl = previewUrl || currentUrl

  return (
    <Card className={`${className}`}>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">
              {type === 'avatar' ? 'Profile Picture' : 'Cover Image'}
            </h4>
            {displayUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={removeImage}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {displayUrl ? (
            <div className="relative">
              <img
                src={displayUrl}
                alt={type === 'avatar' ? 'Profile picture' : 'Cover image'}
                className={`w-full object-cover rounded-lg ${
                  type === 'avatar' 
                    ? 'h-32 w-32 rounded-full mx-auto' 
                    : 'h-24'
                }`}
              />
              {previewUrl && (
                <div className="absolute top-2 right-2">
                  <CheckCircle className="h-5 w-5 text-green-500 bg-white rounded-full" />
                </div>
              )}
            </div>
          ) : (
            <div 
              className={`border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center ${
                type === 'avatar' ? 'h-32 w-32 rounded-full mx-auto' : 'h-24'
              }`}
            >
              <Upload className="h-6 w-6 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {type === 'avatar' ? 'Upload avatar' : 'Upload cover'}
              </p>
            </div>
          )}

          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={uploading || !address}
              asChild
            >
              <label className="cursor-pointer">
                {uploading ? 'Uploading...' : `Choose ${type === 'avatar' ? 'Avatar' : 'Cover'}`}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Supports JPG, PNG, GIF. Max 5MB.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}