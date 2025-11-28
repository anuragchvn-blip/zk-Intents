# Maintenance Runbook

## Routine Maintenance Schedule

### Daily (Automated)

- Database backups (3 AM UTC)
- Log rotation
- Metrics collection
- Security scans

### Weekly (Manual - 15 min)

- Review error logs
- Check storage usage
- Update dependencies (security patches)
- Review monitoring alerts

### Monthly (Manual - 2 hours)

- Performance review
- Cost optimization
- Capacity planning
- Security audit

### Quarterly (Manual - 1 day)

- Disaster recovery drill
- Load testing
- Third-party audit (smart contracts)
- Documentation review

## Database Maintenance

### Backup Verification

```bash
# Test latest backup restore
BACKUP_FILE=$(aws s3 ls s3://zkintents-backups/ | sort | tail -1 | awk '{print $4}')
aws s3 cp s3://zkintents-backups/$BACKUP_FILE ./backup.sql

# Restore to test database
psql $TEST_DB_URL < backup.sql

# Verify data integrity
psql $TEST_DB_URL -c "SELECT COUNT(*) FROM \"User\";"
psql $TEST_DB_URL -c "SELECT COUNT(*) FROM \"Intent\" WHERE status = 'completed';"
```

### Database Optimization

```bash
# Run VACUUM ANALYZE weekly
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Check table bloat
psql $DATABASE_URL -c "
  SELECT
    schemaname || '.' || tablename AS table,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    n_dead_tup AS dead_tuples
  FROM pg_stat_user_tables
  WHERE n_dead_tup > 1000
  ORDER BY n_dead_tup DESC;
"

# Rebuild indexes if needed
psql $DATABASE_URL -c "REINDEX INDEX CONCURRENTLY idx_intent_sender;"
```

### Connection Pool Tuning

```bash
# Check current pool stats
psql $DATABASE_URL -c "
  SELECT state, count(*)
  FROM pg_stat_activity
  GROUP BY state;
"

# If too many idle connections, adjust pool size in sequencer config
# Edit sequencer/src/index.ts:
# connectionLimit: 20  (default)
# Increase for high traffic, decrease for low memory
```

## Storage Management

### Log Rotation

```bash
# PM2 logs are auto-rotated, but verify size
pm2 flush  # Clear old logs

# Manually archive old logs
tar -czf logs_$(date +%Y%m%d).tar.gz /var/log/zkintents
aws s3 cp logs_$(date +%Y%m%d).tar.gz s3://zkintents-archives/logs/
rm logs_$(date +%Y%m%d).tar.gz
```

### Disk Space Monitoring

```bash
# Check disk usage
df -h

# Find large directories
du -h --max-depth=1 / | sort -rh | head -10

# Clean up if needed
docker system prune -a  # Remove unused Docker images
npm cache clean --force  # Clear npm cache
```

## Dependency Updates

### Security Patches (Weekly)

```bash
# Check for vulnerabilities
npm audit

# Update dependencies
npm update

# For critical vulnerabilities, force update
npm audit fix --force

# Test after updates
npm test
npm run test:integration
```

### Major Version Upgrades (Quarterly)

```bash
# Check outdated packages
npm outdated

# Update one major package at a time
npm install prisma@latest
npm test

# If tests pass, commit and deploy to staging
git add package*.json
git commit -m "chore: upgrade Prisma to vX.Y.Z"
git push origin staging
```

## SSL Certificate Renewal

### Automated (Certbot)

```bash
# Certbot auto-renews, but verify
sudo certbot renew --dry-run

# Check expiry dates
echo | openssl s_client -servername api.zkintents.io -connect api.zkintents.io:443 2>/dev/null | openssl x509 -noout -dates
```

### Manual Renewal (if needed)

```bash
sudo certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials ~/.secrets/cloudflare.ini \
  -d api.zkintents.io \
  -d app.zkintents.io

# Reload nginx
sudo systemctl reload nginx
```

## Performance Optimization

### Database Indexes

```bash
# Find missing indexes
psql $DATABASE_URL -c "
  SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
  FROM pg_stats
  WHERE schemaname = 'public'
    AND n_distinct > 100
    AND correlation < 0.1
  ORDER BY n_distinct DESC;
"

# Add index for frequently queried columns
psql $DATABASE_URL -c "
  CREATE INDEX CONCURRENTLY idx_intent_status_created
  ON \"Intent\"(status, \"createdAt\");
"
```

