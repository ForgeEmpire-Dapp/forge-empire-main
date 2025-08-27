import { useState } from 'react'
import { useAccount } from 'wagmi'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { secureLog } from '@/utils/secureLogger'

interface VerificationRequest {
  nonce: string
  message: string
  walletAddress: string
}

interface UseSecureWalletVerificationReturn {
  isVerifying: boolean
  requestVerification: (walletAddress: string) => Promise<VerificationRequest | null>
  confirmVerification: (verification: VerificationRequest, signature: string) => Promise<boolean>
}

export const useSecureWalletVerification = (): UseSecureWalletVerificationReturn => {
  const [isVerifying, setIsVerifying] = useState(false)
  const { isConnected } = useAccount()
  const { toast } = useToast()

  const requestVerification = async (walletAddress: string): Promise<VerificationRequest | null> => {
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      })
      return null
    }

    setIsVerifying(true)
    
    try {
      secureLog.info('Requesting wallet verification', { walletAddress })
      
      const { data, error } = await supabase.functions.invoke('verify-wallet/request', {
        body: { walletAddress }
      })

      if (error) {
        throw new Error(error.message)
      }

      secureLog.info('Verification request successful')
      
      return {
        nonce: data.nonce,
        message: data.message,
        walletAddress: data.walletAddress
      }
    } catch (error) {
      secureLog.error('Failed to request verification', error)
      toast({
        title: "Verification Request Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      })
      return null
    } finally {
      setIsVerifying(false)
    }
  }

  const confirmVerification = async (
    verification: VerificationRequest, 
    signature: string
  ): Promise<boolean> => {
    setIsVerifying(true)
    
    try {
      secureLog.info('Confirming wallet verification')
      
      const { data, error } = await supabase.functions.invoke('verify-wallet/confirm', {
        body: {
          walletAddress: verification.walletAddress,
          signature,
          nonce: verification.nonce
        }
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data?.success) {
        secureLog.info('Wallet verification confirmed successfully')
        toast({
          title: "Wallet Verified",
          description: "Your wallet has been successfully linked to your account",
        })
        return true
      } else {
        throw new Error(data?.error || 'Verification failed')
      }
    } catch (error) {
      secureLog.error('Failed to confirm verification', error)
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : 'Signature verification failed',
        variant: "destructive"
      })
      return false
    } finally {
      setIsVerifying(false)
    }
  }

  return {
    isVerifying,
    requestVerification,
    confirmVerification
  }
}