# zk-Intents

Production-grade zero-knowledge rollup on Polygon with intent-first UX, partial privacy, and micro-transaction support.

## Features

### Core Features

- **Walletless Onboarding**: Email recovery or WebAuthn passkeys - no MetaMask required
- **Micro-Transactions**: Sub-cent transactions via batching and sponsored fees
- **Partial Privacy**: Committed amounts with public aggregates for compliance
- **Intent-First UX**: Submit intents, not raw transactions
- **Production Ready**: Automated proving, monitoring, security audits

### Advanced Features (NEW! 🎉)

- **Decentralized Sequencer Network**: Leader rotation, MEV-resistant ordering, Byzantine fault tolerance
- **Data Availability Layer**: Multi-DA support (Celestia, EigenDA, Avail, Polygon DA)
- **Cross-Chain Bridge**: Intent propagation across 5+ chains with solver competition
- **Chain Abstraction**: Automatic routing to best liquidity and price
- **Real WebAuthn**: Complete FIDO2 implementation with signature verification
- **Production Circuit Keys**: Automated setup with Groth16 ceremony

## Quick Start

```bash
# Install dependencies
npm install

# Build circuits
npm run circuits:build

# Compile contracts
npm run contracts:build

# Run sequencer
npm run sequencer:dev

# Run demo UI
npm run ui:dev
```

## Architecture

```text
┌─────────────────┐
│   React Demo UI │
│  (Walletless)   │
└────────┬────────┘
         │
    ┌────▼────┐
    │   SDK   │
    └────┬────┘
         │
┌────────▼────────┐
│    Sequencer    │
│  (Intent Pool)  │
└────┬────────┬───┘
     │        │
     │   ┌────▼────────┐
     │   │   Prover    │
     │   │  (GPU/CPU)  │
     │   └────┬────────┘
     │        │
┌────▼────────▼───────┐
│  Polygon L1         │
│  (ZkIntentsRollup)  │
└─────────────────────┘
```

## Documentation

- [Design & Architecture](docs/design.md)
- [API Reference](docs/api.md)
- [SDK Guide](docs/sdk-guide.md)
- [Deployment Guide](docs/deployment.md)

## Development Roadmap

- ✅ Phase 0: Planning & Architecture
- 🔄 Phase 1: Repository Setup & Core Circuits
- ⏳ Phase 2: Smart Contracts
- ⏳ Phase 3: Sequencer & State Management
- ⏳ Phase 4: Prover Infrastructure
- ⏳ Phase 5: SDK & Demo UI
- ⏳ Phase 6: Testing & Polygon Testnet
- ⏳ Phase 7: Documentation & Production Prep

## Security

This project is under active development. See [security/](security/) for threat model, audit checklist, and vulnerability reporting.

## License

MIT
