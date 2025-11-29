import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import pino from 'pino';
import { IntentValidator } from './validator';
import { Batcher } from './batcher';
import { StateTree } from './state';
import { TransactionPool } from './pool';
import { DataAvailabilityService } from './data-availability';
import { DecentralizedSequencerNetwork } from './decentralized-network';
import { SolverNetwork, Solver } from './solver-network';
import { AuthService } from './auth-service';
import { DepositWithdrawalService } from './deposit-withdrawal';
import prisma from './db';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Initialize components
const stateTree = new StateTree();
const txPool = new TransactionPool();
const validator = new IntentValidator(stateTree);
const daService = new DataAvailabilityService();
const solverNetwork = new SolverNetwork();
const authService = new AuthService(stateTree);

// Generate node ID and keys for sequencer
const nodeId = process.env.NODE_ID || `seq-${Date.now()}`;
const nodeAddress = process.env.NODE_ADDRESS || '0x0000000000000000000000000000000000000001';
const nodePublicKey = process.env.NODE_PUBLIC_KEY || '0x' + '0'.repeat(64);

const sequencerNetwork = new DecentralizedSequencerNetwork(nodeId, nodeAddress, nodePublicKey);
const batcher = new Batcher(stateTree, txPool, daService, sequencerNetwork, (update: { type: string; data: any }) => {
  broadcastUpdate(update);
});

// Initialize deposit/withdrawal service
const depositWithdrawal = new DepositWithdrawalService(
  stateTree,
  process.env.POLYGON_RPC || 'https://rpc-mumbai.maticvigil.com',
  process.env.SEQUENCER_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001',
  process.env.ROLLUP_CONTRACT_ADDRESS || ''
);

// Initialize solver network with demo solvers
function initializeSolvers() {
  logger.info('Initializing solver network...');
  
  // Create 3 demo solvers with different capabilities
  const solver1 = new Solver(
    process.env.SOLVER1_KEY || '0x' + '1'.repeat(64),
    ['polygon', 'arbitrum', 'optimism'],
    100
  );
  
  const solver2 = new Solver(
    process.env.SOLVER2_KEY || '0x' + '2'.repeat(64),
    ['polygon', 'base', 'zksync'],
    95
  );
  
  const solver3 = new Solver(
    process.env.SOLVER3_KEY || '0x' + '3'.repeat(64),
    ['polygon', 'arbitrum', 'base', 'optimism', 'zksync'],
    110
  );
  
  solverNetwork.registerSolver(solver1);
  solverNetwork.registerSolver(solver2);
  solverNetwork.registerSolver(solver3);
  
  logger.info({ solvers: 3 }, 'Solver network initialized');
}

initializeSolvers();

// ===== API Routes =====

/**
 * Submit a new intent
 */
