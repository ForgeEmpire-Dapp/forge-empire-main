import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMarketplace } from '@/hooks/useMarketplace';
import { ShoppingCart, Tag, TrendingUp, Grid, List, Search, Plus, Loader2 } from 'lucide-react';
import { formatEther } from 'viem';

export const NFTMarketplace = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [showListDialog, setShowListDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { listings, isLoading, listItem, buyItem, isApproving, isListing, isBuying, isConnected } = useMarketplace();

  const categories = ['All', 'Character', 'Weapon', 'Badge', 'Land', 'Art'];

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white';
      case 'epic': return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
      case 'rare': return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
      case 'common': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const filteredNFTs = useMemo(() => {
    return listings.filter(nft => 
      (selectedCategory === 'All' || nft.category === selectedCategory) &&
      (searchQuery === '' || nft.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       nft.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [listings, selectedCategory, searchQuery]);

  const handleBuyNFT = async (nft) => {
    if (!isConnected) return;
    await buyItem(nft.listingId, nft.price);
  };

  const ListNFTDialog = () => {
    const [nftContract, setNftContract] = useState('');
    const [tokenId, setTokenId] = useState('');
    const [price, setPrice] = useState('');

    const handleList = async () => {
      await listItem(nftContract, Number(tokenId), price);
      setShowListDialog(false);
    };

    return (
      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>List NFT for Sale</DialogTitle>
            <DialogDescription>List your NFT on the marketplace</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">NFT Contract Address</label>
              <Input placeholder="0x..." value={nftContract} onChange={e => setNftContract(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Token ID</label>
              <Input placeholder="Token ID" type="number" value={tokenId} onChange={e => setTokenId(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Price (AVAX)</label>
              <Input placeholder="0.0" type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <div className="flex space-x-4">
              <Button onClick={() => setShowListDialog(false)} variant="outline" className="flex-1">Cancel</Button>
              <Button onClick={handleList} className="flex-1" disabled={isApproving || isListing}>
                {(isApproving || isListing) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isApproving ? 'Approving...' : isListing ? 'Listing...' : 'List NFT'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">NFT Marketplace</h1>
          <p className="text-muted-foreground mt-2">Discover, collect, and trade unique digital assets</p>
        </div>
        <Button onClick={() => setShowListDialog(true)} className="bg-gradient-to-r from-primary to-secondary text-white">
          <Plus className="h-4 w-4 mr-2" />
          List NFT
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-4'}>
          {filteredNFTs.map((nft) => (
            <Card key={nft.listingId} className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => setSelectedNFT(nft)}>
              <div className="relative">
                <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg flex items-center justify-center">
                  {nft.image ? <img src={nft.image} alt={nft.name} className="object-cover w-full h-full rounded-t-lg" /> : <div className="text-6xl text-gray-400">🖼️</div>}
                </div>
                {nft.rarity && <Badge className={`absolute top-2 right-2 ${getRarityColor(nft.rarity)}`}>{nft.rarity}</Badge>}
              </div>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <h3 className="font-semibold group-hover:text-primary transition-colors">{nft.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{nft.description}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Price</p>
                      <p className="font-bold text-lg">{formatEther(nft.price)} AVAX</p>
                    </div>
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); handleBuyNFT(nft); }} disabled={isBuying}>
                      {isBuying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-1" />}
                      Buy
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2 pt-2 border-t">
                    <Avatar className="h-6 w-6"><AvatarFallback className="text-xs">{nft.seller.slice(2, 4)}</AvatarFallback></Avatar>
                    <p className="text-xs text-muted-foreground">{nft.seller.slice(0, 6)}...{nft.seller.slice(-4)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedNFT && (
        <Dialog open={!!selectedNFT} onOpenChange={() => setSelectedNFT(null)}>
          <DialogContent className="max-w-4xl">
            {/* ... NFT Detail Modal Content ... */}
          </DialogContent>
        </Dialog>
      )}

      <ListNFTDialog />
    </div>
  );
};