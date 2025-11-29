import pino from 'pino';
import { ethers } from 'ethers';
import { DexExecutor } from './dex-executor';
import { LayerZeroBridge } from './layerzero-bridge';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface Intent {
  intentId: string;
  senderAddress: string;
  action: 'transfer' | 'swap' | 'withdraw' | 'bridge';
  amountCommitment: string;
  targetCommitment?: string;
  sourceChain?: string;
  targetChain?: string;
  token?: string;
  targetToken?: string;
  nonce: number;
  timestamp: number;
  signature: {
    r: string;
    s: string;
    pubKey: [string, string];
  };
}

export interface SolverBid {
  solverId: string;
  intentId: string;
  executionCost: bigint;
  estimatedGas: bigint;
  route?: string[];
  expiresAt: number;
}

export interface ExecutionResult {
  intentId: string;
  solverId: string;
  success: boolean;
  txHash?: string;
  gasUsed?: bigint;
  executionTime: number;
  error?: string;
}

/**
 * Solver - Competes to execute intents for profit
 */
export class Solver {
  private solverId: string;
  private dexExecutor: DexExecutor;
  private bridge: LayerZeroBridge;
  private pendingIntents: Map<string, Intent> = new Map();
  private executions: Map<string, ExecutionResult> = new Map();
  
  constructor(
    private privateKey: string,
    private supportedChains: string[],
    private reputationScore: number = 100
  ) {
    const wallet = new ethers.Wallet(privateKey);
    this.solverId = wallet.address;
    this.dexExecutor = new DexExecutor(privateKey);
    this.bridge = new LayerZeroBridge(privateKey);
    logger.info({ solverId: this.solverId, chains: supportedChains }, 'Solver initialized');
  }
  
