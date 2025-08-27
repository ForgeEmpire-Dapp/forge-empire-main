import React from 'react'
import { Bell, Check, CheckCheck, Heart, Users, Trophy, Target, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDistanceToNow } from 'date-fns'
import { useNotifications, type Notification } from '@/hooks/useNotifications'

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
  switch (type) {
    case 'like':
      return <Heart className="h-4 w-4 text-destructive" />
    case 'follow':
      return <Users className="h-4 w-4 text-primary" />
    case 'achievement':
      return <Trophy className="h-4 w-4 text-accent" />
    case 'quest_complete':
      return <Target className="h-4 w-4 text-secondary" />
    case 'mention':
      return <Zap className="h-4 w-4 text-warning" />
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />
  }
}

const NotificationItem = ({ notification, onMarkAsRead }: {
  notification: Notification
  onMarkAsRead: (id: string) => void
}) => (
  <Card className={`mb-2 ${!notification.read ? 'ring-1 ring-primary/20' : ''}`}>
    <CardContent className="p-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <NotificationIcon type={notification.type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-medium">{notification.title}</h4>
              <p className="text-xs text-muted-foreground">{notification.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </p>
            </div>
            {!notification.read && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onMarkAsRead(notification.id)}
                className="h-6 w-6 p-0"
              >
                <Check className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
)

export const NotificationCenter = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-96">
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading notifications...</p>
              </div>
            ) : notifications.length > 0 ? (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                />
              ))
            ) : (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}