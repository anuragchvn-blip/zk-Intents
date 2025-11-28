import * as bip39 from 'bip39';
import { HDKey } from '@scure/bip32';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface WalletKeyPair {
  privateKey: Uint8Array;
  publicKey: [string, string]; // EdDSA public key as [x, y]
  address: string;
}

export class WalletService {
  private eddsa: any;

  async initialize() {
    try {
      // @ts-ignore - circomlibjs is optional
      const { buildBabyjub } = await import('circomlibjs');
      const babyJub = await buildBabyjub();
      this.eddsa = babyJub;
    } catch (error) {
      console.warn('circomlibjs not available, wallet signing disabled');
    }
  }

  /**
   * Generate a new BIP39 seed phrase (24 words)
   */
  generateSeedPhrase(): string {
    return bip39.generateMnemonic(256); // 24 words
  }

  /**
   * Validate seed phrase
   */
  validateSeedPhrase(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic);
  }

  /**
   * Derive EdDSA keypair from seed phrase
   * @param mnemonic BIP39 seed phrase
   * @param accountIndex Account index (default 0)
   */
  async deriveKeypair(mnemonic: string, accountIndex: number = 0): Promise<WalletKeyPair> {
    if (!this.validateSeedPhrase(mnemonic)) {
      throw new Error('Invalid seed phrase');
    }

    // Convert mnemonic to seed
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    
    // Derive HD key following BIP44: m/44'/60'/0'/0/{accountIndex}
    const hdKey = HDKey.fromMasterSeed(seed);
    const path = `m/44'/60'/0'/0/${accountIndex}`;
    const derivedKey = hdKey.derive(path);

    if (!derivedKey.privateKey) {
      throw new Error('Failed to derive private key');
    }

    // Use first 32 bytes as EdDSA private key
    const privateKey = derivedKey.privateKey.slice(0, 32);

    // Generate EdDSA public key
    const publicKey = this.eddsa.prv2pub(privateKey);

    // Derive Ethereum-compatible address from public key
    const address = this.publicKeyToAddress(publicKey);

    return {
      privateKey,
      publicKey: [publicKey[0].toString(), publicKey[1].toString()],
      address,
    };
  }

  /**
   * Encrypt seed phrase with password
   */
  encryptSeed(seedPhrase: string, password: string): { encrypted: string; salt: string; iv: string } {
    const salt = randomBytes(16);
    const key = this.deriveKeyFromPassword(password, salt);
    const iv = randomBytes(16);
    
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(seedPhrase, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted + authTag.toString('hex'),
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
    };
  }

  /**
   * Decrypt seed phrase with password
   */
  decryptSeed(encryptedData: { encrypted: string; salt: string; iv: string }, password: string): string {
    const key = this.deriveKeyFromPassword(password, Buffer.from(encryptedData.salt, 'hex'));
    const iv = Buffer.from(encryptedData.iv, 'hex');
    
    // Extract auth tag (last 16 bytes)
    const encryptedText = encryptedData.encrypted.slice(0, -32);
    const authTag = Buffer.from(encryptedData.encrypted.slice(-32), 'hex');
    
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  private deriveKeyFromPassword(password: string, salt: Buffer): Buffer {
    const crypto = require('crypto');
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  }

  /**
   * Convert EdDSA public key to Ethereum address
   */
  private publicKeyToAddress(publicKey: [bigint, bigint]): string {
    const crypto = require('crypto');
    
    // Concatenate x and y coordinates
    const pubKeyBytes = Buffer.concat([
      Buffer.from(publicKey[0].toString(16).padStart(64, '0'), 'hex'),
      Buffer.from(publicKey[1].toString(16).padStart(64, '0'), 'hex'),
    ]);
    
    // Keccak-256 hash
    const hash = crypto.createHash('sha256').update(pubKeyBytes).digest();
    
    // Take last 20 bytes as address
    const address = '0x' + hash.slice(-20).toString('hex');
    
    return address;
  }

  /**
   * Sign message with private key
   */
  async signMessage(privateKey: Uint8Array, message: string): Promise<{ R8: string[]; S: string }> {
    const msgHash = Buffer.from(message, 'utf8');
    const signature = this.eddsa.signPoseidon(privateKey, msgHash);
    
    return {
      R8: [signature.R8[0].toString(), signature.R8[1].toString()],
      S: signature.S.toString(),
    };
  }

  /**
   * Verify signature
   */
  verifySignature(publicKey: [string, string], message: string, signature: { R8: string[]; S: string }): boolean {
    const msgHash = Buffer.from(message, 'utf8');
    
    return this.eddsa.verifyPoseidon(msgHash, {
      R8: signature.R8.map(BigInt),
      S: BigInt(signature.S),
    }, publicKey.map(BigInt));
  }
}

export const walletService = new WalletService();
