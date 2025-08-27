import React from 'react'
import { PageLayout } from '@/components/layout/PageLayout'
import { NFTMarketplace } from '@/components/marketplace/NFTMarketplace'

export default function Marketplace() {
  return (
    <PageLayout
      title="NFT Marketplace"
      description="Discover, trade, and collect unique NFTs in the Avalanche ecosystem"
    >
      <div className="max-w-6xl mx-auto">
        <NFTMarketplace />
      </div>
    </PageLayout>
  )
}