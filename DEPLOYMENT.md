# Deployment Guide

## 🚀 Testnet Deployment Status

**Network**: Polygon Mumbai Testnet (Chain ID: 80001)

### Deployed Contracts

| Contract | Address | Explorer |
|----------|---------|----------|
| Pairing.sol | `0xBC7a47391847c84D57A792fBcDA6d2BF399513b0` | [View](https://mumbai.polygonscan.com/address/0xBC7a47391847c84D57A792fBcDA6d2BF399513b0) |
| Verifier.sol | `0x3fb8D15312A7f2bfC1B22578213DDa4957C2f952` | [View](https://mumbai.polygonscan.com/address/0x3fb8D15312A7f2bfC1B22578213DDa4957C2f952) |
| ZkIntentsRollup.sol | `0xE6a142952E876F2Aa30E1c51E4e5b1675CC4bFB3` | [View](https://mumbai.polygonscan.com/address/0xE6a142952E876F2Aa30E1c51E4e5b1675CC4bFB3) |

## 📦 Deploy Backend Sequencer

### Option 1: Local Development
```bash
# Set environment variables
cp .env.example .env
# Edit .env with deployed contract addresses

# Install dependencies
cd sequencer
npm install

# Start sequencer
npm start
```

### Option 2: Deploy to Vercel (Serverless)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy sequencer
cd sequencer
vercel --prod

# Set environment variables in Vercel dashboard:
# - ROLLUP_CONTRACT_ADDRESS=0xE6a142952E876F2Aa30E1c51E4e5b1675CC4bFB3
# - VERIFIER_CONTRACT_ADDRESS=0x3fb8D15312A7f2bfC1B22578213DDa4957C2f952
# - POLYGON_RPC=https://rpc-mumbai.maticvigil.com
# - SEQUENCER_PRIVATE_KEY=<your-key>
```

### Option 3: Deploy to Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy
railway login
railway init
railway up

# Set environment variables in Railway dashboard
```

## 🎨 Deploy Frontend UI

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from root
vercel --prod

# Vercel will auto-detect Next.js and deploy from /ui folder
```

### Deploy to Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build
cd ui
npm install
npm run build

# Deploy
netlify deploy --prod --dir=.next
```

## 🔧 Configuration

### Update Environment Variables

**Backend (.env)**:
```bash
ROLLUP_CONTRACT_ADDRESS=0xE6a142952E876F2Aa30E1c51E4e5b1675CC4bFB3
VERIFIER_CONTRACT_ADDRESS=0x3fb8D15312A7f2bfC1B22578213DDa4957C2f952
PAIRING_CONTRACT_ADDRESS=0xBC7a47391847c84D57A792fBcDA6d2BF399513b0
POLYGON_RPC=https://rpc-mumbai.maticvigil.com
NETWORK=mumbai
CHAIN_ID=80001
SEQUENCER_PRIVATE_KEY=<your-private-key>
```

**Frontend (ui/.env.local)**:
```bash
NEXT_PUBLIC_SEQUENCER_URL=https://your-sequencer.vercel.app
NEXT_PUBLIC_NETWORK=mumbai
NEXT_PUBLIC_CHAIN_ID=80001
```

## ✅ Verification Checklist

- [ ] Contracts deployed to Mumbai testnet
- [ ] Contracts verified on PolygonScan
- [ ] Backend sequencer running (local or deployed)
- [ ] Frontend UI deployed (Vercel/Netlify)
- [ ] Public URL accessible (e.g., zk-intents.vercel.app)
- [ ] Test deposit → intent → withdrawal flow
- [ ] WebSocket connection working
- [ ] Email authentication working

## 🧪 Testing

### Test Deposit
```bash
# Using cast (Foundry)
cast send 0xE6a142952E876F2Aa30E1c51E4e5b1675CC4bFB3 \
  "deposit(bytes32)" \
  0x0000000000000000000000000000000000000000000000000000000000000001 \
  --value 0.1ether \
  --rpc-url https://rpc-mumbai.maticvigil.com \
  --private-key <your-key>
```

### Test API
```bash
# Check sequencer health
curl https://your-sequencer.vercel.app/health

# Check account state
curl https://your-sequencer.vercel.app/api/v1/state/<address>
```

## 📊 Monitoring

- **PolygonScan**: https://mumbai.polygonscan.com
- **Sequencer logs**: Check deployment platform (Vercel/Railway)
- **Database**: Supabase dashboard
- **Analytics**: Add Google Analytics to UI

## 🚀 Next Steps

1. **Verify contracts** on PolygonScan for transparency
2. **Get testnet MATIC** from faucet for testing
3. **Share public URL** on Twitter/Reddit/Discord
4. **Collect feedback** from early users
5. **Monitor metrics**: signups, deposits, intent submissions
6. **Target**: 100-500 testnet users before grant application

## 📝 Grant Application

Once you have:
- ✅ Public testnet deployment
- ✅ 100-500 active users
- ✅ 5-minute video demo
- ✅ Community engagement (Twitter, Reddit)

Apply to:
1. **Ethereum Foundation** - Ecosystem Support Program
2. **Polygon Labs** - Grants Program  
3. **Gitcoin Grants** - Community funding

**Estimated grant approval**: 60-70% with testnet traction
