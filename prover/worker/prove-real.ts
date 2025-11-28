import express from 'express';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import * as snarkjs from 'snarkjs';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const app = express();
app.use(express.json({ limit: '100mb' }));

const CIRCUITS_PATH = path.resolve(__dirname, '../../circuits');

interface ProveRequest {
  circuitName: string;
  witness: unknown;
}

/**
 * Generate ZK proof using snarkjs
 */
app.post('/prove', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { circuitName, witness }: ProveRequest = req.body;
    
    if (!circuitName || !witness) {
      return res.status(400).json({ error: 'Missing circuitName or witness' });
    }
    
    logger.info({ circuitName }, 'Starting proof generation');
    
    // Check if circuit files exist
    const wasmPath = path.join(CIRCUITS_PATH, `${circuitName}.wasm`);
    const zkeyPath = path.join(CIRCUITS_PATH, `${circuitName}_final.zkey`);
    
    if (!fs.existsSync(wasmPath)) {
      logger.error({ wasmPath }, 'WASM file not found');
      return res.status(404).json({ 
        error: 'Circuit WASM not found',
        hint: 'Run: cd circuits && npm run build'
      });
    }
    
    if (!fs.existsSync(zkeyPath)) {
      logger.error({ zkeyPath }, 'Zkey file not found');
      return res.status(404).json({ 
        error: 'Circuit zkey not found',
        hint: 'Run: cd circuits && ./setup_keys.sh'
      });
    }
    
    // Generate proof with snarkjs
    logger.info('Calling snarkjs.groth16.fullProve...');
    
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      witness,
      wasmPath,
      zkeyPath
    );
    
    const duration = Date.now() - startTime;
    logger.info({ circuitName, duration }, 'Proof generated successfully');
    
    res.json({
      proof,
      publicSignals,
      duration,
      circuitName
    });
    
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage, duration }, 'Proof generation failed');
    
    res.status(500).json({
      error: 'Proof generation failed',
      message: errorMessage,
      duration
    });
  }
});

/**
 * Verify a proof
 */
app.post('/verify', async (req, res) => {
  try {
    const { circuitName, proof, publicSignals } = req.body;
    
    if (!circuitName || !proof || !publicSignals) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const vkeyPath = path.join(CIRCUITS_PATH, `${circuitName}_verification_key.json`);
    
    if (!fs.existsSync(vkeyPath)) {
      return res.status(404).json({ error: 'Verification key not found' });
    }
    
    const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf-8'));
    
    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    
    res.json({
      valid: isValid,
      circuitName
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, 'Verification failed');
    res.status(500).json({ error: 'Verification failed', message: errorMessage });
  }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  const circuitsExist = fs.existsSync(CIRCUITS_PATH);
  
  res.json({
    status: 'ok',
    circuitsPath: CIRCUITS_PATH,
    circuitsExist,
    timestamp: Date.now()
  });
});

/**
 * List available circuits
 */
app.get('/circuits', (req, res) => {
  try {
    if (!fs.existsSync(CIRCUITS_PATH)) {
      return res.json({ circuits: [], note: 'Circuits directory not found' });
    }
    
    const files = fs.readdirSync(CIRCUITS_PATH);
    const circuits = files
      .filter(f => f.endsWith('.wasm'))
      .map(f => f.replace('.wasm', ''))
      .map(name => {
        const zkeyExists = fs.existsSync(path.join(CIRCUITS_PATH, `${name}_final.zkey`));
        const vkeyExists = fs.existsSync(path.join(CIRCUITS_PATH, `${name}_verification_key.json`));
        
        return {
          name,
          ready: zkeyExists && vkeyExists,
          zkeyExists,
          vkeyExists
        };
      });
    
    res.json({ circuits, circuitsPath: CIRCUITS_PATH });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMessage });
  }
});

const PORT = process.env.PROVER_WORKER_PORT || 8081;

app.listen(PORT, () => {
  logger.info({ port: PORT, circuitsPath: CIRCUITS_PATH }, '⚡ Prover Worker started');
  logger.info('Ready to generate proofs using snarkjs + Groth16');
});
