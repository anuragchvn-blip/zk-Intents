# Deployed Contract Addresses

## Polygon Mumbai Testnet (Chain ID: 80001)

### Core Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| **Pairing.sol** | `0xBC7a47391847c84D57A792fBcDA6d2BF399513b0` | BN254 elliptic curve pairing library |
| **Verifier.sol** | `0x3fb8D15312A7f2bfC1B22578213DDa4957C2f952` | Groth16 zkSNARK proof verifier |
| **ZkIntentsRollup.sol** | `0xE6a142952E876F2Aa30E1c51E4e5b1675CC4bFB3` | Main L2 rollup contract (UUPS proxy) |

### Deployment Details

- **Network**: Polygon Mumbai Testnet
- **Chain ID**: 80001
- **RPC URL**: https://rpc-mumbai.maticvigil.com
- **Block Explorer**: https://mumbai.polygonscan.com
- **Deployment Date**: November 29, 2025

### Contract Verification URLs

Verify on PolygonScan Mumbai:

- **Pairing**: https://mumbai.polygonscan.com/address/0xBC7a47391847c84D57A792fBcDA6d2BF399513b0#code
- **Verifier**: https://mumbai.polygonscan.com/address/0x3fb8D15312A7f2bfC1B22578213DDa4957C2f952#code
- **ZkIntentsRollup**: https://mumbai.polygonscan.com/address/0xE6a142952E876F2Aa30E1c51E4e5b1675CC4bFB3#code

### Next Steps

1. **Verify contracts on PolygonScan** (improves trust & allows UI interaction)
2. **Update backend sequencer** with rollup contract address
3. **Update UI** to connect to Mumbai testnet
4. **Configure environment variables**:
   ```bash
   ROLLUP_CONTRACT_ADDRESS=0xE6a142952E876F2Aa30E1c51E4e5b1675CC4bFB3
   VERIFIER_CONTRACT_ADDRESS=0x3fb8D15312A7f2bfC1B22578213DDa4957C2f952
   NETWORK=mumbai
   RPC_URL=https://rpc-mumbai.maticvigil.com
   ```

### Test the Deployment

```bash
# Test deposit function
cast send 0xE6a142952E876F2Aa30E1c51E4e5b1675CC4bFB3 \
  "deposit(bytes32)" \
  0x0000000000000000000000000000000000000000000000000000000000000001 \
  --value 0.1ether \
  --rpc-url https://rpc-mumbai.maticvigil.com

# Check state root
cast call 0xE6a142952E876F2Aa30E1c51E4e5b1675CC4bFB3 \
  "stateRoot()(bytes32)" \
  --rpc-url https://rpc-mumbai.maticvigil.com
```

### Configuration for SDK

```typescript
// sdk/src/config.ts
export const CONTRACTS = {
  rollup: '0xE6a142952E876F2Aa30E1c51E4e5b1675CC4bFB3',
  verifier: '0x3fb8D15312A7f2bfC1B22578213DDa4957C2f952',
};

export const NETWORK = {
  chainId: 80001,
  name: 'mumbai',
  rpc: 'https://rpc-mumbai.maticvigil.com',
};
```

## Grant Application Readiness

✅ **Contracts deployed to testnet**  
✅ **Verifiable on block explorer**  
⏳ **Need to configure backend sequencer**  
⏳ **Need to deploy UI to Vercel/Netlify**  
⏳ **Need to get 100-500 testnet users**  

**Next Priority**: Update .env files and deploy UI to public URL.
