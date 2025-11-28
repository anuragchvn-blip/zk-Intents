import { SessionManager, SessionKey, SessionOptions } from './session';

export interface Intent {
  intentId: string;
  senderAddress: string;
  action: 'transfer' | 'withdraw';
  targetCommitment?: string;
  amountCommitment: string;
  nonce: number;
  timestamp: number;
}

export interface AccountState {
  address: string;
  balanceCommitment: string;
  nonce: number;
  publicKey: string;
}

/**
 * zk-Intents SDK Client
 */
export class ZkIntentsClient {
  private sessionManager: SessionManager;
  private session: SessionKey | null = null;
  protected sequencerUrl: string;
  
  constructor(sequencerUrl: string) {
    this.sequencerUrl = sequencerUrl;
    this.sessionManager = new SessionManager();
    this.session = this.sessionManager.loadSession();
  }
  
  /**
   * Create new walletless session
   */
  async createSession(options: SessionOptions): Promise<SessionKey> {
    this.session = await this.sessionManager.createSession(options);
    return this.session;
  }
  
  /**
   * Get current session
   */
  getSession(): SessionKey | null {
    return this.session;
  }
  
  /**
   * Submit intent to sequencer
   */
  async submitIntent(params: {
    action: 'transfer' | 'withdraw';
    targetCommitment?: string;
    amountCommitment: string;
  }): Promise<{ intentId: string; status: string }> {
    if (!this.session) {
      throw new Error('No active session. Call createSession() first.');
    }
    
    // Get current nonce
    const state = await this.queryState(this.session.address);
    
    // Create intent
    const intent: Intent = {
      intentId: this.generateIntentId(),
      senderAddress: this.session.address,
      action: params.action,
      targetCommitment: params.targetCommitment,
      amountCommitment: params.amountCommitment,
      nonce: state.nonce,
      timestamp: Date.now(),
    };
    
    // Sign intent
    const signedIntent = this.sessionManager.signIntent(intent, this.session);
    
    // Submit to sequencer
    const response = await fetch(`${this.sequencerUrl}/api/v1/intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedIntent),
    });
    
    if (!response.ok) {
      const error: any = await response.json();
      throw new Error(error.error || 'Failed to submit intent');
    }
    
    return await response.json() as { intentId: string; status: string };
  }
  
  /**
   * Query account state
   */
  async queryState(address: string): Promise<AccountState> {
    const response = await fetch(`${this.sequencerUrl}/api/v1/state/${address}`);
    
    if (!response.ok) {
      throw new Error('Failed to query state');
    }
    
    return await response.json() as AccountState;
  }
  
  /**
   * Deposit funds (L1 → L2)
   */
  async deposit(amount: bigint): Promise<string> {
    // TODO: Interact with L1 contract
    throw new Error('Deposit not yet implemented');
  }
  
  /**
   * Withdraw funds (L2 → L1)
   */
  async withdraw(amount: bigint): Promise<string> {
    if (!this.session) {
      throw new Error('No active session');
    }
    
    // Create withdrawal intent
    const result = await this.submitIntent({
      action: 'withdraw',
      amountCommitment: amount.toString(),
    });
    
    return result.intentId;
  }
  
  /**
   * Subscribe to real-time updates
   */
  subscribeToUpdates(callback: (update: any) => void): () => void {
    const ws = new WebSocket(this.sequencerUrl.replace('http', 'ws'));
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe' }));
    };
    
    ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        callback(update);
      } catch (error) {
        console.error('Failed to parse WebSocket message', error);
      }
    };
    
    // Return unsubscribe function
    return () => ws.close();
  }
  
  private generateIntentId(): string {
    return `intent_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

// Export all types and classes
export { SessionManager, SessionKey, SessionOptions };
export * from './session';
export * from './types';
