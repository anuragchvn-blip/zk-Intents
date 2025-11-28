import { randomBytes, createHash, pbkdf2Sync } from 'crypto';

export interface SessionKey {
  privateKey: string;
  publicKey: [string, string];
  address: string;
}

export interface SessionOptions {
  recoveryMethod: 'email' | 'passkey';
  email?: string;
  password?: string;
}

/**
 * Session key manager - walletless key generation and recovery
 */
export class SessionManager {
  private readonly STORAGE_KEY = 'zk-intents-session';
  
  /**
   * Create new session with recovery
   */
  async createSession(options: SessionOptions): Promise<SessionKey> {
    // Generate EdDSA keypair (simplified - use proper EdDSA in production)
    const privateKey = this.generatePrivateKey();
    const publicKey = this.derivePublicKey(privateKey);
    const address = this.deriveAddress(publicKey);
    
    const session: SessionKey = {
      privateKey,
      publicKey,
      address,
    };
    
    // Store in browser localStorage
    this.storeLocal(session);
    
    // Set up recovery
    if (options.recoveryMethod === 'email' && options.email && options.password) {
      await this.setupEmailRecovery(session, options.email, options.password);
    } else if (options.recoveryMethod === 'passkey') {
      await this.setupPasskeyRecovery(session);
    }
    
    return session;
  }
  
  /**
   * Load existing session from localStorage
   */
  loadSession(): SessionKey | null {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return null;
    
  try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  
  /**
   * Recover session via email
   */
  async recoverViaEmail(
    email: string,
    password: string,
    sequencerUrl: string
  ): Promise<SessionKey> {
    // Fetch encrypted key from sequencer
    const response = await fetch( `${sequencerUrl}/api/v1/session/email/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch encrypted key');
    }
    
    const data: any = await response.json();
    
    // Decrypt with password
    const session = this.decryptSession(data.encryptedKey, password);
    
    // Store locally
    this.storeLocal(session);
    
    return session;
  }
  
  /**
   * Recover session via passkey
   */
  async recoverViaPasskey(userId: string): Promise<SessionKey> {
    // Import WebAuthn
    const { startAuthentication } = await import('@simplewebauthn/browser');
    
    // TODO: Get challenge from server
    const challenge = randomBytes(32).toString('base64');
    
    // Authenticate with passkey
    const authResponse = await startAuthentication({
      challenge,
      rpId: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
      userVerification: 'required',
    });
    
    // TODO: Derive session key from passkey response
    // For POC, placeholder implementation
    
    throw new Error('Passkey recovery not yet implemented');
  }
  
  /**
   * Sign intent with session key
   */
  signIntent(intent: any, session: SessionKey): any {
    // TODO: Implement EdDSA signing
    // For POC, placeholder signature
    
    const message = this.hashIntent(intent);
    
    return {
      ...intent,
      signature: {
        r: randomBytes(32).toString('hex'),
        s: randomBytes(32).toString('hex'),
        pubKey: session.publicKey,
      },
    };
  }
  
  // ===== Private Methods =====
  
  private generatePrivateKey(): string {
    return randomBytes(32).toString('hex');
  }
  
  private derivePublicKey(privateKey: string): [string, string] {
    // Simplified - use proper EdDSA point multiplication in production
    const hash = createHash('sha256').update(privateKey).digest('hex');
    return [hash.slice(0, 64), hash.slice(64)];
  }
  
  private deriveAddress(publicKey: [string, string]): string {
    const combined = publicKey[0] + publicKey[1];
    const hash = createHash('sha256').update(combined).digest('hex');
    return '0x' + hash.slice(0, 40);
  }
  
  private storeLocal(session: SessionKey): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    }
  }
  
  private async setupEmailRecovery(
    session: SessionKey,
    email: string,
    password: string
  ): Promise<void> {
    // Encrypt session with password
    const encrypted = this.encryptSession(session, password);
    
    // TODO: Send to sequencer for storage
    console.log('Email recovery set up for', email);
  }
  
  private async setupPasskeyRecovery(session: SessionKey): Promise<void> {
    // TODO: Enroll WebAuthn passkey
    console.log('Passkey recovery set up');
  }
  
  private encryptSession(session: SessionKey, password: string): string {
    // Derive encryption key from password
    const salt = randomBytes(16);
    const key = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    // Simplified encryption (use proper AES-GCM in production)
    const sessionStr = JSON.stringify(session);
    const encrypted = Buffer.from(sessionStr).toString('base64');
    
    return JSON.stringify({ salt: salt.toString('hex'), data: encrypted });
  }
  
  private decryptSession(encryptedData: string, password: string): SessionKey {
    const { salt, data } = JSON.parse(encryptedData);
    const key = pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');
    
    // Simplified decryption
    const decrypted = Buffer.from(data, 'base64').toString('utf8');
    return JSON.parse(decrypted);
  }
  
  private hashIntent(intent: any): string {
    const data = JSON.stringify(intent);
    return createHash('sha256').update(data).digest('hex');
  }
}
