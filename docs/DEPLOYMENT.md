# IBM Cloud Cost Tracking System - Deployment Guide

**Version:** 1.0  
**Last Updated:** 2026-05-04

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Options](#deployment-options)
5. [Docker Deployment](#docker-deployment)
6. [Manual Deployment](#manual-deployment)
7. [Cloud Deployment](#cloud-deployment)
8. [Post-Deployment](#post-deployment)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers deploying the IBM Cloud Cost Tracking System to production environments. The application consists of:

- **Backend API**: Node.js/Express server with WebSocket support
- **Frontend**: React SPA served via Nginx
- **Redis**: Optional caching layer (recommended for production)

---

## Prerequisites

### Required

- IBM Cloud account with API access
- IBM Cloud API Key with appropriate permissions
- Server with:
  - 2+ CPU cores
  - 4GB+ RAM
  - 20GB+ storage
  - Ubuntu 20.04+ or similar Linux distribution

### For Docker Deployment

- Docker 20.10+
- Docker Compose 2.0+

### For Manual Deployment

- Node.js 18+
- pnpm 8+
- Nginx 1.18+
- Redis 7+ (optional but recommended)

---

## Environment Configuration

### Backend Environment Variables

Create `backend/.env.production` from `backend/.env.production.example`:

```bash
# Required
IBM_CLOUD_API_KEY=your_api_key_here
IBM_CLOUD_ACCOUNT_ID=your_account_id_here

# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Redis (recommended)
REDIS_ENABLED=true
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_password

# Security
SESSION_SECRET=your_32_char_minimum_secret_here
CORS_ORIGIN=https://your-domain.com

# Logging
LOG_LEVEL=info
LOG_PRETTY=false
```

### Frontend Environment Variables

Create `frontend/.env.production`:

```bash
VITE_API_BASE_URL=https://api.your-domain.com
VITE_WS_URL=https://api.your-domain.com
```

---

## Deployment Options

### Option 1: Docker Compose (Recommended)

**Pros:**
- Easy setup and management
- Consistent environment
- Built-in service orchestration
- Automatic restarts

**Cons:**
- Requires Docker knowledge
- Additional resource overhead

### Option 2: Manual Deployment

**Pros:**
- More control over configuration
- Lower resource usage
- Easier debugging

**Cons:**
- More complex setup
- Manual service management

### Option 3: Cloud Platform

**Pros:**
- Managed infrastructure
- Auto-scaling
- High availability

**Cons:**
- Higher cost
- Platform lock-in

---

## Docker Deployment

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd ibmcloud_usage_cost
```

### Step 2: Configure Environment

```bash
# Backend
cp backend/.env.production.example backend/.env.production
nano backend/.env.production  # Edit with your values

# Frontend
cp frontend/.env.production.example frontend/.env.production
nano frontend/.env.production  # Edit with your values
```

### Step 3: Build and Start Services

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Step 4: Verify Deployment

```bash
# Check service health
curl http://localhost:3000/health  # Backend
curl http://localhost/health       # Frontend

# Check logs
docker-compose logs backend
docker-compose logs frontend
```

### Docker Commands

```bash
# Stop services
docker-compose down

# Restart services
docker-compose restart

# View resource usage
docker stats

# Access container shell
docker-compose exec backend sh
docker-compose exec frontend sh

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

---

## Manual Deployment

### Backend Deployment

#### 1. Install Dependencies

```bash
cd backend
pnpm install --prod --frozen-lockfile
```

#### 2. Build Application

```bash
pnpm build
```

#### 3. Configure Environment

```bash
cp .env.production.example .env.production
nano .env.production
```

#### 4. Create Systemd Service

Create `/etc/systemd/system/ibm-cost-tracker-backend.service`:

```ini
[Unit]
Description=IBM Cloud Cost Tracker Backend
After=network.target redis.service

[Service]
Type=simple
User=nodejs
WorkingDirectory=/opt/ibm-cost-tracker/backend
Environment=NODE_ENV=production
EnvironmentFile=/opt/ibm-cost-tracker/backend/.env.production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ibm-cost-tracker-backend

[Install]
WantedBy=multi-user.target
```

#### 5. Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable ibm-cost-tracker-backend
sudo systemctl start ibm-cost-tracker-backend
sudo systemctl status ibm-cost-tracker-backend
```

### Frontend Deployment

#### 1. Build Application

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm build
```

#### 2. Configure Nginx

Create `/etc/nginx/sites-available/ibm-cost-tracker`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /opt/ibm-cost-tracker/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

#### 3. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/ibm-cost-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Redis Installation

```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: requirepass your_secure_password

# Restart Redis
sudo systemctl restart redis
sudo systemctl enable redis
```

---

## Cloud Deployment

### AWS Deployment

#### Using ECS (Elastic Container Service)

1. Push Docker images to ECR
2. Create ECS task definitions
3. Configure Application Load Balancer
4. Set up Auto Scaling
5. Configure CloudWatch monitoring

#### Using EC2

Follow manual deployment steps on EC2 instance.

### IBM Cloud Deployment

#### Using Code Engine

1. Build and push Docker images
2. Create Code Engine applications
3. Configure environment variables
4. Set up custom domain

### Google Cloud Platform

#### Using Cloud Run

1. Build and push to Container Registry
2. Deploy to Cloud Run
3. Configure environment variables
4. Set up Cloud Load Balancing

---

## Post-Deployment

### SSL/TLS Configuration

#### Using Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Firewall Configuration

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (if needed)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

### Backup Strategy

#### Database Backups (if using)

```bash
# Automated backup script
#!/bin/bash
BACKUP_DIR=/backups
DATE=$(date +%Y%m%d_%H%M%S)
# Add backup commands
```

#### Configuration Backups

```bash
# Backup environment files
tar -czf config-backup-$DATE.tar.gz \
  backend/.env.production \
  frontend/.env.production
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Backend health
curl https://api.your-domain.com/health

# Frontend health
curl https://your-domain.com/health
```

### Log Management

```bash
# View backend logs (Docker)
docker-compose logs -f backend

# View backend logs (systemd)
sudo journalctl -u ibm-cost-tracker-backend -f

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Performance Monitoring

- Monitor CPU and memory usage
- Track API response times
- Monitor cache hit rates
- Track error rates

### Updates

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart (Docker)
docker-compose build
docker-compose up -d

# Rebuild and restart (Manual)
cd backend && pnpm build
sudo systemctl restart ibm-cost-tracker-backend
```

---

## Troubleshooting

### Backend Won't Start

**Check logs:**
```bash
docker-compose logs backend
# or
sudo journalctl -u ibm-cost-tracker-backend
```

**Common issues:**
- Invalid IBM Cloud API key
- Missing environment variables
- Port already in use
- Redis connection failed

### Frontend Not Loading

**Check Nginx:**
```bash
sudo nginx -t
sudo systemctl status nginx
```

**Common issues:**
- Build files not copied correctly
- Nginx configuration errors
- API proxy misconfigured

### High Memory Usage

**Solutions:**
- Increase cache TTL to reduce API calls
- Enable Redis for distributed caching
- Adjust Node.js memory limits
- Scale horizontally

### Slow API Responses

**Solutions:**
- Enable caching
- Increase concurrent request limits
- Optimize IBM Cloud API calls
- Add Redis caching layer

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong session secrets
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Set up rate limiting
- [ ] Enable security headers
- [ ] Regular security updates
- [ ] Monitor access logs
- [ ] Implement backup strategy
- [ ] Set up monitoring alerts

---

## Support

For issues and questions:
- Check logs first
- Review troubleshooting section
- Consult API documentation
- Contact support team

---

**Made with Bob**