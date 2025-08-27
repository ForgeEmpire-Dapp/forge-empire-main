import { useState, useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Lock,
  UserCheck,
  Database,
  Zap
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAccount } from 'wagmi'

export const SecurityAlert = () => {
  const [showAlert, setShowAlert] = useState(false)
  const { isAuthenticated } = useAuth()
  const { isConnected } = useAccount()

  useEffect(() => {
    // Show security alert if user has connected wallet but not authenticated
    const hasSeenSecurityAlert = localStorage.getItem('security-alert-seen')
    
    if (isConnected && !isAuthenticated && !hasSeenSecurityAlert) {
      setShowAlert(true)
    }
  }, [isConnected, isAuthenticated])

  const handleDismiss = () => {
    setShowAlert(false)
    localStorage.setItem('security-alert-seen', 'true')
  }

  if (!showAlert) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl mx-auto animate-scale-in shadow-2xl border-2 border-warning/20">
        <CardHeader className="relative bg-gradient-to-r from-warning/10 to-success/10 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-warning to-success rounded-full flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <AlertTitle className="text-xl font-bold">🔒 Security Enhancement Complete!</AlertTitle>
                <p className="text-muted-foreground mt-1">
                  Your profile data is now fully protected with advanced security
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* Security Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <div className="font-semibold text-sm">Profile Security</div>
                <div className="text-xs text-muted-foreground">Protected by RLS</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
              <Database className="h-5 w-5 text-success" />
              <div>
                <div className="font-semibold text-sm">Data Integrity</div>
                <div className="text-xs text-muted-foreground">Authenticated access</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-warning/10 rounded-lg border border-warning/20">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div>
                <div className="font-semibold text-sm">Action Required</div>
                <div className="text-xs text-muted-foreground">Complete setup</div>
              </div>
            </div>
          </div>

          {/* What Changed */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Security Improvements Made:
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
                <div>
                  <div className="font-medium">Row-Level Security (RLS) Enabled</div>
                  <div className="text-sm text-muted-foreground">
                    Users can now only modify their own profiles, preventing unauthorized access
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
                <div>
                  <div className="font-medium">Authentication Integration</div>
                  <div className="text-sm text-muted-foreground">
                    Wallet connections now linked to secure user accounts
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
                <div>
                  <div className="font-medium">Data Protection</div>
                  <div className="text-sm text-muted-foreground">
                    Profile creation and updates require proper authentication
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <Alert className="border-primary/20 bg-primary/5">
            <UserCheck className="h-4 w-4" />
            <AlertTitle>Complete Your Secure Setup</AlertTitle>
            <AlertDescription className="mt-2">
              To ensure full security and access to all features, please create a secure account 
              that will be linked to your wallet. This is a one-time setup that greatly enhances 
              your profile protection.
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="flex-1 bg-gradient-primary hover:opacity-90">
              <Link to="/auth" onClick={handleDismiss}>
                <Lock className="h-4 w-4 mr-2" />
                Secure My Account Now
              </Link>
            </Button>
            
            <Button variant="outline" onClick={handleDismiss} className="flex-1">
              Continue Without Authentication
            </Button>
          </div>

          {/* Security Notice */}
          <div className="text-xs text-muted-foreground text-center p-3 bg-muted/50 rounded-lg">
            <strong>Note:</strong> Without authentication, you'll only be able to view profiles but cannot 
            create or modify your own profile data. This change was implemented to protect all users 
            from potential security vulnerabilities.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}