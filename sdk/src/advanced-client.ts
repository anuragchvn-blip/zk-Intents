import { ZkIntentsClient } from './client';
import pino from 'pino';

const logger = pino({ level: 'info' });

interface CrossChainTransferOptions {
  targetChain: number;
  tokenAddress: string;
  amount: string;
  recipientAddress: string;
}

interface IntentSolverBid {
  solver: string;
  estimatedFee: string;
  estimatedTime: number;
  reputation: number;
}

/**
 * Enhanced SDK with cross-chain and advanced features
 */
export class ZkIntentsAdvancedClient extends ZkIntentsClient {
  /**
   * Execute cross-chain transfer with automatic routing
   */
  async crossChainTransfer(options: CrossChainTransferOptions): Promise<{
    intentId: string;
    estimatedTime: number;
    bridgeFee: string;
  }> {
    if (!this.getSession()) {
      throw new Error('No active session');
    }
    
    logger.info({
      targetChain: options.targetChain,
      amount: options.amount,
    }, 'Initiating cross-chain transfer');
    
    // Submit cross-chain intent
    const response = await fetch(`${this.sequencerUrl}/api/v1/cross-chain/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceChain: 137, // Polygon
        targetChain: options.targetChain,
        tokenAddress: options.tokenAddress,
        amount: options.amount,
        recipientAddress: options.recipientAddress,
        senderAddress: this.getSession()!.address,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Cross-chain transfer failed');
    }
    
    const result = await response.json();
    
    return {
      intentId: result.intentId,
      estimatedTime: result.estimatedTime,
      bridgeFee: result.bridgeFee,
    };
  }
  
  /**
   * Get solver bids for intent (competitive pricing)
   */
  async getSolverBids(intentId: string): Promise<IntentSolverBid[]> {
    const response = await fetch(`${this.sequencerUrl}/api/v1/intents/${intentId}/bids`);
    
    if (!response.ok) {
      throw new Error('Failed to get solver bids');
    }
    
    return await response.json();
  }
  
  /**
   * Accept solver bid and execute intent
   */
  async acceptSolverBid(intentId: string, solverAddress: string): Promise<{ txHash: string }> {
    const response = await fetch(`${this.sequencerUrl}/api/v1/intents/${intentId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solverAddress }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to accept solver bid');
    }
    
    return await response.json();
  }
  
  /**
   * Propagate intent across multiple chains for best execution
   */
  async propagateIntent(intent: {
    action: string;
    tokenAddress: string;
    amount: string;
    targetChains: number[];
  }): Promise<{ propagationId: string }> {
    const response = await fetch(`${this.sequencerUrl}/api/v1/intents/propagate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...intent,
        senderAddress: this.getSession()!.address,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Intent propagation failed');
    }
    
    return await response.json();
  }
  
  /**
   * Get optimal chain routing for transfer
   */
  async getOptimalRoute(tokenAddress: string, amount: string): Promise<{
    targetChain: number;
    chainName: string;
    estimatedFee: string;
    liquidity: string;
  }> {
    const response = await fetch(
      `${this.sequencerUrl}/api/v1/routing/optimal?token=${tokenAddress}&amount=${amount}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to get optimal route');
    }
    
    return await response.json();
  }
  
  /**
   * Check data availability for a batch
   */
  async checkDataAvailability(batchId: string): Promise<{
    available: boolean;
    commitment: string;
    provider: string;
  }> {
    const response = await fetch(`${this.sequencerUrl}/api/v1/batches/${batchId}/da`);
    
    if (!response.ok) {
      throw new Error('Failed to check data availability');
    }
    
    return await response.json();
  }
  
  /**
   * Get network statistics (decentralized sequencer)
   */
  async getNetworkStats(): Promise<{
    totalSequencers: number;
    activeSequencers: number;
    currentEpoch: number;
    isLeader: boolean;
  }> {
    const response = await fetch(`${this.sequencerUrl}/api/v1/network/stats`);
    
    if (!response.ok) {
      throw new Error('Failed to get network stats');
    }
    
    return await response.json();
  }
  
  /**
   * Subscribe to cross-chain events
   */
  subscribeToCrossChainEvents(
    callback: (event: {
      type: string;
      intentId: string;
      sourceChain: number;
      targetChain: number;
      status: string;
    }) => void
  ): () => void {
    const ws = new WebSocket(this.sequencerUrl.replace('http', 'ws'));
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'cross-chain' }));
    };
    
    ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        if (update.channel === 'cross-chain') {
          callback(update.data);
        }
      } catch (error) {
        logger.error({ error }, 'Failed to parse cross-chain event');
      }
    };
    
    return () => ws.close();
  }
  
  /**
   * Get intent execution history across chains
   */
  async getIntentHistory(options?: {
    limit?: number;
    offset?: number;
    chain?: number;
  }): Promise<Array<{
    intentId: string;
    action: string;
    amount: string;
    chain: number;
    status: string;
    timestamp: number;
    txHash?: string;
  }>> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.chain) params.append('chain', options.chain.toString());
    
    const response = await fetch(
      `${this.sequencerUrl}/api/v1/intents/history?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${this.getSession()?.address}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to get intent history');
    }
    
    return await response.json();
  }
  
  /**
   * Estimate total cost for intent including all fees
   */
  async estimateIntentCost(intent: {
    action: string;
    amount: string;
    targetChain?: number;
  }): Promise<{
    sequencerFee: string;
    bridgeFee: string;
    gasFee: string;
    totalCost: string;
  }> {
    const response = await fetch(`${this.sequencerUrl}/api/v1/intents/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(intent),
    });
    
    if (!response.ok) {
      throw new Error('Failed to estimate intent cost');
    }
    
    return await response.json();
  }
}

// Export all SDK components
export * from './client';
export * from './session';
export * from './types';
