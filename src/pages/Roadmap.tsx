import { useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Circle, Clock, ArrowRight } from 'lucide-react'

const RoadmapPage = () => {
  useEffect(() => {
    document.title = 'Roadmap | Avax Forge Empire'
  }, [])

  const phases = [
    {
      phase: "Phase 1",
      title: "Foundation & Core Loop",
      status: "complete",
      timeline: "Complete",
      description: "Deployed: XPEngine, BadgeMinter, ProfileRegistry, OnboardingQuests.",
      features: [
        "XPEngine - Core gamification layer",
        "BadgeMinter - Achievement system",
        "ProfileRegistry - On-chain identity",
        "OnboardingQuests - User journey"
      ]
    },
    {
      phase: "Phase 2", 
      title: "Engagement & Social Expansion",
      status: "current",
      timeline: "Q4 2025",
      description: "Launch: SocialGraph, QuestRegistry, StreakSystem.",
      features: [
        "SocialGraph - Follow system & content",
        "QuestRegistry - Dynamic quest system", 
        "StreakSystem - Daily engagement rewards",
        "Enhanced social interactions"
      ]
    },
    {
      phase: "Phase 3",
      title: "Monetization & DeFi",
      status: "upcoming",
      timeline: "Q1 2026", 
      description: "Launch: $FORGE Token, StakingRewards, ForgePass.",
      features: [
        "$FORGE Token - Native utility token",
        "StakingRewards - Yield generation",
        "ForgePass - Premium NFT access",
        "Token economics implementation"
      ]
    },
    {
      phase: "Phase 4",
      title: "Full Decentralization & Governance",
      status: "future",
      timeline: "Q2 2026",
      description: "Launch: CommunityDAO, Marketplace, Guilds.",
      features: [
        "CommunityDAO - Governance system",
        "Marketplace - Trading platform",
        "Guilds - Community organizations", 
        "Complete decentralization"
      ]
    }
  ]

  const pillars = [
    {
      title: "Identity & Reputation",
      description: "Create and manage unique on-chain identities with meaningful progression",
      components: ["ProfileRegistry", "XPEngine", "BadgeMinter"]
    },
    {
      title: "Engagement & Socialization", 
      description: "Build networks and foster positive community interactions",
      components: ["SocialGraph", "Kudos", "TipJar"]
    },
    {
      title: "Play & Earn (GameFi)",
      description: "Personalized quests and challenges that reward active participation",
      components: ["QuestRegistry", "DynamicQuestEngine", "StreakSystem", "SeasonalEvents"]
    },
    {
      title: "Invest & Govern (DeFi)",
      description: "Decentralized finance features with community governance",
      components: ["ForgeTokenCore", "StakingRewards", "CommunityDAO", "ForgePass"]
    }
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-success" />
      case 'current':
        return <Circle className="w-5 h-5 text-accent fill-current" />
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <Badge variant="secondary" className="bg-success/20 text-success border-success/30">✅ Complete</Badge>
      case 'current':
        return <Badge variant="secondary" className="bg-accent/20 text-accent border-accent/30">▶️ Current</Badge>
      default:
        return <Badge variant="outline" className="border-muted-foreground/30">⏳ Upcoming</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-10 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Avax Forge Empire Roadmap
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Building the premier SocialFi and GameFi destination on Avalanche
            </p>
          </div>
        </div>

        {/* Project Overview */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-center">Project Overview</h2>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-8">
              <p className="text-lg leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Avax Forge Empire</strong> is a comprehensive and ambitious project designed to be a unified, gamified social hub on the Avalanche blockchain. It aims to address the fragmentation, high barrier to entry, and lack of user retention prevalent in the current Web3 landscape by seamlessly integrating <strong className="text-primary">SocialFi</strong>, <strong className="text-secondary">GameFi</strong>, and <strong className="text-accent">DeFi</strong> into a single, cohesive ecosystem.
              </p>
              <p className="text-lg leading-relaxed text-muted-foreground mt-4">
                The project's vision is to build a <strong className="text-foreground">"digital nation"</strong> for Web3 users—a user-owned, decentralized economy where on-chain identity and reputation have tangible value and utility.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Core Pillars */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-center">Core Pillars & Features</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {pillars.map((pillar, index) => (
              <Card key={index} className="bg-gradient-card border-border/50 hover:border-primary/30 transition-colors">
                <CardHeader>
                  <CardTitle className="text-xl">{pillar.title}</CardTitle>
                  <CardDescription className="text-base">{pillar.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">Key Components:</h4>
                    <div className="flex flex-wrap gap-2">
                      {pillar.components.map((component, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {component}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Development Phases */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-center">Development Roadmap</h2>
          <div className="space-y-6">
            {phases.map((phase, index) => (
              <Card key={index} className="bg-gradient-card border-border/50 relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(phase.status)}
                    <div>
                      <CardTitle className="text-xl flex items-center gap-3">
                        {phase.phase}: {phase.title}
                        {getStatusBadge(phase.status)}
                      </CardTitle>
                      <CardDescription className="text-sm text-muted-foreground mt-1">
                        {phase.timeline}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-muted-foreground mb-4">{phase.description}</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {phase.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <ArrowRight className="w-3 h-3 text-primary" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
                {phase.status === 'current' && (
                  <div className="absolute top-0 right-0 w-2 h-full bg-gradient-accent" />
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* Tokenomics Section */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-center">Tokenomics Overview: $FORGE</h2>
          <div className="text-center mb-6">
            <p className="text-lg text-muted-foreground">
              <strong className="text-foreground">The Heart of the Avalanche Forge Empire's Economy</strong>
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Key Utilities */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-xl">Key Utilities of $FORGE</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-0.5 bg-primary/10 text-primary border-primary/30">Governance</Badge>
                    <span className="text-sm text-muted-foreground">Stake <strong className="text-foreground">$FORGE</strong> to participate in <strong className="text-accent">CommunityDAO</strong> decisions.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-0.5 bg-secondary/10 text-secondary border-secondary/30">Staking Rewards</Badge>
                    <span className="text-sm text-muted-foreground">Earn a share of <strong className="text-foreground">protocol rewards</strong> by staking $FORGE.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-0.5 bg-accent/10 text-accent border-accent/30">Premium Access</Badge>
                    <span className="text-sm text-muted-foreground">Purchase <strong className="text-foreground">ForgePass</strong> for exclusive content and features.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-0.5 bg-success/10 text-success border-success/30">Exchange Medium</Badge>
                    <span className="text-sm text-muted-foreground">Primary currency for <strong className="text-foreground">marketplace transactions</strong> and <strong className="text-foreground">tipping</strong>.</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Value Accrual */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-xl">Value Accrual Mechanism</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Platform fees from services like <strong className="text-foreground">TokenLauncher</strong> and the upcoming <strong className="text-foreground">marketplace</strong> flow into the <strong className="text-accent">DAO treasury</strong>.
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">The <strong className="text-accent">DAO governs fund allocation</strong>, including:</p>
                  <div className="space-y-1 ml-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ArrowRight className="w-3 h-3 text-primary" />
                      <strong className="text-foreground">Buybacks</strong>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ArrowRight className="w-3 h-3 text-primary" />
                      <strong className="text-foreground">Token Burns</strong>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ArrowRight className="w-3 h-3 text-primary" />
                      <strong className="text-foreground">Reinvestment into ecosystem growth</strong>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Token Configuration */}
          <Card className="bg-gradient-card border-border/50 mt-6">
            <CardHeader>
              <CardTitle className="text-xl text-center">Token Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Parameter</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Value</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-2">
                    <tr className="border-b border-border/30">
                      <td className="py-3 px-4 font-medium text-foreground">MAX_SUPPLY</td>
                      <td className="py-3 px-4 text-muted-foreground">1,000,000,000 (1B)</td>
                      <td className="py-3 px-4 text-muted-foreground">Total supply cap (18 decimals)</td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="py-3 px-4 font-medium text-foreground">INITIAL_SUPPLY</td>
                      <td className="py-3 px-4 text-muted-foreground">100,000,000 (100M)</td>
                      <td className="py-3 px-4 text-muted-foreground">Initial circulating supply</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium text-foreground">MAX_DAILY_MINT</td>
                      <td className="py-3 px-4 text-muted-foreground">10,000,000 (10M)</td>
                      <td className="py-3 px-4 text-muted-foreground">Daily minting limit (if applicable)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Call to Action */}
        <section className="text-center space-y-6 py-8">
          <h2 className="text-2xl font-bold">Join the Digital Nation</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Avax Forge Empire is not just a dApp; it is a full-fledged, thoughtfully designed digital economy 
            aiming to become the premier SocialFi and GameFi destination on the Avalanche network.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Badge variant="secondary" className="bg-success/20 text-success border-success/30 text-sm px-4 py-2">
              🚀 Phase 1 Complete - Foundation Live on Testnet
            </Badge>
          </div>
        </section>
      </main>
    </div>
  )
}

export default RoadmapPage