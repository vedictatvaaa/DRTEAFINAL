# Dr Tea — Deployment Guide

One repo, two ways to deploy. The `Dockerfile` at the repo root is the universal contract both methods use.

| Method | Best for | Effort | Lock-in |
|---|---|---|---|
| **A. Manual VPS install** | Maximum control, lowest cost, full freedom | 15 min once | None |
| **B. GitHub Action auto-deploy** | Push-to-deploy on your own VPS | +10 min setup | None |

Both pull from the same GitHub repo: `vedictatvaaa/DRTEAFINAL`.

---

## Prerequisites (all methods)

- A domain name you control (e.g. `drtea.in`)
- DNS access to point an `A` record at the server's IP
- A VPS running **Ubuntu 22.04 or 24.04** with at least 2 GB RAM (Hetzner CX22 €4/mo or DigitalOcean Basic $6/mo both work)
- Root SSH access to that VPS

---

## A. Manual VPS install (recommended for freedom)

The `install.sh` script does everything: installs Docker, generates secrets, fetches the code, starts the stack, gets free TLS certs.

### 1. SSH into your fresh VPS

```bash
ssh root@YOUR_VPS_IP
```

### 2. Run the one-line install

```bash
curl -fsSL https://raw.githubusercontent.com/vedictatvaaa/DRTEAFINAL/main/deploy/install.sh | bash
```

