import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Copy, Share, Twitter, ExternalLink } from 'lucide-react'

interface ProfileShareProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  address?: string
  username?: string
}

export const ProfileShare = ({ open, onOpenChange, address, username }: ProfileShareProps) => {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  // Don't render if no address
  if (!address) {
    return null
  }

  const profileUrl = `${window.location.origin}/profile/${address}`
  const displayName = username || `User ${address.slice(0, 6)}...${address.slice(-4)}`

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl)
      setCopied(true)
      toast({
        title: 'Copied!',
        description: 'Profile link copied to clipboard'
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive'
      })
    }
  }

  const shareOnTwitter = () => {
    const text = `Check out my profile on Avax Forge Empire! 🚀`
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(profileUrl)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const openProfile = () => {
    window.open(profileUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share className="w-5 h-5" />
            Share Profile
          </DialogTitle>
          <DialogDescription>
            Share your Avax Forge Empire profile with others
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Profile URL */}
          <div className="space-y-2">
            <Label htmlFor="profile-url">Profile URL</Label>
            <div className="flex gap-2">
              <Input
                id="profile-url"
                value={profileUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="px-3"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Quick Share Options */}
          <div className="space-y-3">
            <Label>Quick Share</Label>
            <div className="grid grid-cols-1 gap-2">
              <Button
                variant="outline"
                onClick={shareOnTwitter}
                className="justify-start"
              >
                <Twitter className="w-4 h-4 mr-2" />
                Share on Twitter
              </Button>
              <Button
                variant="outline"
                onClick={openProfile}
                className="justify-start"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Profile
              </Button>
            </div>
          </div>

          {/* Profile Info */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Sharing profile for:</div>
            <div className="font-semibold">{displayName}</div>
            <div className="text-xs text-muted-foreground font-mono">
              {address.slice(0, 8)}...{address.slice(-6)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}