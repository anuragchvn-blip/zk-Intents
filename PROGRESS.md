# zk-Intents - Progress Update

## ✅ Completed (Week 1)

### Repository Structure
- Complete project scaffolding with npm workspaces
- Configuration files (TypeScript, ESLint, Prettier)
- Documentation structure (README, docs/, runbooks/)

### Circuits Layer
- **merkle.circom**: Sparse Merkle tree inclusion proofs and updates
- **commitments.circom**: Pedersen commitments, range proofs, commitment arithmetic
- **eddsa.circom**: EdDSA signature verification on BabyJubJub
- **transfer.circom**: Full transfer intent circuit with:
  - Signature verification
  - Balance checks with range proofs
  - Dual Merkle updates (sender → receiver)
  - Depth-20 tree (1M accounts)

### Smart Contracts
- **ZkIntentsRollup.sol**:
  - UUPS upgradeable proxy pattern
  - Batch submission with proof verification
  - Deposit queue (L1 → L2)
  - Merkle-proof withdrawals (L2 → L1)
  - Emergency withdrawal after 24hr sequencer downtime
- **Verifier.sol**: Groth16 verifier scaffold (BN256 pairing)

### Sequencer Service
- **index.ts**: Express API + WebSocket server
  - POST /api/v1/intents
  - GET /api/v1/state/:address
  - GET /api/v1/batch/:id
  - Email + Passkey recovery endpoints
- **state.ts**: Sparse Merkle tree with LevelDB
- **recovery.ts**: Email OTP + WebAuthn passkey management

## 🚧 In Progress

- Transaction pool and batching logic
- Intent validation
- Prover orchestration
- SDK and demo UI

## Next Steps

1. Complete sequencer components (validator, batcher, pool)
2. Build prover infrastructure (Docker workers)
3. Create TypeScript SDK
4. Build Next.js demo UI with walletless flows
5. Integration testing
6. Deploy to Polygon Mumbai testnet

## Timeline

- Week 1: ✅ Core circuits + contracts + sequencer foundation
- Week 2-3:  SDK, prover, UI
- Week 4: Testing + testnet deployment
- Week 5-6: Optimization + security review
- Week 7-8: Documentation + production prep
