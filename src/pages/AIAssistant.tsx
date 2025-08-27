import { PageLayout } from '@/components/layout/PageLayout'
import { VoiceChatWidget } from '@/components/ai/VoiceChatWidget'
import { Card, CardContent } from '@/components/ui/card'
import { Bot } from 'lucide-react'
import { useAccount } from 'wagmi'

const AIAssistantPage = () => {
  const { isConnected } = useAccount()

  return (
    <PageLayout 
      title="AI Assistant"
      description="Get personalized help with quests, learn about features, and navigate the Avax Forge Empire ecosystem with AI-powered assistance."
    >
      {!isConnected ? (
        <Card className="bg-gradient-card border-border/50 animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bot className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Connect your wallet to get personalized assistance and access all AI features.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="max-w-4xl mx-auto">
          {/* <VoiceChatWidget className="w-full" /> */}
          
          {/* AI Features Overview */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  Voice Chat
                </h3>
                <p className="text-muted-foreground text-sm">
                  Talk directly with your AI assistant using natural speech. Get instant answers to questions about the platform, your progress, and available opportunities.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-secondary" />
                  Smart Insights
                </h3>
                <p className="text-muted-foreground text-sm">
                  Get personalized recommendations for quests, optimal strategies for earning rewards, and insights about your performance compared to the community.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-accent" />
                  Real-time Help
                </h3>
                <p className="text-muted-foreground text-sm">
                  Get instant explanations of complex DeFi concepts, tokenomics, and platform features. Perfect for both beginners and experienced users.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-success" />
                  Progress Tracking
                </h3>
                <p className="text-muted-foreground text-sm">
                  Ask about your current stats, recent achievements, upcoming milestones, and how to optimize your journey in the Avax Forge Empire.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

export default AIAssistantPage