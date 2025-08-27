import { useState, useEffect } from 'react'

/**
 * Hook to track if the current tab is active/visible
 * Used for optimizing data refetching strategies
 */
export const useActiveTabRefetch = () => {
  const [isActiveTab, setIsActiveTab] = useState(!document.hidden)

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsActiveTab(!document.hidden)
    }

    const handleFocus = () => setIsActiveTab(true)
    const handleBlur = () => setIsActiveTab(false)

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return isActiveTab
}