  /**
   * Evaluate if solver can execute this intent
   */
  async evaluateIntent(intent: Intent): Promise<SolverBid | null> {
    try {
      // Check if we support the required chains
      const sourceChain = intent.sourceChain || 'polygon';
      const targetChain = intent.targetChain || sourceChain;
      
      if (!this.supportedChains.includes(sourceChain) || 
          !this.supportedChains.includes(targetChain)) {
        return null;
      }
      
      // Estimate execution cost
      const { executionCost, gasEstimate, route } = await this.estimateCost(intent);
      
      // Only bid if profitable (execution cost < potential profit)
      const potentialProfit = this.calculateProfit(intent, executionCost);
      
      if (potentialProfit <= 0n) {
        logger.debug({ intentId: intent.intentId }, 'Intent not profitable, skipping');
        return null;
      }
      
      const bid: SolverBid = {
        solverId: this.solverId,
        intentId: intent.intentId,
        executionCost,
        estimatedGas: gasEstimate,
        route,
        expiresAt: Date.now() + 30000, // 30 second bid validity
      };
      
      logger.info({ intentId: intent.intentId, executionCost: executionCost.toString() }, 'Created bid');
      
      return bid;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ intentId: intent.intentId, error: errorMessage }, 'Failed to evaluate intent');
      return null;
    }
  }
  
  /**
   * Execute intent if we won the auction
   */
  async executeIntent(intent: Intent): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      logger.info({ intentId: intent.intentId, action: intent.action }, 'Executing intent');
      
      this.pendingIntents.set(intent.intentId, intent);
      
      let result: ExecutionResult;
      
      // Execute based on intent type
      switch (intent.action) {
        case 'transfer':
          result = await this.executeTransfer(intent);
          break;
        case 'swap':
          result = await this.executeSwap(intent);
          break;
        case 'bridge':
          result = await this.executeBridge(intent);
          break;
        case 'withdraw':
          result = await this.executeWithdrawal();
          break;
        default:
          throw new Error(`Unsupported action: ${intent.action}`);
      }
      
      result.executionTime = Date.now() - startTime;
      this.executions.set(intent.intentId, result);
      this.pendingIntents.delete(intent.intentId);
      
      if (result.success) {
        this.reputationScore += 1;
        logger.info({ intentId: intent.intentId, txHash: result.txHash }, 'Intent executed successfully');
      } else {
        this.reputationScore -= 2;
        logger.error({ intentId: intent.intentId, error: result.error }, 'Intent execution failed');
      }
      
      return result;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result: ExecutionResult = {
        intentId: intent.intentId,
        solverId: this.solverId,
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime,
      };
      
      this.executions.set(intent.intentId, result);
      this.pendingIntents.delete(intent.intentId);
      this.reputationScore -= 5;
      
      return result;
    }
  }
  
  /**
   * Execute transfer intent
   */
  private async executeTransfer(intent: Intent): Promise<ExecutionResult> {
    const rpcUrl = this.getRpcUrl(intent.sourceChain || 'polygon');
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(this.privateKey, provider);
    
    // Decode amount from commitment (in real system, use ZK proof)
    const amount = BigInt(intent.amountCommitment);
    
    // Send transaction
    const tx = await wallet.sendTransaction({
      to: intent.targetCommitment || ethers.constants.AddressZero,
      value: amount,
    });
    
    const receipt = await tx.wait();
    
    return {
      intentId: intent.intentId,
      solverId: this.solverId,
      success: receipt?.status === 1,
      txHash: receipt?.transactionHash,
      gasUsed: receipt?.gasUsed ? BigInt(receipt.gasUsed.toString()) : undefined,
      executionTime: 0, // Will be set by caller
    };
  }
  
  /**
   * Execute swap intent (using DEX)
   */
  private async executeSwap(intent: Intent): Promise<ExecutionResult> {
    logger.info({ intentId: intent.intentId }, 'Executing swap via Uniswap V3');
    
    try {
      // Extract swap parameters from intent
      const chainId = this.getChainId(intent.sourceChain || 'polygon');
      const amountIn = ethers.utils.formatUnits(intent.amountCommitment, 18);
      
      // Execute real swap via Uniswap
      const swapResult = await this.dexExecutor.executeSwap({
        tokenIn: intent.token || ethers.constants.AddressZero,
        tokenOut: intent.targetToken || ethers.constants.AddressZero,
        amountIn,
        recipient: intent.targetCommitment || this.solverId,
        chainId,
        slippageTolerance: 50, // 0.5%
      });
      
      if (!swapResult.success) {
        throw new Error(swapResult.error || 'Swap failed');
      }
      
      return {
        intentId: intent.intentId,
        solverId: this.solverId,
        success: true,
        txHash: swapResult.txHash,
        gasUsed: BigInt(swapResult.gasUsed || '0'),
        executionTime: 0,
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, intentId: intent.intentId }, 'Swap execution failed');
      
      // Fallback to simulation if real execution fails
      return {
        intentId: intent.intentId,
        solverId: this.solverId,
        success: false,
        error: errorMessage,
        executionTime: 0,
      };
    }
  }
  
  /**
   * Get numeric chain ID from chain name
   */
  private getChainId(chainName: string): number {
    const chainIds: Record<string, number> = {
      'ethereum': 1,
      'polygon': 137,
      'arbitrum': 42161,
      'optimism': 10,
      'base': 8453,
    };
    return chainIds[chainName.toLowerCase()] || 137;
  }
  
  /**
   * Execute cross-chain bridge intent
   */
  private async executeBridge(intent: Intent): Promise<ExecutionResult> {
    logger.info({ 
      intentId: intent.intentId,
      from: intent.sourceChain,
      to: intent.targetChain
    }, 'Executing cross-chain bridge via LayerZero');
    
    try {
      const sourceChainId = this.getChainId(intent.sourceChain || 'polygon');
      const destChainId = this.getChainId(intent.targetChain || 'ethereum');
      const amountIn = ethers.utils.formatUnits(intent.amountCommitment, 18);
      
      // Execute real bridge via LayerZero
      const bridgeResult = await this.bridge.bridgeTokens({
        tokenAddress: intent.token || ethers.constants.AddressZero,
        amount: amountIn,
        recipient: intent.targetCommitment || this.solverId,
        sourceChainId,
        destChainId,
        slippage: 50,
      });
      
      if (!bridgeResult.success) {
        throw new Error(bridgeResult.error || 'Bridge failed');
      }
      
      return {
        intentId: intent.intentId,
        solverId: this.solverId,
        success: true,
        txHash: bridgeResult.txHash,
        gasUsed: 300000n,
        executionTime: 0,
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, intentId: intent.intentId }, 'Bridge execution failed');
      
      // Fallback to simulation
      return {
        intentId: intent.intentId,
        solverId: this.solverId,
        success: false,
        error: errorMessage,
        executionTime: 0,
      };
    }
  }
  
  private async executeWithdrawal(): Promise<ExecutionResult> {
    throw new Error('Withdrawal execution not implemented - integrate with DepositWithdrawalService');
  }
  
  /**
   * Estimate execution cost for intent
   */
  private async estimateCost(intent: Intent): Promise<{
    executionCost: bigint;
    gasEstimate: bigint;
    route?: string[];
  }> {
    // Simple cost estimation
    const baseCost = 100000n; // Base gas cost
    
    let gasEstimate = baseCost;
    let route: string[] = [];
    
    switch (intent.action) {
      case 'transfer':
        gasEstimate = 21000n;
        break;
      case 'swap':
        gasEstimate = 150000n;
        route = ['Uniswap V3'];
        break;
      case 'bridge':
        gasEstimate = 300000n;
        route = ['LayerZero'];
        break;
      case 'withdraw':
        gasEstimate = 200000n;
        break;
    }
    
    // Gas price (simplified)
    const gasPrice = 50n * 10n ** 9n; // 50 gwei
    const executionCost = gasEstimate * gasPrice;
    
    return { executionCost, gasEstimate, route };
  }
  
  /**
   * Calculate potential profit from executing intent
   */
  private calculateProfit(intent: Intent, executionCost: bigint): bigint {
    // In real system: analyze order flow, MEV opportunities, fees
    // For now: assume 0.1% fee on transfer amount
    
    const amount = BigInt(intent.amountCommitment);
    const fee = amount / 1000n; // 0.1%
    
    return fee - executionCost;
  }
  
  /**
   * Get RPC URL for chain
   */
  private getRpcUrl(chain: string): string {
    const rpcUrls: Record<string, string> = {
      polygon: process.env.POLYGON_RPC || 'https://polygon-rpc.com',
      arbitrum: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
      optimism: process.env.OPTIMISM_RPC || 'https://mainnet.optimism.io',
      base: process.env.BASE_RPC || 'https://mainnet.base.org',
      zksync: process.env.ZKSYNC_RPC || 'https://mainnet.era.zksync.io',
    };
    
    return rpcUrls[chain] || rpcUrls.polygon;
  }
  
  /**
   * Get solver stats
   */
  getStats() {
    const totalExecutions = this.executions.size;
    const successful = Array.from(this.executions.values()).filter(e => e.success).length;
    const failed = totalExecutions - successful;
    
    return {
      solverId: this.solverId,
      reputation: this.reputationScore,
      totalExecutions,
      successful,
      failed,
      successRate: totalExecutions > 0 ? (successful / totalExecutions) * 100 : 0,
      pending: this.pendingIntents.size,
    };
  }
}

