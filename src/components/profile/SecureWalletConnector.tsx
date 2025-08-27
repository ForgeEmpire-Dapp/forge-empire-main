import { useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield, CheckCircle, AlertTriangle } from 'lucide-react'
import { VerificationRequest, useSecureWalletVerification } from '@/hooks/useSecureWalletVerification'
import { secureLog } from '@/utils/secureLogger'

export const SecureWalletConnector = () => {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { isVerifying, requestVerification, confirmVerification } = useSecureWalletVerification()
  const [verificationStep, setVerificationStep] = useState<'initial' | 'pending' | 'complete'>('initial')
  const [verificationData, setVerificationData] = useState<VerificationRequest | null>(null)

  const handleVerifyWallet = async () => {
    if (!address || !isConnected) {
      return
    }

    try {
      setVerificationStep('pending')
      
      // Step 1: Request verification challenge
      const verification = await requestVerification(address)
      if (!verification) {
        setVerificationStep('initial')
        return
      }

      setVerificationData(verification)
      
      // Step 2: Sign the message
      secureLog.info('Requesting signature for wallet verification')
      const signature = await signMessageAsync({
        account: address,
        message: verification.message
      })

      // Step 3: Confirm verification with signature
      const success = await confirmVerification(verification, signature)
      
      if (success) {
        setVerificationStep('complete')
        secureLog.info('Wallet verification completed successfully')
      } else {
        setVerificationStep('initial')
      }
    } catch (error) {
      secureLog.error('Wallet verification failed', error)
      setVerificationStep('initial')
    }
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Secure Wallet Connection
          </CardTitle>
          <CardDescription>
            Connect your wallet to securely link it to your profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet first to proceed with verification
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (verificationStep === 'complete') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            Wallet Verified
          </CardTitle>
          <CardDescription>
            Your wallet has been securely linked to your profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Verified Address: {address}
            </p>
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Your wallet is now securely linked and verified. You can access all platform features.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Verify Wallet Ownership
        </CardTitle>
        <CardDescription>
          Prove ownership of your wallet by signing a verification message
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            This process ensures only you can link this wallet to your account. 
            You'll be asked to sign a message to prove ownership.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <p className="text-sm font-medium">Wallet Address:</p>
          <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
            {address}
          </p>
        </div>

        {verificationStep === 'pending' && verificationData && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Verification Message:</p>
            <pre className="text-xs bg-muted p-3 rounded whitespace-pre-wrap">
              {verificationData.message}
            </pre>
          </div>
        )}

        <Button 
          onClick={handleVerifyWallet}
          disabled={isVerifying || verificationStep === 'pending'}
          className="w-full"
        >
          {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {verificationStep === 'initial' && 'Verify Wallet Ownership'}
          {verificationStep === 'pending' && 'Complete Signature to Verify'}
        </Button>

        {verificationStep === 'pending' && (
          <Alert>
            <AlertDescription>
              Please check your wallet for a signature request and sign the message to complete verification.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}