app.post('/api/v1/intents', async (req, res) => {
  try {
    const intent = req.body;
    
    // Validate intent
    const validationResult = await validator.validate(intent);
    if (!validationResult.valid) {
      return res.status(400).json({ error: validationResult.error });
    }
    
    // Add to pool
    const intentId = await txPool.add(intent);
    
    // Broadcast to websocket clients
    broadcastUpdate({ type: 'new_intent', intentId });
    
    logger.info({ intentId }, 'Intent accepted, sending to solver network');
    
    // Send intent to solver network for execution (async)
    solverNetwork.executeIntent(intent)
      .then((result) => {
        if (result && result.success) {
          logger.info({ 
            intentId, 
            solverId: result.solverId,
            txHash: result.txHash 
          }, 'Intent executed by solver');
          
          // Broadcast execution success
          broadcastUpdate({
            type: 'intent_executed',
            intentId,
            solverId: result.solverId,
            txHash: result.txHash,
            gasUsed: result.gasUsed?.toString(),
          });
        } else {
          logger.warn({ intentId, error: result?.error }, 'Intent execution failed');
        }
      })
      .catch((error) => {
        logger.error({ intentId, error: error.message }, 'Solver execution error');
      });
    
    res.json({ intentId, status: 'queued' });
  } catch (error) {
    logger.error({ error }, 'Failed to process intent');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Query account state
 */
app.get('/api/v1/state/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const account = await stateTree.getAccount(address);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json({
      address,
      balanceCommitment: account.balanceCommitment,
      nonce: account.nonce,
      publicKey: account.publicKey,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to query state');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get batch status
 */
app.get('/api/v1/batch/:id', async (req, res) => {
  try {
    const batchId = parseInt(req.params.id);
    const batch = await batcher.getBatch(batchId);
    
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    res.json(batch);
  } catch (error) {
    logger.error({ error }, 'Failed to get batch');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Step 1: Register email and send OTP
 */
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    
    // Create OTP and send email
    const otp = await authService.createEmailOTP(email);
    
    res.json({ 
      message: 'OTP sent to your email. Please verify to complete registration.' 
    });
  } catch (error) {
    logger.error({ error }, 'Failed to register');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Step 2: Verify OTP and create account (passwordless)
 */
app.post('/api/v1/auth/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP required' });
    }
    
    // Verify OTP and create account (no password needed)
    const result = await authService.verifyOTPAndCreateAccount(email, otp);
    
    logger.info({ address: result.address }, 'Account created');
    
    res.json({
      success: true,
      address: result.address,
      seedPhrase: result.seedPhrase, // User should save this!
      sessionToken: result.sessionToken,
      message: 'Account created successfully. Save your seed phrase!'
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to verify OTP');
    res.status(400).json({ error: error.message || 'Verification failed' });
  }
});

/**
 * Step 3 (Optional): Enroll passkey for future passwordless login
 */
app.post('/api/v1/auth/passkey/enroll', async (req, res) => {
  try {
    const { credentialId, publicKey, email } = req.body;
    
    if (!credentialId || !publicKey || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Look up user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await authService.enrollPasskey(user.id, credentialId, publicKey);
    
    res.json({ 
      success: true,
      message: 'Passkey enrolled successfully. You can now use passwordless login!' 
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to enroll passkey');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Login with email + OTP (passwordless for returning users)
 */
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }
    
    // Send OTP for login
    const userId = await authService.sendLoginOTP(email);
    
    res.json({
      success: true,
      userId,
      message: 'OTP sent to your email'
    });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Failed to send login OTP');
    // If user not found, return 404 instead of 500
    if (error.message?.includes('not found') || error.message?.includes('Account not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Verify OTP and complete login
 */
app.post('/api/v1/auth/login/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP required' });
    }
    
    // Verify OTP and login
    const result = await authService.loginWithOTP(email, otp);
    
    logger.info({ address: result.address }, 'User logged in with OTP');
    
    res.json({
      success: true,
      address: result.address,
      sessionToken: result.sessionToken,
      message: 'Login successful'
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Login failed');
    res.status(401).json({ error: error.message || 'Invalid OTP' });
  }
});

/**
 * Get WebAuthn challenge for passkey login
 */
app.get('/api/v1/auth/passkey/challenge', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email required' });
    }

    const passkeys = await authService.getPasskeysForUser(email);
    if (passkeys.length === 0) {
      return res.status(404).json({ error: 'No passkey found. Please login with password.' });
    }

    // Generate random challenge
    const challenge = require('crypto').randomBytes(32).toString('base64url');
    
    res.json({
      challenge,
      allowCredentials: passkeys.map(pk => ({
        id: pk.credentialId,
        type: 'public-key',
        transports: ['internal', 'hybrid'],
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get challenge');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Login with passkey (WebAuthn) - passwordless
 */
app.post('/api/v1/auth/passkey/login', async (req, res) => {
  try {
    const { email, credentialId, signature } = req.body;
    
    if (!email || !credentialId) {
      return res.status(400).json({ error: 'Email and credential required' });
    }
    
    // Verify passkey authentication
    const result = await authService.loginWithPasskey(email, credentialId, signature);
    
    logger.info({ address: result.address }, 'User logged in with passkey');
    
    res.json({
      success: true,
      address: result.address,
      sessionToken: result.sessionToken,
      message: 'Passkey login successful'
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Passkey login failed');
    res.status(401).json({ error: error.message || 'Invalid passkey' });
  }
});

/**
 * Logout - invalidate session
 */
app.post('/api/v1/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No session token provided' });
    }

    const sessionToken = authHeader.substring(7);
    
    // Delete session from database
    await authService.invalidateSession(sessionToken);
    
    logger.info('User logged out');
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error({ error }, 'Logout failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Enroll WebAuthn passkey
 */
app.post('/api/v1/auth/passkey/enroll', async (req, res) => {
  try {
    const { credentialId, publicKey, email } = req.body;
    
    if (!email || !credentialId || !publicKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Look up user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await authService.enrollPasskey(user.id, credentialId, publicKey);
    
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to enroll passkey');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    stateRoot: stateTree.getRoot(),
    pendingIntents: txPool.size(),
    timestamp: Date.now(),
  });
});

/**
 * Get solver network stats
 */
app.get('/api/v1/solvers/stats', (req, res) => {
  try {
    const stats = solverNetwork.getNetworkStats();
    res.json(stats);
  } catch (error) {
    logger.error({ error }, 'Failed to get solver stats');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create/Register new account in state tree
 */
app.post('/api/v1/account/create', async (req, res) => {
  try {
    const { address, publicKey } = req.body;
    
    if (!address || !publicKey) {
      return res.status(400).json({ error: 'Missing address or publicKey' });
    }
    
    // Check if account already exists
    const existing = await stateTree.getAccount(address);
    if (existing) {
      return res.json({ 
        success: true, 
        message: 'Account already exists',
        address 
      });
    }
    
    // Create new account with initial state
    await stateTree.updateAccount(address, {
      address,
      balanceCommitment: '0x0', // Initial balance (encrypted)
      nonce: 0,
      publicKey: publicKey,
    });
    
    logger.info({ address }, 'Account created');
    res.json({ 
      success: true, 
      address,
      nonce: 0
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create account');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Deposit tokens from L1 to L2
 */
app.post('/api/v1/deposit', async (req, res) => {
  try {
    const { userAddress, tokenAddress, amount, chainId } = req.body;
    
    if (!userAddress || !tokenAddress || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await depositWithdrawal.processDeposit({
      userAddress,
      tokenAddress,
      amount,
      chainId: chainId || 137, // Default to Polygon Mumbai
    });
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    logger.info({ userAddress, amount }, 'Deposit processed');
    res.json({
      success: true,
      txHash: result.txHash,
      l2Balance: result.l2Balance,
    });
  } catch (error) {
    logger.error({ error }, 'Deposit failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Initiate withdrawal from L2 to L1
 */
app.post('/api/v1/withdraw/initiate', async (req, res) => {
  try {
    const { userAddress, tokenAddress, amount, recipient } = req.body;
    
    if (!userAddress || !tokenAddress || !amount || !recipient) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await depositWithdrawal.initiateWithdrawal({
      userAddress,
      tokenAddress,
      amount,
      recipient,
      merkleProof: [], // Will be generated when withdrawal is included in batch
    });
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    logger.info({ userAddress, amount, withdrawalId: result.withdrawalId }, 'Withdrawal initiated');
    res.json({
      success: true,
      withdrawalId: result.withdrawalId,
      message: 'Withdrawal initiated. You can claim it after the next batch is verified on L1.',
    });
  } catch (error) {
    logger.error({ error }, 'Withdrawal initiation failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Complete withdrawal on L1 (after proof verification)
 */
app.post('/api/v1/withdraw/complete', async (req, res) => {
  try {
    const { userAddress, tokenAddress, amount, recipient, merkleProof } = req.body;
    
    if (!userAddress || !tokenAddress || !amount || !recipient || !merkleProof) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await depositWithdrawal.completeWithdrawal({
      userAddress,
      tokenAddress,
      amount,
      recipient,
      merkleProof,
    });
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    logger.info({ userAddress, txHash: result.txHash }, 'Withdrawal completed');
    res.json({
      success: true,
      txHash: result.txHash,
    });
  } catch (error) {
    logger.error({ error }, 'Withdrawal completion failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get L2 balance
 */
app.get('/api/v1/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const balance = await depositWithdrawal.getL2Balance(address);
    
    res.json({
      address,
      balance,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get balance');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== WebSocket Handling =====

wss.on('connection', (ws) => {
  logger.info('New WebSocket connection');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      logger.debug({ data }, 'Received WebSocket message');
      
      // Handle subscriptions
      if (data.type === 'subscribe') {
        ws.send(JSON.stringify({
          type: 'subscribed',
          stateRoot: stateTree.getRoot(),
        }));
      }
    } catch (error) {
      logger.error({ error }, 'WebSocket message error');
    }
  });
  
  ws.on('close', () => {
    logger.info('WebSocket closed');
  });
});

function broadcastUpdate(update: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(update));
    }
  });
}

// ===== Start Batcher =====

batcher.start(); // Start background batching process

// ===== Start Server =====

const PORT = process.env.PORT || 3000;

// Initialize auth service before starting server
authService.initialize().then(() => {
  server.listen(PORT, () => {
    logger.info({ port: PORT }, '🚀 Sequencer API started');
    logger.info({ stateRoot: stateTree.getRoot() }, 'Initial state root');
  });
}).catch((error) => {
  logger.error({ error }, 'Failed to initialize auth service');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await batcher.stop();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

