/**
 * Configuration for zk-Intents contracts and network
 */

export const NETWORK_CONFIG = {
  mumbai: {
    chainId: 80001,
    name: 'Polygon Mumbai Testnet',
    rpc: 'https://rpc-mumbai.maticvigil.com',
    explorer: 'https://mumbai.polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
  polygon: {
    chainId: 137,
    name: 'Polygon Mainnet',
    rpc: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
};

export const CONTRACT_ADDRESSES = {
  mumbai: {
    pairing: '0xBC7a47391847c84D57A792fBcDA6d2BF399513b0',
    verifier: '0x3fb8D15312A7f2bfC1B22578213DDa4957C2f952',
    rollup: '0xE6a142952E876F2Aa30E1c51E4e5b1675CC4bFB3',
  },
  polygon: {
    pairing: '', // Deploy to mainnet later
    verifier: '',
    rollup: '',
  },
};

// Current network (change to 'polygon' for mainnet)
export const CURRENT_NETWORK = 'mumbai';

export const SEQUENCER_URL = 
  process.env.NEXT_PUBLIC_SEQUENCER_URL || 'http://localhost:3000';

export const getNetworkConfig = () => NETWORK_CONFIG[CURRENT_NETWORK];
export const getContractAddresses = () => CONTRACT_ADDRESSES[CURRENT_NETWORK];
