import { useState, useEffect, createContext, useContext } from 'react'
import { User, Session, AuthError, UserResponse } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { useAccount } from 'wagmi'
import { useToast } from '@/hooks/use-toast'
import { logger, logUserAction } from '@/utils/logger'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  linkWalletToUser: (walletAddress: string) => Promise<{ error?: AuthError | null; data?: UserResponse | null }>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const useAuthProvider = () => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const { address } = useAccount()
  const { toast } = useToast()

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        
        // Auto-linking disabled for security
        
        setLoading(false)
      }
    )

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // NOTE: Auto-linking removed for security - use secure verification flow instead
  // Users must now explicitly verify wallet ownership before linking

  const signUp = async (email: string, password: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      })
      
      if (error) {
        toast({
          title: 'Sign Up Error',
          description: error.message,
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Success!',
          description: 'Please check your email to confirm your account.'
        })
      }
      
      return { error }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Sign up failed', { error: errorMessage })
      return { error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        toast({
          title: 'Sign In Error',
          description: error.message,
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Welcome back!',
          description: 'You have been signed in successfully.'
        })
      }
      
      return { error }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Sign in failed', { error: errorMessage })
      return { error }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        toast({
          title: 'Sign Out Error',
          description: error.message,
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Signed Out',
          description: 'You have been signed out successfully.'
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Sign out failed', { error: errorMessage })
      toast({
        title: 'Error',
        description: 'An error occurred while signing out.',
        variant: 'destructive'
      })
    }
  }

  // DEPRECATED: Direct wallet linking without verification is a security risk
  // Use useSecureWalletVerification hook instead
  const linkWalletToUser = async (walletAddress: string) => {
    logger.warn('Direct wallet linking is deprecated. Use secure verification flow.')
    toast({
      title: "Security Notice",
      description: "Please use the secure wallet verification process",
      variant: "destructive"
    })
    return { error: { message: 'Use secure verification flow' } }
  }

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    linkWalletToUser,
    isAuthenticated: !!user
  }
}

export { AuthContext }