/**
 * Solver Network - Manages multiple solvers competing for intents
 */
export class SolverNetwork {
  private solvers: Map<string, Solver> = new Map();
  private intentAuctions: Map<string, SolverBid[]> = new Map();
  
  constructor() {
    logger.info('Solver Network initialized');
  }
  
  /**
   * Register a new solver
   */
  registerSolver(solver: Solver): void {
    const stats = solver.getStats();
    this.solvers.set(stats.solverId, solver);
    logger.info({ solverId: stats.solverId }, 'Solver registered');
  }
  
  /**
   * Request bids from all solvers for an intent
   */
  async requestBids(intent: Intent): Promise<SolverBid[]> {
    logger.info({ intentId: intent.intentId, solvers: this.solvers.size }, 'Requesting solver bids');
    
    const bidPromises = Array.from(this.solvers.values()).map(solver =>
      solver.evaluateIntent(intent)
    );
    
    const bids = (await Promise.all(bidPromises)).filter(bid => bid !== null) as SolverBid[];
    
    this.intentAuctions.set(intent.intentId, bids);
    
    logger.info({ intentId: intent.intentId, bids: bids.length }, 'Bids received');
    
    return bids;
  }
  
  /**
   * Select winning solver (lowest cost + highest reputation)
   */
  selectWinner(intentId: string): SolverBid | null {
    const bids = this.intentAuctions.get(intentId);
    
    if (!bids || bids.length === 0) {
      return null;
    }
    
    // Sort by execution cost (ascending) and reputation (descending)
    const sortedBids = bids.sort((a, b) => {
      const costDiff = Number(a.executionCost - b.executionCost);
      if (costDiff !== 0) return costDiff;
      
      // If costs equal, prefer higher reputation
      const solverA = this.solvers.get(a.solverId);
      const solverB = this.solvers.get(b.solverId);
      
      const repA = solverA?.getStats().reputation || 0;
      const repB = solverB?.getStats().reputation || 0;
      
      return repB - repA;
    });
    
    return sortedBids[0];
  }
  
  /**
   * Execute intent with winning solver
   */
  async executeIntent(intent: Intent): Promise<ExecutionResult | null> {
    // Get bids
    const bids = await this.requestBids(intent);
    
    if (bids.length === 0) {
      logger.warn({ intentId: intent.intentId }, 'No solvers available for intent');
      return null;
    }
    
    // Select winner
    const winningBid = this.selectWinner(intent.intentId);
    
    if (!winningBid) {
      return null;
    }
    
    logger.info({ 
      intentId: intent.intentId,
      solverId: winningBid.solverId,
      cost: winningBid.executionCost.toString()
    }, 'Solver selected, executing intent');
    
    // Execute with winning solver
    const solver = this.solvers.get(winningBid.solverId);
    
    if (!solver) {
      return null;
    }
    
    const result = await solver.executeIntent(intent);
    
    // Clean up auction
    this.intentAuctions.delete(intent.intentId);
    
    return result;
  }
  
  /**
   * Get network stats
   */
  getNetworkStats() {
    const solverStats = Array.from(this.solvers.values()).map(s => s.getStats());
    
    return {
      totalSolvers: this.solvers.size,
      activeSolvers: solverStats.filter(s => s.reputation > 0).length,
      pendingAuctions: this.intentAuctions.size,
      solvers: solverStats,
    };
  }
}
