import { ethers } from 'ethers';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface BridgeParams {
  tokenAddress: string;
  amount: string;
  recipient: string;
  sourceChainId: number;
  destChainId: number;
  slippage?: number; // basis points
}

export interface BridgeResult {
  success: boolean;
  txHash?: string;
  bridgeFee?: string;
  estimatedTime?: number; // seconds
  error?: string;
}

export class LayerZeroBridge {
  private providers: Map<number, ethers.providers.JsonRpcProvider>;
  private wallet: ethers.Wallet;

  // LayerZero Endpoint addresses per chain
  private static readonly LZ_ENDPOINTS: Record<number, string> = {
    1: '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675', // Ethereum
    137: '0x3c2269811836af69497E5F486A85D7316753cf62', // Polygon
    42161: '0x3c2269811836af69497E5F486A85D7316753cf62', // Arbitrum
    10: '0x3c2269811836af69497E5F486A85D7316753cf62', // Optimism
    8453: '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7', // Base
  };

  // LayerZero Chain IDs (different from EVM chain IDs)
  private static readonly LZ_CHAIN_IDS: Record<number, number> = {
    1: 101, // Ethereum
    137: 109, // Polygon
    42161: 110, // Arbitrum
    10: 111, // Optimism
    8453: 184, // Base
  };

  constructor(privateKey: string) {
    this.providers = new Map();
    this.wallet = new ethers.Wallet(privateKey);
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const rpcUrls: Record<number, string> = {
      1: process.env.ETHEREUM_RPC || '',
      137: process.env.POLYGON_RPC || '',
      42161: process.env.ARBITRUM_RPC || '',
      10: process.env.OPTIMISM_RPC || '',
      8453: process.env.BASE_RPC || '',
    };

    for (const [chainId, rpcUrl] of Object.entries(rpcUrls)) {
      if (rpcUrl) {
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        this.providers.set(Number(chainId), provider);
      }
    }
  }

  /**
   * Bridge tokens across chains using LayerZero
   */
  async bridgeTokens(params: BridgeParams): Promise<BridgeResult> {
    try {
      logger.info({ params }, 'Initiating LayerZero bridge');

      const sourceProvider = this.providers.get(params.sourceChainId);
      if (!sourceProvider) {
        throw new Error(`Source chain ${params.sourceChainId} not supported`);
      }

      const signer = this.wallet.connect(sourceProvider);
      const lzEndpoint = LayerZeroBridge.LZ_ENDPOINTS[params.sourceChainId];
      const destLzChainId = LayerZeroBridge.LZ_CHAIN_IDS[params.destChainId];

      if (!lzEndpoint || !destLzChainId) {
        throw new Error('LayerZero not supported on this chain');
      }

      // Get bridge fee estimate
      const bridgeFee = await this.estimateFee(params);
      logger.info({ bridgeFee: bridgeFee.toString() }, 'Bridge fee estimated');

      // Prepare adapter params (v1: minGas for destination)
      const adapterParams = ethers.utils.solidityPack(
        ['uint16', 'uint256'],
        [1, 200000] // version 1, 200k gas on destination
      );

      // Encode the payload: recipient address + amount
      const payload = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256'],
        [params.recipient, ethers.utils.parseUnits(params.amount, 18)]
      );

      // Call LayerZero send function
      // Note: This is simplified - actual implementation needs OFT (Omnichain Fungible Token) contract
      const lzEndpointContract = new ethers.Contract(
        lzEndpoint,
        [
          'function send(uint16 _dstChainId, bytes calldata _destination, bytes calldata _payload, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) external payable',
          'function estimateFees(uint16 _dstChainId, address _userApplication, bytes calldata _payload, bool _payInZRO, bytes calldata _adapterParams) external view returns (uint nativeFee, uint zroFee)'
        ],
        signer
      );

      // Send bridge transaction
      logger.info('Sending LayerZero bridge transaction...');
      const tx = await lzEndpointContract.send(
        destLzChainId,
        ethers.utils.solidityPack(['address'], [params.recipient]), // destination address
        payload,
        await signer.getAddress(), // refund address
        ethers.constants.AddressZero, // zro payment address (use native token)
        adapterParams,
        {
          value: bridgeFee, // pay bridge fee in native token
        }
      );

      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error('Bridge transaction failed');
      }

      logger.info({ txHash: receipt.hash }, 'LayerZero bridge initiated');

      return {
        success: true,
        txHash: receipt.hash,
        bridgeFee: ethers.utils.formatEther(bridgeFee),
        estimatedTime: 300, // ~5 minutes typical
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, params }, 'Bridge failed');
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Estimate bridge fee
   */
  private async estimateFee(params: BridgeParams): Promise<bigint> {
    try {
      const sourceProvider = this.providers.get(params.sourceChainId);
      if (!sourceProvider) {
        throw new Error('Provider not found');
      }

      const lzEndpoint = LayerZeroBridge.LZ_ENDPOINTS[params.sourceChainId];
      const destLzChainId = LayerZeroBridge.LZ_CHAIN_IDS[params.destChainId];

      const lzEndpointContract = new ethers.Contract(
        lzEndpoint,
        ['function estimateFees(uint16 _dstChainId, address _userApplication, bytes calldata _payload, bool _payInZRO, bytes calldata _adapterParams) external view returns (uint nativeFee, uint zroFee)'],
        sourceProvider
      );

      const adapterParams = ethers.utils.solidityPack(
        ['uint16', 'uint256'],
        [1, 200000]
      );

      const payload = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256'],
        [params.recipient, ethers.utils.parseUnits(params.amount, 18)]
      );

      const [nativeFee] = await lzEndpointContract.estimateFees(
        destLzChainId,
        lzEndpoint,
        payload,
        false,
        adapterParams
      );

      // Add 20% buffer
      return BigInt(nativeFee.mul(120).div(100).toString());

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn({ error: errorMessage }, 'Fee estimation failed, using default');
      // Return default fee: 0.001 ETH
      return BigInt(ethers.utils.parseEther('0.001').toString());
    }
  }

  /**
   * Get bridge status (check if message has been delivered)
   */
  async getBridgeStatus(sourceTxHash: string, sourceChainId: number): Promise<{
    delivered: boolean;
    destTxHash?: string;
  }> {
    try {
      // In production, you'd query LayerZero's oracle/relayer API
      // For now, simulate based on time
      logger.info({ sourceTxHash, sourceChainId }, 'Checking bridge status');
      
      return {
        delivered: false, // Would check actual status via LayerZero scan API
        destTxHash: undefined,
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, 'Failed to get bridge status');
      return {
        delivered: false,
      };
    }
  }

  /**
   * Get supported chains for bridging
   */
  getSupportedChains(): number[] {
    return Object.keys(LayerZeroBridge.LZ_ENDPOINTS).map(Number);
  }

  /**
   * Check if bridge route is available
   */
  isRouteSupported(sourceChainId: number, destChainId: number): boolean {
    return (
      LayerZeroBridge.LZ_ENDPOINTS[sourceChainId] !== undefined &&
      LayerZeroBridge.LZ_ENDPOINTS[destChainId] !== undefined
    );
  }
}
