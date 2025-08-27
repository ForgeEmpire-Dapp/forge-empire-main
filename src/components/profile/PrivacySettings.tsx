import { useState } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Shield, Eye, Users, Lock } from 'lucide-react'
import { toast } from 'sonner'

export const PrivacySettings = () => {
  const { profile, saveProfile, saving } = useProfile()
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>(
    profile?.visibility || 'public'
  )

  const handleSave = async () => {
    try {
      await saveProfile({ visibility })
      toast.success('Privacy settings updated successfully')
    } catch (error) {
      toast.error('Failed to update privacy settings')
    }
  }

  const visibilityOptions = [
    {
      value: 'public' as const,
      label: 'Public',
      description: 'Anyone with your profile link can view your profile',
      icon: Eye
    },
    {
      value: 'friends' as const,
      label: 'Friends Only',
      description: 'Only your connections can view your profile (coming soon)',
      icon: Users,
      disabled: true
    },
    {
      value: 'private' as const,
      label: 'Private',
      description: 'Only you can view your profile',
      icon: Lock
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Privacy Settings
        </CardTitle>
        <CardDescription>
          Control who can view your profile information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={visibility}
          onValueChange={(value) => setVisibility(value as 'public' | 'friends' | 'private')}
          className="space-y-4"
        >
          {visibilityOptions.map((option) => {
            const IconComponent = option.icon
            return (
              <div
                key={option.value}
                className={`flex items-start space-x-3 rounded-lg border p-4 transition-colors ${
                  option.disabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-accent cursor-pointer'
                }`}
              >
                <RadioGroupItem
                  value={option.value}
                  id={option.value}
                  disabled={option.disabled}
                />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor={option.value}
                    className={`flex items-center gap-2 font-medium ${
                      option.disabled ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <IconComponent className="h-4 w-4" />
                    {option.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </div>
            )
          })}
        </RadioGroup>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || visibility === profile?.visibility}
          >
            {saving ? 'Saving...' : 'Save Privacy Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}