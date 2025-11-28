import express from 'express';
import pino from 'pino';
import { randomBytes } from 'crypto';
import { execSync } from 'child_process';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();

app.use(express.json({ limit: '50mb' }));

interface ProofRequest {
  batchId: number;
  circuitName: string;
  witness: any;
}

interface ProofJob {
  id: string;
  batchId: number;
  status: 'queued' | 'proving' | 'completed' | 'failed';
  proof?: any;
  publicSignals?: any;
  error?: string;
  startTime: number;
  endTime?: number;
}

/**
 * Proof Orchestrator
 * Receives proof requests and distributes to workers
 */
class ProofOrchestrator {
  private jobs: Map<string, ProofJob> = new Map();
  private queue: string[] = [];
  
  /**
   * Submit proof request
   */
  async submitProofRequest(request: ProofRequest): Promise<string> {
    const jobId = this.generateJobId();
    
    const job: ProofJob = {
      id: jobId,
      batchId: request.batchId,
      status: 'queued',
      startTime: Date.now(),
    };
    
    this.jobs.set(jobId, job);
    this.queue.push(jobId);
    
    logger.info({ jobId, batchId: request.batchId }, 'Proof request queued');
    
    // Start processing (in real implementation, send to worker pool)
    this.processJob(jobId, request);
    
    return jobId;
  }
  
  /**
   * Get job status
   */
  getJobStatus(jobId: string): ProofJob | null {
    return this.jobs.get(jobId) || null;
  }
  
  /**
   * Process proof generation
   */
  private async processJob(jobId: string, request: ProofRequest): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    try {
      job.status = 'proving';
      logger.info({ jobId }, 'Starting proof generation');
      
      // Call prover worker
      const result = await this.callProverWorker(request);
      
      job.proof = result.proof;
      job.publicSignals = result.publicSignals;
      job.status = 'completed';
      job.endTime = Date.now();
      
      const duration = job.endTime - job.startTime;
      logger.info({ jobId, duration }, 'Proof generated successfully');
      
    } catch (error: any) {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = Date.now();
      
      logger.error({ jobId, error: error.message }, 'Proof generation failed');
    }
  }
  
  /**
   * Call prover worker (HTTP call to worker service)
   */
  private async callProverWorker(request: ProofRequest): Promise<any> {
    // In production, this would call the prover worker via HTTP
    // For now, simulate the worker response
    const workerUrl = process.env.PROVER_WORKER_URL || 'http://localhost:8080';
    
    try {
      const response = await fetch(`${workerUrl}/prove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          circuitName: request.circuitName,
          witness: request.witness,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Worker returned ${response.status}`);
      }
      
      return await response.json();
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Worker not available, using local generation');
      
      // Fallback: Use local snarkjs if worker unavailable
      const snarkjs = require('snarkjs');
      const circuitsPath = process.env.CIRCUITS_PATH || './circuits';
      
      const zkeyPath = `${circuitsPath}/${request.circuitName}_final.zkey`;
      const wasmPath = `${circuitsPath}/${request.circuitName}.wasm`;
      
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        request.witness,
        wasmPath,
        zkeyPath
      );
      
      return { proof, publicSignals };
    }
  }
  
  private generateJobId(): string {
    return `job_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }
  
  /**
   * Get queue stats
   */
  getStats() {
    const queued = Array.from(this.jobs.values()).filter(j => j.status === 'queued').length;
    const proving = Array.from(this.jobs.values()).filter(j => j.status === 'proving').length;
    const completed = Array.from(this.jobs.values()).filter(j => j.status === 'completed').length;
    const failed = Array.from(this.jobs.values()).filter(j => j.status === 'failed').length;
    
    return { queued, proving, completed, failed, total: this.jobs.size };
  }
}

// Initialize orchestrator
const orchestrator = new ProofOrchestrator();

// ===== API Routes =====

/**
 * Submit proof request
 */
app.post('/api/v1/prove', async (req, res) => {
  try {
    const request: ProofRequest = req.body;
    
    if (!request.batchId || !request.circuitName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const jobId = await orchestrator.submitProofRequest(request);
    
    res.json({ jobId, status: 'queued' });
  } catch (error: any) {
    logger.error({ error }, 'Failed to submit proof request');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get job status
 */
app.get('/api/v1/job/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = orchestrator.getJobStatus(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(job);
});

/**
 * Get orchestrator stats
 */
app.get('/api/v1/stats', (req, res) => {
  const stats = orchestrator.getStats();
  res.json(stats);
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Start server
const PORT = process.env.PROVER_PORT || 8080;

app.listen(PORT, () => {
  logger.info({ port: PORT }, '🔧 Prover Orchestrator started');
});

export { ProofOrchestrator };
