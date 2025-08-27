import { useState, useEffect, useCallback } from 'react'
import { logComponentError } from '@/utils/secureLogger'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, AlertTriangle, Clock, Users, Database } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface SecurityStats {
  active_verifications: number
  expired_unverified: number
  verified_with_sensitive_data: number
  old_audit_logs: number
  locked_accounts: number
}

interface CleanupResult {
  expired_deleted: number
  anonymized_count: number
  old_verified_deleted: number
  cleanup_timestamp: string
}

export const SecurityMonitoring = () => {
  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [lastCleanup, setLastCleanup] = useState<CleanupResult | null>(null)
  const { toast } = useToast()

  const fetchSecurityStats = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_verification_security_stats')
      if (error) throw error
      
      if (data && data.length > 0) {
        setStats(data[0])
      }
    } catch (error: unknown) {
      logComponentError('SecurityMonitoring', 'Fetch security stats', error)
      toast({
        title: 'Error fetching security stats',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const runSecurityCleanup = async () => {
    setCleanupLoading(true)
    try {
      // Call the security cleanup edge function
      const { data, error } = await supabase.functions.invoke('security-cleanup')
      
      if (error) throw error
      
      setLastCleanup(data.cleanup_result)
      toast({
        title: 'Security cleanup completed',
        description: `Cleaned up ${data.cleanup_result.expired_deleted} expired records and anonymized ${data.cleanup_result.anonymized_count} sensitive records.`
      })
      
      // Refresh stats after cleanup
      await fetchSecurityStats()
    } catch (error: unknown) {
      logComponentError('SecurityMonitoring', 'Security cleanup', error)
      toast({
        title: 'Security cleanup failed',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setCleanupLoading(false)
    }
  }

  useEffect(() => {
    fetchSecurityStats()
  }, [fetchSecurityStats])

  const getStatusColor = (value: number, warningThreshold: number) => {
    if (value === 0) return 'text-muted-foreground'
    if (value < warningThreshold) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Security Monitoring</h2>
          <p className="text-muted-foreground">
            Monitor and manage wallet verification security
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={fetchSecurityStats} 
            disabled={loading}
            variant="outline"
          >
            <Shield className="w-4 h-4 mr-2" />
            {loading ? 'Refreshing...' : 'Refresh Stats'}
          </Button>
          <Button 
            onClick={runSecurityCleanup} 
            disabled={cleanupLoading}
            variant="default"
          >
            <Database className="w-4 h-4 mr-2" />
            {cleanupLoading ? 'Cleaning...' : 'Run Cleanup'}
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Verifications
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active_verifications}</div>
              <p className="text-xs text-muted-foreground">
                Currently pending verification
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Expired Unverified
              </CardTitle>
              <AlertTriangle className={`h-4 w-4 ${getStatusColor(stats.expired_unverified, 10)}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getStatusColor(stats.expired_unverified, 10)}`}>
                {stats.expired_unverified}
              </div>
              <p className="text-xs text-muted-foreground">
                Should be cleaned up
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Sensitive Data Records
              </CardTitle>
              <AlertTriangle className={`h-4 w-4 ${getStatusColor(stats.verified_with_sensitive_data, 5)}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getStatusColor(stats.verified_with_sensitive_data, 5)}`}>
                {stats.verified_with_sensitive_data}
              </div>
              <p className="text-xs text-muted-foreground">
                Contains nonces/IP data
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Old Audit Logs
              </CardTitle>
              <Database className={`h-4 w-4 ${getStatusColor(stats.old_audit_logs, 100)}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getStatusColor(stats.old_audit_logs, 100)}`}>
                {stats.old_audit_logs}
              </div>
              <p className="text-xs text-muted-foreground">
                Logs older than 90 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Locked Accounts
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.locked_accounts}</div>
              <p className="text-xs text-muted-foreground">
                Currently locked
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {lastCleanup && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Last Cleanup Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {lastCleanup.expired_deleted}
                </div>
                <p className="text-sm text-muted-foreground">Expired records deleted</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {lastCleanup.anonymized_count}
                </div>
                <p className="text-sm text-muted-foreground">Records anonymized</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {lastCleanup.old_verified_deleted}
                </div>
                <p className="text-sm text-muted-foreground">Old verified deleted</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Last run: {new Date(lastCleanup.cleanup_timestamp).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Automated Cleanup</p>
              <p className="text-sm text-muted-foreground">
                Run the security cleanup function regularly to remove expired verifications and anonymize sensitive data.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium">Monitor Sensitive Data</p>
              <p className="text-sm text-muted-foreground">
                Keep the number of records with sensitive data (nonces, IP addresses) as low as possible.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Database className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium">Schedule Regular Maintenance</p>
              <p className="text-sm text-muted-foreground">
                Set up a cron job or scheduled task to call the security-cleanup edge function daily.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}