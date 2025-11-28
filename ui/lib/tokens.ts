export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chainId: number;
  chain: string;
  logo: string;
  isNative: boolean;
}

export const SUPPORTED_TOKENS: Token[] = [
  // Layer 1 Tokens (Ethereum Mainnet - Chain ID 1)
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    chainId: 1,
    chain: 'Ethereum',
    logo: '⟠',
    isNative: true,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    chainId: 1,
    chain: 'Ethereum',
    logo: '💵',
    isNative: false,
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    chainId: 1,
    chain: 'Ethereum',
    logo: '💲',
    isNative: false,
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
    chainId: 1,
    chain: 'Ethereum',
    logo: '◈',
    isNative: false,
  },
  
  // Polygon (MATIC) - Chain ID 137
  {
    symbol: 'MATIC',
    name: 'Polygon',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    chainId: 137,
    chain: 'Polygon',
    logo: '🔷',
    isNative: true,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin (Polygon)',
    address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    decimals: 6,
    chainId: 137,
    chain: 'Polygon',
    logo: '💵',
    isNative: false,
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    decimals: 18,
    chainId: 137,
    chain: 'Polygon',
    logo: '⟠',
    isNative: false,
  },
  
  // Arbitrum - Chain ID 42161
  {
    symbol: 'ARB',
    name: 'Arbitrum',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    chainId: 42161,
    chain: 'Arbitrum',
    logo: '🔵',
    isNative: true,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin (Arbitrum)',
    address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    decimals: 6,
    chainId: 42161,
    chain: 'Arbitrum',
    logo: '💵',
    isNative: false,
  },
  
  // Optimism - Chain ID 10
  {
    symbol: 'OP',
    name: 'Optimism',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    chainId: 10,
    chain: 'Optimism',
    logo: '🔴',
    isNative: true,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin (Optimism)',
    address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    decimals: 6,
    chainId: 10,
    chain: 'Optimism',
    logo: '💵',
    isNative: false,
  },
  
  // Base - Chain ID 8453
  {
    symbol: 'ETH',
    name: 'Ethereum (Base)',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    chainId: 8453,
    chain: 'Base',
    logo: '🔵',
    isNative: true,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin (Base)',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    chainId: 8453,
    chain: 'Base',
    logo: '💵',
    isNative: false,
  },
  
  // zkSync Era - Chain ID 324
  {
    symbol: 'ETH',
    name: 'Ethereum (zkSync)',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    chainId: 324,
    chain: 'zkSync Era',
    logo: '⚡',
    isNative: true,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin (zkSync)',
    address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4',
    decimals: 6,
    chainId: 324,
    chain: 'zkSync Era',
    logo: '💵',
    isNative: false,
  },
];

export const INTENT_ACTIONS = [
  { value: 'transfer', label: 'Send', description: 'Transfer tokens to another address' },
  { value: 'swap', label: 'Swap', description: 'Exchange one token for another' },
  { value: 'deposit', label: 'Deposit', description: 'Deposit into DeFi protocol' },
  { value: 'withdraw', label: 'Withdraw', description: 'Withdraw from DeFi protocol' },
  { value: 'stake', label: 'Stake', description: 'Stake tokens for rewards' },
  { value: 'unstake', label: 'Unstake', description: 'Unstake tokens' },
];

export function getTokensByChain(chainId: number): Token[] {
  return SUPPORTED_TOKENS.filter(t => t.chainId === chainId);
}

export function getTokenBySymbol(symbol: string, chainId: number): Token | undefined {
  return SUPPORTED_TOKENS.find(t => t.symbol === symbol && t.chainId === chainId);
}
