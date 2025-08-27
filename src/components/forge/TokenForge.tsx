import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from 'wagmi';
import { useTokenManager } from '@/hooks/useTokenManager';
import { Rocket, Loader2, AlertCircle } from "lucide-react";

export const TokenForge = () => {
  const { toast } = useToast();
  const { isConnected } = useAccount();
  const { launchToken, isLaunching } = useTokenManager();
  
  const [tokenAddress, setTokenAddress] = useState('');

  const handleRegister = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to register a token.",
        variant: "destructive"
      });
      return;
    }

    if (!tokenAddress) {
      toast({
        title: "Missing Information",
        description: "Please enter a token address.",
        variant: "destructive"
      });
      return;
    }

    await launchToken(tokenAddress);
  };

  return (
    <section id="forge" className="py-20 container">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4">
          <span className="bg-gradient-primary bg-clip-text text-transparent">
            Token Registry
          </span>
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Register an existing ERC20 token to integrate with the Forge Empire platform.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Rocket className="w-5 h-5" />
              <span>Register Token</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="token-address">Token Address</Label>
              <Input 
                id="token-address" 
                placeholder="0x..."
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                className="bg-background border-border/50"
              />
            </div>

            {!isConnected && (
              <div className="bg-warning/10 border border-warning/20 p-4 rounded-lg mb-4">
                <div className="flex items-center gap-2 text-warning">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Connect your wallet to register tokens</span>
                </div>
              </div>
            )}
            
            <Button 
              variant="hero" 
              className="w-full"
              onClick={handleRegister}
              disabled={isLaunching || !isConnected}
            >
              {isLaunching ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5 mr-2" />
                  Register Token
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};