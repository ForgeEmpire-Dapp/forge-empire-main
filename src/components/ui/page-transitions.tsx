import { ReactNode, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface PageTransitionProps {
  children: ReactNode
  className?: string
}

export const PageTransition = ({ children, className }: PageTransitionProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setIsVisible(false)
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [location.pathname])

  return (
    <div
      className={cn(
        'transition-all duration-300 ease-out',
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-4',
        className
      )}
    >
      {children}
    </div>
  )
}

interface RouteWrapperProps {
  children: ReactNode
}

export const RouteWrapper = ({ children }: RouteWrapperProps) => {
  return (
    <PageTransition>
      {children}
    </PageTransition>
  )
}