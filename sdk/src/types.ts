/**
 * zk-Intents SDK Type Definitions
 */

export interface Intent {
  intentId: string;
  senderAddress: string;
  action: 'transfer' | 'withdraw';
  targetCommitment?: string;
  amountCommitment: string;
  nonce: number;
  timestamp: number;
  signature?: EdDSASignature;
}

export interface EdDSASignature {
  r: string;
  s: string;
  pubKey: [string, string];
}

export interface AccountState {
  address: string;
  balanceCommitment: string;
  nonce: number;
  publicKey: string;
}

export interface SessionKey {
  address: string;
  privateKey: string;
  publicKey: [string, string];
  sessionId: string;
}

export interface SessionOptions {
  email?: string;
  passkey?: boolean;
  duration?: number;
}

export interface IntentSubmitResult {
  intentId: string;
  status: 'queued' | 'batched' | 'proven' | 'finalized';
}

export interface BatchInfo {
  batchId: number;
  intents: string[];
  stateRoot: string;
  proof?: any;
  status: 'pending' | 'proven' | 'finalized';
  timestamp: number;
}

/**
 * WebSocket update types
 */
export type RealtimeUpdate = 
  | { type: 'new_intent'; intentId: string }
  | { type: 'batch_created'; batchId: number; intentCount: number }
  | { type: 'proof_generated'; batchId: number }
  | { type: 'batch_finalized'; batchId: number; txHash: string }
  | { type: 'state_update'; stateRoot: string };