It will prompt you for:
- **Domain** (e.g. `drtea.in`)
- **Email** (for Let's Encrypt TLS certs)
- **Repo URL** — just press Enter to accept the default (`vedictatvaaa/DRTEAFINAL`)
- **Share this VPS with other sites?** (`true`/`false`, default `false`)
  - `false` → Dr Tea owns ports 80/443, handles its own TLS via Caddy.
  - `true` → Dr Tea binds only to `127.0.0.1:APP_PORT` (default 8080). Your existing
    nginx/Caddy/Traefik on the host fronts it. Use this when other sites already live on the same box.
- **Host HTTP/HTTPS ports** (default 80/443) — change only if those are taken and you'd rather pick alternates than use shared-proxy mode.

Before any install touches your box the script runs a **pre-flight port collision check** — if anything else already holds 80 or 443 (or `APP_PORT` in shared mode), it aborts and tells you exactly which process is in the way, with three suggested fixes.

### 3. Point DNS

In your domain registrar (GoDaddy / Namecheap / Cloudflare):
- Create an `A` record: `@` → `YOUR_VPS_IP`
- Create an `A` record: `www` → `YOUR_VPS_IP`

Wait 1–5 minutes for DNS to propagate, then visit `https://your-domain.com`. TLS certs are issued automatically the first time someone visits.

### 4. Managing the running site

The installer adds a `drtea` CLI to your server. Available commands:

```bash
drtea status              # show what's running
drtea logs                # tail container logs
drtea update              # pull latest code and restart
drtea update --safe       # update + auto-rollback if health check fails
drtea update --safe --ref <commit-sha>   # deploy a specific commit
drtea rollback            # revert to the last known-good commit
drtea health              # check the API health endpoint
drtea restart             # restart the stack
```

### Files involved
- `deploy/install.sh` — the one-file installer
- `deploy/standalone/docker-compose.yml` — Postgres + API + Caddy
- `deploy/standalone/Caddyfile` — TLS + reverse proxy config
- `Dockerfile` — multi-stage build (api + storefront targets)

---

## B. GitHub Action auto-deploy (on top of Method A)

Once Method A is set up, you can make every `git push` to `main` automatically deploy to your VPS — with security failsafes so a bad push can't take you down.

### What protects you
1. **Author allowlist** — only commits from approved GitHub users trigger a deploy.
2. **Sensitive-path guard** — pushes that touch `deploy/`, `Dockerfile`, `.env*`, lockfiles, or workflows are blocked from auto-deploy (they need manual review).
3. **Health-check + auto-rollback** — after deploy, the workflow calls `/api/healthz`. If it doesn't return `200`, the VPS auto-rolls back to the last good commit.
4. **GitHub issues opened on failure or block** — you always know what happened.

### Setup

#### 1. Generate an SSH key just for the Action

On your laptop (or in Replit Shell):

```bash
ssh-keygen -t ed25519 -C "github-actions-drtea" -f ~/.ssh/gh_drtea -N ""
```

This creates two files:
- `~/.ssh/gh_drtea` → **private** key (goes in GitHub)
- `~/.ssh/gh_drtea.pub` → **public** key (goes on VPS)

#### 2. Authorize the public key on your VPS

```bash
ssh root@YOUR_VPS_IP
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "PASTE_PUBLIC_KEY_LINE_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

Test it works:
```bash
ssh -i ~/.ssh/gh_drtea root@YOUR_VPS_IP "echo connected"
```

#### 3. Add secrets + variable to GitHub

Go to: `https://github.com/vedictatvaaa/DRTEAFINAL/settings/secrets/actions`

**Secrets tab** → "New repository secret" (add all three):

| Name | Value |
|---|---|
| `VPS_HOST` | your VPS IP |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | the entire contents of `~/.ssh/gh_drtea` (including `-----BEGIN…` and `-----END…` lines) |

**Variables tab** → "New repository variable":

| Name | Value |
|---|---|
| `ALLOWED_AUTHORS` | your GitHub username (comma-separated for multiple, no spaces: `user1,user2`) |

#### 4. Push code and watch it deploy

Any `git push origin main` from now on will trigger the workflow at:
👉 https://github.com/vedictatvaaa/DRTEAFINAL/actions

### Files involved
- `.github/workflows/deploy.yml` — the workflow
- `deploy/GITHUB_ACTIONS.md` — detailed setup doc

### Manual override
Need to deploy without the Action? Just SSH in and run `drtea update --safe`. The Action and the manual CLI both work; they don't conflict.

---

## Running Dr Tea alongside other sites on the same VPS

Two safe ways:

**Option 1 — Shared-proxy mode (recommended when another site already owns 80/443)**

Re-run the installer with:
```bash
SHARED_PROXY=true APP_PORT=8081 \
  curl -fsSL https://raw.githubusercontent.com/vedictatvaaa/DRTEAFINAL/main/deploy/install.sh | bash
```
Then add a block to your existing host proxy. For Caddy on the host:
```
drtea.in {
  reverse_proxy 127.0.0.1:8081
}
```
For nginx on the host:
```
server {
  listen 443 ssl;
  server_name drtea.in;
  # ... certbot config ...
  location / { proxy_pass http://127.0.0.1:8081; proxy_set_header Host $host; }
}
```
The API stays bound to `127.0.0.1` only, so it's never reachable from the public internet except through your proxy.

**Option 2 — Use Dr Tea's own Caddy as the shared proxy**

Add more `domain { reverse_proxy ... }` blocks to `/opt/drtea/app/deploy/standalone/Caddyfile`, pointing at the other apps' containers, then `drtea restart`. Caddy will issue free TLS for each new domain automatically.

**Don't mix two reverse proxies (nginx + our Caddy + another Caddy) on the same VPS.** Only one process can hold ports 80/443.

---

## Health check endpoint

All methods rely on this URL returning `{"status":"ok"}`:

```
GET https://your-domain.com/api/healthz
```

If this 404s or 500s, the site is unhealthy. The `install.sh` CLI and the GitHub Action both use this to verify deploys.

---

## Cost summary

| Stack | Monthly |
|---|---|
| Hetzner CX22 + domain | ~€4 + ~$12/yr domain |
| DigitalOcean Basic + domain | ~$6 + ~$12/yr domain |
| Backups (recommended) | +€0.90 (Hetzner) or +$1.20 (DO) |

That's it. No vendor fees, no per-deploy charges, no traffic limits inside reasonable bounds.

---

## Help / troubleshooting

| Problem | Where to look |
|---|---|
| Site won't load | `drtea logs` on the VPS, check `drtea health` |
| TLS cert error | Make sure DNS `A` record points to the VPS IP, then `drtea restart` |
| Deploy failed | GitHub Actions tab — opens an issue automatically on failure |
| Rolled back unexpectedly | `drtea logs` shows which deploy failed health check |
| Need to revert manually | `drtea rollback` |
