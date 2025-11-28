# zk-Intents Security Guidelines

## Overview

This document outlines security best practices and compliance requirements for the zk-Intents platform.

## Data Protection

### User Data Classification

**Highly Sensitive (Tier 1)**:

- Seed phrases (encrypted at rest, never stored in plain text)
- Private keys (never transmitted, derived client-side)
- Password hashes (bcrypt with salt rounds ≥ 12)

**Sensitive (Tier 2)**:

- Email addresses
- Account balances
- Transaction history
- Recovery codes

**Public (Tier 3)**:

- On-chain addresses
- Public keys
- Intent IDs

### Encryption Standards

**At Rest**:

```javascript
// Seed phrase encryption: AES-256-GCM
const cipher = createCipheriv('aes-256-gcm', key, iv);
```

**In Transit**:

- TLS 1.3 only (no TLS 1.2 or lower)
- HSTS enabled (max-age=31536000)
- Certificate pinning for mobile apps

**Key Management**:

- Encryption keys rotated every 90 days
- Keys stored in environment variables (not in code)
- Production keys in secure vault (AWS Secrets Manager / HashiCorp Vault)

## Authentication & Authorization

### WebAuthn (Passkeys)

**Implementation Requirements**:

- HTTPS required (WebAuthn won't work on HTTP)
- Challenge must be random (32 bytes minimum)
- Timeout: 60 seconds
- Attestation: "none" (for privacy)

```typescript
// Secure challenge generation
const challenge = crypto.getRandomValues(new Uint8Array(32));
```

**Security Considerations**:

- Store credential IDs hashed
- Implement counter verification (replay attack prevention)
- Rate limit registration attempts (5 per hour per IP)

### Session Management

**Requirements**:

- Session tokens: 256-bit random (cryptographically secure)
- Expiry: 7 days (configurable)
- Refresh tokens: 30 days
- Secure, HttpOnly, SameSite=Strict cookies

```typescript
res.cookie('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

### Rate Limiting

**API Endpoints**:

- Intent submission: 100 requests/minute per address
- OTP requests: 5 requests/hour per email
- Account creation: 3 requests/hour per IP
- Login attempts: 10 requests/hour per email

**Implementation**:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/v1/intents', limiter);
```

## Smart Contract Security

### Audit Requirements

**Pre-Deployment**:

- [ ] Internal security review
- [ ] External audit by reputable firm (Consensys, Trail of Bits, etc.)
- [ ] Formal verification of critical functions
- [ ] Fuzzing tests (Echidna, Foundry)

**Audit Checklist**:

- Reentrancy guards
- Integer overflow/underflow protection (Solidity 0.8+)
- Access control verification
- Gas optimization
- Front-running mitigation

### Deployment Process

```bash
# 1. Deploy to testnet first
npx hardhat deploy --network polygon-mumbai

# 2. Verify on Polygonscan
npx hardhat verify --network polygon-mumbai DEPLOYED_ADDRESS

# 3. Wait 48 hours for community review

# 4. Deploy to mainnet
npx hardhat deploy --network polygon
```

### Emergency Procedures

**Pause Mechanism**:

```solidity
bool public paused = false;

modifier whenNotPaused() {
    require(!paused, "Contract is paused");
    _;
}

function pause() external onlyOwner {
    paused = true;
    emit Paused(msg.sender);
}
```

**Multisig Requirements**:

- 3-of-5 multisig for contract upgrades
- 24-hour timelock for critical changes
- Emergency halt: 2-of-5 (no timelock)

## Data Privacy (GDPR Compliance)

### User Rights

**Right to Access**:

```typescript
// API endpoint: GET /api/v1/user/data
app.get('/api/v1/user/data', authenticateUser, async (req, res) => {
  const userData = await getUserData(req.user.id);
  // Return all data in JSON format
  res.json(userData);
});
```

**Right to Deletion**:

```typescript
// API endpoint: DELETE /api/v1/user/account
app.delete('/api/v1/user/account', authenticateUser, async (req, res) => {
  // Anonymize on-chain data (can't delete from blockchain)
  // Delete off-chain data
  await deleteUserData(req.user.id);
  res.json({ message: 'Account deleted' });
});
```

**Data Retention**:

- Active accounts: Indefinite
- Inactive accounts (>2 years): Delete off-chain data
- Transaction logs: 7 years (financial compliance)
- Error logs: 90 days

### Privacy by Design

**Minimize Data Collection**:

- Don't ask for phone numbers
- Don't track IP addresses (unless for security)
- Use pseudonymous addresses on-chain

**Zero-Knowledge Proofs**:

- Balance commitments (encrypted)
- Transaction amounts hidden
- Receiver addresses obscured (except in settlement)

## Incident Response Plan

### Severity Levels

**Critical (P0)**:

- Private key compromise
- Smart contract exploit
- Database breach

**High (P1)**:

- Service unavailable >15 minutes
- Data leak (non-sensitive)
- DDoS attack

**Medium (P2)**:

- API errors affecting <10% of users
- Performance degradation

**Low (P3)**:

- UI/UX bugs
- Documentation errors

### Response Procedures

**P0 Incident**:

1. **Immediate** (0-5 min):
   - Activate incident response team
   - Pause affected systems
   - Notify leadership

2. **Investigation** (5-30 min):
   - Identify attack vector
   - Assess damage
   - Preserve evidence (logs, snapshots)

3. **Containment** (30-60 min):
   - Deploy fixes
   - Invalidate compromised sessions
   - Reset affected credentials

4. **Communication** (1-2 hours):
   - Notify affected users
   - Public disclosure (if required)
   - Regulatory reporting (if applicable)

5. **Recovery** (2-24 hours):
   - Restore services
   - Verify system integrity
   - Monitor for recurrence

6. **Post-Mortem** (1-7 days):
   - Root cause analysis
   - Update security measures
   - Documentation

### Communication Templates

**User Notification**:

```
Subject: Security Update - Action Required

Dear zk-Intents User,

We detected suspicious activity affecting [X] accounts. As a precaution:

1. All sessions have been invalidated
2. Please reset your password
3. Review recent transactions

We have implemented additional security measures to prevent recurrence.

For questions: security@zkintents.io

Best regards,
zk-Intents Security Team
```

## Compliance

### Financial Regulations

**KYC/AML**:

- Not required for self-custody wallets
- Required if offering fiat on/off-ramps
- Transaction monitoring for amounts > $10,000

**Tax Reporting**:

- Provide transaction history exports
- Include cost basis tracking
- Support tax software integrations

### Jurisdictional Considerations

**Restricted Countries**:

- Implement IP geofencing
- Block sanctioned addresses (OFAC list)
- Regularly update restricted regions

**Terms of Service**:

- Clear disclaimers (not investment advice)
- Liability limitations
- Dispute resolution mechanism

## Security Checklist (Pre-Launch)

### Infrastructure

- [ ] HTTPS enabled on all domains
- [ ] SSL certificates auto-renewed
- [ ] DDoS protection (Cloudflare)
- [ ] WAF configured (Web Application Firewall)
- [ ] Database backups automated (daily)
- [ ] Secrets managed securely (no .env in git)

### Application

- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection (CSP headers)
- [ ] CSRF tokens implemented
- [ ] Rate limiting configured
- [ ] Error messages sanitized (no stack traces)

### Authentication

- [ ] Passwords hashed (bcrypt, rounds ≥ 12)
- [ ] MFA available (WebAuthn + TOTP)
- [ ] Session timeout configured
- [ ] Account lockout after failed attempts
- [ ] Secure password reset flow

### Smart Contracts

- [ ] Audited by external firm
- [ ] Pausing mechanism implemented
- [ ] Multisig for admin functions
- [ ] Timelock for upgrades
- [ ] Gas limits tested

### Monitoring

- [ ] Log aggregation (ELK stack / Datadog)
- [ ] Alerts configured (PagerDuty)
- [ ] Intrusion detection (fail2ban)
- [ ] Security scanning (Snyk, Dependabot)
- [ ] Penetration testing completed

## Bug Bounty Program

**Scope**:

- Smart contracts
- API endpoints
- WebAuthn implementation
- Cryptographic modules

**Rewards**:

- Critical: $10,000 - $50,000
- High: $2,000 - $10,000
- Medium: $500 - $2,000
- Low: $100 - $500

**Reporting**:

- Email: security@zkintents.io
- PGP Key: [Download](https://zkintents.io/.well-known/pgp-key.asc)
- Expected response: 24 hours

## Contacts

- **Security Team**: security@zkintents.io
- **Data Protection Officer**: dpo@zkintents.io
- **Bug Bounty**: bugbounty@zkintents.io
- **Emergency Hotline**: +1-XXX-XXX-XXXX (24/7)
