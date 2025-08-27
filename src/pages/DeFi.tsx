import { useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EnhancedStakingInterface } from '@/components/defi/EnhancedStakingInterface'
import { LiquidityPoolInterface } from '@/components/defi/LiquidityPoolInterface'

const DeFiPage = () => {
  useEffect(() => {
    document.title = 'DeFi Hub | Avax Forge Empire'
  }, [])
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
            DeFi Hub
          </h1>
          <p className="text-xl text-muted-foreground">
            Stake, trade, and earn with FORGE ecosystem
          </p>
        </div>

        <Tabs defaultValue="staking" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="staking">Staking</TabsTrigger>
            <TabsTrigger value="liquidity">Liquidity Pools</TabsTrigger>
          </TabsList>

          <TabsContent value="staking">
            <EnhancedStakingInterface />
          </TabsContent>

          <TabsContent value="liquidity">
            <LiquidityPoolInterface />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default DeFiPage