# Incident Response Runbook

## Severity Levels

### P0 - Critical (Response Time: Immediate)

- Complete service outage
- Data breach or security incident
- Smart contract exploit
- Payment system failure

### P1 - High (Response Time: 15 minutes)

- Partial service degradation (>25% users affected)
- Database performance issues
- API errors affecting core functionality

### P2 - Medium (Response Time: 2 hours)

- Minor service degradation (<25% users)
- Non-critical feature failures
- Performance degradation

### P3 - Low (Response Time: Next business day)

- UI/UX issues
- Documentation errors
- Minor bugs

## On-Call Procedures

### Who's On-Call?

Check PagerDuty or run:

```bash
curl https://api.pagerduty.com/oncalls
```

### Escalation Path

1. **L1**: On-call engineer (responds within 15 min)
2. **L2**: Team lead (if L1 can't resolve in 30 min)
3. **L3**: Engineering manager (if L2 can't resolve in 1 hour)
4. **Executive**: CTO (for P0 incidents only)

## Common Incidents

### 1. Sequencer Down

**Symptoms**:

- Health check failing
- Intents not being accepted
- Users reporting "Service Unavailable"

**Diagnostic Commands**:

```bash
# Check if process is running
pm2 status sequencer

# Check logs
pm2 logs sequencer --lines 100

# Check port
netstat -tulpn | grep 3000

# Check database connection
npx prisma studio
```

**Resolution**:

```bash
# Quick restart
pm2 restart sequencer

# If database is the issue
# Check Supabase dashboard for outages
# Verify DATABASE_URL in .env

# If still failing, check recent code changes
git log -10 --oneline
# Consider rollback
```

**Escalation**: If not resolved in 30 min → Escalate to L2

---

### 2. High Error Rate

**Symptoms**:

- Error rate > 1% in monitoring
- Users reporting frequent errors
- Sentry alerts firing

**Diagnostic Commands**:

```bash
# Check error logs
pm2 logs sequencer | grep -i error | tail -50

# Check specific error types
curl https://api.zkintents.io/metrics | jq '.errors'

# Check database status
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

**Resolution**:

```bash
# If recent deployment, rollback
git log --since="1 hour ago"
./scripts/rollback.sh

# If specific error pattern, apply hotfix
# Example: validation error
git checkout -b hotfix/validation-fix
# ... fix code ...
./scripts/deploy-production.sh
```

**Escalation**: If error rate doesn't drop in 15 min → Escalate to L2

---

### 3. Database Slow Queries

**Symptoms**:

- API response time > 1s
- Users reporting slow app
- Database CPU at 100%

**Diagnostic Commands**:

```bash
# Find slow queries
psql $DATABASE_URL -c "
  SELECT pid, query, now() - query_start AS duration
  FROM pg_stat_activity
  WHERE state = 'active' AND now() - query_start > interval '5 seconds'
  ORDER BY duration DESC;
"

# Check table sizes
psql $DATABASE_URL -c "
  SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
  FROM pg_tables
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 10;
"

# Check index usage
psql $DATABASE_URL -c "
  SELECT schemaname, tablename, indexname, idx_scan
  FROM pg_stat_user_indexes
  ORDER BY idx_scan ASC;
"
```

**Resolution**:

```bash
# Kill long-running queries (carefully!)
psql $DATABASE_URL -c "SELECT pg_cancel_backend(PID);"

# Add missing indexes
# Example:
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY idx_intent_sender ON \"Intent\"(\"senderAddress\");"

# Vacuum analyze
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# If critical, scale up database (Supabase dashboard)
```

**Escalation**: If performance doesn't improve in 30 min → Escalate to L2

---

### 4. Out of Memory

**Symptoms**:

- PM2 shows high memory usage
- Process crashes with "heap out of memory"

**Diagnostic Commands**:

```bash
# Check memory usage
pm2 monit

# Check for memory leaks
pm2 logs sequencer | grep "heap"

# Check process details
ps aux | grep node
```

**Resolution**:

```bash
# Immediate: Restart with higher memory limit
pm2 delete sequencer
pm2 start sequencer --max-memory-restart 2G

# Long-term: Fix memory leak
# Profile with Chrome DevTools or --inspect flag
node --inspect --max-old-space-size=4096 sequencer/src/index.ts
```

**Escalation**: If crashes persist → Escalate to L2

---

### 5. DDoS Attack

**Symptoms**:

- Sudden spike in requests (>10x normal)
- Legitimate users can't access service
- High bandwidth usage

**Diagnostic Commands**:

```bash
# Check request rate
pm2 logs sequencer | grep "POST /api/v1/intents" | wc -l

# Check top IPs
pm2 logs sequencer | grep -oP '\d+\.\d+\.\d+\.\d+' | sort | uniq -c | sort -nr | head -10

# Check Cloudflare firewall (if using)
# Go to dashboard → Firewall Events
```

**Resolution**:

```bash
# Enable rate limiting (if not already)
# Add to sequencer/src/index.ts:
# app.use(rateLimit({
#   windowMs: 60 * 1000,
#   max: 100
# }));

# Block malicious IPs in Cloudflare
# Or use fail2ban

# Enable Cloudflare "I'm Under Attack" mode
# (5-second JavaScript challenge)
```

**Escalation**: Immediate → Notify security team + L2

---

### 6. Data Breach

**Symptoms**:

- Unauthorized access detected
- Unusual database queries
- User reports of compromised accounts

**CRITICAL - Follow Security Incident Protocol**:

```bash
# 1. CONTAIN (Immediate)
# - Disable affected accounts
# - Revoke API keys
# - Enable 2FA requirement

# 2. PRESERVE EVIDENCE
# - Don't delete logs
# - Take database snapshot
# - Save all logs to S3
aws s3 sync /var/log/zkintents s3://zkintents-incident-logs/$(date +%Y%m%d)/

# 3. INVESTIGATE
# - Review access logs
# - Check for SQL injection
# - Review recent code changes

# 4. NOTIFY
# - Legal team (immediately)
# - Affected users (within 72 hours per GDPR)
# - Regulatory bodies (if required)
```

**Escalation**: Immediate → CTO + Legal + Security team

## Communication Templates

### Internal Notification (Slack)

```
🚨 **INCIDENT ALERT** - P0

**Status**: Investigating
**Impact**: Sequencer is down, all users affected
**Started**: 2024-11-27 15:30 UTC
**Incident Commander**: @john.doe
**Status Page**: https://status.zkintents.io/incidents/12345

**Updates**: Every 15 minutes in this thread
```

### External Communication (Status Page)

```
[INVESTIGATING] API Service Disruption

We are currently investigating reports of API errors.
Our team is working to identify and resolve the issue.

Next update: 15:45 UTC
```

### Post-Incident Update

```
[RESOLVED] API Service Disruption

The issue has been resolved. All systems are operating normally.

**Root Cause**: Database connection pool exhausted
**Impact**: 45 minutes, ~500 users affected
**Fix**: Increased connection pool size
**Prevention**: Added connection pool monitoring

Thank you for your patience.
```

## Post-Incident Review

**Template** (to be completed within 48 hours):

```markdown
# Post-Incident Review - [Incident ID]

## Summary

- **Date**: 2024-11-27
- **Duration**: 45 minutes
- **Severity**: P0
- **Impact**: 500 users unable to submit intents

## Timeline

- 15:30 - Incident detected (monitoring alert)
- 15:32 - On-call engineer paged
- 15:35 - Investigation started
- 15:50 - Root cause identified
- 16:00 - Fix deployed
- 16:15 - Service fully restored

## Root Cause

The database connection pool was exhausted due to a leak introduced in commit abc123. Connections were not being properly released after use.

## Resolution

- Immediate: Restarted sequencer to clear connections
- Long-term: Fixed connection leak, added connection pool monitoring

## Action Items

- [ ] Add connection pool metrics to dashboard (@john.doe, 2024-11-30)
- [ ] Implement connection timeout (15s) (@jane.smith, 2024-11-28)
- [ ] Add integration test for connection handling (@team, 2024-12-01)

## Lessons Learned

1. Need better connection pool observability
2. Code review should catch resource leaks
3. Staging environment didn't catch this (need production-like load testing)
```

## Useful Commands

```bash
# Quick health check
curl -s https://api.zkintents.io/health | jq

# Check all PM2 processes
pm2 status

# Tail logs in real-time
pm2 logs --lines 100

# Check database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Check disk usage
df -h

# Check CPU and memory
top -b -n 1 | head -20

# Validate environment variables
env | grep -E "DATABASE_URL|JWT_SECRET|ENCRYPTION_KEY"

# Test database connection
npx prisma db pull

# Check API response time
curl -w "@curl-format.txt" -o /dev/null -s https://api.zkintents.io/health

# curl-format.txt:
# time_total: %{time_total}s
```

## Contacts

- **On-Call Engineer**: Check PagerDuty
- **Incident Channel**: Slack #incidents
- **Status Page**: https://status.zkintents.io
- **Emergency Hotline**: +1-XXX-XXX-XXXX
