# Quick Start - zk-Intents

## Prerequisites

1. **Environment Setup**: Ensure `.env` is configured with:
    - `ROLLUP_CONTRACT_ADDRESS`
    - `VERIFIER_CONTRACT_ADDRESS`
    - `SEQUENCER_PRIVATE_KEY`

## Start the System

Run these commands in separate terminals:

**Terminal 1 - Sequencer (Backend):**

```bash
npm run sequencer:dev
```

**Terminal 2 - UI (Frontend):**

```bash
npm run dev
```

**Terminal 3 - Prover (Optional - runs automatically):**

```bash
npm run prover:dev
```

## Accessing the App

- **Demo UI**: <http://localhost:3001>
- **Sequencer API**: <http://localhost:3000>

## What to Try

1. Visit <http://localhost:3001>
2. **Create Account**: Enter email -> Get OTP from sequencer console -> Verify
3. **Submit Intent**: Send funds or withdraw
4. **Watch Realtime**: See "Batch Created" and "Batch Verified" logs in the UI!

## Troubleshooting

- **Contract Error**: Ensure you have MATIC/ETH in your sequencer wallet for gas.
- **Build Error**: Run `npm run build` in the root directory.
