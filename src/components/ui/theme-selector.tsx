import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Sun, 
  Moon, 
  Monitor, 
  Palette,
  Check
} from 'lucide-react'
import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark' | 'system'

export const ThemeSelector = ({ className = '' }: { className?: string }) => {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme') as Theme || 'dark'
    setTheme(savedTheme)
    applyTheme(savedTheme)
  }, [])

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement
    
    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.className = systemTheme
    } else {
      root.className = newTheme
    }
  }

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  }

  if (!mounted) return null

  const themes: Array<{ id: Theme; label: string; icon: React.ComponentType }> = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-4 w-4" />
          Theme Preference
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {themes.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={theme === id ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleThemeChange(id)}
              className="flex flex-col gap-1 h-auto py-3 hover-scale"
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs">{label}</span>
              {theme === id && <Check className="h-3 w-3" />}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Color palette showcase for users to see the theme
export const ColorPalette = ({ className = '' }: { className?: string }) => {
  const colors = [
    { name: 'Primary', var: '--primary', desc: 'Main brand color' },
    { name: 'Secondary', var: '--secondary', desc: 'Secondary actions' },
    { name: 'Accent', var: '--accent', desc: 'Highlights & rewards' },
    { name: 'Success', var: '--success', desc: 'Success states' },
    { name: 'Warning', var: '--warning', desc: 'Warning states' },
    { name: 'Destructive', var: '--destructive', desc: 'Error states' },
  ]

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Color System</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {colors.map((color) => (
            <div key={color.name} className="space-y-2">
              <div 
                className="w-full h-12 rounded border hover-scale transition-transform"
                style={{ backgroundColor: `hsl(var(${color.var}))` }}
              />
              <div>
                <div className="font-medium text-sm">{color.name}</div>
                <div className="text-xs text-muted-foreground">{color.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}