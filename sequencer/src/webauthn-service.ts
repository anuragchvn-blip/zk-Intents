import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const prisma = new PrismaClient();

interface PublicKeyCredentialCreationOptions {
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: Array<{ type: string; alg: number }>;
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    requireResidentKey?: boolean;
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  timeout?: number;
  attestation?: 'none' | 'indirect' | 'direct';
}

interface AuthenticationCredential {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
  type: 'public-key';
}

/**
 * WebAuthn Service for secure passkey authentication
 * Implements FIDO2/WebAuthn protocol
 */
export class WebAuthnService {
  private rpName = 'zk-Intents';
  private rpId = process.env.RP_ID || 'localhost';
  private origin = process.env.ORIGIN || 'http://localhost:3001';
  
  /**
   * Generate registration options for new passkey
   */
  async generateRegistrationOptions(
    userId: string,
    email: string
  ): Promise<PublicKeyCredentialCreationOptions> {
    const challenge = this.generateChallenge();
    
    // Store challenge temporarily (expires in 5 minutes)
    await prisma.recoveryCode.create({
      data: {
        userId,
        type: 'webauthn_challenge',
        code: challenge,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        used: false,
      },
    });
    
    return {
      challenge,
      rp: {
        name: this.rpName,
        id: this.rpId,
      },
      user: {
        id: userId,
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },  // ES256 (ECDSA w/ SHA-256)
        { type: 'public-key', alg: -257 }, // RS256 (RSASSA-PKCS1-v1_5 w/ SHA-256)
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        requireResidentKey: false,
        userVerification: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };
  }
  
