import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export class ZkClient {
  private baseUrl: string;
  private ws: WebSocket | null = null;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
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
      const credential = await startRegistration({
        challenge: challengeB64,
        rp: {
          name: 'zk-Intents',
          id: 'localhost',
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
      const enrollRes = await fetch(`${this.baseUrl}/api/v1/auth/passkey/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          credentialId: credential.id,
          publicKey: credential.response.publicKey,
        }),
      });

      if (!enrollRes.ok) {
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
      const credential = await startAuthentication({
        challenge,
        rpId: 'localhost',
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

  clearSession(): void {
    localStorage.removeItem('zk-intents-session');
    window.dispatchEvent(new Event('session-update'));
  }

  async submitIntent(intent: {
    senderAddress: string;
    action: 'transfer' | 'withdraw';
    amountCommitment: string;
    targetCommitment?: string;
    nonce?: number;
  }): Promise<{ intentId: string; status: string }> {
    try {
      // Generate intentId
      const intentId = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Build full intent matching validator schema
      const fullIntent = {
        intentId,
        senderAddress: intent.senderAddress,
        action: intent.action,
        amountCommitment: intent.amountCommitment,
        targetCommitment: intent.targetCommitment || '0x0',
        nonce: intent.nonce || 0,
        timestamp: Date.now(),
        signature: {
          r: '0x' + '0'.repeat(64), // Placeholder signature
          s: '0x' + '0'.repeat(64),
          pubKey: ['0x' + '0'.repeat(64), '0x' + '0'.repeat(64)] as [string, string],
        },
      };

      const res = await fetch(`${this.baseUrl}/api/v1/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullIntent),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit intent');
      }

      return {
        intentId: data.intentId,
        status: data.status,
      };
    } catch (e) {
      console.error('Failed to submit intent', e);
      throw e;
    }
  }

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

export const api = new ZkClient();
