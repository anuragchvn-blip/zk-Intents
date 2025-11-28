# zk-Intents Production Runbook

## Table of Contents

1. [Quick Start](#quick-start)
2. [Service Architecture](#service-architecture)
3. [Deployment](#deployment)
4. [Monitoring](#monitoring)
5. [Incident Response](#incident-response)
6. [Maintenance](#maintenance)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (Supabase)
- SMTP credentials (Gmail/SendGrid)

### Environment Setup

```bash
# Clone and install
git clone https://github.com/your-org/zk-Intents
cd zk-Intents
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Initialize database
npx prisma migrate deploy
npx prisma generate

# Start services
npm run dev:sequencer  # Port 3000
npm run dev:prover     # Background
npm run dev:ui         # Port 3001
```

## Service Architecture

### Core Services

#### 1. Sequencer (`sequencer/`)

- **Purpose**: Receives intents, validates signatures, batches transactions
- **Port**: 3000
- **Database**: PostgreSQL (Supabase)
- **Dependencies**: Prisma, WebSocket, Pino logger

**Health Check**:

```bash
curl http://localhost:3000/health
```

**Logs**:

```bash
pm2 logs sequencer
# or
journalctl -u zkintents-sequencer -f
```

#### 2. Prover Network (`prover/`)

- **Purpose**: Generates ZK proofs for batched intents
- **Process**: Background worker
- **Dependencies**: snarkjs, circom

**Monitor**:

```bash
pm2 status prover
# Check proof generation queue
curl http://localhost:3000/api/v1/batch/status
```

#### 3. UI (`ui/`)

- **Purpose**: User interface (Next.js)
- **Port**: 3001
- **Type**: Static site (can deploy to Vercel/Netlify)

## Deployment

### Production Deployment (AWS/GCP)

#### 1. Database Setup

```bash
# Use Supabase for managed PostgreSQL
# Or deploy your own:
# - AWS RDS PostgreSQL
# - GCP Cloud SQL
# - DigitalOcean Managed Database

# Run migrations
DATABASE_URL="your-prod-url" npx prisma migrate deploy
```

#### 2. Sequencer Deployment

**Option A: Docker**

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json prisma ./
RUN npm ci --only=production
RUN npx prisma generate
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:sequencer"]
```

```bash
docker build -t zkintents-sequencer .
docker run -p 3000:3000 --env-file .env zkintents-sequencer
```

**Option B: PM2**

```bash
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'sequencer',
    script: 'sequencer/src/index.ts',
    interpreter: 'ts-node',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }, {
    name: 'prover',
    script: 'prover/orchestrator.ts',
    interpreter: 'ts-node',
    instances: 1,
    env: {
      NODE_ENV: 'production'
    }
  }]
}

# Deploy
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 3. UI Deployment

**Vercel** (Recommended):

```bash
vercel --prod
```

**Netlify**:

```bash
netlify deploy --prod
```

**Self-hosted (Nginx)**:

```bash
cd ui
npm run build
# Deploy /out folder to Nginx

# nginx.conf
server {
  listen 80;
  server_name app.zkintents.io;

  root /var/www/zkintents-ui/out;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### SSL/TLS Setup (Required for WebAuthn)

```bash
# Using Certbot (Let's Encrypt)
sudo certbot --nginx -d api.zkintents.io -d app.zkintents.io

# Auto-renewal
sudo systemctl enable certbot.timer
```

## Monitoring

### Metrics to Track

#### 1. System Health

- **Uptime**: Sequencer, Prover, Database
- **Response Time**: API endpoints < 200ms (p95)
- **Error Rate**: < 0.1%

#### 2. Business Metrics

- **Intent Volume**: Intents/hour
- **Batch Frequency**: Batches/hour
- **Proof Generation Time**: < 60s (p95)
- **Settlement Finality**: < 15min

### Monitoring Stack

**Prometheus + Grafana**:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'sequencer'
    static_configs:
      - targets: ['localhost:3000']
```

**Datadog**:

```javascript
// sequencer/src/index.ts
import { StatsD } from 'hot-shots';

const statsd = new StatsD({
  host: 'localhost',
  port: 8125,
  prefix: 'zkintents.',
});

statsd.increment('intent.submitted');
statsd.timing('batch.proof_time', proofDuration);
```

### Alerts

**Critical**:

- Sequencer down > 2 minutes
- Database connection lost
- Proof generation failing > 5 minutes

**Warning**:

- High intent queue (> 1000)
- Slow response times (> 500ms p95)
- Low proof throughput

**Setup (PagerDuty)**:

```bash
# Install agent
curl -L https://install.pagerduty.com | bash

# Configure
pagerduty-agent configure \
  --integration-key YOUR_KEY \
  --service sequencer
```

## Incident Response

### Common Issues

#### 1. Sequencer Not Accepting Intents

```bash
# Check sequencer logs
pm2 logs sequencer

# Check database connection
npx prisma db pull

# Restart sequencer
pm2 restart sequencer
```

#### 2. Proof Generation Delayed

```bash
# Check prover status
pm2 status prover

# Check queue size
curl http://localhost:3000/api/v1/queue/status

# Scale prover workers
pm2 scale prover +2
```

#### 3. Database Migration Failed

```bash
# Rollback last migration
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Re-run migration
npx prisma migrate deploy
```

#### 4. High Memory Usage

```bash
# Check memory
pm2 monit

# Restart with memory limit
pm2 restart sequencer --max-memory-restart 1G
```

### Rollback Procedure

```bash
# 1. Stop services
pm2 stop all

# 2. Rollback code
git checkout previous-stable-tag

# 3. Rollback database
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# 4. Restart
npm install
pm2 restart all
```

## Maintenance

### Daily Tasks

- Monitor dashboards (Grafana)
- Check error logs
- Verify proof generation rate

### Weekly Tasks

- Review database performance
- Check disk usage
- Update dependencies (security patches)

### Monthly Tasks

- Database backup verification
- Load testing
- Security audit
- Update SSL certificates

### Database Backups

**Automated (Supabase)**:

- Enabled by default (point-in-time recovery)

**Manual Backup**:

```bash
pg_dump -h db.ndfyqrfyfelwuzethiqv.supabase.co \
  -U postgres \
  -d postgres \
  > backup_$(date +%Y%m%d).sql

# Restore
psql -h db.ndfyqrfyfelwuzethiqv.supabase.co \
  -U postgres \
  -d postgres \
  < backup_20241127.sql
```

### Scaling

**Horizontal Scaling**:

```bash
# Add more sequencer instances
pm2 scale sequencer +2

# Load balancer (Nginx)
upstream sequencer {
  server 127.0.0.1:3000;
  server 127.0.0.1:3001;
  server 127.0.0.1:3002;
}
```

**Database Scaling**:

- Upgrade Supabase plan
- Add read replicas for queries
- Implement connection pooling (PgBouncer)

## Security Checklist

- [ ] HTTPS enabled (SSL/TLS)
- [ ] Environment variables secured
- [ ] Database backups automated
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Input validation enabled
- [ ] Logs sanitized (no PII)
- [ ] Dependencies up to date
- [ ] Security headers enabled
- [ ] DDoS protection (Cloudflare)

## Support Contacts

- **On-Call Engineer**: oncall@zkintents.io
- **PagerDuty**: https://zkintents.pagerduty.com
- **Status Page**: https://status.zkintents.io
- **Documentation**: https://docs.zkintents.io
