import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Camera, Upload, User, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useProfile } from '@/hooks/useProfile'

interface ProfileImageUploaderProps {
  currentImage?: string
  onImageUpdate?: (url: string) => void
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const ProfileImageUploader = ({ 
  currentImage, 
  onImageUpdate, 
  size = 'md',
  className = '' 
}: ProfileImageUploaderProps) => {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { profile, saveProfile } = useProfile()

  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32'
  }

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

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }

    setUploading(true)
    setPreviewUrl(URL.createObjectURL(file))

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${profile?.id || 'temp'}-avatar-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update profile with new avatar URL
      if (profile) {
        const result = await saveProfile({ avatar_url: publicUrl })
        if (result.error) {
          throw new Error(result.error)
        }
      }

      onImageUpdate?.(publicUrl)
      toast.success('Profile image updated successfully!')
      
    } catch (error: unknown) {
      console.error('Error uploading image:', error)
      toast.error(error.message || 'Failed to upload image')
      setPreviewUrl(null)
    } finally {
      setUploading(false)
    }
  }

  const displayImage = previewUrl || currentImage

  return (
    <div className={`relative ${className}`}>
      <Avatar className={`${sizeClasses[size]} border-4 border-primary/20`}>
        <AvatarImage src={displayImage} alt="Profile" />
        <AvatarFallback className="bg-gradient-primary text-primary-foreground">
          <User className="h-6 w-6" />
        </AvatarFallback>
      </Avatar>
      
      <Button
        size="icon"
        variant="outline"
        onClick={handleFileSelect}
        disabled={uploading}
        className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-background border-2 border-primary/20 hover:border-primary/40"
      >
        {uploading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Camera className="h-3 w-3" />
        )}
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}