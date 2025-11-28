# Smart Contracts - Remix IDE

These contracts are designed to be deployed using [Remix IDE](https://remix.ethereum.org/).

## Files

- `ZkIntentsRollup.sol` - Main rollup contract
- `Verifier.sol` - Groth16 proof verifier

## Deployment Steps (Remix)

### 1. Open Remix IDE

Visit https://remix.ethereum.org/

### 2. Import Contracts

1. Create new workspace or use default
2. Upload `ZkIntentsRollup.sol` and `Verifier.sol`
3. Remix will auto-install OpenZeppelin dependencies

### 3. Compile

1. Go to "Solidity Compiler" tab
2. Select compiler version: `0.8.24`
3. Enable optimization (200 runs)
4. Click "Compile ZkIntentsRollup.sol"
5. Click "Compile Verifier.sol"

### 4. Deploy to Polygon Mumbai

1. Go to "Deploy & Run Transactions" tab
2. Environment: "Injected Provider - MetaMask"
3. Connect to Polygon Mumbai network
4. Deploy contracts in order:
   - First: `Verifier.sol`
   - Then: `ZkIntentsRollup.sol` with constructor args:
     - `_stateRoot`: Initial state root (use `0x0000...` for genesis)
     - `_verifier`: Address of deployed Verifier contract
     - `_sequencer`: Your sequencer address

### 5. Verify on Polygonscan

1. Go to Polygonscan Mumbai
2. Find your contract
3. Click "Verify and Publish"
4. Use Remix flattener or copy contract code
5. Match compiler settings

## Environment Variables

After deployment, update `.env` with contract addresses:

```
ROLLUP_CONTRACT_ADDRESS=0x...
VERIFIER_CONTRACT_ADDRESS=0x...
```

## Testing

Use Remix's JavaScript VM for local testing or deploy to Mumbai for integration tests.

## Notes

- Contracts use UUPS proxy pattern - deploy implementation first
- Verifier will be replaced when circuits are finalized
- Emergency withdrawal enabled after 24h sequencer downtime
