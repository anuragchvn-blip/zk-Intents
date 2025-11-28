# 🔐 zk-Intents

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/anuragchvn-blip/zk-Intents?style=social)](https://github.com/anuragchvn-blip/zk-Intents)
[![Status](https://img.shields.io/badge/Status-65%25%20Complete-orange)](https://github.com/anuragchvn-blip/zk-Intents)

**Production-grade zero-knowledge intent rollup with privacy-preserving cross-chain execution**

> 🚀 **Live Demo**: [Coming Soon - Testnet Deployment]  
> 📖 **Documentation**: [Full Guide](./GETTING_STARTED.md)  
> 💬 **Discussions**: [GitHub Issues](https://github.com/anuragchvn-blip/zk-Intents/issues)

---

## 🎯 What is zk-Intents?

A zkRollup that lets users express **intents** instead of transactions, with zero-knowledge privacy guarantees. Unlike traditional intent systems, we're Ethereum-native and work with existing L2s (Polygon, Arbitrum, Optimism, Base, zkSync).

**Think:** CoW Protocol meets zkSync, but for any chain.

### ✨ Key Features

#### 🔓 **Walletless Authentication**
- **Email OTP**: No seed phrases, just email verification
- **WebAuthn/Passkey**: Biometric authentication (Touch ID, Face ID, Windows Hello)
- **Session Management**: Secure JWT-based sessions

#### 🤝 **Solver Network**
- **Competitive Bidding**: 3+ solvers compete for best execution
- **Multi-Chain**: Execute on Polygon, Arbitrum, Optimism, Base, zkSync
- **Reputation System**: Track solver performance and reliability

#### 🔒 **Zero-Knowledge Proofs**
- **Real Groth16 Proofs**: Using snarkjs with Circom circuits
- **Privacy Preserving**: Amounts hidden via Pedersen commitments
- **Batch Verification**: 16-128 intents per proof

#### 🌉 **Cross-Chain Intents**
- **Unified Interface**: Submit once, execute anywhere
- **Automatic Routing**: Solvers find best execution path
- **Bridge Abstraction**: LayerZero, Axelar, Wormhole support (coming soon)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (for sequencer)
- Circom 2.1.6 (for circuit compilation)

### 1. Clone & Install

```bash
git clone https://github.com/anuragchvn-blip/zk-Intents.git
cd zk-Intents
npm install
```

### 2. Setup Environment

```bash
# Sequencer
cd sequencer
cp ../.env.example .env
# Edit .env with your SMTP credentials for email OTP
npx prisma generate
npx prisma db push
cd ..
```

### 3. Generate Circuit Keys (Optional - for ZK proofs)

```bash
cd circuits
npm install
npm run build
./setup_keys.sh  # Generates proving keys (~5 minutes)
cd ..
```

### 4. Start All Services

**Windows:**
```powershell
.\start-all.ps1
```

**Linux/Mac:**
```bash
./start-all.sh
```

This starts:
- 🔧 Prover Worker (port 8081)
- 📊 Prover Orchestrator (port 8080)
- 🎯 Sequencer (port 3000)
- 🖥️ Frontend UI (port 3001)

### 5. Open Demo

Visit **http://localhost:3001**

1. Create account with email
2. Verify OTP
3. (Optional) Enroll passkey
4. Submit intent!

---

## 📊 Project Status: 65% Complete

### ✅ What's Working

- [x] Intent submission frontend (React + Next.js)
- [x] Email OTP authentication
- [x] WebAuthn/Passkey enrollment & login
- [x] Intent validation & mempool
- [x] Solver network with competitive bidding
- [x] ZK proof generation pipeline (snarkjs)
- [x] Batch processing
- [x] WebSocket real-time updates
- [x] Multi-chain support (5 chains)

### ⚠️ Partial Implementation

- [ ] L1 smart contract verification (20%)
- [ ] Real DEX execution (10% - simulated)
- [ ] Cross-chain bridging (10% - placeholder)
- [ ] Multi-node sequencer (30% - single node)

### ❌ Not Yet Implemented

- [ ] Deposit/withdrawal mechanism
- [ ] Staking & slashing for sequencers
- [ ] Mainnet deployment
- [ ] Security audit

**Full Status**: See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     User Interface                       │
│  React + Next.js | Email OTP | WebAuthn/Passkey         │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                   Intent Submission                      │
│      Transfer | Swap | Bridge | Withdraw                │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                 Sequencer (Port 3000)                    │
│  Validation → Mempool → Solver Auction → Batching       │
└─────┬────────────────────────────────────────┬───────────┘
      │                                        │
      ▼                                        ▼
┌──────────────────┐              ┌────────────────────────┐
│  Solver Network  │              │   Prover Pipeline      │
│  3+ Competitors  │              │  Orchestrator (8080)   │
│  Bid & Execute   │              │  + Worker (8081)       │
└──────────────────┘              └──────────┬─────────────┘
                                             │
                                             ▼
                                  ┌──────────────────────┐
                                  │   ZK Proof (Groth16) │
                                  │   snarkjs + Circom   │
                                  └──────────┬───────────┘
                                             │
                                             ▼
                            ┌────────────────────────────────┐
                            │  Smart Contracts (Polygon L1)  │
                            │  Verify Proofs + State Roots   │
                            └────────────────────────────────┘
```

## 📚 Documentation

- **[Getting Started](./GETTING_STARTED.md)** - Complete setup guide
- **[Implementation Status](./IMPLEMENTATION_STATUS.md)** - Detailed progress tracking
- **[Quick Start](./QUICKSTART.md)** - Fast setup for developers
- **[Security](./docs/SECURITY.md)** - Threat model & security practices
- **[Runbook](./docs/RUNBOOK.md)** - Operations & troubleshooting

## 🛠️ Technology Stack

**Frontend:**
- Next.js 14 (React 18)
- TypeScript
- Tailwind CSS
- Framer Motion
- @simplewebauthn/browser

**Backend:**
- Node.js 20+
- Express
- Prisma (PostgreSQL)
- WebSocket (real-time updates)

**ZK Stack:**
- Circom 2.1.6
- snarkjs
- Groth16 proving system
- Pedersen commitments

**Smart Contracts:**
- Solidity 0.8.x
- Hardhat
- OpenZeppelin

**Infrastructure:**
- Docker
- Kubernetes (K8s manifests)
- Prometheus + Grafana

---

## 🎯 Roadmap to 100%

### Phase 1: Testnet Ready (2 weeks)
- [ ] Generate circuit keys
- [ ] Deploy contracts to Mumbai testnet
- [ ] Test end-to-end proof verification
- [ ] Add real DEX execution (Uniswap V3)

### Phase 2: Multi-Chain (3 weeks)
- [ ] LayerZero bridge integration
- [ ] Real cross-chain intent execution
- [ ] Solver staking mechanism
- [ ] Multi-node sequencer setup

### Phase 3: Production (4 weeks)
- [ ] Security audit (Trail of Bits / OpenZeppelin)
- [ ] Mainnet deployment
- [ ] 10,000+ testnet users
- [ ] Performance optimization

**Target:** Ethereum Foundation Grant Application by **Q1 2026**

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

**Areas We Need Help:**
- Smart contract development (Solidity)
- ZK circuit optimization
- Frontend improvements
- Documentation
- Testing & QA

---

## 📧 Contact & Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/anuragchvn-blip/zk-Intents/issues)
- **Email**: [Your email for inquiries]
- **Twitter**: [@zkIntents] (if you have one)

---

## 🎓 Learn More

**Intent-Based Architectures:**
- [Anoma: Intents](https://anoma.net/)
- [Uniswap X](https://uniswap.org/whitepaper-uniswapx.pdf)
- [CoW Protocol](https://cow.fi/)

**Zero-Knowledge Proofs:**
- [zkSync Documentation](https://docs.zksync.io/)
- [Circom Language](https://docs.circom.io/)
- [snarkjs Tutorial](https://github.com/iden3/snarkjs)

**Account Abstraction:**
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)
- [WebAuthn Guide](https://webauthn.guide/)

---

## ⚠️ Security Notice

**Status**: Under active development. **DO NOT USE IN PRODUCTION.**

This project has not been audited. See [security/](security/) for:
- Threat model
- Security checklist
- Vulnerability reporting

**Planned Audits:**
- Trail of Bits (Q1 2026)
- OpenZeppelin (Q2 2026)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---

## 🌟 Star History

If you find this project interesting, please give it a star! ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=anuragchvn-blip/zk-Intents&type=Date)](https://star-history.com/#anuragchvn-blip/zk-Intents&Date)

---

**Built with ❤️ by the zk-Intents Team**

*Making blockchain interactions as simple as expressing intent*
