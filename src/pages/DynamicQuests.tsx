import { PageLayout } from '@/components/layout/PageLayout'
import { ComingSoonEmpty } from '@/components/states/EmptyStates'

const DynamicQuestsPage = () => {
  return (
    <PageLayout 
      title="AI-Powered Dynamic Quests"
      description="Experience personalized, AI-generated quests tailored to your activity and progress in the ecosystem."
    >
      <ComingSoonEmpty feature="Dynamic Quest Engine" />
    </PageLayout>
  )
}

export default DynamicQuestsPage