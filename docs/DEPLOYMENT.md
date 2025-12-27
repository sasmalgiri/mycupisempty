# MyCupIsEmpty - Deployment Guide

Complete guide to deploy MyCupIsEmpty on Vercel, Supabase, and Oracle Cloud (for Ollama AI).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Oracle Cloud VM Setup (Ollama)](#oracle-cloud-vm-setup)
4. [Vercel Deployment](#vercel-deployment)
5. [Post-Deployment Steps](#post-deployment-steps)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- GitHub account (for repository hosting)
- Supabase account (free tier available)
- Oracle Cloud account (free tier includes Always Free VMs)
- Vercel account (free tier available)
- Domain name (optional, Vercel provides free subdomain)

---

## Supabase Setup

### 1. Create a New Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose organization and set:
   - **Project name**: mycupisempty
   - **Database password**: (save this securely)
   - **Region**: Choose closest to your users (e.g., Mumbai for India)
4. Click "Create new project"

### 2. Run Database Migrations

1. Go to **SQL Editor** in your Supabase dashboard
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and run the SQL
4. Verify tables are created in **Table Editor**

### 3. Get API Keys

1. Go to **Settings** → **API**
2. Copy the following:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: Your public API key
   - **service_role key**: Your secret service role key (keep secure!)

### 4. Configure Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. (Optional) Configure email templates in **Email Templates**
4. (Optional) Add OAuth providers (Google, GitHub, etc.)

### 5. Set Up Row Level Security (RLS)

The migration file includes RLS policies. Verify they're active:
1. Go to **Table Editor**
2. Click on any table
3. Check that RLS is enabled (shield icon)

---

## Oracle Cloud VM Setup

Oracle Cloud Free Tier includes Always Free VMs - perfect for hosting Ollama!

### 1. Create Oracle Cloud Account

1. Go to [cloud.oracle.com](https://cloud.oracle.com)
2. Sign up for a free account
3. Complete verification (may require credit card, won't be charged)

### 2. Create a Compute Instance

1. Go to **Compute** → **Instances**
2. Click **Create instance**
3. Configure:
   - **Name**: ollama-server
   - **Image**: Ubuntu 22.04 or later
   - **Shape**: VM.Standard.A1.Flex (Always Free)
     - 4 OCPU, 24GB RAM (max free tier)
   - **Networking**: Create new VCN or use existing
   - **Add SSH keys**: Upload your public key
4. Click **Create**

### 3. Configure Security Rules

1. Go to your VCN → Security Lists
2. Add Ingress Rule:
   - **Source CIDR**: 0.0.0.0/0
   - **Destination Port**: 11434
   - **Protocol**: TCP

### 4. Install Ollama

SSH into your instance:

```bash
ssh -i your_private_key ubuntu@YOUR_INSTANCE_IP
```

Install Ollama:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama service
sudo systemctl start ollama
sudo systemctl enable ollama

# Pull recommended models
ollama pull llama3.2
# or for lower memory usage:
ollama pull mistral
```

### 5. Configure Ollama for Remote Access

Edit the Ollama service file:

```bash
sudo systemctl edit ollama
```

Add:

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

Restart the service:

```bash
sudo systemctl restart ollama
```

### 6. Verify Ollama is Running

```bash
# From the VM
curl http://localhost:11434/api/tags

# From your local machine
curl http://YOUR_INSTANCE_IP:11434/api/tags
```

---

## Vercel Deployment

### 1. Push to GitHub

```bash
# Initialize git if not done
git init
git add .
git commit -m "Initial commit"

# Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/mycupisempty.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: ./
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### 3. Set Environment Variables

Add the following environment variables in Vercel:

| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` | Your Supabase service role key |
| `OLLAMA_BASE_URL` | `http://YOUR_ORACLE_VM_IP:11434` | Your Oracle VM Ollama URL |
| `OLLAMA_MODEL` | `llama3.2` | Default model to use |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Your deployment URL |

### 4. Deploy

1. Click **Deploy**
2. Wait for build to complete
3. Visit your deployment URL

---

## Post-Deployment Steps

### 1. Seed the Database

After deployment, seed the database with initial curriculum data:

```bash
# From your local machine with environment variables set
npm run seed
```

Or use the API endpoint:
```bash
curl -X POST https://your-app.vercel.app/api/curriculum \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### 2. Configure Custom Domain (Optional)

1. In Vercel, go to **Settings** → **Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXT_PUBLIC_APP_URL` in environment variables

### 3. Set Up Analytics (Optional)

1. **PostHog**: Add `NEXT_PUBLIC_POSTHOG_KEY`
2. **Sentry**: Add `SENTRY_DSN`

### 4. Configure Email (Optional)

For password reset and email verification:
1. In Supabase, go to **Settings** → **Auth**
2. Configure SMTP settings or use Supabase's default

---

## Troubleshooting

### Common Issues

#### 1. "Failed to fetch" errors

- Check if Supabase URL and keys are correct
- Verify environment variables are set in Vercel
- Check browser console for CORS errors

#### 2. Ollama not responding

- Verify the VM is running in Oracle Cloud
- Check security rules allow port 11434
- Verify Ollama is running: `sudo systemctl status ollama`
- Check firewall: `sudo ufw status`

#### 3. Database errors

- Run migrations again in Supabase SQL Editor
- Check RLS policies are not blocking queries
- Verify service role key is correct for server-side operations

#### 4. Build failures

- Check all dependencies are installed: `npm install`
- Verify TypeScript has no errors: `npm run build`
- Check for missing environment variables

### Getting Help

- **Supabase**: [Supabase Discord](https://discord.supabase.com)
- **Vercel**: [Vercel Support](https://vercel.com/support)
- **Ollama**: [Ollama GitHub](https://github.com/ollama/ollama)

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Vercel (Next)  │────▶│    Supabase     │────▶│  Oracle Cloud   │
│    Frontend     │     │    Database     │     │     Ollama      │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
   - React UI              - PostgreSQL           - LLaMA 3.2
   - API Routes            - Auth                 - AI Tutor
   - SSR                   - Storage              - Explanations
```

---

## Cost Estimation

| Service | Free Tier | Estimated Monthly Cost |
|---------|-----------|------------------------|
| Vercel | Hobby (free) | $0 |
| Supabase | Free tier (500MB, 50K auth users) | $0 |
| Oracle Cloud | Always Free VM | $0 |
| **Total** | | **$0** |

For scaling:
- Vercel Pro: $20/month
- Supabase Pro: $25/month
- Oracle Cloud upgrade: ~$50/month

---

## Security Checklist

- [ ] Use HTTPS only
- [ ] Set secure Supabase RLS policies
- [ ] Never expose service role key in client
- [ ] Enable rate limiting in Vercel
- [ ] Use secure cookies for auth
- [ ] Regular dependency updates
- [ ] Enable 2FA on all accounts
