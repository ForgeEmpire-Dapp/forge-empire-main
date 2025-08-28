import { Header } from "@/components/layout/Header"
import { HeroSection } from "@/components/layout/HeroSection"
import { EnhancedDashboard } from "@/components/dashboard/EnhancedDashboard"
import { FeatureGrid } from "@/components/features/FeatureGrid"
import { EnhancedQuestBoard } from "@/components/quests/EnhancedQuestBoard"
import { EnhancedDAOGovernance } from "@/components/dao/EnhancedDAOGovernance"
import { TokenForge } from "@/components/forge/TokenForge"
import { ProfileSection } from "@/components/profile/ProfileSection"
import { EnhancedOnboarding, useEnhancedOnboarding } from "@/components/onboarding/EnhancedOnboarding"
import { QuickActionsHub } from "@/components/dashboard/QuickActionsHub"
import { LiveActivityFeed } from "@/components/dashboard/LiveActivityFeed"
import { SecurityAlert } from "@/components/security/SecurityAlert"

const Index = () => {
  const { showOnboarding, closeOnboarding } = useEnhancedOnboarding()

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pb-16">
        <HeroSection />
        
        {/* Main Content Container */}
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Enhanced Dashboard Section */}
          <section id="dashboard" className="py-8">
            <div className="text-center mb-6 animate-fade-in">
              <h2 className="text-2xl font-bold mb-2">
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  Your Builder Dashboard
                </span>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Track your progress, complete challenges, and connect with the community
              </p>
            </div>
            <EnhancedDashboard />
          </section>
          </div>
       {/* Compact Footer */}
      <footer className="border-t border-border/40 py-8 bg-card/50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center space-x-3">
              <span className="font-bold text-lg bg-gradient-primary bg-clip-text text-transparent">
                Avax Forge Empire
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Building the future of decentralized communities on Avalanche
            </p>
            <div className="flex justify-center space-x-4 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Docs</a>
              <a href="#" className="hover:text-primary transition-colors">Discord</a>
              <a href="#" className="hover:text-primary transition-colors">Twitter</a>
              <a href="#" className="hover:text-primary transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
      </main>

      
      {/* Floating Components */}
      <SecurityAlert />
      <EnhancedOnboarding isOpen={showOnboarding} onClose={closeOnboarding} />
    </div>
  );
};

export default Index;
