# Getting Started with zk-Intents

## Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Git
- (Optional) Circom compiler for circuit development

## Installation

```bash
# Clone repository
git clone https://github.com/yourusername/zk-Intents.git
cd zk-Intents

# Install dependencies
npm install

# Build all packages
npm run build
```

## Quick Start (Local Development)

### 1. Start the Sequencer

```bash
# Run sequencer in development mode
npm run sequencer:dev
```

The sequencer will start on `http://localhost:3000`

### 2. Use the SDK

```javascript
import { ZkIntentsClient } from '@zk-intents/sdk';

// Initialize client
const client = new ZkIntentsClient('http://localhost:3000');

// Create walletless session with email recovery
const session = await client.createSession({
  recoveryMethod: 'email',
  email: 'user@example.com',
  password: 'secure-password'
});

console.log('Session created:', session.address);

// Submit a transfer intent
const result = await client.submitIntent({
  action: 'transfer',
  amountCommitment: '1000000', // Committed amount
});

console.log('Intent submitted:', result.intentId);

// Query account state
const state = await client.queryState(session.address);
console.log('Account state:', state);
```

### 3. Run Demo UI

```bash
npm run ui:dev
```

Visit `http://localhost:3001` to see the walletless demo.

## Development Workflow

### Build Circuits

```bash
# Install Circom (Linux/Mac)
wget https://github.com/iden3/circom/releases/download/v2.1.6/circom-linux-amd64
chmod +x circom-linux-amd64
sudo mv circom-linux-amd64 /usr/local/bin/circom

# Build circuits
npm run circuits:build
```

### Compile Contracts

```bash
npm run contracts:build
```

### Run Tests

```bash
# All tests
npm test

# Specific workspace
npm run contracts:test
npm --workspace=sequencer test
```

## Deployment

### Deploy to Polygon Mumbai Testnet

1. Set environment variables:

```bash
# Create .env file
cp .env.example .env

# Add your keys
PRIVATE_KEY=your_private_key
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
POLYGONSCAN_API_KEY=your_api_key
```

2. Deploy contracts:

```bash
npm run contracts:deploy:testnet
```

3. Update sequencer config with deployed contract addresses

4. Run sequencer:

```bash
npm run sequencer:start
```

## Project Structure

```
zk-Intents/
├── circuits/        # Circom zk circuits
├── contracts/       # Solidity smart contracts
├── sequencer/       # TypeScript sequencer service
├── prover/          # Proof generation workers
├── sdk/             # Client SDK
├── ui/              # Demo web app
├── docs/            # Documentation
├── scripts/         # Build & deployment scripts
└── infra/           # Infrastructure as code
```

## Next Steps

- Read the [Architecture Guide](docs/design.md)
- Explore the [API Reference](docs/api.md)
- Check [SDK examples](sdk/examples/)
- Review [Security considerations](security/threat-model.md)

## Support

- GitHub Issues: https://github.com/yourusername/zk-Intents/issues
- Documentation: https://docs.zk-intents.dev

## License

MIT
