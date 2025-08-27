import { Button } from '@/components/ui/button'

interface QuickActionsProps {
  isConnected: boolean
  handleQuickAction: (action: string) => void
}

export const QuickActions = ({ isConnected, handleQuickAction }: QuickActionsProps) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleQuickAction('stats')}
        disabled={!isConnected}
      >
        My Stats
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleQuickAction('quests')}
        disabled={!isConnected}
      >
        Quests
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleQuickAction('badges')}
        disabled={!isConnected}
      >
        Badges
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleQuickAction('staking')}
        disabled={!isConnected}
      >
        Staking
      </Button>
    </div>
  )
}
