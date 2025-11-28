FROM node:20-slim

# Install build essentials
RUN apt-get update && apt-get install -y \
    build-essential \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Circom
RUN wget https://github.com/iden3/circom/releases/download/v2.1.6/circom-linux-amd64 \
    && chmod +x circom-linux-amd64 \
    && mv circom-linux-amd64 /usr/local/bin/circom

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy worker code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start worker
CMD ["node", "dist/prove.js"]