### API Response Time

```bash
# Analyze slow endpoints
cat access.log | grep "POST /api/v1/intents" | awk '{print $NF}' | sort -n | tail -100

# Add caching for frequently accessed data
# Example: Cache account balances for 10 seconds
redis-cli SET "balance:0x123" '{"USDC": "1000"}' EX 10
```

## Scaling Procedures

### Horizontal Scaling (Add Instances)

```bash
# Using PM2
pm2 scale sequencer +2

# Using Kubernetes
kubectl scale deployment zkintents-sequencer --replicas=5 -n zkintents

# Verify new instances are healthy
kubectl get pods -n zkintents
curl http://new-instance-ip:3000/health
```

### Vertical Scaling (Increase Resources)

```bash
# Update Kubernetes resource limits
kubectl set resources deployment zkintents-sequencer \
  --limits=cpu=2000m,memory=2Gi \
  --requests=cpu=1000m,memory=1Gi \
  -n zkintents

# For PM2 (requires restart)
pm2 delete sequencer
pm2 start sequencer --max-memory-restart 2G
```

### Database Scaling

```bash
# Upgrade Supabase plan (via dashboard)
# Or add read replicas

# Configure Prisma for read replicas
# In schema.prisma:
# datasource db {
#   provider = "postgresql"
#   url      = env("DATABASE_URL")
#   directUrl = env("DIRECT_URL")  # For migrations
#   replicas = [env("READ_REPLICA_1"), env("READ_REPLICA_2")]
# }
```

## Disaster Recovery Drill

### Quarterly Exercise (2 hours)

**Scenario**: Complete database loss

```bash
# 1. Notify team (Slack: #incident-drill)
# "🔔 DR DRILL: Simulating database loss. Do not panic."

# 2. Restore from latest backup
LATEST_BACKUP=$(aws s3 ls s3://zkintents-backups/ | sort | tail -1 | awk '{print $4}')
aws s3 cp s3://zkintents-backups/$LATEST_BACKUP ./restore.sql

# 3. Create new database (or use test DB)
createdb zkintents_restored

# 4. Restore data
psql zkintents_restored < restore.sql

# 5. Verify data integrity
psql zkintents_restored -c "SELECT COUNT(*) FROM \"User\";"
psql zkintents_restored -c "SELECT MAX(\"createdAt\") FROM \"Intent\";"

# 6. Update connection string
export DATABASE_URL="postgresql://postgres:password@localhost:5432/zkintents_restored"

# 7. Restart services
pm2 restart all

# 8. Verify functionality
curl http://localhost:3000/health
npm run test:smoke

# 9. Document results
# - Time to recovery: X minutes
# - Data loss: X minutes (diff between now and latest intent)
# - Issues encountered: [list]

# 10. Cleanup
dropdb zkintents_restored
```

## Health Check Procedures

### Daily Health Check Script

```bash
#!/bin/bash
# scripts/daily-health-check.sh

echo "=== Daily Health Check $(date) ===" >> health-check.log

# 1. Service status
pm2 status >> health-check.log

# 2. Database connection
psql $DATABASE_URL -c "SELECT 1" &> /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Database: OK" >> health-check.log
else
  echo "❌ Database: FAILED" >> health-check.log
fi

# 3. Disk space
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 80 ]; then
  echo "✅ Disk space: ${DISK_USAGE}% used" >> health-check.log
else
  echo "⚠️ Disk space: ${DISK_USAGE}% used (threshold: 80%)" >> health-check.log
fi

# 4. Memory usage
MEM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
echo "📊 Memory: ${MEM_USAGE}% used" >> health-check.log

# 5. Certificate expiry
CERT_DAYS=$(echo | openssl s_client -servername api.zkintents.io -connect api.zkintents.io:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2 | xargs -I {} date -d {} +%s | awk -v now=$(date +%s) '{print int(($1 - now) / 86400)}')
if [ $CERT_DAYS -gt 30 ]; then
  echo "✅ SSL certificate: ${CERT_DAYS} days remaining" >> health-check.log
else
  echo "⚠️ SSL certificate: ${CERT_DAYS} days remaining (renew soon)" >> health-check.log
fi

# Email summary
cat health-check.log | tail -10 | mail -s "Daily Health Check" ops@zkintents.io
```

## Contacts

- **Operations Team**: ops@zkintents.io
- **Database Admin**: dba@zkintents.io
- **On-Call Engineer**: Check PagerDuty
