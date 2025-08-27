import { PageLayout } from '@/components/layout/PageLayout'
import { QuestCentralWrapper } from '@/components/quests/QuestCentralWrapper'
import { PageTransition } from '@/components/ui/page-transitions'

const QuestsPage = () => {
  return (
    <PageTransition>
      <PageLayout 
        title="Quest Central"
        description="Complete engaging challenges, earn XP and rewards, and unlock new opportunities"
      >
        <QuestCentralWrapper />
      </PageLayout>
    </PageTransition>
  )
}

export default QuestsPage
