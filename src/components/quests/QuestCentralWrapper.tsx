import { Suspense } from 'react'
import { EnhancedQuestSystem } from './EnhancedQuestSystem'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'
import { ErrorBoundary } from '@/components/ui/error-boundary'

const QuestCentralLoading = () => (
  <div className="max-w-6xl mx-auto p-6">
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading Quest Central...</span>
        </div>
      </CardContent>
    </Card>
  </div>
)

const QuestCentralError = () => (
  <div className="max-w-6xl mx-auto p-6">
    <Card>
      <CardContent className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load Quest Central. Please refresh the page or try again later.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  </div>
)

export const QuestCentralWrapper = () => {
  return (
    <ErrorBoundary fallback={<QuestCentralError />}>
      <Suspense fallback={<QuestCentralLoading />}>
        <EnhancedQuestSystem />
      </Suspense>
    </ErrorBoundary>
  )
}