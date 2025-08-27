import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider } from 'wagmi';
import { config } from './config/web3';
import { AchievementSystem } from '@/components/achievements/AchievementSystem';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { Suspense } from 'react';
import { FeedSkeleton } from '@/components/ui/optimized-loading';
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Quests from "./pages/Quests";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Forge from "./pages/Forge";
import DAOPage from "./pages/DAO";
import Kudos from "./pages/Kudos";
import TipJar from "./pages/TipJar";
import Community from "./pages/Community";
import Marketplace from "./pages/Marketplace";
import Roadmap from "./pages/Roadmap";
import { Navigate } from "react-router-dom";
import Streaks from "./pages/Streaks";
import DynamicQuests from "./pages/DynamicQuests";
import Auth from "./pages/Auth";
import Portfolio from "./pages/Portfolio";
import Staking from "./pages/Staking";
import Leaderboard from "./pages/Leaderboard";
import Dashboard from "./pages/Dashboard";
import AIAssistant from "./pages/AIAssistant";
import AdminPage from "./pages/AdminPage";
import { ForgePassMinter } from "@/components/ForgePassMinter";
import { CommunityDAOComponent } from "@/components/CommunityDAO";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <ErrorBoundary>
              <AchievementSystem />
            </ErrorBoundary>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={
                  <ErrorBoundary>
                    <Index />
                  </ErrorBoundary>
                } />
                <Route path="/auth" element={<Auth />} />
                <Route path="/quests" element={
                  <ErrorBoundary>
                    <Suspense fallback={<FeedSkeleton />}>
                      <Quests />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/dynamic-quests" element={<DynamicQuests />} />
                {/* Social redirects to unified community hub */}
                <Route path="/social" element={<Navigate to="/community" replace />} />
                <Route path="/streaks" element={<Streaks />} />
                <Route path="/profile" element={
                  <ErrorBoundary>
                    <Profile />
                  </ErrorBoundary>
                } />
                <Route path="/profile/:address" element={<UserProfile />} />
                <Route path="/forge" element={<Forge />} />
                <Route path="/dao" element={<DAO />} />
                <Route path="/kudos" element={<Kudos />} />
                <Route path="/tip-jar" element={<TipJar />} />
                <Route path="/community" element={<Community />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/roadmap" element={<Roadmap />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/staking" element={<Staking />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/dashboard" element={
                  <ErrorBoundary>
                    <Dashboard />
                  </ErrorBoundary>
                } />
                <Route path="/ai-assistant" element={<AIAssistant />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/forge-pass" element={<ForgePassMinter />} />
                <Route path="/community-dao" element={<CommunityDAOComponent />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </ErrorBoundary>
);

export default App;
