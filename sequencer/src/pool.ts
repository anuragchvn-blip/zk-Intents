import { Intent } from './validator';

export { Intent };

/**
 * Transaction pool - manages pending intents
 */
export class TransactionPool {
  private pool: Map<string, Intent> = new Map();
  private readonly MAX_POOL_SIZE = 10000;
  
  /**
   * Add intent to pool
   */
  async add(intent: Intent): Promise<string> {
    if (this.pool.size >= this.MAX_POOL_SIZE) {
      throw new Error('Transaction pool is full');
    }
    
    if (this.pool.has(intent.intentId)) {
      throw new Error('Intent already in pool');
    }
    
    this.pool.set(intent.intentId, intent);
    return intent.intentId;
  }
  
  /**
   * Get intents for batching
   */
  getForBatch(maxCount: number): Intent[] {
    const intents: Intent[] = [];
    
    for (const [, intent] of this.pool) {
      if (intents.length >= maxCount) break;
      intents.push(intent);
    }
    
    // Sort by nonce to ensure correct ordering
    return intents.sort((a, b) => a.nonce - b.nonce);
  }
  
  /**
   * Remove processed intents
   */
  remove(intentIds: string[]): void {
    intentIds.forEach(id => this.pool.delete(id));
  }
  
  /**
   * Get pool size
   */
  size(): number {
    return this.pool.size;
  }
  
  /**
   * Get intent by ID
   */
  get(intentId: string): Intent | undefined {
    return this.pool.get(intentId);
  }
}
