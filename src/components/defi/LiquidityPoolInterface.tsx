import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { 
  Droplets, 
  TrendingUp, 
  RefreshCw, 
  Plus, 
  Minus,
  ArrowUpDown,
  Coins
} from 'lucide-react'
import { useLiquidityPools } from '@/hooks/useLiquidityPools'
import { useAccount } from 'wagmi'

export const LiquidityPoolInterface = () => {
  const { address } = useAccount()
  const { 
    addLiquidity, 
    removeLiquidity, 
    swapTokensForAvax, 
    swapAvaxForTokens, 
    isProcessing 
  } = useLiquidityPools()
  
  const [tokenAmount, setTokenAmount] = useState('')
  const [avaxAmount, setAvaxAmount] = useState('')
  const [liquidityAmount, setLiquidityAmount] = useState('')
  const [swapAmount, setSwapAmount] = useState('')
  const [slippage, setSlippage] = useState([0.5])
  const [swapDirection, setSwapDirection] = useState<'token-to-avax' | 'avax-to-token'>('token-to-avax')

  if (!address) {
    return (
      <div className="container mx-auto p-6">
        <Card className="text-center">
          <CardContent className="pt-6">
            <Droplets className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Connect Wallet</h3>
            <p className="text-muted-foreground">Please connect your wallet to access liquidity pool features.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleAddLiquidity = async () => {
    if (tokenAmount && avaxAmount) {
      await addLiquidity(tokenAmount, avaxAmount, slippage[0])
      setTokenAmount('')
      setAvaxAmount('')
    }
  }

  const handleRemoveLiquidity = async () => {
    if (liquidityAmount) {
      await removeLiquidity(liquidityAmount, slippage[0])
      setLiquidityAmount('')
    }
  }

  const handleSwap = async () => {
    if (swapAmount) {
      if (swapDirection === 'token-to-avax') {
        await swapTokensForAvax(swapAmount, slippage[0])
      } else {
        await swapAvaxForTokens(swapAmount, slippage[0])
      }
      setSwapAmount('')
    }
  }

  const toggleSwapDirection = () => {
    setSwapDirection(prev => 
      prev === 'token-to-avax' ? 'avax-to-token' : 'token-to-avax'
    )
    setSwapAmount('')
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
          Liquidity Pools
        </h1>
        <p className="text-xl text-muted-foreground">
          Provide liquidity and trade FORGE/AVAX pairs
        </p>
      </div>

      {/* Pool Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Droplets className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Liquidity</p>
                <p className="text-2xl font-bold">$1.2M</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">24h Volume</p>
                <p className="text-2xl font-bold">$45.2K</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Coins className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">FORGE Price</p>
                <p className="text-2xl font-bold">$0.024</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <RefreshCw className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">APR</p>
                <p className="text-2xl font-bold">24.5%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="add" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="add">Add Liquidity</TabsTrigger>
          <TabsTrigger value="remove">Remove Liquidity</TabsTrigger>
          <TabsTrigger value="swap">Swap</TabsTrigger>
        </TabsList>

        <TabsContent value="add" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add Liquidity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tokenAmount">FORGE Amount</Label>
                    <Input
                      id="tokenAmount"
                      type="number"
                      placeholder="0.00"
                      value={tokenAmount}
                      onChange={(e) => setTokenAmount(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="avaxAmount">AVAX Amount</Label>
                    <Input
                      id="avaxAmount"
                      type="number"
                      placeholder="0.00"
                      value={avaxAmount}
                      onChange={(e) => setAvaxAmount(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Slippage Tolerance: {slippage[0]}%</Label>
                    <Slider
                      value={slippage}
                      onValueChange={setSlippage}
                      max={5}
                      min={0.1}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  <Button 
                    onClick={handleAddLiquidity}
                    disabled={!tokenAmount || !avaxAmount || isProcessing}
                    className="w-full"
                    size="lg"
                  >
                    {isProcessing ? 'Adding Liquidity...' : 'Add Liquidity'}
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Pool Information</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span>Pool Share</span>
                      <Badge variant="outline">0.001%</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span>LP Tokens</span>
                      <Badge variant="outline">1,234.56</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span>Pool Fee</span>
                      <Badge variant="outline">0.3%</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="remove" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Minus className="w-5 h-5" />
                Remove Liquidity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="liquidityAmount">LP Token Amount</Label>
                  <Input
                    id="liquidityAmount"
                    type="number"
                    placeholder="0.00"
                    value={liquidityAmount}
                    onChange={(e) => setLiquidityAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Slippage Tolerance: {slippage[0]}%</Label>
                  <Slider
                    value={slippage}
                    onValueChange={setSlippage}
                    max={5}
                    min={0.1}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <Button 
                  onClick={handleRemoveLiquidity}
                  disabled={!liquidityAmount || isProcessing}
                  className="w-full"
                  size="lg"
                  variant="destructive"
                >
                  {isProcessing ? 'Removing Liquidity...' : 'Remove Liquidity'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="swap" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5" />
                Swap Tokens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>From</Label>
                  <Badge variant="outline">
                    {swapDirection === 'token-to-avax' ? 'FORGE' : 'AVAX'}
                  </Badge>
                </div>
                
                <Input
                  type="number"
                  placeholder="0.00"
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                />

                <div className="flex justify-center">
                  <Button
                    onClick={toggleSwapDirection}
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <Label>To</Label>
                  <Badge variant="outline">
                    {swapDirection === 'token-to-avax' ? 'AVAX' : 'FORGE'}
                  </Badge>
                </div>

                <Input
                  type="number"
                  placeholder="0.00"
                  readOnly
                  className="bg-muted/50"
                />

                <div className="space-y-2">
                  <Label>Slippage Tolerance: {slippage[0]}%</Label>
                  <Slider
                    value={slippage}
                    onValueChange={setSlippage}
                    max={5}
                    min={0.1}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <Button 
                  onClick={handleSwap}
                  disabled={!swapAmount || isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? 'Swapping...' : 'Swap'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}