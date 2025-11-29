import { ethers } from 'ethers';
import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { AlphaRouter, SwapType } from '@uniswap/smart-order-router';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  recipient: string;
  chainId: number;
  slippageTolerance?: number; // basis points, default 50 = 0.5%
}

export interface SwapResult {
  success: boolean;
  txHash?: string;
  amountOut?: string;
  gasUsed?: string;
  error?: string;
}

export class DexExecutor {
  private providers: Map<number, ethers.providers.JsonRpcProvider>;
  private routers: Map<number, AlphaRouter>;
  private wallet: ethers.Wallet;

  // Uniswap V3 Router addresses per chain
  private static readonly SWAP_ROUTER_ADDRESSES: Record<number, string> = {
    1: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // Ethereum mainnet
    137: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // Polygon
    42161: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // Arbitrum
    10: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // Optimism
    8453: '0x2626664c2603336E57B271c5C0b26F421741e481', // Base
  };

  constructor(privateKey: string) {
    this.providers = new Map();
    this.routers = new Map();
    this.wallet = new ethers.Wallet(privateKey);

    // Initialize providers
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

        // Initialize Uniswap AlphaRouter for this chain
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const router = new AlphaRouter({
          chainId: Number(chainId),
          provider: provider as unknown as ethers.providers.BaseProvider, // AlphaRouter expects ethers v5 BaseProvider
        });
        this.routers.set(Number(chainId), router);
      }
    }
  }

  /**
   * Execute a swap on Uniswap V3
   */
  async executeSwap(params: SwapParams): Promise<SwapResult> {
    const startTime = Date.now();

    try {
      logger.info({ params }, 'Executing DEX swap');

      // Get provider and router for chain
      const provider = this.providers.get(params.chainId);
      const router = this.routers.get(params.chainId);

      if (!provider || !router) {
        throw new Error(`Chain ${params.chainId} not supported or RPC not configured`);
      }

      // Connect wallet to provider
      const signer = this.wallet.connect(provider);

      // Create token objects
      const tokenIn = await this.getToken(params.tokenIn, params.chainId, provider);
      const tokenOut = await this.getToken(params.tokenOut, params.chainId, provider);

      // Create amount
      const amountIn = ethers.utils.parseUnits(params.amountIn, tokenIn.decimals);
      const currencyAmountIn = CurrencyAmount.fromRawAmount(
        tokenIn,
        amountIn.toString()
      );

      // Get route from Uniswap
      logger.info('Finding best route via Uniswap AlphaRouter...');
      const route = await router.route(
        currencyAmountIn,
        tokenOut,
        TradeType.EXACT_INPUT,
        {
          recipient: params.recipient,
          slippageTolerance: new Percent(
            params.slippageTolerance || 50,
            10000
          ),
          deadline: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
          type: SwapType.SWAP_ROUTER_02,
        }
      );

      if (!route) {
        throw new Error('No route found for swap');
      }

      logger.info({
        quote: route.quote.toFixed(),
        gasEstimate: route.estimatedGasUsed.toString(),
      }, 'Route found');

      // Approve token if needed
      if (params.tokenIn !== ethers.constants.AddressZero) {
        await this.approveToken(
          params.tokenIn,
          DexExecutor.SWAP_ROUTER_ADDRESSES[params.chainId],
          BigInt(amountIn.toString()),
          signer
        );
      }

      // Execute swap
      logger.info('Executing swap transaction...');
      const tx = await signer.sendTransaction({
        data: route.methodParameters?.calldata,
        to: DexExecutor.SWAP_ROUTER_ADDRESSES[params.chainId],
        value: params.tokenIn === ethers.constants.AddressZero ? amountIn : 0,
        gasLimit: route.estimatedGasUsed.mul(120).div(100), // 20% buffer
      });

      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error('Swap transaction failed');
      }

      const duration = Date.now() - startTime;
      logger.info({
        txHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        duration,
      }, 'Swap executed successfully');

      return {
        success: true,
        txHash: receipt.transactionHash,
        amountOut: route.quote.toFixed(),
        gasUsed: receipt.gasUsed.toString(),
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, params }, 'Swap execution failed');
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get token information
   */
  private async getToken(
    address: string,
    chainId: number,
    provider: ethers.providers.JsonRpcProvider
  ): Promise<Token> {
    // Handle native token (ETH, MATIC, etc.)
    if (address === ethers.constants.AddressZero || address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
      return new Token(
        chainId,
        '0x0000000000000000000000000000000000000000',
        18,
        this.getNativeSymbol(chainId),
        this.getNativeName(chainId)
      );
    }

    // Get ERC20 token info
    const tokenContract = new ethers.Contract(
      address,
      ['function decimals() view returns (uint8)', 'function symbol() view returns (string)', 'function name() view returns (string)'],
      provider
    );

    const [decimals, symbol, name] = await Promise.all([
      tokenContract.decimals(),
      tokenContract.symbol(),
      tokenContract.name(),
    ]);

    return new Token(chainId, address, decimals, symbol, name);
  }

  /**
   * Approve token spending
   */
  private async approveToken(
    tokenAddress: string,
    spender: string,
    amount: bigint,
    signer: ethers.Wallet
  ): Promise<void> {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function approve(address spender, uint256 amount) returns (bool)', 'function allowance(address owner, address spender) view returns (uint256)'],
      signer
    );

    // Check current allowance
    const currentAllowance = await tokenContract.allowance(
      await signer.getAddress(),
      spender
    );

    if (currentAllowance >= amount) {
      logger.info('Token already approved');
      return;
    }

    // Approve
    logger.info({ tokenAddress, spender, amount: amount.toString() }, 'Approving token');
    const tx = await tokenContract.approve(spender, ethers.constants.MaxUint256);
    await tx.wait();
    logger.info('Token approved');
  }

  /**
   * Get quote for a swap without executing
   */
  async getQuote(params: Omit<SwapParams, 'recipient'>): Promise<{
    amountOut: string;
    gasEstimate: string;
    priceImpact: string;
  } | null> {
    try {
      const provider = this.providers.get(params.chainId);
      const router = this.routers.get(params.chainId);

      if (!provider || !router) {
        return null;
      }

      const tokenIn = await this.getToken(params.tokenIn, params.chainId, provider);
      const tokenOut = await this.getToken(params.tokenOut, params.chainId, provider);

      const amountIn = ethers.utils.parseUnits(params.amountIn, tokenIn.decimals);
      const currencyAmountIn = CurrencyAmount.fromRawAmount(
        tokenIn,
        amountIn.toString()
      );

      const route = await router.route(
        currencyAmountIn,
        tokenOut,
        TradeType.EXACT_INPUT,
        {
          recipient: ethers.constants.AddressZero,
          slippageTolerance: new Percent(50, 10000),
          deadline: Math.floor(Date.now() / 1000) + 1800,
          type: SwapType.SWAP_ROUTER_02,
        }
      );

      if (!route) {
        return null;
      }

      return {
        amountOut: route.quote.toFixed(),
        gasEstimate: route.estimatedGasUsed.toString(),
        priceImpact: route.trade.priceImpact.toFixed(2),
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, 'Failed to get quote');
      return null;
    }
  }

  private getNativeSymbol(chainId: number): string {
    const symbols: Record<number, string> = {
      1: 'ETH',
      137: 'MATIC',
      42161: 'ETH',
      10: 'ETH',
      8453: 'ETH',
    };
    return symbols[chainId] || 'ETH';
  }

  private getNativeName(chainId: number): string {
    const names: Record<number, string> = {
      1: 'Ether',
      137: 'Matic',
      42161: 'Ether',
      10: 'Ether',
      8453: 'Ether',
    };
    return names[chainId] || 'Ether';
  }
}
