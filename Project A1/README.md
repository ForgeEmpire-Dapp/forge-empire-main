# Avax Forge Empire

A modular DeFi protocol for launching and managing tokens on the Avalanche C-Chain.

## Core Modules

| Contract | Description |
|---|---|
| `TokenManagerCore` | Central registry for token metadata, roles, and global configuration. |
| `TokenLauncher` | Handles the creation and launch of new tokens. |
| `CommunityDAO` | A decentralized autonomous organization for community governance. |
| `CommunityRewards` | Manages the distribution of rewards to the community. |
| `QuestRegistry` | A registry for quests that users can complete to earn rewards. |
| `BadgeMinter` | Mints badges (ERC-721 tokens) to users who complete quests. |
| `XPEngine` | Tracks and manages experience points (XP) for users. |
| `ProfileRegistry` | Manages user profiles, including usernames and badges. |
| `ReferralEngine` | Manages a referral program to incentivize user growth. |
| `StakingRewards` | Manages staking and rewards for users who stake tokens. |
| `TipJar` | A simple contract that allows users to tip each other. |
| `ForgePass` | An NFT pass that grants users special privileges. |

## Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/en/) (v16+)
* [Yarn](https://yarnpkg.com/)

### Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/your-username/avax-forge-empire.git
   ```

2. Install the dependencies:
   ```sh
   yarn install
   ```

### Running the Tests

```sh
   yarn test
```

### Deployment

1.  Create a `.env` file in the root of the project and add the following:

    ```
    PRIVATE_KEY=your-private-key
    ```

2.  Run the deployment script:

    ```sh
    yarn deploy
    ```

## License

This project is licensed under the MIT License. See the `LICENSE.md` file for details.
