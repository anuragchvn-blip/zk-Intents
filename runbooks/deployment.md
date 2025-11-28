# Deployment Runbook

## Pre-Deployment Checklist

### 1. Code Review

- [ ] All PRs approved and merged
- [ ] Tests passing (unit, integration, e2e)
- [ ] No critical security vulnerabilities (`npm audit`)
- [ ] Code coverage > 80%
- [ ] Documentation updated

### 2. Database

- [ ] Migration scripts reviewed
- [ ] Backup created
- [ ] Migration tested on staging
- [ ] Rollback plan documented

### 3. Infrastructure

- [ ] Resource limits configured
- [ ] Autoscaling rules tested
- [ ] Load balancer health checks configured
- [ ] SSL certificates valid

### 4. Monitoring

- [ ] Alerts configured
- [ ] Dashboards created
- [ ] On-call schedule set
- [ ] Runbook links added to alerts

## Deployment Steps

### Staging Deployment

```bash
# 1. Pull latest code
git checkout main
git pull origin main

# 2. Install dependencies
npm install

# 3. Run database migrations
DATABASE_URL=$STAGING_DB_URL npx prisma migrate deploy

# 4. Build application
npm run build

# 5. Deploy to staging environment
# Using PM2
pm2 delete zkintents-staging || true
pm2 start ecosystem.staging.config.js
pm2 save

# 6. Verify deployment
curl https://staging-api.zkintents.io/health
curl https://staging.zkintents.io

# 7. Run smoke tests
npm run test:smoke -- --env=staging
```

### Production Deployment

```bash
# 1. Create release tag
VERSION=$(node -p "require('./package.json').version")
git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin "v$VERSION"

# 2. Notify team
# Post to Slack: "🚀 Deploying v$VERSION to production"

# 3. Enable maintenance mode (optional)
curl -X POST https://api.zkintents.io/admin/maintenance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": true, "message": "Deploying updates"}'

# 4. Database migration (with monitoring)
DATABASE_URL=$PROD_DB_URL npx prisma migrate deploy 2>&1 | tee migration.log

# 5. Deploy sequencer (zero-downtime)
pm2 reload zkintents-sequencer --update-env

# 6. Deploy prover
pm2 reload zkintents-prover --update-env

# 7. Deploy UI (static files to CDN)
npm run build
aws s3 sync ui/out s3://zkintents-ui --delete
aws cloudfront create-invalidation --distribution-id EXXX --paths "/*"

# 8. Verify deployment
./scripts/verify-deployment.sh production

# 9. Disable maintenance mode
curl -X POST https://api.zkintents.io/admin/maintenance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": false}'

# 10. Monitor for 30 minutes
pm2 logs --lines 100 | grep -i error
curl https://api.zkintents.io/metrics

# 11. Notify team
# Post to Slack: "✅ v$VERSION deployed successfully"
```

## Rollback Procedure

### Quick Rollback (< 5 minutes old deployment)

```bash
# 1. Rollback code
git revert HEAD --no-edit
git push origin main

# 2. Redeploy previous version
pm2 reload all

# 3. Verify
curl https://api.zkintents.io/health
```

### Full Rollback (database migration included)

```bash
# 1. Identify last good version
LAST_GOOD_VERSION="v1.2.3"
git checkout "tags/$LAST_GOOD_VERSION"

# 2. Rollback database migration
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# 3. Rebuild
npm install
npm run build

# 4. Deploy
pm2 reload all

# 5. Verify
./scripts/verify-deployment.sh production
```

## Verification Script

```bash
#!/bin/bash
# scripts/verify-deployment.sh

ENV=$1
if [ "$ENV" = "production" ]; then
  API_URL="https://api.zkintents.io"
  UI_URL="https://app.zkintents.io"
else
  API_URL="https://staging-api.zkintents.io"
  UI_URL="https://staging.zkintents.io"
fi

echo "🔍 Verifying deployment on $ENV..."

# Health check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health)
if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Health check failed (HTTP $HTTP_CODE)"
  exit 1
fi
echo "✅ Health check passed"

# Database connectivity
PENDING_INTENTS=$(curl -s $API_URL/health | jq '.pendingIntents')
if [ "$PENDING_INTENTS" = "null" ]; then
  echo "❌ Database not responding"
  exit 1
fi
echo "✅ Database connected"

# UI accessibility
UI_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $UI_URL)
if [ "$UI_HTTP_CODE" != "200" ]; then
  echo "❌ UI not accessible (HTTP $UI_HTTP_CODE)"
  exit 1
fi
echo "✅ UI accessible"

# WebSocket connectivity
# (add wscat test here)

echo "✅ All checks passed!"
```

## Post-Deployment

### Monitoring Checklist (First 24 Hours)

- [ ] Error rate < 0.1%
- [ ] Response time p95 < 500ms
- [ ] No memory leaks (check `pm2 monit`)
- [ ] Database connections stable
- [ ] No critical logs
- [ ] User complaints = 0

### Communication

**Internal**:

- Post deployment summary in Slack
- Link to deployment logs
- List of changes included

**External** (if user-facing changes):

- Tweet: "New update live! 🚀 [features]"
- Blog post (for major releases)
- Email newsletter (monthly digest)

## Troubleshooting

### Deployment Fails

**Symptom**: Deployment script exits with error

**Diagnosis**:

```bash
# Check last 100 lines of logs
pm2 logs --lines 100

# Check PM2 process status
pm2 status

# Check database connection
npx prisma db pull
```

**Resolution**:

- Fix the error
- Re-run deployment
- If persistent, rollback

### High Error Rate After Deployment

**Symptom**: Error rate > 1% in first 10 minutes

**Action**:

```bash
# 1. Immediate rollback
./scripts/rollback.sh

# 2. Investigate logs
pm2 logs | grep -i error | tail -100

# 3. Fix and redeploy later
```

### Database Migration Stuck

**Symptom**: Migration running > 5 minutes

**Action**:

```bash
# 1. Check running queries
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state != 'idle';"

# 2. If safe, cancel long-running query
psql $DATABASE_URL -c "SELECT pg_cancel_backend(PID);"

# 3. Re-run migration
npx prisma migrate deploy
```

## Emergency Hotfix Procedure

For critical bugs affecting users:

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-bug main

# 2. Fix the bug
# ... make changes ...

# 3. Test locally
npm test

# 4. Fast-track review
# Get approval from 1 senior engineer (instead of 2)

# 5. Merge and deploy
git checkout main
git merge hotfix/critical-bug
git push origin main

# 6. Deploy immediately (skip staging)
./scripts/deploy-production.sh

# 7. Monitor closely for 1 hour
pm2 logs --lines 100
```

## Contacts

- **Deployment Lead**: deploy@zkintents.io
- **On-Call Engineer**: oncall@zkintents.io
- **Emergency**: Slack #incidents channel
