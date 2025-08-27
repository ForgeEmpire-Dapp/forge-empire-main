import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Rocket, 
  Coins, 
  Users, 
  Shield,
  Zap,
  Trophy
} from "lucide-react"
import heroBg from "@/assets/hero-bg.png"

export const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="absolute inset-0 bg-gradient-hero opacity-90" />
      
      {/* Content */}
      <div className="relative z-10 container text-center space-y-8 max-w-4xl">
        <div className="space-y-4">
          <Badge className="bg-gradient-primary text-primary-foreground px-4 py-2 text-sm float-animation">
            🔥 Production Ready • Security Audited
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              Forge Empire
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            The ultimate modular DeFi platform for tokenized communities. Launch tokens, 
            gamify engagement, and build the future of decentralized governance.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
          <div className="text-center space-y-2">
            <div className="text-3xl font-bold text-primary">A+</div>
            <div className="text-sm text-muted-foreground">Security Rating</div>
          </div>
          <div className="text-center space-y-2">
            <div className="text-3xl font-bold text-secondary">13</div>
            <div className="text-sm text-muted-foreground">Core Modules</div>
          </div>
          <div className="text-center space-y-2">
            <div className="text-3xl font-bold text-accent">∞</div>
            <div className="text-sm text-muted-foreground">Possibilities</div>
          </div>
          <div className="text-center space-y-2">
            <div className="text-3xl font-bold text-success">FUJI</div>
            <div className="text-sm text-muted-foreground">Testnet Live</div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button variant="hero" className="glow-primary">
            <Rocket className="w-5 h-5" />
            Launch Your Empire
          </Button>
          <Button variant="gaming" size="lg">
            <Trophy className="w-5 h-5" />
            Explore Features
          </Button>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <div className="group p-6 rounded-xl bg-gradient-card border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-card">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <Coins className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Token Management</h3>
            </div>
            <p className="text-muted-foreground">
              Launch custom ERC20 tokens with advanced features, governance, and community rewards.
            </p>
          </div>

          <div className="group p-6 rounded-xl bg-gradient-card border border-border/50 hover:border-secondary/30 transition-all duration-300 hover:shadow-card">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-secondary">
                <Users className="w-6 h-6 text-secondary-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Community & DAO</h3>
            </div>
            <p className="text-muted-foreground">
              Build engaged communities with governance, proposals, voting, and shared rewards.
            </p>
          </div>

          <div className="group p-6 rounded-xl bg-gradient-card border border-border/50 hover:border-accent/30 transition-all duration-300 hover:shadow-card">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-accent">
                <Zap className="w-6 h-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Gamified Experience</h3>
            </div>
            <p className="text-muted-foreground">
              Quests, XP systems, NFT badges, and social features that make DeFi engaging and fun.
            </p>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 w-20 h-20 bg-primary/20 rounded-full blur-xl animate-pulse" />
      <div className="absolute bottom-40 right-20 w-32 h-32 bg-secondary/20 rounded-full blur-xl animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-accent/20 rounded-full blur-xl animate-pulse delay-500" />
    </section>
  )
}
