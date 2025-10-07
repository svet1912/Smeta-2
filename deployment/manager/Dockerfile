# Phase 4 Step 1: Deployment Manager Service
# Zero-downtime Blue-Green Deployment Controller

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --only=production

# Install Docker CLI for container management
RUN apk add --no-cache docker-cli curl jq

# Copy application files
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S deployer && \
    adduser -S deployer -u 1001

# Set permissions
RUN chown -R deployer:deployer /app
USER deployer

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]