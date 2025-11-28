# zk-Intents Setup Guide

## Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
# Root dependencies
npm install

# Sequencer
cd sequencer && npm install

# UI
cd ../ui && npm install

# Prover
cd ../prover && npm install
```

### 2. Configure Environment Variables

Create `.env` in the root directory:

```bash
# Copy template
cp .env.example .env
```

#### Generate Security Keys

```bash
# JWT Secret (copy output to .env)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Encryption Key (copy output to .env)
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

#### Setup Gmail SMTP (Optional)

1. Go to <https://myaccount.google.com/security>
2. Enable 2-Factor Authentication
3. Go to <https://myaccount.google.com/apppasswords>
4. Create app password for "Mail" → "Other (zk-Intents)"
5. Copy the 16-character password to `.env`:

```env
SMTP_USER="your-email@gmail.com"
SMTP_PASS="abcd efgh ijkl mnop"
```

#### Your Complete .env

```env
# Database (Supabase)
DATABASE_URL="postgresql://postgres:Chvn@2003@db.ndfyqrfyfelwuzethiqv.supabase.co:5432/postgres"

# Security (Generated above)
JWT_SECRET="your-generated-jwt-secret-here"
ENCRYPTION_KEY="your-generated-encryption-key-here"

# Application
NODE_ENV="development"
PORT=3000
LOG_LEVEL="info"
FRONTEND_URL="http://localhost:3001"

# Email (Optional for development)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Blockchain RPC (Optional - defaults work)
ETHEREUM_RPC="https://eth-mainnet.g.alchemy.com/v2/demo"
POLYGON_RPC="https://polygon-mainnet.g.alchemy.com/v2/demo"
```

### 3. Initialize Database

```bash
# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### 4. Start Services

```bash
# Terminal 1: Sequencer
cd sequencer
npm run dev

# Terminal 2: Prover
cd prover
npx ts-node orchestrator.ts

# Terminal 3: UI
cd ui
npm run dev
```

### 5. Open Application

Visit <http://localhost:3001>

---

## Development Workflow

### Database Changes

```bash
# Create new migration
npx prisma migrate dev --name add_new_feature

# Reset database (⚠️ destructive)
npx prisma migrate reset

# View database in browser
npx prisma studio
```

### Testing

```bash
# Run all tests
npm test

# Run sequencer tests
cd sequencer && npm test

# Run circuit tests
cd circuits && npm test
```

### Building

```bash
# Build circuits
cd circuits && npm run build

# Build TypeScript
npm run build

# Build Docker images
docker-compose build
```

---

## Deployment

### Testnet Deployment

```bash
# Deploy contracts to Polygon Mumbai
cd contracts
npx hardhat deploy --network mumbai

# Deploy sequencer
cd ../sequencer
npm run deploy:staging

# Deploy UI
cd ../ui
vercel --prod
```

### Production Deployment

See `runbooks/deployment.md` for complete procedures.

---

## Troubleshooting

### Database Connection Failed

```bash
# Check Supabase status
curl https://status.supabase.io

# Verify DATABASE_URL
echo $DATABASE_URL

# Test connection
npx prisma db pull
```

### Sequencer Won't Start

```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill process using port 3000
# (Use PID from above)
taskkill /PID <PID> /F

# Restart sequencer
cd sequencer && npm run dev
```

### UI Not Loading

```bash
# Clear Next.js cache
cd ui
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Restart
npm run dev
```

### Prisma Client Not Found

```bash
# Regenerate Prisma client
npx prisma generate

# If still failing, reinstall
npm install @prisma/client
```

---

## Development Tools

### Useful Commands

```bash
# Format code
npm run format

# Lint code
npm run lint

# Type check
npm run type-check

# View logs
pm2 logs sequencer

# Monitor resources
pm2 monit
```

### Database GUI

```bash
# Prisma Studio (web-based)
npx prisma studio

# Connect with psql
psql "postgresql://postgres:Chvn@2003@db.ndfyqrfyfelwuzethiqv.supabase.co:5432/postgres"
```

---

## Next Steps

1. ✅ Complete `.env` setup
2. ✅ Start all services
3. ✅ Test account creation
4. ✅ Submit an intent
5. 📖 Read `docs/design.md` for architecture
6. 🔐 Review `docs/SECURITY.md` for best practices
7. 🚀 Deploy to testnet

---

## Support

- **Documentation**: `/docs` folder
- **Runbooks**: `/runbooks` folder
- **Issues**: <https://github.com/your-org/zk-intents/issues>
- **Discord**: <https://discord.gg/zk-intents>

---

**Last Updated**: November 27, 2024
