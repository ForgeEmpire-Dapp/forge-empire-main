import { useEffect } from 'react'
import { useAccount } from 'wagmi'
import { triggerAchievement } from '@/components/achievements/AchievementSystem'

export const useWalletAchievements = () => {
  const { isConnected, address } = useAccount()

  useEffect(() => {
    if (isConnected && address) {
      // Check if this is the first time connecting
      const hasConnectedBefore = localStorage.getItem(`wallet-connected-${address}`)
      
      if (!hasConnectedBefore) {
        // Trigger first connection achievement
        setTimeout(() => {
          triggerAchievement('first-connection')
        }, 1000)
        
        localStorage.setItem(`wallet-connected-${address}`, 'true')
      }
    }
  }, [isConnected, address])
}