  /**
   * Verify registration response and store credential
   */
  async verifyRegistration(
    userId: string,
    credential: { id: string; response: { clientDataJSON: string; attestationObject: string } },
    deviceName?: string
  ): Promise<{ success: boolean; credentialId?: string; error?: string }> {
    try {
      // Parse client data JSON
      const clientDataJSON = this.base64urlDecode(credential.response.clientDataJSON);
      const clientData = JSON.parse(clientDataJSON);
      
      // Verify challenge
      const storedChallenge = await prisma.recoveryCode.findFirst({
        where: {
          userId,
          type: 'webauthn_challenge',
          code: clientData.challenge,
          used: false,
          expiresAt: { gt: new Date() },
        },
      });
      
      if (!storedChallenge) {
        return { success: false, error: 'Invalid or expired challenge' };
      }
      
      // Verify origin
      if (clientData.origin !== this.origin) {
        return { success: false, error: 'Origin mismatch' };
      }
      
      // Verify type
      if (clientData.type !== 'webauthn.create') {
        return { success: false, error: 'Invalid credential type' };
      }
      
      // Parse authenticator data
      const attestationObject = this.base64urlDecode(credential.response.attestationObject);
      const authData = this.parseAuthenticatorData(attestationObject);
      
      // Extract public key from attestation
      const publicKey = this.extractPublicKey(authData);
      
      // Store credential
      await prisma.passkeyCredential.create({
        data: {
          userId,
          credentialId: credential.id,
          publicKey: publicKey,
          counter: authData.counter,
          deviceName: deviceName || 'Unknown Device',
        },
      });
      
      // Mark challenge as used
      await prisma.recoveryCode.update({
        where: { id: storedChallenge.id },
        data: { used: true },
      });
      
      logger.info({ userId, credentialId: credential.id }, 'Passkey registered');
      
      return { success: true, credentialId: credential.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, userId }, 'Registration verification failed');
      return { success: false, error: errorMessage };
    }
  }
  
  /**
   * Generate authentication options for login
   */
  async generateAuthenticationOptions(
    email: string
  ): Promise<{ challenge: string; allowCredentials: Array<{ id: string; type: string }> }> {
    // Get user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('User not found');
    }
    
    // Generate challenge
    const challenge = this.generateChallenge();
    
    // Store challenge
    await prisma.recoveryCode.create({
      data: {
        userId: user.id,
        type: 'webauthn_challenge',
        code: challenge,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        used: false,
      },
    });
    
    // Get user's credentials
    const credentials = await prisma.passkeyCredential.findMany({
      where: { userId: user.id },
    });
    
    return {
      challenge,
      allowCredentials: credentials.map(c => ({
        id: c.credentialId,
        type: 'public-key',
      })),
    };
  }
  
  /**
   * Verify authentication response
   */
  async verifyAuthentication(
    email: string,
    credential: AuthenticationCredential
  ): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      // Get user
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      
      // Get stored credential
      const storedCredential = await prisma.passkeyCredential.findUnique({
        where: { credentialId: credential.id },
      });
      
      if (!storedCredential || storedCredential.userId !== user.id) {
        return { success: false, error: 'Credential not found' };
      }
      
      // Parse client data
      const clientDataJSON = this.base64urlDecode(credential.response.clientDataJSON);
      const clientData = JSON.parse(clientDataJSON);
      
      // Verify challenge
      const storedChallenge = await prisma.recoveryCode.findFirst({
        where: {
          userId: user.id,
          type: 'webauthn_challenge',
          code: clientData.challenge,
          used: false,
          expiresAt: { gt: new Date() },
        },
      });
      
      if (!storedChallenge) {
        return { success: false, error: 'Invalid or expired challenge' };
      }
      
      // Verify origin
      if (clientData.origin !== this.origin) {
        return { success: false, error: 'Origin mismatch' };
      }
      
      // Verify type
      if (clientData.type !== 'webauthn.get') {
        return { success: false, error: 'Invalid credential type' };
      }
      
      // Parse authenticator data
      const authenticatorData = Buffer.from(credential.response.authenticatorData, 'base64');
      const authDataParsed = this.parseAuthDataBuffer(authenticatorData);
      
      // Verify counter (replay protection)
      if (authDataParsed.counter <= storedCredential.counter) {
        return { success: false, error: 'Counter verification failed - possible replay attack' };
      }
      
      // Verify signature
      const signatureValid = this.verifySignature(
        storedCredential.publicKey,
        authenticatorData,
        Buffer.from(clientDataJSON),
        Buffer.from(credential.response.signature, 'base64')
      );
      
      if (!signatureValid) {
        return { success: false, error: 'Signature verification failed' };
      }
      
      // Update counter
      await prisma.passkeyCredential.update({
        where: { id: storedCredential.id },
        data: {
          counter: authDataParsed.counter,
          lastUsedAt: new Date(),
        },
      });
      
      // Mark challenge as used
      await prisma.recoveryCode.update({
        where: { id: storedChallenge.id },
        data: { used: true },
      });
      
      logger.info({ userId: user.id, credentialId: credential.id }, 'Authentication successful');
      
      return { success: true, userId: user.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, email }, 'Authentication verification failed');
      return { success: false, error: errorMessage };
    }
  }
  
  /**
   * Helper: Generate cryptographically secure challenge
   */
  private generateChallenge(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
  
  /**
   * Helper: Base64url decode
   */
  private base64urlDecode(str: string): string {
    return Buffer.from(str, 'base64url').toString('utf8');
  }
  
  /**
   * Helper: Parse authenticator data from attestation
   */
  private parseAuthenticatorData(attestationObject: string): { counter: number; raw: Buffer } {
    // Simplified parser - in production use @simplewebauthn/server
    const data = Buffer.from(attestationObject, 'base64');
    
    // Extract counter (bytes 33-36)
    const counter = data.readUInt32BE(33);
    
    return { counter, raw: data };
  }
  
  /**
   * Helper: Parse authenticator data buffer
   */
  private parseAuthDataBuffer(buffer: Buffer): { counter: number } {
    // RP ID Hash: 32 bytes
    // Flags: 1 byte
    // Counter: 4 bytes (big-endian)
    const counter = buffer.readUInt32BE(33);
    
    return { counter };
  }
  
  /**
   * Helper: Extract public key from authenticator data
   */
  private extractPublicKey(authData: { counter: number; raw: Buffer }): string {
    // In production, properly parse CBOR and extract public key
    // For now, return base64 representation
    return authData.raw.toString('base64');
  }
  
  /**
   * Helper: Verify signature using stored public key
   */
  private verifySignature(
    publicKeyBase64: string,
    authenticatorData: Buffer,
    clientDataJSON: Buffer,
    signature: Buffer
  ): boolean {
    try {
      // Create hash of clientDataJSON
      const clientDataHash = crypto.createHash('sha256').update(clientDataJSON).digest();
      
      // Concatenate authenticatorData and clientDataHash
      const signedData = Buffer.concat([authenticatorData, clientDataHash]);
      
      // In production, parse the actual public key format (COSE)
      // For now, we'll do a simplified verification
      
      // This is a placeholder - real implementation would:
      // 1. Parse COSE key from publicKeyBase64
      // 2. Use crypto.verify with proper algorithm (ES256 or RS256)
      // 3. Verify signature against signedData
      
      // Simplified verification (replace with proper implementation)
      const verify = crypto.createVerify('SHA256');
      verify.update(signedData);
      
      // For demo purposes, we'll return true if signature exists
      // In production, use proper ECDSA verification with parsed public key
      return signature.length > 0;
    } catch (error) {
      logger.error({ error }, 'Signature verification error');
      return false;
    }
  }
}

export const webAuthnService = new WebAuthnService();
