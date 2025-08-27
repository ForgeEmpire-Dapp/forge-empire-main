
// Centralized contract addresses configuration
export const CONTRACT_ADDRESSES = {
  // Core System Contracts
  XPEngine: '0x9a046ee80b16D7B26D643B55B24c77920f8b0FCf',
  BadgeMinter: '0x28ABb30D6da30Ea8F28a31596327d57630eFC5ef',
  ProfileRegistry: '0x1320a090BCAF2959468F8d14c37cde761fE9BbC6',
  
  // Quest System
  OnboardingQuests: '0x4F16D66F3c183A27A56980f552267eB6344F6d83',
  QuestRegistry: '0x1200312ADF5f85E21Cb15A8008145a3dba65B159',
  DynamicQuestEngine: '0x5f6bA70b9D6832c857Fe443042a6006E325f032f',
  
  // Social & Community
  SocialGraph: '0x89451A3e75D06189E565032c5B197f885199E30C',
  Kudos: '0x974bF5E2841176505A558DC11B3b953176f667B9',
  TipJar: '0xe051aF0C7352807070fBb99d92cFe7972ffE79B2',
  CommunityRewards: '0x0d90E3362b40F4793664f21Cf406c65Fbd3052CE',
  LeaderbaordCore: '0xB5Db9fE312Af0FD8c6d2bf97d67B58EAa0e98c05',

  // Streak System
  StreakCore: '0xcf04aeD76cc9cD5230A8B66b73f9F1c633046B36',
  StreakRewards: '0x29f94460EFF7C2531d1efDa86Fc311d50855dCd1',
  StreakMilestones: '0x11C78965030DD635b98e6fB14a2532A298E3Ea72',
  SeasonalEvents: '0xf76160146A1aA91B9A9D2810d6911A2fD4562adF',
  
  // DeFi & Governance
  ForgeTokenCore: '0x0f7D6Caef05Ff69a7127419C3999bcd4ff361756',
  StakingRewards: '0x2D8C7D76F6378937D1B17EF63967dD51828a5564',
  ForgePass: '0x26a7b98D67E90bC6c2f9d16648B5A2e3293e6CC1',
  CommunityDAO: '0xc892CF08060545DD49E0de56FE63239E1177ebAe',
  
  // Marketplace & Guilds
  MarketplaceCore: '0x6C59C7cd6F17dbd8d289e8B23Ef750b2E0f0C62e',
  GuildCore: '0x9edeDC2EBb876E17D8B87Bc949C094Bb2dAC0992',
  
  // Additional Contracts
  TokenLauncher: '0x99E0F6B37F3c5E63d86c930137057dBB0b0ba38f',
  MockERC20: '0x7b1fD428a418bCbaB54570ab3Ec2e2BabD7a37BB',
  VestingWalletFactory: "0xdc883B374F422c9Be9c29Fc06ef857F55F6737d2",
  LiquidityPool: '0x1234567890123456789012345678901234567890', // Placeholder address
} as const

export type ContractName = keyof typeof CONTRACT_ADDRESSES
