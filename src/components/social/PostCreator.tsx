import { useState } from 'react'
import { handleError } from '@/utils/standardErrorHandler'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input' // Import Input for file selection
import { 
  Send,
  Image as ImageIcon,
  Calendar,
  MapPin,
  Hash,
  Loader2,
  XCircle
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { useProfile } from '@/hooks/useProfile'
import { useProfileRegistry } from '@/hooks/useProfileRegistry'
import { useSocial } from '@/hooks/useSocial'
import { toast } from 'sonner'

// Placeholder for IPFS upload utility
// In a real application, this would interact with an IPFS client or a service like Pinata
const uploadToIPFS = async (file: File): Promise<string> => {
  console.log('Simulating IPFS upload for:', file.name)
  // Simulate a delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  // Return a dummy URL for now
  return `https://ipfs.io/ipfs/QmW${Math.random().toString(36).substring(2, 15)}`
}

interface PostCreatorProps {
  onPostCreated?: () => void
  placeholder?: string
  maxLength?: number
}

export const PostCreator = ({ 
  onPostCreated, 
  placeholder = "Share your empire building journey, achievements, or thoughts...",
  maxLength = 500 
}: PostCreatorProps) => {
  const [content, setContent] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { isConnected, address } = useAccount()
  const { profile } = useProfile()
  const { username, hasProfile } = useProfileRegistry()
  const { createPost, isPending } = useSocial()

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]
      setSelectedImage(file)
      setImagePreviewUrl(URL.createObjectURL(file))
    } else {
      setSelectedImage(null)
      setImagePreviewUrl(null)
    }
  }

  const handleRemoveImage = () => {
    setSelectedImage(null)
    setImagePreviewUrl(null)
  }

  const handleSubmit = async () => {
    if (!content.trim() && !selectedImage) {
      toast.error('Please enter some content or select an image for your post')
      return
    }

    if (!isConnected) {
      toast.error('Please connect your wallet to post')
      return
    }

    setIsSubmitting(true)
    try {
      let mediaUrl: string | undefined = undefined
      if (selectedImage) {
        toast.info('Uploading image to IPFS...')
        mediaUrl = await uploadToIPFS(selectedImage)
        toast.success('Image uploaded to IPFS!')
      }

      // Pass mediaUrl to createPost. This will require updating useSocial.ts and SocialGraph.sol
      await createPost(content.trim(), mediaUrl) 
      setContent('')
      setSelectedImage(null)
      setImagePreviewUrl(null)
      onPostCreated?.()
      toast.success('Post created successfully!')
    } catch (error) {
      handleError(error, { component: 'PostCreator', action: 'Create post' })
      // Error handling is done in the hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const isDisabled = (!content.trim() && !selectedImage) || isSubmitting || isPending || !isConnected

  const displayName = username || profile?.username || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Anonymous')
  const avatarSrc = profile?.avatar_url

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* User Info */}
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarImage src={avatarSrc} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{displayName}</span>
                {hasProfile && (
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                    Verified Builder
                  </Badge>
                )}
              </div>

              {/* Post Input */}
              <div className="space-y-3">
                <Textarea
                  placeholder={placeholder}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={maxLength}
                  className="min-h-24 resize-none border-0 bg-muted/50 focus:bg-background transition-colors placeholder:text-muted-foreground/70"
                  disabled={isSubmitting || isPending}
                />
                
                {/* Image Preview */}
                {imagePreviewUrl && (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden border border-border/50">
                    <img src={imagePreviewUrl} alt="Image preview" className="w-full h-full object-cover" />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 bg-background/50 hover:bg-background/70 rounded-full"
                      onClick={handleRemoveImage}
                    >
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </div>
                )}

                {/* Character Count */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{content.length}/{maxLength} characters</span>
                  {content.length > maxLength * 0.9 && (
                    <span className="text-warning">
                      {maxLength - content.length} characters remaining
                    </span>
                  )}
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <Button variant="ghost" size="sm" asChild>
                        <>
                          <ImageIcon className="h-4 w-4 mr-1" />
                          Image
                          <Input 
                            id="image-upload" 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleImageChange} 
                            disabled={isSubmitting || isPending}
                          />
                        </>
                      </Button>
                    </label>
                    <Button variant="ghost" size="sm" disabled className="opacity-50">
                      <Hash className="h-4 w-4 mr-1" />
                      Tags
                      <Badge variant="secondary" className="ml-2 text-xs">Soon</Badge>
                    </Button>
                  </div>
                  
                  <Button 
                    onClick={handleSubmit}
                    disabled={isDisabled}
                    className="flex items-center gap-2 glow-primary"
                  >
                    {isSubmitting || isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isSubmitting ? 'Creating...' : isPending ? 'Confirming...' : 'Share Post'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Connection Status */}
          {!isConnected && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-center">
              <p className="text-sm text-warning">
                Connect your wallet to share posts with the community
              </p>
            </div>
          )}

          {/* Profile Suggestion */}
          {isConnected && !hasProfile && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
              <p className="text-sm text-primary">
                Set up your on-chain username in your profile to enhance your social presence
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}