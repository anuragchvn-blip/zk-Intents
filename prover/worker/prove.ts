import express from 'express';
import pino from 'pino';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();

app.use(express.json({ limit: '50mb' }));

/**
 * Prover Worker
 * Generates zk-SNARK proofs using snarkjs
 */
class ProverWorker {
  private circuitsPath: string = '/app/circuits';
  
  /**
   * Generate proof from witness using snarkjs
   */
  async generateProof(circuitName: string, witness: any): Promise<any> {
    const startTime = Date.now();
    
    logger.info({ circuitName }, 'Generating proof');
    
    try {
      // Path to circuit artifacts
      const zkeyPath = `${this.circuitsPath}/${circuitName}_final.zkey`;
      const wasmPath = `${this.circuitsPath}/${circuitName}.wasm`;
      
      // Verify files exist
      if (!existsSync(zkeyPath)) {
        throw new Error(`Proving key not found: ${zkeyPath}`);
      }
      
      if (!existsSync(wasmPath)) {
        throw new Error(`WASM file not found: ${wasmPath}`);
      }
      
      // Real snarkjs proof generation
      const snarkjs = require('snarkjs');
      
      logger.info('Generating witness...');
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        witness,
        wasmPath,
        zkeyPath
      );
      
      const duration = Date.now() - startTime;
      logger.info({ circuitName, duration, publicSignalsCount: publicSignals.length }, 'Proof generated successfully');
      
      return {
        proof,
        publicSignals
      };
      
    } catch (error: any) {
      logger.error({ error: error.message, stack: error.stack }, 'Proof generation failed');
      throw new Error(`Proof generation failed: ${error.message}`);
    }
  }
}

const worker = new ProverWorker();

// ===== API Routes =====

/**
 * Generate proof endpoint
 */
app.post('/prove', async (req, res) => {
  try {
    const { circuitName, witness } = req.body;
    
    if (!circuitName || !witness) {
      return res.status(400).json({ error: 'Missing circuitName or witness' });
    }
    
    const result = await worker.generateProof(circuitName, witness);
    
    res.json(result);
  } catch (error: any) {
    logger.error({ error }, 'Proof generation failed');
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', worker: 'ready', timestamp: Date.now() });
});

// Start worker
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  logger.info({ port: PORT }, '⚡ Prover Worker ready');
});
