import { createHash, randomBytes } from 'crypto';
import prisma from './db';

/**
 * Recovery service managing email recovery and passkey enrollment
 * Now using Prisma instead of Level DB
 */
export class RecoveryService {
  private readonly OTP_LENGTH = 6;
  private readonly OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_OTP_ATTEMPTS = 3;
  private readonly RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
  private readonly MAX_REQUESTS_PER_WINDOW = 3;
  
  constructor() {}
  
  /**
   * Create email recovery session and send OTP
   */
  async createEmailSession(email: string): Promise<string> {
    // Rate limiting check
    await this.checkRateLimit(email);
    
    // Generate OTP
    const otp = this.generateOTP();
    const sessionId = this.generateSessionId();
    
    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Create new user with placeholder data (will be filled during verification)
      const bcrypt = require('bcrypt');
      const tempPassword = require('crypto').randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      
      user = await prisma.user.create({
        data: {
          email,
          emailVerified: false,
          encryptedSeed: '',
          seedSalt: '',
          seedIv: '',
          passwordHash,
        },
      });
    }

    // Create OTP recovery code
    await prisma.recoveryCode.create({
      data: {
        userId: user.id,
        type: 'email_otp',
        code: otp,
        used: false,
        expiresAt: new Date(Date.now() + this.OTP_EXPIRY_MS),
      },
    });
    
    // Send email with OTP
    try {
      const emailServiceModule = await import('./email-service');
      await emailServiceModule.emailService.sendOTP(email, otp);
      console.log(`✅ OTP email sent to ${email}`);
    } catch (emailError) {
      // Fall back to console logging if email fails (for development)
      console.log(`📧 OTP for ${email}: ${otp} (Email service unavailable: ${emailError})`);
    }
    
    
    // Record request for rate limiting
    await this.recordRequest(email);
    
    return sessionId;
  }
  
  /**
   * Verify email OTP
   */
  async verifyEmailOTP(userId: string, otp: string): Promise<boolean> {
    try {
      const recoveryCode = await prisma.recoveryCode.findFirst({
        where: {
          userId,
          type: 'email_otp',
          code: otp,
          used: false,
          expiresAt: { gte: new Date() },
        },
      });

      if (!recoveryCode) {
        return false;
      }

      // Mark as used
      await prisma.recoveryCode.update({
        where: { id: recoveryCode.id },
        data: { used: true },
      });

      // Mark email as verified
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });

      return true;
    } catch (error: any) {
      console.error('OTP verification failed:', error);
      return false;
    }
  }
  
  /**
   * Enroll WebAuthn passkey
   */
  async enrollPasskey(
    userId: string,
    credentialId: string,
    publicKey: string
  ): Promise<void> {
    // Check if user exists first
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(`User ${userId} not found. Create user account first.`);
    }
    
    await prisma.passkeyCredential.create({
      data: {
        userId,
        credentialId,
        publicKey,
        counter: 0,
      },
    });
  }
  
  /**
   * Get passkey credential
   */
  async getPasskey(userId: string): Promise<any | null> {
    try {
      return await prisma.passkeyCredential.findFirst({
        where: { userId },
      });
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Get all passkeys for user email
   */
  async getPasskeysForUser(email: string): Promise<any[]> {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return [];
      
      return await prisma.passkeyCredential.findMany({
        where: { userId: user.id },
      });
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Generate random OTP
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  /**
   * Get account for user email
   */
  async getAccountForUser(email: string): Promise<any | null> {
    try {
      const user = await prisma.user.findUnique({ 
        where: { email },
        include: { accounts: true }
      });
      
      if (!user || user.accounts.length === 0) return null;
      return user.accounts[0];
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return randomBytes(16).toString('hex');
  }
  
  /**
   * Hash email for privacy
   */
  private hashEmail(email: string): string {
    return createHash('sha256').update(email.toLowerCase()).digest('hex');
  }
  
  /**
   * Check rate limit
   */
  private async checkRateLimit(email: string): Promise<void> {
    const windowStart = new Date(Date.now() - this.RATE_LIMIT_WINDOW);
    
    // Count recent recovery code requests
    const recentCount = await prisma.recoveryCode.count({
      where: {
        user: { email },
        type: 'email_otp',
        createdAt: { gte: windowStart },
      },
    });

    if (recentCount >= this.MAX_REQUESTS_PER_WINDOW) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
  }
  
  /**
   * Record request for rate limiting
   */
  private async recordRequest(email: string): Promise<void> {
    // Rate limiting is now handled by database queries in checkRateLimit
    // No need for separate tracking
  }
}

export const recoveryService = new RecoveryService();
