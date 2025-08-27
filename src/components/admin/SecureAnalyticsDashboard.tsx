import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSecureAnalytics } from '@/hooks/useSecureAnalytics'
import { useAccount } from 'wagmi'
import { 
  Shield, 
  BarChart3, 
  Trash2,
  AlertTriangle,
  Check,
  User,
  Loader2
} from 'lucide-react'

export const SecureAnalyticsDashboard = () => {
  const { 
    userAnalytics, 
    isLoadingUserAnalytics,
    securityStatus,
    isLoadingStatus,
    refetchStatus,
    triggerCleanup 
  } = useSecureAnalytics()
  const { isConnected } = useAccount()
  const isAdmin = false // For now, disable admin features until proper role system is set up

  // Enable admin queries only if user is admin
  useEffect(() => {
    if (isAdmin && isConnected) {
      refetchStatus()
    }
  }, [isAdmin, isConnected, refetchStatus])

  const handleCleanup = async () => {
    await triggerCleanup()
  }

  return (
    <div className="space-y-6">
      {/* Security Status Header */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            Analytics Security Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-green-600 font-medium mb-1">
              <Check className="h-4 w-4" />
              Security Status: Enhanced
            </div>
            <p className="text-sm text-muted-foreground">
              Analytics data collection has been secured with automatic data minimization, 
              privacy-preserving anonymization, and strict access controls.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Status */}
        {isAdmin && (
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Analytics Security Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStatus ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading security status...</span>
                </div>
              ) : securityStatus ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <div className="text-2xl font-bold">{securityStatus.total_events}</div>
                      <div className="text-sm text-muted-foreground">Total Events</div>
                    </div>
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-500">{securityStatus.events_with_pii}</div>
                      <div className="text-sm text-muted-foreground">With PII</div>
                    </div>
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <div className="text-2xl font-bold text-green-500">{securityStatus.events_anonymized}</div>
                      <div className="text-sm text-muted-foreground">Anonymized</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                    <span>Retention Compliance</span>
                    <Badge variant={securityStatus.retention_compliance ? "default" : "destructive"}>
                      {securityStatus.retention_compliance ? "Compliant" : "Needs Cleanup"}
                    </Badge>
                  </div>
                  
                  <Button 
                    onClick={handleCleanup} 
                    className="w-full"
                    variant="outline"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Run Security Cleanup
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">Unable to load security status</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* User Analytics (for current user) */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Your Analytics Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingUserAnalytics ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading your analytics...</span>
              </div>
            ) : userAnalytics && userAnalytics.length > 0 ? (
              <div className="space-y-3">
                {userAnalytics.map((item) => (
                  <div key={item.event_name} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                    <div>
                      <span className="font-medium">{item.event_name}</span>
                      <div className="text-xs text-muted-foreground">
                        Last: {new Date(item.last_seen).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge variant="outline">{item.event_count} times</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No personal analytics data available</p>
            )}
          </CardContent>
        </Card>

        {/* Security Information */}
        <Card className="bg-gradient-card border-border/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Security Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-background/50 rounded-lg">
              <h4 className="font-medium mb-2">Data Protection Measures</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• User agents automatically simplified to prevent fingerprinting</li>
                <li>• URLs stripped of query parameters and fragments</li>
                <li>• Sensitive properties removed from event data</li>
                <li>• Automatic anonymization after 7 days</li>
                <li>• Complete data deletion after 90 days</li>
                <li>• Users can only access their own analytics data</li>
              </ul>
            </div>
            
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-blue-600 font-medium mb-1">
                <BarChart3 className="h-4 w-4" />
                Security Implementation
              </div>
              <p className="text-sm text-muted-foreground">
                This security fix implements comprehensive analytics protection including:
                row-level security policies, automatic data minimization triggers, 
                scheduled anonymization processes, and admin-only access controls.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}