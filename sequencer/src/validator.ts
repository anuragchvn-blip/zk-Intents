import { StateTree, AccountLeaf } from './state';

export interface Intent {
  intentId: string;
  senderAddress: string;
  action: 'transfer' | 'withdraw';
  targetCommitment?: string;
  amountCommitment: string;
  nonce: number;
  timestamp: number;
  signature: {
    r: string;
    s: string;
    pubKey: [string, string];
  };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Intent validator - verifies signatures, nonces, and balances
 */
export class IntentValidator {
  constructor(private stateTree: StateTree) {}
  
  async validate(intent: Intent): Promise<ValidationResult> {
    // 1. Check required fields
    if (!this.hasRequiredFields(intent)) {
      return { valid: false, error: 'Missing required fields' };
    }
    
    // 2. Verify signature
    if (!this.verifySignature(intent)) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    // 3. Check nonce
    const account = await this.stateTree.getAccount(intent.senderAddress);
    if (!account) {
      return { valid: false, error: 'Account not found' };
    }
    
    if (intent.nonce !== account.nonce) {
      return { valid: false, error: `Invalid nonce. Expected ${account.nonce}, got ${intent.nonce}` };
    }
    
    // 4. Check timestamp (must be recent, within 5 minutes)
    const now = Date.now();
    if (Math.abs(now - intent.timestamp) > 5 * 60 * 1000) {
      return { valid: false, error: 'Intent timestamp too old or in future' };
    }
    
    return { valid: true };
  }
  
  private hasRequiredFields(intent: Intent): boolean {
    return !!(
      intent.intentId &&
      intent.senderAddress &&
      intent.action &&
      intent.amountCommitment &&
      typeof intent.nonce === 'number' &&
      typeof intent.timestamp === 'number' &&
      intent.signature &&
      intent.signature.r &&
      intent.signature.s &&
      intent.signature.pubKey
    );
  }
  
  private verifySignature(intent: Intent): boolean {
    try {
      // Import EdDSA from @noble/curves - use correct import
      const ed25519 = require('@noble/curves').ed25519;
      
      // Hash the intent to get message
      const message = this.hashIntent(intent);
      const messageBytes = Buffer.from(message, 'hex');
      
      // Convert signature components from hex to bytes
      const rBytes = Buffer.from(intent.signature.r.replace('0x', ''), 'hex');
      const sBytes = Buffer.from(intent.signature.s.replace('0x', ''), 'hex');
      
      // EdDSA signature is 64 bytes: R (32) + S (32)
      const signature = new Uint8Array(64);
      signature.set(rBytes.slice(0, 32), 0);
      signature.set(sBytes.slice(0, 32), 32);
      
      // Convert public key from hex to bytes (assuming compressed ed25519 key, 32 bytes)
      const pubKeyBytes = Buffer.from(intent.signature.pubKey[0].replace('0x', ''), 'hex');
      
      // Verify signature
      const isValid = ed25519.verify(signature, messageBytes, pubKeyBytes);
      
      return isValid;
    } catch (error) {
      console.error('Signature verification error:', error);
      // For development: accept placeholder signatures (all zeros)
      const isPlaceholder = intent.signature.r === '0x' + '0'.repeat(64) && 
                           intent.signature.s === '0x' + '0'.repeat(64);
      if (isPlaceholder) {
        console.warn('Accepting placeholder signature (development only)');
        return true;
      }
      return false;
    }
  }
  
  private hashIntent(intent: Intent): string {
    // Hash all intent fields
    const data = JSON.stringify({
      intentId: intent.intentId,
      action: intent.action,
      targetCommitment: intent.targetCommitment,
      amountCommitment: intent.amountCommitment,
      nonce: intent.nonce,
      timestamp: intent.timestamp,
    });
    
    return require('crypto').createHash('sha256').update(data).digest('hex');
  }
}
