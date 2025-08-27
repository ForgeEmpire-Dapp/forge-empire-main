import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock,
  Users,
  MessageSquare,
  Shield,
  Zap,
  Database,
  Globe,
  Activity
} from 'lucide-react'

interface StatusItem {
  name: string
  status: 'working' | 'partial' | 'broken' | 'planned'
  description: string
  icon: React.ReactNode
}

const StatusIcon = ({ status }: { status: StatusItem['status'] }) => {
  switch (status) {
    case 'working':
      return <CheckCircle className="h-4 w-4 text-success" />
    case 'partial':
      return <AlertTriangle className="h-4 w-4 text-warning" />
    case 'broken':
      return <XCircle className="h-4 w-4 text-destructive" />
    case 'planned':
      return <Clock className="h-4 w-4 text-muted-foreground" />
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />
  }
}

const statusItems: StatusItem[] = [
  // Core Features - Working
  {
    name: 'Social Feed System',
    status: 'working',
    description: 'Global feed, personal feed, post creation, likes, shares - all functional',
    icon: <MessageSquare className="h-4 w-4" />
  },
  {
    name: 'User Profiles',
    status: 'working',
    description: 'Profile creation, editing, viewing, with avatar and banner support',
    icon: <Users className="h-4 w-4" />
  },
  {
    name: 'Wallet Integration',
    status: 'working',
    description: 'MetaMask connection, Avalanche Fuji testnet, contract interactions',
    icon: <Zap className="h-4 w-4" />
  },
  {
    name: 'Real-time Updates',
    status: 'working',
    description: 'Contract event listening, live feed updates, notification system',
    icon: <Activity className="h-4 w-4" />
  },

  // Core Features - Partial
  {
    name: 'Enhanced Analytics',
    status: 'working',
    description: 'User behavior tracking, performance monitoring, Supabase storage',
    icon: <Database className="h-4 w-4" />
  },
  {
    name: 'Notification Center',
    status: 'working',
    description: 'Real-time notifications, read/unread status, notification types',
    icon: <Shield className="h-4 w-4" />
  },
  {
    name: 'Enhanced Trending',
    status: 'working',
    description: 'Improved trending algorithm with engagement scoring and time decay',
    icon: <Globe className="h-4 w-4" />
  },

  // Security - Partial
  {
    name: 'Supabase Security',
    status: 'partial',
    description: 'RLS policies working, but OTP expiry and password protection need manual config',
    icon: <Shield className="h-4 w-4" />
  },

  // Planned Features
  {
    name: 'Media Uploads',
    status: 'planned',
    description: 'Image and video upload support for posts and profiles',
    icon: <MessageSquare className="h-4 w-4" />
  },
  {
    name: 'Search & Discovery',
    status: 'planned',
    description: 'User and post search, hashtags, trending topics',
    icon: <Globe className="h-4 w-4" />
  },
]

const getStatusColor = (status: StatusItem['status']) => {
  switch (status) {
    case 'working': return 'bg-success/10 text-success border-success/20'
    case 'partial': return 'bg-warning/10 text-warning border-warning/20'
    case 'broken': return 'bg-destructive/10 text-destructive border-destructive/20'
    case 'planned': return 'bg-muted/10 text-muted-foreground border-muted/20'
    default: return 'bg-muted/10 text-muted-foreground border-muted/20'
  }
}

const getStatusLabel = (status: StatusItem['status']) => {
  switch (status) {
    case 'working': return 'Fully Working'
    case 'partial': return 'Partially Working'
    case 'broken': return 'Needs Fixing'
    case 'planned': return 'Planned Feature'
    default: return 'Unknown'
  }
}

export const ProjectStatusDashboard = () => {
  const workingCount = statusItems.filter(item => item.status === 'working').length
  const partialCount = statusItems.filter(item => item.status === 'partial').length
  const brokenCount = statusItems.filter(item => item.status === 'broken').length
  const plannedCount = statusItems.filter(item => item.status === 'planned').length
  
  const totalImplemented = workingCount + partialCount
  const totalPlanned = statusItems.length
  const completionPercentage = (workingCount / totalPlanned) * 100

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-card border-success/20">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-success" />
            <div className="text-2xl font-bold">{workingCount}</div>
            <p className="text-sm text-muted-foreground">Fully Working</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-card border-warning/20">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-warning" />
            <div className="text-2xl font-bold">{partialCount}</div>
            <p className="text-sm text-muted-foreground">Partially Working</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-card border-destructive/20">
          <CardContent className="p-4 text-center">
            <XCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <div className="text-2xl font-bold">{brokenCount}</div>
            <p className="text-sm text-muted-foreground">Needs Fixing</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-card border-muted/20">
          <CardContent className="p-4 text-center">
            <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">{plannedCount}</div>
            <p className="text-sm text-muted-foreground">Planned Features</p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle>Project Completion Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{Math.round(completionPercentage)}% Complete</span>
            </div>
            <Progress value={completionPercentage} className="h-3" />
            <div className="text-sm text-muted-foreground">
              {workingCount} of {totalPlanned} features fully implemented
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Status List */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle>Feature Status Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {statusItems.map((item, index) => (
              <div key={index} className="flex items-start gap-4 p-4 rounded-lg border border-border/50">
                <div className="flex-shrink-0 mt-1">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{item.name}</h4>
                    <StatusIcon status={item.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                  <Badge variant="outline" className={getStatusColor(item.status)}>
                    {getStatusLabel(item.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card className="bg-gradient-card border-primary/20">
        <CardHeader>
          <CardTitle className="text-primary">🎯 Immediate Action Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-warning" />
              <span className="text-sm">
                <strong>Security Config:</strong> Configure OTP expiry and password protection in Supabase dashboard
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-sm">
                <strong>Environment Setup:</strong> Move contract addresses to environment variables
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-secondary" />
              <span className="text-sm">
                <strong>Performance:</strong> Implement data caching and optimize query performance
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}