import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export class ZkClient {
  private baseUrl: string;
  private ws: WebSocket | null = null;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): HeadersInit {
    const session = this.loadSession();
    if (session?.sessionId) {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.sessionId}`,
      };
    }
    return { 'Content-Type': 'application/json' };
  }

  async checkHealth(): Promise<{ ok: boolean; data?: any }> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      const data = await res.json();
      return { ok: res.ok, data };
    } catch (e) {
      console.error('Sequencer offline', e);
      return { ok: false };
    }
  }

  // NEW: Step 1 - Send OTP to email for registration
  async registerWithEmail(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      return { success: true, message: data.message };
    } catch (e: any) {
      console.error('Failed to send registration OTP', e);
      throw e;
    }
  }

  // NEW: Step 2 - Verify OTP and create account (no password)
  async verifyOTPAndCreateAccount(email: string, otp: string): Promise<{ address: string; sessionId: string; email: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'OTP verification failed');
      }

      const sessionData = await res.json();
      
      // Save session
      localStorage.setItem('zk-intents-session', JSON.stringify({ ...sessionData, email }));
      window.dispatchEvent(new Event('session-update'));
      
      return { ...sessionData, email };
    } catch (e: any) {
      console.error('Failed to verify OTP', e);
      throw e;
    }
  }

  // NEW: Step 3 (Optional) - Enroll passkey after account creation
  async enrollPasskey(email: string): Promise<{ success: boolean; credentialId: string }> {
    try {
      // Step 1: Generate random challenge for WebAuthn
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      
      // Convert to base64url string
      const challengeB64 = btoa(String.fromCharCode.apply(null, Array.from(challenge)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      // Step 2: Create passkey using WebAuthn
      // Get current domain for RP ID (remove port if present)
      const rpId = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      
      const credential = await startRegistration({
        challenge: challengeB64,
        rp: {
          name: 'zk-Intents',
          id: rpId,
        },
        user: {
          id: email,
          name: email,
          displayName: email,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        timeout: 60000,
        attestation: 'none',
      });

      // Step 3: Enroll passkey with sequencer
      // Convert publicKey to base64 string
      const pkData = credential.response.publicKey;
      const pkArray = pkData ? (typeof pkData === 'string' ? new TextEncoder().encode(pkData) : new Uint8Array(pkData)) : new Uint8Array(0);
      let publicKeyBase64 = '';
      for (let i = 0; i < pkArray.length; i++) {
        publicKeyBase64 += String.fromCharCode(pkArray[i]);
      }
      publicKeyBase64 = btoa(publicKeyBase64);
      
      const enrollRes = await fetch(`${this.baseUrl}/api/v1/auth/passkey/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          credentialId: credential.id,
          publicKey: publicKeyBase64,
        }),
      });

      if (!enrollRes.ok) {
        const errorText = await enrollRes.text();
        console.error('Passkey enrollment failed:', errorText);
        throw new Error('Failed to enroll passkey');
      }

      // Step 4: Update session with credential ID
      const session = this.loadSession();
      if (session) {
        const updatedSession = {
          ...session,
          credentialId: credential.id,
        };
        localStorage.setItem('zk-intents-session', JSON.stringify(updatedSession));
        window.dispatchEvent(new Event('session-update'));
      }

      return { success: true, credentialId: credential.id };
    } catch (e: any) {
      console.error('Failed to enroll passkey', e);
      throw e;
    }
  }

  // NEW: Login Step 1 - Send OTP to email for login
  async sendLoginOTP(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      return { success: true, message: data.message };
    } catch (e: any) {
      console.error('Failed to send login OTP', e);
      throw e;
    }
  }

  // NEW: Login Step 2 - Verify OTP and login
  async loginWithOTP(email: string, otp: string): Promise<{ address: string; sessionId: string; email: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/auth/login/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }

      const sessionData = await res.json();
      
      // Save session
      localStorage.setItem('zk-intents-session', JSON.stringify({ ...sessionData, email }));
      window.dispatchEvent(new Event('session-update'));
      
      return { ...sessionData, email };
    } catch (e: any) {
      console.error('Failed to login with OTP', e);
      throw e;
    }
  }

  // Passkey Login (instant authentication)
  async loginWithPasskey(email: string): Promise<{ address: string; sessionId: string; credentialId: string; email: string }> {
    try {
      // Step 1: Get challenge from sequencer
      const res = await fetch(`${this.baseUrl}/api/v1/auth/passkey/challenge?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error('Account not found');
      const { challenge, allowCredentials } = await res.json();

      // Step 2: Authenticate with WebAuthn
      // Get current domain for RP ID (remove port if present)
      const rpId = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      
      const credential = await startAuthentication({
        challenge,
        rpId: rpId,
        allowCredentials,
        userVerification: 'preferred',
      });

      // Step 3: Verify authentication with sequencer
      const verifyRes = await fetch(`${this.baseUrl}/api/v1/auth/passkey/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          credential,
        }),
      });

      if (!verifyRes.ok) throw new Error('Login failed');
      
      const sessionData = await verifyRes.json();
      
      // Save session
      localStorage.setItem('zk-intents-session', JSON.stringify({ ...sessionData, email }));
      window.dispatchEvent(new Event('session-update'));
      
      return { ...sessionData, email };
    } catch (e) {
      console.error('Login failed', e);
      throw e;
    }
  }

  loadSession(): { address: string; sessionId: string; credentialId: string; email: string } | null {
    try {
      const data = localStorage.getItem('zk-intents-session');
      if (!data) return null;
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }

  async clearSession(): Promise<void> {
    try {
      // Call backend logout endpoint
      const session = this.loadSession();
      if (session?.sessionId) {
        await fetch(`${this.baseUrl}/api/v1/auth/logout`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
        });
      }
    } catch (e) {
      console.error('Logout API call failed', e);
    } finally {
      // Always clear local session
      localStorage.removeItem('zk-intents-session');
      window.dispatchEvent(new Event('session-update'));
    }
  }

  // NOTE: submitIntent removed - must implement proper EdDSA signing before use
  // Placeholder signatures are rejected by validator for security

  async getAccountState(address: string): Promise<any> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/state/${address}`);
      if (!res.ok) {
        return null;
      }
      return await res.json();
    } catch (e) {
      console.error('Failed to get account state', e);
      return null;
    }
  }

  async deposit(params: {
    userAddress: string;
    tokenAddress: string;
    amount: string;
    chainId?: number;
  }): Promise<{ success: boolean; txHash?: string; l2Balance?: string; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/deposit`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(params),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Deposit failed');
      }

      return data;
    } catch (e: any) {
      console.error('Deposit failed', e);
      return { success: false, error: e.message };
    }
  }

  async initiateWithdrawal(params: {
    userAddress: string;
    tokenAddress: string;
    amount: string;
    recipient: string;
  }): Promise<{ success: boolean; withdrawalId?: string; message?: string; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/withdraw/initiate`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(params),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Withdrawal initiation failed');
      }

      return data;
    } catch (e: any) {
      console.error('Withdrawal initiation failed', e);
      return { success: false, error: e.message };
    }
  }

  async completeWithdrawal(params: {
    userAddress: string;
    tokenAddress: string;
    amount: string;
    recipient: string;
    merkleProof: string[];
  }): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/withdraw/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Withdrawal completion failed');
      }

      return data;
    } catch (e: any) {
      console.error('Withdrawal completion failed', e);
      return { success: false, error: e.message };
    }
  }

  async getBalance(address: string): Promise<{ address: string; balance: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/balance/${address}`);
      
      if (!res.ok) {
        throw new Error('Failed to get balance');
      }

      return await res.json();
    } catch (e: any) {
      console.error('Failed to get balance', e);
      return { address, balance: '0' };
    }
  }

  connectWebSocket(onMessage: (data: any) => void): void {
    try {
      const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.ws?.send(JSON.stringify({ type: 'subscribe' }));
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onMessage(data);
      };

      this.ws.onerror = () => {
        // Silently handle WebSocket errors - it's optional
        console.warn('WebSocket connection failed (optional feature)');
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
      };
    } catch (e) {
      console.warn('WebSocket not available (optional feature)');
    }
  }

  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Import config to get production sequencer URL
import { SEQUENCER_URL } from './config';

export const api = new ZkClient(SEQUENCER_URL);
