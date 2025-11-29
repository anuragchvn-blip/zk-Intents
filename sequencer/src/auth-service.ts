import prisma from './db';
import { walletService } from './wallet';
import { emailService } from './email-service';
import { StateTree } from './state';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

export interface AuthSession {
  userId: string;
  sessionToken: string;
  email: string;
  address: string;
  expiresAt: Date;
}

export class AuthService {
  private readonly OTP_LENGTH = 6;
  private readonly OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
  private readonly SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  private stateTree?: StateTree;

  constructor(stateTree?: StateTree) {
    this.stateTree = stateTree;
  }

  async initialize() {
    await walletService.initialize();
  }

  /**
   * Create email OTP session
   */
  async createEmailOTP(email: string): Promise<string> {
    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MS);

    // Check if user exists
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Create new user (will complete registration after OTP verification)
      const tempPassword = randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      user = await prisma.user.create({
        data: {
          email,
          emailVerified: false,
          encryptedSeed: '', // Will be filled after OTP verification
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
        expiresAt,
      },
    });

    // Send OTP email
    await emailService.sendOTP(email, otp);

    return user.id;
  }

  /**
   * Verify OTP and create account with seed phrase (passwordless)
   */
  async verifyOTPAndCreateAccount(
    email: string,
    otp: string
  ): Promise<{ seedPhrase: string; address: string; sessionToken: string }> {
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('User not found');
    }

    // Verify OTP
    const recoveryCode = await prisma.recoveryCode.findFirst({
      where: {
        userId: user.id,
        type: 'email_otp',
        code: otp,
        used: false,
        expiresAt: { gte: new Date() },
      },
    });

    if (!recoveryCode) {
      throw new Error('Invalid or expired OTP');
    }

    // Mark OTP as used
    await prisma.recoveryCode.update({
      where: { id: recoveryCode.id },
      data: { used: true },
    });

    // Generate seed phrase
    const seedPhrase = walletService.generateSeedPhrase();

    // Update user as verified (no password storage)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
      },
    });

    // Derive first account from seed
    const keypair = await walletService.deriveKeypair(seedPhrase, 0);

    // Create account in database
    await prisma.account.create({
      data: {
        userId: user.id,
        address: keypair.address,
        publicKeyX: keypair.publicKey[0],
        publicKeyY: keypair.publicKey[1],
        derivationPath: "m/44'/60'/0'/0/0",
        chainId: 137, // Polygon by default
        chainName: 'Polygon',
        nonce: 0,
      },
    });

    // Add account to state tree
    if (this.stateTree) {
      await this.stateTree.updateAccount(keypair.address, {
        address: keypair.address,
        balanceCommitment: '0',
        nonce: 0,
        publicKey: JSON.stringify(keypair.publicKey),
      });
    }

    // Create session
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.SESSION_EXPIRY_MS);

    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken,
        expiresAt,
      },
    });

    // Send welcome email with seed phrase
    await emailService.sendWelcomeEmail(email, seedPhrase);

    return {
      seedPhrase,
      address: keypair.address,
      sessionToken,
    };
  }

  /**
   * Enroll WebAuthn passkey
   */
  async enrollPasskey(
    userId: string,
    credentialId: string,
    publicKey: string,
    deviceName?: string
  ): Promise<void> {
    await prisma.passkeyCredential.create({
      data: {
        userId,
        credentialId,
        publicKey,
        deviceName: deviceName || 'Unknown Device',
        counter: 0,
      },
    });
  }

  /**
   * Authenticate with session token
   */
  async authenticateSession(sessionToken: string): Promise<AuthSession | null> {
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        user: {
          include: {
            accounts: {
              take: 1,
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    // Update last active
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    return {
      userId: session.userId,
      sessionToken: session.sessionToken,
      email: session.user.email,
      address: session.user.accounts[0]?.address || '',
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Get user accounts
   */
  async getUserAccounts(userId: string) {
    return await prisma.account.findMany({
      where: { userId },
      include: { balances: true },
    });
  }

  /**
   * Update account nonce
   */
  async incrementNonce(address: string): Promise<number> {
    const account = await prisma.account.update({
      where: { address },
      data: {
        nonce: {
          increment: 1,
        },
      },
    });

    return account.nonce;
  }

  /**
   * Send OTP for login (passwordless)
   */
  async sendLoginOTP(email: string): Promise<string> {
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      throw new Error('Account not found. Please register first.');
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP
    await prisma.recoveryCode.create({
      data: {
        userId: user.id,
        type: 'email_otp',
        code: otp,
        expiresAt,
      },
    });

    // Send email
    await emailService.sendOTP(email, otp);

    return user.id;
  }

  /**
   * Login with OTP (passwordless)
   */
  async loginWithOTP(
    email: string,
    otp: string
  ): Promise<{ address: string; sessionToken: string }> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        accounts: {
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user) {
      throw new Error('Account not found');
    }

    // Verify OTP
    const recoveryCode = await prisma.recoveryCode.findFirst({
      where: {
        userId: user.id,
        type: 'email_otp',
        code: otp,
        used: false,
        expiresAt: { gte: new Date() },
      },
    });

    if (!recoveryCode) {
      throw new Error('Invalid or expired OTP');
    }

    // Mark OTP as used
    await prisma.recoveryCode.update({
      where: { id: recoveryCode.id },
      data: { used: true },
    });

    // Get user's first account
    const account = user.accounts[0];
    if (!account) {
      throw new Error('No account found for user');
    }

    // Create session
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.SESSION_EXPIRY_MS);

    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken,
        expiresAt,
      },
    });

    return {
      address: account.address,
      sessionToken,
    };
  }

  /**
   * Login with passkey (WebAuthn)
   */
  async loginWithPasskey(
    email: string,
    credentialId: string,
    signature?: any
  ): Promise<{ address: string; sessionToken: string }> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        accounts: {
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
        passkeyCredentials: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify passkey credential exists
    const passkey = user.passkeyCredentials.find(
      (pk: any) => pk.credentialId === credentialId
    );

    if (!passkey) {
      throw new Error('Invalid passkey');
    }

    // In production, verify signature using @simplewebauthn/server
    // For now, we accept if credential exists
    
    // Update passkey counter and last used
    await prisma.passkeyCredential.update({
      where: { id: passkey.id },
      data: {
        counter: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    // Get user's first account
    const account = user.accounts[0];
    if (!account) {
      throw new Error('No account found for user');
    }

    // Create session
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.SESSION_EXPIRY_MS);

    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken,
        expiresAt,
      },
    });

    return {
      address: account.address,
      sessionToken,
    };
  }

  /**
   * Invalidate session (logout)
   */
  async invalidateSession(sessionToken: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { sessionToken },
    });
  }

  /**
   * Get all passkeys for user email
   */
  async getPasskeysForUser(email: string): Promise<any[]> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return [];
    
    return await prisma.passkeyCredential.findMany({
      where: { userId: user.id },
    });
  }

  /**
   * Get account for user email
   */
  async getAccountForUser(email: string): Promise<any | null> {
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { accounts: true }
    });
    
    if (!user || user.accounts.length === 0) return null;
    return user.accounts[0];
  }
}

export const authService = new AuthService();
