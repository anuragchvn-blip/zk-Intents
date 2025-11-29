import { StateTree } from './state';
import { TransactionPool, Intent } from './pool';
import { DataAvailabilityService } from './data-availability';
import { DecentralizedSequencerNetwork } from './decentralized-network';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface Batch {
  id: number;
  intents: Intent[];
  stateRoot: string;
  timestamp: number;
  status: 'pending' | 'proving' | 'submitted' | 'verified';
}

/**
 * Batcher - orchestrates batch creation and proof generation
 */
export class Batcher {
  private batches: Map<number, Batch> = new Map();
  private batchId: number = 0;
  private isRunning: boolean = false;
  private interval: NodeJS.Timeout | null = null;
  
  private readonly BATCH_INTERVAL_MS = 30 * 1000; // 30 seconds
  private readonly MIN_BATCH_SIZE = 16;
  private readonly MAX_BATCH_SIZE = 128;
  
  constructor(
    private stateTree: StateTree,
    private txPool: TransactionPool,
    private daService: DataAvailabilityService,
    private sequencerNetwork: DecentralizedSequencerNetwork,
    private onUpdate?: (update: any) => void
  ) {}
  
  /**
   * Start background batching process
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('🚀 Batcher started');
    
    this.interval = setInterval(() => {
      this.processBatch();
    }, this.BATCH_INTERVAL_MS);
  }
  
  /**
   * Stop batching
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
    }
    
    logger.info('⏸️  Batcher stopped');
  }
  
  /**
   * Process a new batch
   */
  private async processBatch(): Promise<void> {
    const poolSize = this.txPool.size();
    
    // Only batch if we have enough intents
    if (poolSize < this.MIN_BATCH_SIZE) {
      logger.debug({ poolSize }, 'Not enough intents for batching');
      return;
    }
    
    try {
      this.batchId++;
      
      // Get intents from pool
      const intents = this.txPool.getForBatch(this.MAX_BATCH_SIZE);
      logger.info({ batchId: this.batchId, count: intents.length }, 'Creating batch');
      
      // Create batch
      const batch: Batch = {
        id: this.batchId,
        intents,
        stateRoot: this.stateTree.getRoot(),
        timestamp: Date.now(),
        status: 'pending',
      };
      
      this.batches.set(this.batchId, batch);
      
      // Notify clients
      if (this.onUpdate) {
        this.onUpdate({
          type: 'batch_created',
          batchId: batch.id,
          txCount: batch.intents.length,
          timestamp: batch.timestamp
        });
      }
      
      // TODO: Generate proof (send to prover orchestrator)
      await this.generateProof(batch);
      
      // Remove processed intents from pool
      this.txPool.remove(intents.map(i => i.intentId));
      
      logger.info({ batchId: batch.id }, '✅ Batch processed');
    } catch (error) {
      logger.error({ error }, 'Failed to process batch');
    }
  }
  
