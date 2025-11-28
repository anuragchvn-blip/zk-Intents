import { Level } from 'level';
import { createHash } from 'crypto';

export interface AccountLeaf {
  address: string;
  balanceCommitment: string;
  nonce: number;
  publicKey: string;
}

/**
 * Sparse Merkle Tree implementation for L2 state
 * Uses LevelDB for persistent storage
 */
export class StateTree {
  private db: Level;
  private root: string;
  private readonly TREE_DEPTH = 20; // 2^20 = 1M accounts
  private readonly EMPTY_HASH = '0x' + '0'.repeat(64);
  
  constructor(dbPath: string = './data/state') {
    this.db = new Level(dbPath);
    this.root = this.EMPTY_HASH;
  }
  
  /**
   * Get current state root
   */
  getRoot(): string {
    return this.root;
  }
  
  /**
   * Get account by address
   */
  async getAccount(address: string): Promise<AccountLeaf | null> {
    try {
      const data = await this.db.get(`account:${address}`);
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }
  
  /**
   * Update account and recompute merkle root
   */
  async updateAccount(address: string, account: AccountLeaf): Promise<void> {
    const leafHash = this.hashLeaf(account);
    const index = this.addressToIndex(address);
    
    // Store account data
    await this.db.put(`account:${address}`, JSON.stringify(account));
    await this.db.put(`leaf:${index}`, leafHash);
    
    // Recompute root
    this.root = await this.computeRoot(index, leafHash);
  }
  
  /**
   * Get Merkle proof for an account
   */
  async getMerkleProof(address: string): Promise<string[]> {
    const index = this.addressToIndex(address);
    const proof: string[] = [];
    
    let currentIndex = index;
    for (let level = 0; level < this.TREE_DEPTH; level++) {
      const siblingIndex = currentIndex ^ 1; // Flip last bit to get sibling
      const siblingHash = await this.getNodeHash(level, siblingIndex);
      proof.push(siblingHash);
      
      currentIndex = currentIndex >> 1; // Move to parent
    }
    
    return proof;
  }
  
  /**
   * Hash account leaf data
   */
  private hashLeaf(account: AccountLeaf): string {
    const data = `${account.balanceCommitment}${account.nonce}${account.publicKey}`;
    return '0x' + createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Convert address to tree index
   */
  private addressToIndex(address: string): number {
    const hash = createHash('sha256').update(address).digest();
    return hash.readUInt32BE(0) % (2 ** this.TREE_DEPTH);
  }
  
  /**
   * Get hash of a node at specific level and index
   */
  private async getNodeHash(level: number, index: number): Promise<string> {
    try {
      return await this.db.get(`node:${level}:${index}`);
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return this.EMPTY_HASH;
      }
      throw error;
    }
  }
  
  /**
   * Compute new root after updating a leaf
   */
  private async computeRoot(leafIndex: number, leafHash: string): Promise<string> {
    let currentHash = leafHash;
    let currentIndex = leafIndex;
    
    for (let level = 0; level < this.TREE_DEPTH; level++) {
      const siblingIndex = currentIndex ^ 1;
      const siblingHash = await this.getNodeHash(level, siblingIndex);
      
      // Compute parent hash
      const isLeft = currentIndex % 2 === 0;
      const parentHash = this.hashPair(
        isLeft ? currentHash : siblingHash,
        isLeft ? siblingHash : currentHash
      );
      
      // Store node hash
      const parentIndex = currentIndex >> 1;
      await this.db.put(`node:${level + 1}:${parentIndex}`, parentHash);
      
      currentHash = parentHash;
      currentIndex = parentIndex;
    }
    
    return currentHash;
  }
  
  /**
   * Hash two nodes
   */
  private hashPair(left: string, right: string): string {
    const combined = left + right.slice(2); // Remove '0x' from right
    return '0x' + createHash('sha256').update(combined).digest('hex');
  }
  
  /**
   * Initialize empty tree
   */
  async initialize(): Promise<void> {
    // Pre-compute empty hashes for all levels
    let currentHash = this.EMPTY_HASH;
    
    for (let level = 0; level < this.TREE_DEPTH; level++) {
      currentHash = this.hashPair(currentHash, currentHash);
      await this.db.put(`empty:${level}`, currentHash);
    }
    
    this.root = currentHash;
  }
}
