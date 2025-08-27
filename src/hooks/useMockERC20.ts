import { useTokenBalance } from './contracts'
import { useAccount } from 'wagmi'
import { CONTRACT_ADDRESSES } from '@/config/web3'

export const useMockERC20 = () => {
  const { address } = useAccount()
  const { data: balance, refetch: refetchBalance } = useTokenBalance()

  const formattedBalance = balance ? Number(balance) / 1e18 : 0

  return {
    address: CONTRACT_ADDRESSES.MockERC20,
    balance: formattedBalance.toString(),
    formattedBalance: formattedBalance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }),
    symbol: 'MOCK',
    name: 'MockERC20',
    decimals: 18,
    refetchBalance,
    isConnected: !!address,
  }
}