  /**
   * Generate proof for batch (connects to prover orchestrator)
   */
  private async generateProof(batch: Batch): Promise<void> {
    logger.info({ batchId: batch.id }, 'Generating proof...');
    
    batch.status = 'proving';
    
    try {
      // Send batch to prover orchestrator
      const proverUrl = process.env.PROVER_URL || 'http://localhost:8080';
      
      const response = await fetch(`${proverUrl}/api/v1/prove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: batch.id,
          circuitName: 'transfer',
          witness: {
            oldStateRoot: this.stateTree.getRoot(),
            intents: batch.intents,
            publicSignals: [this.stateTree.getRoot()],
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Prover request failed');
      }
      
      const { jobId } = (await response.json()) as { jobId: string };
      
      // Poll for proof completion
      await this.waitForProof(proverUrl, jobId);
      
      batch.status = 'submitted';
      logger.info({ batchId: batch.id }, 'Proof generated and submitted');
      
      // Submit proof to L1 contract
      await this.submitToL1(batch, jobId);
      
    } catch (error: any) {
      logger.error({ batchId: batch.id, error: error.message }, 'Batch processing failed');
      batch.status = 'pending'; // Retry later
    }
  }

  /**
   * Submit batch and proof to L1 contract
   */
  private async submitToL1(batch: Batch, jobId: string): Promise<void> {
    const contractAddress = process.env.ROLLUP_CONTRACT_ADDRESS;
    const rpcUrl = process.env.POLYGON_RPC || 'http://localhost:8545';
    const privateKey = process.env.SEQUENCER_PRIVATE_KEY;

    if (!contractAddress || !privateKey) {
      logger.warn('Missing L1 config (ROLLUP_CONTRACT_ADDRESS or SEQUENCER_PRIVATE_KEY), skipping L1 submission');
      return;
    }

    try {
      logger.info({ batchId: batch.id, contractAddress }, 'Submitting to L1...');

      // Dynamic import ethers to avoid build issues if not present
      const { ethers } = await import('ethers');
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      
      const abi = [
        "function submitBatch(bytes32 _newStateRoot, bytes32 _calldataHash, uint256 _txCount, bytes calldata _proof) external"
      ];

      const contract = new ethers.Contract(contractAddress, abi, wallet);

      // Get proof from prover
      const proverUrl = process.env.PROVER_URL || 'http://localhost:8080';
      const response = await fetch(`${proverUrl}/api/v1/job/${jobId}`);
      const job = await response.json() as {
        proof?: {
          pi_a: [string, string];
          pi_b: [[string, string], [string, string]];
          pi_c: [string, string];
          publicSignals?: string[];
        };
      };
      
      if (!job.proof) {
        throw new Error('Proof not found in job result');
      }

      // Format proof for contract (proper Groth16 format)
      const proof = job.proof;
      // Encode proof as: [pi_a[0], pi_a[1], pi_b[0][0], pi_b[0][1], pi_b[1][0], pi_b[1][1], pi_c[0], pi_c[1]]
      const proofCalldata = ethers.utils.defaultAbiCoder.encode(
        ['uint256[2]', 'uint256[2][2]', 'uint256[2]', 'uint256[]'],
        [
          [proof.pi_a[0], proof.pi_a[1]],
          [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
          [proof.pi_c[0], proof.pi_c[1]],
          proof.publicSignals || []
        ]
      );
      const proofBytes = ethers.utils.arrayify(proofCalldata); 
      
      // Mock calldata hash for now
      const calldataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("batch_data"));

      const tx = await contract.submitBatch(
        batch.stateRoot,
        calldataHash,
        batch.intents.length,
        proofBytes
      );

      logger.info({ batchId: batch.id, txHash: tx.hash }, 'L1 Transaction submitted');
      
      await tx.wait();
      batch.status = 'verified';
      
      logger.info({ batchId: batch.id }, '✅ Batch verified on L1');

      if (this.onUpdate) {
        this.onUpdate({
          type: 'batch_verified',
          batchId: batch.id,
          txHash: tx.hash,
          stateRoot: batch.stateRoot
        });
      }

    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to submit to L1');
      throw error;
    }
  }
  
  /**
   * Wait for proof to complete
   */
  private async waitForProof(proverUrl: string, jobId: string): Promise<any> {
    const maxAttempts = 60; // 60 attempts * 5s = 5 min timeout
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      
      const response = await fetch(`${proverUrl}/api/v1/job/${jobId}`);
      const job = (await response.json()) as any;
      
      if (job.status === 'completed') {
        return job.proof;
      }
      
      if (job.status === 'failed') {
        throw new Error(`Proof generation failed: ${job.error}`);
      }
    }
    
    throw new Error('Proof generation timeout');
  }
  
  /**
   * Get batch by ID
   */
  async getBatch(batchId: number): Promise<Batch | null> {
    return this.batches.get(batchId) || null;
  }
}
