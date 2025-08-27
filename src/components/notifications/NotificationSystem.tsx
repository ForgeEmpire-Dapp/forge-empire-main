import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Bell, Check, X, Trophy, Target, Users, Heart, Zap, Star } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { logger, logUserAction } from '@/utils/logger'

export interface Notification {
  id: string
  type: 'achievement' | 'quest_completed' | 'social' | 'system' | 'reward'
  title: string
  message: string
  timestamp: Date
  read: boolean
  actionUrl?: string
  metadata?: {
    xpEarned?: number
    badgeName?: string
    questTitle?: string
    userMention?: string
  }
}

const notificationIcons = {
  achievement: Trophy,
  quest_completed: Target,
  social: Users,
  system: Bell,
  reward: Star
}

const notificationColors = {
  achievement: 'text-accent',
  quest_completed: 'text-primary', 
  social: 'text-secondary',
  system: 'text-muted-foreground',
  reward: 'text-warning'
}

// Enhanced notification storage with persistence
const NOTIFICATIONS_KEY = 'avax-forge-notifications'

const loadNotifications = (): Notification[] => {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed.map((n: Notification) => ({
        ...n,
        timestamp: new Date(n.timestamp)
      }))
    }
  } catch (error) {
    logger.error('Failed to load notifications', { error: error instanceof Error ? error.message : 'Unknown error' })
  }
  return []
}

const saveNotifications = (notifications: Notification[]) => {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications))
  } catch (error) {
    logger.error('Failed to save notifications', { error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

// Mock notification generator for demo
const generateMockNotification = (): Notification => {
  const types: Notification['type'][] = ['achievement', 'quest_completed', 'social', 'reward']
  const type = types[Math.floor(Math.random() * types.length)]
  
  const notifications = {
    achievement: {
      title: 'Achievement Unlocked!',
      message: 'You earned the "Community Builder" badge',
      metadata: { badgeName: 'Community Builder' }
    },
    quest_completed: {
      title: 'Quest Complete!',
      message: 'You completed "DeFi Basics" and earned 200 XP',
      metadata: { xpEarned: 200, questTitle: 'DeFi Basics' }
    },
    social: {
      title: 'New Follower',
      message: 'CryptoBuilder started following you',
      metadata: { userMention: 'CryptoBuilder' }
    },
    reward: {
      title: 'Daily Bonus!',
      message: 'You earned 50 XP for daily login streak',
      metadata: { xpEarned: 50 }
    }
  }
  
  return {
    id: `notif-${Date.now()}-${Math.random()}`,
    type,
    ...notifications[type],
    timestamp: new Date(),
    read: false,
    actionUrl: type === 'achievement' ? '/profile' : type === 'quest_completed' ? '/quests' : '/social'
  }
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const { isConnected } = useAccount()

  useEffect(() => {
    setNotifications(loadNotifications())
  }, [])

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      read: false
    }
    
    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, 50) // Keep max 50 notifications
      saveNotifications(updated)
      return updated
    })

    // Show toast notification
    toast(notification.title, {
      description: notification.message,
      action: notification.actionUrl ? {
        label: 'View',
        onClick: () => window.location.href = notification.actionUrl!
      } : undefined
    })
  }, [])

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n)
      saveNotifications(updated)
      return updated
    })
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }))
      saveNotifications(updated)
      return updated
    })
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id)
      saveNotifications(updated)
      return updated
    })
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    localStorage.removeItem(NOTIFICATIONS_KEY)
  }, [])

  // Demo: Add random notifications when connected (only in development)
  useEffect(() => {
    if (!isConnected) return

    // Only run this simulation in development environment
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        if (Math.random() < 0.3) { // 30% chance every 30 seconds
          const mockNotif = generateMockNotification()
          addNotification(mockNotif)
        }
      }, 30000)

      return () => clearInterval(interval)
    }
    return undefined // Return undefined if not in development
  }, [isConnected, addNotification])

  const unreadCount = notifications.filter(n => !n.read).length

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll
  }
}

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onRemove: (id: string) => void
}

export const NotificationItem = ({ notification, onMarkAsRead, onRemove }: NotificationItemProps) => {
  const Icon = notificationIcons[notification.type]
  const colorClass = notificationColors[notification.type]

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id)
    }
  }

  return (
    <Card className={`group hover:shadow-md transition-all ${
      !notification.read ? 'ring-2 ring-primary/20 bg-primary/5' : 'bg-background'
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full bg-background ${colorClass}`}>
            <Icon className="h-4 w-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className={`font-semibold text-sm ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                {notification.title}
              </h4>
              <div className="flex items-center gap-1">
                {!notification.read && (
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(notification.id)
                  }}
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">
              {notification.message}
            </p>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
              </span>
              
              <div className="flex items-center gap-2">
                {notification.metadata?.xpEarned && (
                  <Badge variant="outline" className="text-xs">
                    +{notification.metadata.xpEarned} XP
                  </Badge>
                )}
                {notification.actionUrl && (
                  <Button variant="ghost" size="sm" asChild onClick={handleClick}>
                    <Link to={notification.actionUrl} className="text-xs">
                      View
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface NotificationBellProps {
  notifications: Notification[]
  unreadCount: number
  onMarkAllAsRead: () => void
  onClearAll: () => void
}

export const NotificationBell = ({ 
  notifications, 
  unreadCount, 
  onMarkAllAsRead, 
  onClearAll 
}: NotificationBellProps) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs animate-bounce-gentle"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-background border rounded-lg shadow-lg z-50 animate-fade-in">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Notifications</h3>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={onMarkAllAsRead}>
                    <Check className="h-3 w-3 mr-1" />
                    Mark All Read
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={onClearAll}>
                  Clear All
                </Button>
              </div>
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto p-2 space-y-2">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 10).map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={() => {}}
                  onRemove={() => {}}
                />
              ))
            )}
          </div>
          
          {notifications.length > 10 && (
            <div className="p-3 border-t text-center">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/notifications">View All Notifications</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}