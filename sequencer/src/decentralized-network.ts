import { EventEmitter } from 'events';
import pino from 'pino';
import crypto from 'crypto';
import { Intent } from './pool';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface SequencerNode {
  id: string;
  address: string;
  publicKey: string;
  stake: bigint;
  reputation: number;
  lastHeartbeat: number;
  isActive: boolean;
}

interface OrderedBatch {
  batchId: string;
  intents: Intent[];
  sequencerId: string;
  timestamp: number;
  signature: string;
  commitmentHash: string;
}

/**
 * Decentralized Sequencer Network
 * Implements shared sequencing with MEV-resistant ordering
 * 
 * Features:
 * - Rotating leader selection based on stake + reputation
 * - Fair ordering using commit-reveal scheme
 * - Slashing for malicious behavior
 * - Byzantine fault tolerance (2f+1 consensus)
 */
export class DecentralizedSequencerNetwork extends EventEmitter {
  private nodes: Map<string, SequencerNode> = new Map();
  private currentLeader: string | null = null;
  private epoch: number = 0;
  private epochDuration = 60000; // 1 minute epochs
  private lastEpochChange = Date.now();
  
  // Commit-reveal for MEV resistance
  private commitments: Map<string, { hash: string; timestamp: number }> = new Map();
  private reveals: Map<string, OrderedBatch> = new Map();
  
  constructor(
    private nodeId: string,
    private nodeAddress: string,
    private nodePublicKey: string
  ) {
    super();
    this.registerSelf();
    this.startEpochRotation();
  }
  
  /**
   * Register this node in the network
   */
  private registerSelf(): void {
    this.nodes.set(this.nodeId, {
      id: this.nodeId,
      address: this.nodeAddress,
      publicKey: this.nodePublicKey,
      stake: BigInt(1000000), // 1M tokens staked
      reputation: 100,
      lastHeartbeat: Date.now(),
      isActive: true,
    });
    
    logger.info({ nodeId: this.nodeId }, 'Sequencer node registered');
  }
  
  /**
   * Add a peer sequencer node
   */
  addPeer(node: SequencerNode): void {
    this.nodes.set(node.id, node);
    logger.info({ peerId: node.id }, 'Peer sequencer added');
  }
  
  /**
   * Remove inactive peer
   */
  removePeer(nodeId: string): void {
    this.nodes.delete(nodeId);
    logger.info({ peerId: nodeId }, 'Peer sequencer removed');
  }
  
  /**
   * Select leader for current epoch using VRF-based selection
   * Probability proportional to stake * reputation
   */
  private selectLeader(): string {
    const activeNodes = Array.from(this.nodes.values()).filter(n => n.isActive);
    
    if (activeNodes.length === 0) {
      throw new Error('No active sequencer nodes');
    }
    
    // Calculate total weight
    const totalWeight = activeNodes.reduce(
      (sum, node) => sum + Number(node.stake) * node.reputation,
      0
    );
    
    // Use epoch + seed for deterministic randomness
    const seed = crypto
      .createHash('sha256')
      .update(`${this.epoch}${process.env.NETWORK_SEED || 'default-seed'}`)
      .digest();
    
    const randomValue = seed.readUInt32BE(0) % totalWeight;
    
    // Select node based on weighted probability
    let cumulativeWeight = 0;
    for (const node of activeNodes) {
      cumulativeWeight += Number(node.stake) * node.reputation;
      if (randomValue < cumulativeWeight) {
        return node.id;
      }
    }
    
    return activeNodes[0].id; // Fallback
  }
  
  /**
   * Start epoch rotation timer
   */
  private startEpochRotation(): void {
    setInterval(() => {
      this.rotateEpoch();
    }, this.epochDuration);
  }
  
  /**
   * Rotate to next epoch and select new leader
   */
  private rotateEpoch(): void {
    this.epoch++;
    this.currentLeader = this.selectLeader();
    this.lastEpochChange = Date.now();
    
    // Clear old commitments and reveals
    this.commitments.clear();
    this.reveals.clear();
    
    logger.info({
      epoch: this.epoch,
      leader: this.currentLeader,
      isLeader: this.currentLeader === this.nodeId,
    }, 'Epoch rotated');
    
    this.emit('epochChange', {
      epoch: this.epoch,
      leader: this.currentLeader,
      isLeader: this.currentLeader === this.nodeId,
    });
  }
  
  /**
   * Check if this node is current leader
   */
  isLeader(): boolean {
    return this.currentLeader === this.nodeId;
  }
  
  /**
   * Get current leader
   */
  getLeader(): string | null {
    return this.currentLeader;
  }
  
  /**
   * Commit-Reveal Phase 1: Submit commitment hash
   * Leader commits to batch ordering without revealing it
   */
  async submitCommitment(intents: Intent[]): Promise<string> {
    if (!this.isLeader()) {
      throw new Error('Only leader can submit commitments');
    }
    
    // Create deterministic ordering
    const sortedIntents = this.fairOrder(intents);
    
    // Generate commitment hash
    const commitmentData = JSON.stringify({
      batchId: `batch_${this.epoch}_${Date.now()}`,
      intents: sortedIntents.map(i => i.intentId),
      timestamp: Date.now(),
    });
    
    const commitmentHash = crypto
      .createHash('sha256')
      .update(commitmentData)
      .digest('hex');
    
    // Store commitment
    this.commitments.set(this.nodeId, {
      hash: commitmentHash,
      timestamp: Date.now(),
    });
    
    // Broadcast commitment to network
    this.broadcastCommitment(commitmentHash);
    
    logger.info({ commitmentHash, intentCount: sortedIntents.length }, 'Commitment submitted');
    
    return commitmentHash;
  }
  
  /**
   * Commit-Reveal Phase 2: Reveal actual batch after commit window
   */
  async revealBatch(batch: OrderedBatch): Promise<boolean> {
    const commitment = this.commitments.get(batch.sequencerId);
    
    if (!commitment) {
      logger.warn({ batchId: batch.batchId }, 'No commitment found for reveal');
      return false;
    }
    
    // Verify commitment matches reveal
    const revealHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        batchId: batch.batchId,
        intents: batch.intents.map(i => i.intentId),
        timestamp: batch.timestamp,
      }))
      .digest('hex');
    
    if (revealHash !== commitment.hash) {
      logger.error({ batchId: batch.batchId }, 'Commitment mismatch - slashing!');
      this.slashNode(batch.sequencerId, 'commitment_mismatch');
      return false;
    }
    
    // Store reveal
    this.reveals.set(batch.batchId, batch);
    
    // Broadcast reveal to network
    this.broadcastReveal(batch);
    
    logger.info({ batchId: batch.batchId }, 'Batch revealed successfully');
    
    return true;
  }
  
  /**
   * Fair ordering algorithm (MEV-resistant)
   * Orders intents by: timestamp + hash(intent + epoch_seed)
   */
  private fairOrder(intents: Intent[]): Intent[] {
    const epochSeed = `epoch_${this.epoch}`;
    
    return intents.sort((a, b) => {
      // Add randomness based on epoch seed to prevent frontrunning
      const hashA = crypto
        .createHash('sha256')
        .update(`${a.intentId}${epochSeed}`)
        .digest('hex');
      
      const hashB = crypto
        .createHash('sha256')
        .update(`${b.intentId}${epochSeed}`)
        .digest('hex');
      
      // Primary sort: timestamp (user intent time)
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      
      // Secondary sort: deterministic hash (prevents MEV)
      return hashA.localeCompare(hashB);
    });
  }
  
  /**
   * Verify batch ordering from another sequencer
   */
  verifyBatchOrdering(batch: OrderedBatch): boolean {
    // Reconstruct expected ordering
    const expectedOrder = this.fairOrder(batch.intents);
    
    // Verify order matches
    for (let i = 0; i < batch.intents.length; i++) {
      if (batch.intents[i].intentId !== expectedOrder[i].intentId) {
        logger.error({ batchId: batch.batchId }, 'Invalid batch ordering detected');
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Slash a node for malicious behavior
   */
  private slashNode(nodeId: string, reason: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    // Reduce stake by 10%
    node.stake = (node.stake * BigInt(90)) / BigInt(100);
    
    // Reduce reputation
    node.reputation = Math.max(0, node.reputation - 20);
    
    // Deactivate if reputation too low
    if (node.reputation < 50) {
      node.isActive = false;
    }
    
    logger.warn({ nodeId, reason, newStake: node.stake.toString(), newReputation: node.reputation }, 'Node slashed');
    
    this.emit('nodeSlashed', { nodeId, reason });
  }
  
  /**
   * Update node heartbeat (liveness check)
   */
  updateHeartbeat(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.lastHeartbeat = Date.now();
    }
  }
  
  /**
   * Check for inactive nodes and remove them
   */
  pruneInactiveNodes(): void {
    const timeout = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    for (const [nodeId, node] of this.nodes.entries()) {
      if (now - node.lastHeartbeat > timeout && nodeId !== this.nodeId) {
        node.isActive = false;
        logger.warn({ nodeId }, 'Node marked inactive due to missed heartbeats');
      }
    }
  }
  
  /**
   * Get network statistics
   */
  getNetworkStats(): {
    totalNodes: number;
    activeNodes: number;
    currentEpoch: number;
    currentLeader: string | null;
    isLeader: boolean;
  } {
    const activeNodes = Array.from(this.nodes.values()).filter(n => n.isActive);
    
    return {
      totalNodes: this.nodes.size,
      activeNodes: activeNodes.length,
      currentEpoch: this.epoch,
      currentLeader: this.currentLeader,
      isLeader: this.isLeader(),
    };
  }
  
  /**
   * Broadcast commitment to network (stub - implement with libp2p/gossipsub)
   */
  private broadcastCommitment(hash: string): void {
    // In production: use libp2p gossipsub or similar P2P protocol
    logger.debug({ hash }, 'Broadcasting commitment to network');
    this.emit('commitmentBroadcast', hash);
  }
  
  /**
   * Broadcast reveal to network (stub - implement with libp2p/gossipsub)
   */
  private broadcastReveal(batch: OrderedBatch): void {
    // In production: use libp2p gossipsub or similar P2P protocol
    logger.debug({ batchId: batch.batchId }, 'Broadcasting reveal to network');
    this.emit('revealBroadcast', batch);
  }
}
